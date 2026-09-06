// The real help component with synthetic replies. No AI, support, or email service is contacted.
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, webkit } from "playwright";
import { build } from "vite";

const root = fileURLToPath(new URL("../..", import.meta.url));
const outputDir = process.argv[2] ? resolve(process.argv[2]) : null;
if (outputDir) mkdirSync(outputDir, { recursive: true });
const builds = await build({
  root, configFile: false, envFile: false, logLevel: "error",
  define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" },
  resolve: { alias: {
    "next/link": fileURLToPath(import.meta.resolve("vinext/shims/link")),
    "next/navigation": fileURLToPath(import.meta.resolve("vinext/shims/navigation")),
  } },
  build: { write: false, lib: { entry: resolve(root, "tests/e2e/fixtures/help-page.tsx"), name: "HelpPageFixture", formats: ["iife"] } },
});
const bundle = Array.isArray(builds) ? builds[0] : builds;
const assets = new Map(bundle.output.map(asset => ["/" + asset.fileName, asset.type === "chunk" ? asset.code : asset.source]));
const js = bundle.output.find(asset => asset.type === "chunk").fileName;
const css = bundle.output.find(asset => asset.fileName.endsWith(".css")).fileName;
assets.set("/brand-badge.png", readFileSync(resolve(root, "public/brand-badge.png")));
const server = createServer((request, response) => {
  const path = request.url.split("?")[0];
  if (assets.has(path)) {
    response.writeHead(200, { "content-type": path.endsWith(".css") ? "text/css" : path.endsWith(".png") ? "image/png" : "text/javascript" });
    response.end(assets.get(path));
  } else if (request.method === "GET" && ["/ai", "/es/ai"].includes(path)) {
    response.writeHead(200, { "content-type": "text/html" });
    response.end('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/' + css + '"></head><body><div id="root"></div><script src="/' + js + '"></script></body></html>');
  } else {
    response.writeHead(404);
    response.end();
  }
});
await new Promise(done => server.listen(0, "127.0.0.1", done));
const origin = "http://127.0.0.1:" + server.address().port;
const json = (status, body) => ({ status, contentType: "application/json", body: JSON.stringify(body) });
const report = { testedAt: new Date().toISOString(), cases: [] };
const gate = () => { let release; const waitFor = new Promise(done => { release = done; }); return { waitFor, release }; };
const input = page => page.locator(".ai-input");
const sendButton = page => page.locator(".ai-composer button[type=submit]");
const userMessages = page => page.locator(".ai-message-user p");
const answers = page => page.locator(".ai-message-assistant:not(.ai-message-pending) > p");

async function assertReadable(page, selector) {
  const contrasts = await page.locator(selector).evaluateAll(elements => {
    const rgb = color => color.match(/[\d.]+/g).map(Number);
    const luminance = channels => channels.slice(0, 3).map(value => {
      const channel = value / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
    return elements.map(element => {
      const ancestors = [];
      for (let node = element; node; node = node.parentElement) ancestors.unshift(node);
      let background = [255, 255, 255];
      for (const node of ancestors) {
        const color = rgb(getComputedStyle(node).backgroundColor);
        const alpha = color[3] ?? 1;
        background = background.map((value, index) => color[index] * alpha + value * (1 - alpha));
      }
      const style = getComputedStyle(element);
      const light = luminance(rgb(style.color)), dark = luminance(background);
      return { ratio: (Math.max(light, dark) + 0.05) / (Math.min(light, dark) + 0.05), color: style.color, background, fontSize: style.fontSize };
    });
  });
  assert.ok(contrasts.length > 0, selector + " must be rendered");
  for (const contrast of contrasts) assert.ok(contrast.ratio >= 4.5, selector + " must be readable: " + JSON.stringify(contrast));
}

async function submit(page, message) {
  if (message !== undefined) await input(page).fill(message);
  const button = sendButton(page);
  await button.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => new Promise(done => {
    let previous = scrollY;
    let stable = 0;
    function measure() {
      stable = scrollY === previous ? stable + 1 : 0;
      previous = scrollY;
      if (stable >= 3) done(true);
      else requestAnimationFrame(measure);
    }
    requestAnimationFrame(measure);
  }));
  await button.click();
}

try {
  for (const browserType of [chromium, webkit]) {
    const browser = await browserType.launch({ headless: true });
    try {
      for (const spanish of [false, true]) {
        const question = spanish ? "¿Cómo puedo aplicar?" : "How do I apply?";
        const nextQuestion = spanish ? "¿Qué documentos necesito?" : "What documents do I need?";
        const reply = spanish ? "Elija los servicios que ofrece al iniciar su solicitud." : "Choose the services you offer when you start your application.";
        const success = json(200, { reply, mode: "policy-guide", sources: [{ label: "Provider Agreement", href: "/provider-agreement" }] });
        const failure = spanish ? "No pudimos obtener una respuesta. Intente de nuevo o contacte al dueño." : "We couldn't get an answer. Please try again or contact the owner.";
        async function run(name, responses, action, options = {}) {
          const context = await browser.newContext({ viewport: { width: browserType === webkit ? 320 : 390, height: 844 } });
          const page = await context.newPage();
          page.setDefaultTimeout(3000);
          const errors = [], unexpected = [], requests = [];
          page.on("pageerror", error => errors.push(error.message));
          await page.route("**/*", async route => {
            const request = route.request();
            const url = new URL(request.url());
            const isQuestion = url.pathname === "/api/ai" && request.method() === "POST";
            if (url.origin !== origin || (!["GET", "HEAD"].includes(request.method()) && !isQuestion)) {
              unexpected.push(request.method() + " " + request.url());
              return route.abort();
            }
            if (url.pathname === "/api/account") return route.fulfill(json(401, { error: "Synthetic signed-out visitor" }));
            if (url.pathname === "/api/ai" && request.method() === "GET") return route.fulfill(json(200, { mode: options.mode ?? "policy-guide" }));
            if (isQuestion) {
              const index = requests.length;
              requests.push(request.postDataJSON());
              const response = responses[Math.min(index, responses.length - 1)];
              if (response?.waitFor) await response.waitFor;
              if (!response || response.abort) return route.abort("failed").catch(() => {});
              return route.fulfill({ status: response.status, contentType: response.contentType, body: response.body }).catch(() => {});
            }
            return route.continue();
          });
          const result = { browser: browserType.name(), language: spanish ? "es" : "en", name };
          try {
            await page.goto(origin + (spanish ? "/es/ai" : "/ai") + (options.customer ? "" : "?for=provider"));
            await page.locator('.ai-audience-option[aria-pressed="true"]').filter({ hasText: options.customer ? (spanish ? "Necesito" : "I need") : (spanish ? "Yo trabajo" : "I do car") }).waitFor();
            await action(page, requests);
            assert.equal(requests.length, responses.length, "one request for each deliberate question");
            assert.deepEqual(errors, [], "unexpected replies must not crash the help page");
            assert.deepEqual(unexpected, [], "no external or support submissions");
            result.layout = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, threadWidth: document.querySelector('.ai-thread').clientWidth, threadScrollWidth: document.querySelector('.ai-thread').scrollWidth }));
            assert.ok(result.layout.scrollWidth <= result.layout.width, "the page fits a phone");
            assert.ok(result.layout.threadScrollWidth <= result.layout.threadWidth + 1, "answers do not scroll sideways");
            result.status = "passed";
          } catch (error) {
            result.status = "failed";
            result.error = error.stack ?? error.message;
          } finally {
            for (const response of responses) response?.release?.();
            result.requests = requests;
            result.browserErrors = errors;
            if (outputDir && result.status === "failed") await page.screenshot({ path: resolve(outputDir, result.browser + "-" + result.language + "-" + name + ".png"), fullPage: true });
            await context.close();
          }
          report.cases.push(result);
          console.log(result.status.toUpperCase() + " " + result.browser + " " + result.language + " " + name + (result.error ? ": " + result.error : ""));
        }

        await run("visible-language-switch-keeps-provider-context", [], async page => {
          const switchName = spanish ? "Change the whole page to English" : "Cambiar toda la página a español";
          const switchBackName = spanish ? "Cambiar toda la página a español" : "Change the whole page to English";
          assert.equal(await page.getByRole("button", { name: switchName, exact: true }).innerText(), spanish ? "English" : "Español", "the language name is visible on a phone");
          await page.getByRole("button", { name: switchName, exact: true }).click();
          await page.getByRole("button", { name: switchBackName, exact: true }).waitFor();
          assert.equal(await page.locator("html").getAttribute("lang"), spanish ? "en" : "es");
          assert.equal(new URL(page.url()).pathname, "/ai", "Spanish switches in place; leaving an explicit Spanish URL opens its English twin");
          assert.equal(new URL(page.url()).searchParams.get("for"), "provider");
          await page.locator('.ai-audience-option[aria-pressed="true"]').filter({ hasText: spanish ? "I do car" : "Yo trabajo" }).waitFor();
          assert.equal(await page.getByRole("button", { name: switchBackName, exact: true }).innerText(), spanish ? "Español" : "English");
          await page.getByRole("button", { name: switchBackName, exact: true }).click();
          await page.getByRole("button", { name: switchName, exact: true }).waitFor();
          assert.equal(await page.locator("html").getAttribute("lang"), spanish ? "es" : "en");
          assert.equal(new URL(page.url()).searchParams.get("for"), "provider");
          await page.locator('.ai-audience-option[aria-pressed="true"]').filter({ hasText: spanish ? "Yo trabajo" : "I do car" }).waitFor();
        });
        await run("failed-question-retry", [null, success], async (page, requests) => {
          await submit(page, question);
          await page.getByRole("alert").waitFor();
          assert.equal(await input(page).inputValue(), question);
          await submit(page);
          await answers(page).waitFor();
          assert.equal(await userMessages(page).count(), 1, "retry must not duplicate the question");
          assert.deepEqual(requests[1].history, [], "an unanswered attempt is not conversation history");
          assert.equal(requests[1].language, spanish ? "es" : "en");
          assert.equal(requests[1].audience, "provider");
        });
        await run("question-answer-and-error-contrast", [success, json(429, { error: "Synthetic rate limit" })], async page => {
          await input(page).fill(question);
          await assertReadable(page, ".ai-input");
          await assertReadable(page, ".ai-safety-note");
          await submit(page);
          await answers(page).waitFor();
          await assertReadable(page, ".ai-message-user p");
          await assertReadable(page, ".ai-message-assistant > p");
          await submit(page, nextQuestion);
          await page.getByRole("alert").waitFor();
          await assertReadable(page, ".ai-error");
        });
        await run("malformed-reply-recovery", [json(200, { reply: { private: "unexpected" }, mode: "ai" }), { status: 200, contentType: "text/html", body: "<h1>Temporary failure</h1>" }, success], async page => {
          for (let attempt = 0; attempt < 2; attempt++) {
            await submit(page, question);
            await page.getByRole("alert").waitFor();
            assert.equal(await page.getByRole("alert").textContent(), failure);
            assert.equal(await answers(page).count(), 0);
          }
          await submit(page);
          await answers(page).waitFor();
          assert.equal(await userMessages(page).count(), 1);
        });
        await run("safe-sources-and-long-answer", [json(200, { reply: reply + "\n" + "X".repeat(450), mode: "policy-guide", sources: [null, { href: "https://example.test/", label: "External" }, { href: "javascript:alert(1)", label: "Script" }, { href: "/provider-agreement", label: "Provider Agreement" }, { href: "/provider-agreement", label: "Duplicate" }, { href: "/privacy", label: { bad: true } }] })], async page => {
          await submit(page, question);
          await answers(page).waitFor();
          assert.equal(await page.locator('.ai-sources a').count(), 1);
          assert.equal(await page.locator('.ai-sources a').getAttribute('href'), '/provider-agreement');
          assert.equal(await page.locator('.ai-sources a').textContent(), spanish ? 'el Acuerdo del proveedor' : 'Provider Agreement');
        });
        await run("unexpected-source-shape", [json(200, { reply, mode: "policy-guide", sources: { length: 1 } })], async page => {
          await submit(page, question);
          await answers(page).waitFor();
          assert.equal(await answers(page).textContent(), reply);
          assert.equal(await page.locator('.ai-sources a').count(), 0);
        });
        const failedGate = gate();
        await run("failed-answer-keeps-new-draft", [{ abort: true, ...failedGate }, success], async (page, requests) => {
          await submit(page, question);
          await page.locator('.ai-message-pending').waitFor();
          await input(page).fill(nextQuestion);
          failedGate.release();
          await page.getByRole('alert').waitFor();
          assert.equal(await input(page).inputValue(), nextQuestion, "a late failure cannot overwrite the next draft");
          await submit(page);
          await answers(page).waitFor();
          assert.equal(requests[1].message, nextQuestion);
          assert.deepEqual(requests[1].history, []);
        });
        const acceptedGate = gate();
        await run("pending-draft-and-keyboard", [{ ...success, ...acceptedGate }, success], async (page, requests) => {
          await submit(page, question);
          await page.locator('.ai-message-pending').waitFor();
          assert.equal(await page.locator('.ai-audience-option:not(:disabled)').count(), 0, "the current question retains its audience until answered");
          await input(page).fill(nextQuestion);
          acceptedGate.release();
          await answers(page).waitFor();
          assert.equal(await input(page).inputValue(), nextQuestion);
          await input(page).dispatchEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, isComposing: true });
          assert.equal(await sendButton(page).isDisabled(), false, "IME confirmation must not send a question");
          assert.equal(requests.length, 1);
          await input(page).press('Shift+Enter');
          assert.ok((await input(page).inputValue()).includes('\n'));
          await input(page).press('Enter');
          await page.waitForFunction(() => document.querySelectorAll('.ai-message-assistant:not(.ai-message-pending)').length === 2);
          assert.deepEqual(requests[1].history.map(t => ({ role: t.role, content: t.content })), [{ role: 'user', content: question }, { role: 'assistant', content: reply }]);
        });
        const timeoutGate = gate();
        await run("stalled-answer-recovery", [{ ...success, ...timeoutGate }, success], async page => {
          await page.clock.install();
          await input(page).fill(question);
          await input(page).press('Enter');
          await page.locator('.ai-message-pending').waitFor();
          await page.clock.fastForward(46000);
          await page.getByRole('alert').waitFor();
          assert.equal(await input(page).inputValue(), question);
          assert.equal(await sendButton(page).isDisabled(), false);
          timeoutGate.release();
          await page.clock.resume();
          await submit(page);
          await answers(page).waitFor();
        });
        await run("friendly-rate-limit", [json(429, { error: 'PRIVATE_UPSTREAM_ERROR' }), success], async page => {
          await submit(page, question);
          await page.getByRole('alert').waitFor();
          assert.equal(await page.getByRole('alert').textContent(), spanish ? 'Espere un momento antes de volver a preguntar.' : 'Please wait a moment before asking again.');
          await page.getByRole('button', { name: spanish ? 'Contactar al dueño' : 'Contact the owner', exact: true }).click();
          assert.equal(await page.locator('#support-message').inputValue(), question, 'owner handoff keeps the question for review without sending it');
          assert.equal(await page.locator('.ai-support input[type=checkbox]').isChecked(), false);
          await submit(page);
          await answers(page).waitFor();
        });
        await run("vehicle-starter-language", [json(200, { reply, mode: 'ai', sources: [] })], async (page, requests) => {
          const prompt = spanish ? 'Mi carro no arranca y escucho un chasquido.' : "My car won't start and I hear a clicking sound.";
          await page.getByRole('button', { name: prompt, exact: true }).click();
          await answers(page).waitFor();
          assert.equal(requests[0].message, prompt, 'send the prompt in the language actually shown');
          assert.equal(await userMessages(page).textContent(), prompt);
        }, { customer: true, mode: 'ai' });
      }
    } finally { await browser.close(); }
  }
} finally {
  await new Promise(done => server.close(done));
  if (outputDir) writeFileSync(resolve(outputDir, 'report.json'), JSON.stringify(report, null, 2));
}
assert.equal(report.cases.filter(result => result.status === 'failed').length, 0, 'all help-page cases must pass');
