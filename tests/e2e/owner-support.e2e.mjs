// Real help/contact components with loopback-only synthetic support replies.
// No messages are sent to the owner, an email service, or an AI service.
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
  build: { write: false, lib: { entry: resolve(root, "tests/e2e/fixtures/help-page.tsx"), name: "SupportFixture", formats: ["iife"] } },
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
  } else { response.writeHead(404); response.end(); }
});
await new Promise(done => server.listen(0, "127.0.0.1", done));
const origin = "http://127.0.0.1:" + server.address().port;
const json = (status, body) => ({ status, contentType: "application/json", body: JSON.stringify(body) });
const success = payload => json(202, { ok: true, status: "queued", reference: payload.requestId });
const gate = () => { let release; const waitFor = new Promise(done => { release = done; }); return { waitFor, release }; };
const report = { testedAt: new Date().toISOString(), cases: [] };
const email = "visitor@example.test";

try {
  for (const browserType of [chromium, webkit]) {
    const browser = await browserType.launch({ headless: true });
    try {
      for (const spanish of [false, true]) {
        const message = spanish ? "¿Qué documentos necesito para ofrecer limpieza de interiores?" : "Which documents do I need to offer interior cleaning?";
        const edited = spanish ? "Quiero revisar mi solicitud de proveedor." : "I would like to review my provider application.";
        const toggle = page => page.getByRole("button", { name: spanish ? "Contactar al dueño" : "Contact the owner", exact: true });
        const form = page => page.locator("form.ai-support");
        const receipt = page => page.locator("div.ai-support[role=status]");
        const alert = page => page.locator(".ai-support [role=alert]");
        const failure = spanish ? "No pudimos confirmar la recepción. Su mensaje sigue aquí. Revise su conexión e intente de nuevo." : "We couldn't confirm receipt. Your message is still here. Check your connection and try again.";
        async function submit(page) {
          await page.locator("#support-email").press("Enter");
        }
        async function retained(page, expectedMessage = message) {
          assert.equal(await page.locator("#support-email").inputValue(), email);
          assert.equal(await page.locator("#support-message").inputValue(), expectedMessage);
          assert.equal(await form(page).getByRole("checkbox").isChecked(), true);
          assert.equal(await form(page).getByRole("button", { name: spanish ? "Enviar al dueño" : "Send to the owner", exact: true }).isEnabled(), true);
        }
        async function run(name, responses, action) {
          const context = await browser.newContext({ viewport: { width: browserType === webkit ? 320 : 390, height: 844 }, reducedMotion: "reduce" });
          const page = await context.newPage();
          page.setDefaultTimeout(3000);
          const errors = [], unexpected = [], requests = [];
          page.on("pageerror", error => errors.push(error.message));
          await page.route("**/*", async route => {
            const request = route.request(), url = new URL(request.url());
            const isSupport = url.pathname === "/api/support" && request.method() === "POST";
            if (url.origin !== origin || (!["GET", "HEAD"].includes(request.method()) && !isSupport)) {
              unexpected.push(request.method() + " " + request.url());
              return route.abort();
            }
            if (url.pathname === "/api/account") return route.fulfill(json(401, { error: "Synthetic signed-out visitor" }));
            if (url.pathname === "/api/ai") return route.fulfill(json(200, { mode: "policy-guide" }));
            if (isSupport) {
              const payload = request.postDataJSON();
              const index = requests.length;
              requests.push(payload);
              const planned = responses[Math.min(index, responses.length - 1)];
              const response = typeof planned === "function" ? planned(payload) : planned;
              if (response?.waitFor) await response.waitFor;
              if (!response) return route.abort("failed").catch(() => {});
              return route.fulfill({ status: response.status, contentType: response.contentType, body: response.body }).catch(() => {});
            }
            return route.continue();
          });
          const result = { browser: browserType.name(), language: spanish ? "es" : "en", name };
          try {
            await page.goto(origin + (spanish ? "/es/ai" : "/ai") + "?for=provider");
            await page.locator('.ai-audience-option[aria-pressed="true"]').filter({ hasText: spanish ? "Yo trabajo" : "I do car" }).waitFor();
            await page.locator(".ai-input").fill(message);
            await toggle(page).click();
            assert.equal(await page.locator("#support-message").inputValue(), message);
            assert.equal(await form(page).getByRole("checkbox").isChecked(), false, "contact consent starts unchecked");
            await page.locator("#support-email").fill(email);
            await form(page).getByRole("checkbox").check();
            await action(page, requests);
            assert.equal(requests.length, responses.length, "one request for each deliberate send, no automatic retries");
            assert.deepEqual(errors, [], "contact form must not crash");
            assert.deepEqual(unexpected, [], "only loopback fixture requests are allowed");
            for (const request of requests) {
              assert.equal(request.consent, true);
              assert.equal(request.audience, "provider");
              assert.equal(request.history, undefined, "chat history is not sent");
              assert.match(request.requestId, /^[0-9a-f-]{36}$/i);
            }
            result.layout = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
            assert.ok(result.layout.scrollWidth <= result.layout.width, "contact form fits a phone");
            result.status = "passed";
          } catch (error) {
            result.status = "failed";
            result.error = error.stack ?? error.message;
          } finally {
            for (const response of responses) response?.release?.();
            result.requestCount = requests.length;
            result.browserErrors = errors;
            if (outputDir && result.status === "failed") await page.screenshot({ path: resolve(outputDir, result.browser + "-" + result.language + "-" + name + ".png"), fullPage: true });
            await context.close();
          }
          report.cases.push(result);
          console.log(result.status.toUpperCase() + " " + result.browser + " " + result.language + " " + name + (result.error ? ": " + result.error : ""));
        }

        await run("unconfirmed-receipts", [
          json(202, {}),
          payload => json(202, { status: "queued", reference: payload.requestId }),
          payload => json(202, { ok: false, status: "queued", reference: payload.requestId }),
          json(202, { ok: true, status: "queued", reference: "different-message" }),
          json(202, { ok: true, status: "queued", reference: { unexpected: true } }),
          { status: 200, contentType: "text/html", body: "<h1>Temporary failure</h1>" },
          success,
        ], async (page, requests) => {
          for (let attempt = 0; attempt < 6; attempt++) {
            await submit(page);
            await alert(page).waitFor();
            assert.equal(await alert(page).textContent(), failure);
            assert.equal(await receipt(page).count(), 0, "only this message's valid receipt can show success");
            await retained(page);
          }
          await submit(page);
          await receipt(page).waitFor();
          assert.equal(new Set(requests.map(item => item.requestId)).size, 1, "unchanged retries retain their deduplication reference");
        });
        await run("malformed-error-recovery", [json(500, { error: { private: "internal detail" } }), success], async page => {
          await submit(page);
          await alert(page).waitFor();
          assert.equal(await alert(page).textContent(), failure);
          await retained(page);
          await submit(page);
          await receipt(page).waitFor();
        });
        await run("network-retry-keeps-reference", [null, success], async (page, requests) => {
          await submit(page);
          await alert(page).waitFor();
          await retained(page);
          await submit(page);
          await receipt(page).waitFor();
          assert.deepEqual(requests[1], requests[0]);
        });
        const stalled = gate();
        await run("stalled-send-recovery", [{ ...json(202, {}), ...stalled }, success], async (page, requests) => {
          await page.clock.install();
          await submit(page);
          await form(page).getByRole("button", { name: spanish ? "Guardando…" : "Saving…", exact: true }).waitFor();
          assert.equal(await page.locator("#support-message").isDisabled(), true);
          await page.clock.fastForward(46000);
          await alert(page).waitFor();
          await retained(page);
          stalled.release();
          await page.clock.resume();
          await submit(page);
          await receipt(page).waitFor();
          assert.deepEqual(requests[1], requests[0]);
        });
        await run("collapse-keeps-reviewed-message", [], async page => {
          await page.locator("#support-message").fill(edited);
          await toggle(page).click();
          assert.equal(await form(page).isVisible(), false);
          await page.locator(".ai-input").fill("Another question that must not replace the reviewed message.");
          await toggle(page).click();
          await retained(page, edited);
        });
        const pending = gate();
        await run("pending-collapse-keeps-one-send", [payload => ({ ...success(payload), ...pending })], async page => {
          try {
            await submit(page);
            await form(page).getByRole("button", { name: spanish ? "Guardando…" : "Saving…", exact: true }).waitFor();
            await toggle(page).click();
            await toggle(page).click();
            assert.equal(await page.locator("#support-message").isDisabled(), true, "reopening must not start a second form during the original send");
            pending.release();
            await receipt(page).waitFor();
          } finally { pending.release(); }
        });
        await run("changed-message-new-reference", [null, success], async (page, requests) => {
          await submit(page);
          await alert(page).waitFor();
          await page.locator("#support-message").fill(edited);
          await submit(page);
          await receipt(page).waitFor();
          assert.notEqual(requests[1].requestId, requests[0].requestId);
          assert.equal(requests[1].message, edited);
        });
        await run("friendly-errors-follow-language", [json(429, { error: "PRIVATE_ERROR" }), json(400, { error: "PRIVATE_ERROR" }), success], async page => {
          await submit(page);
          await alert(page).waitFor();
          assert.equal(await alert(page).textContent(), spanish ? "Espere una hora antes de enviar otro mensaje, o escriba a hello@tuveloz.com." : "Please wait an hour before sending another message, or email hello@tuveloz.com.");
          await page.getByRole("button", { name: spanish ? "Change the whole page to English" : "Cambiar toda la página a español", exact: true }).click();
          // Explicit /es URLs navigate when switched to English; check in-place
          // changes on English URLs and leave navigation coverage to help-page.
          if (spanish) {
            await page.getByRole("button", { name: "Cambiar toda la página a español", exact: true }).waitFor();
            await page.locator(".ai-input").fill(message);
            await page.getByRole("button", { name: "Contact the owner", exact: true }).click();
            await page.locator("#support-email").fill(email);
            await form(page).getByRole("checkbox").check();
          } else {
            assert.equal(await alert(page).textContent(), "Espere una hora antes de enviar otro mensaje, o escriba a hello@tuveloz.com.");
          }
          await submit(page);
          await alert(page).waitFor();
          assert.equal(await alert(page).textContent(), spanish ? "Check your email and message, and confirm you want to send them to the owner." : "Revise su correo y mensaje, y confirme que desea enviarlos al dueño.");
          await submit(page);
          await receipt(page).waitFor();
        });
        await run("success-collapse-keeps-receipt", [success], async page => {
          await submit(page);
          await receipt(page).waitFor();
          const reference = await receipt(page).locator("code").textContent();
          await toggle(page).click();
          await toggle(page).click();
          await receipt(page).waitFor();
          assert.equal(await receipt(page).locator("code").textContent(), reference);
          assert.equal(await form(page).count(), 0, "reopening a saved message must not offer a second send");
        });
      }
    } finally { await browser.close(); }
  }
} finally {
  await new Promise(done => server.close(done));
  if (outputDir) writeFileSync(resolve(outputDir, "report.json"), JSON.stringify(report, null, 2));
}
assert.equal(report.cases.filter(result => result.status === "failed").length, 0, "all contact recovery scenarios must pass");
