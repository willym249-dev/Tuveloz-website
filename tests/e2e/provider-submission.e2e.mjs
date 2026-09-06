// Actual provider form; synthetic local requests only. No real application, mail, or Places request.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
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
  build: { write: false, lib: { entry: resolve(root, "tests/e2e/fixtures/provider-form.tsx"), name: "ProviderSubmissionFixture", formats: ["iife"] } },
});
const bundle = Array.isArray(builds) ? builds[0] : builds;
const assets = new Map(bundle.output.map(asset => ["/" + asset.fileName, asset.type === "chunk" ? asset.code : asset.source]));
const js = bundle.output.find(asset => asset.type === "chunk").fileName;
const css = bundle.output.find(asset => asset.fileName.endsWith(".css")).fileName;
const server = createServer((request, response) => {
  const path = request.url.split("?")[0];
  if (assets.has(path)) {
    response.writeHead(200, { "content-type": path.endsWith(".css") ? "text/css" : "text/javascript" });
    response.end(assets.get(path));
  } else if (request.method === "GET" && ["/join", "/es/join"].includes(path)) {
    response.writeHead(200, { "content-type": "text/html" });
    response.end('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/' + css + '"></head><body><div id="root"></div><script src="/' + js + '"></script></body></html>');
  } else { response.writeHead(404); response.end(); }
});
await new Promise(done => server.listen(0, "127.0.0.1", done));
const origin = "http://127.0.0.1:" + server.address().port;
const json = body => ({ status: 202, contentType: "application/json", body: JSON.stringify(body) });
const gate = () => { let release; const waitFor = new Promise(done => { release = done; }); return { waitFor, release }; };
const draftKey = "tuveloz-provider-signup-draft-v1";
const draft = {
  step: 3, selectedProviderServices: ["photo_documentation_only"], soloBusiness: true,
  selectedProviderWorkLocations: ["I travel to customers"],
  fields: { "provider-email": "provider-fixture@example.test", "performing-person-first-name": "Example", "performing-person-last-name": "Fixture", "business-municipality": "Rockville" },
};
const challenge = json({ ok: true, challengeId: "fixture-code-1", expiresInSeconds: 600 });
const complete = json({ ok: true, onboardingUrl: "/provider-onboarding" });
const report = { testedAt: new Date().toISOString(), cases: [] };
const code = page => page.locator('[name="provider-verification-code"]');
const submit = page => page.locator('.provider-form button[type="submit"]');
const sendAgain = page => page.getByRole("button", { name: /^(Send the code again|Enviar el código de nuevo)$/ });
const address = page => page.locator('[name="business-service-address"]');
const options = page => page.locator("datalist option").evaluateAll(nodes => nodes.map(node => node.value));
async function confirm(page) {
  // Native Enter submits the form without depending on smooth scroll timing.
  await page.locator('input[name="performing-person-first-name"]').press("Enter");
  await page.locator(".action-confirm").waitFor();
  await page.locator(".action-confirm button[type=submit]").press("Enter");
}
async function savedDetails(page) {
  assert.equal(await page.locator('input[name="performing-person-first-name"]').inputValue(), "Example");
  assert.equal(await page.evaluate(key => JSON.parse(localStorage.getItem(key))?.fields?.["provider-email"], draftKey), draft.fields["provider-email"]);
  assert.equal(await page.locator(".provider-success").count(), 0);
}
async function errorShown(page, language) {
  const alert = page.getByRole("alert");
  await alert.waitFor();
  assert.match(await alert.innerText(), language === "es" ? /No pudimos confirmar/ : /We couldn't confirm/);
}

try {
  for (const browserType of [chromium, webkit]) {
    const browser = await browserType.launch({ headless: true });
    try {
      for (const language of ["en", "es"]) {
        async function run(name, action) {
          const context = await browser.newContext({ viewport: { width: language === "es" ? 320 : 390, height: 844 } });
          const page = await context.newPage();
          page.setDefaultTimeout(2500);
          const requests = [], outside = [], errors = [], gates = [];
          const queues = { challenge: [], application: [], address: [] };
          const result = { browser: browserType.name(), language, name };
          page.on("pageerror", error => errors.push(error.message));
          await context.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: draftKey, value: draft });
          await page.route("**/*", async route => {
            const request = route.request();
            const url = new URL(request.url());
            if (url.origin !== origin) { outside.push(request.url()); return route.abort(); }
            if (url.pathname === "/api/analytics") return route.fulfill({ status: 204 });
            const stage = url.pathname === "/api/providers/challenge" ? "challenge" : url.pathname === "/api/providers" ? "application" : url.pathname === "/api/places/autocomplete" ? "address" : null;
            if (stage) {
              requests.push({ stage, body: stage === "address" ? url.searchParams.get("input") : request.postDataJSON() });
              const reply = queues[stage].shift() ?? (stage === "challenge" ? challenge : stage === "application" ? complete : json({ suggestions: [] }));
              if (reply.waitFor) { gates.push(reply); await reply.waitFor; }
              await route.fulfill({ status: reply.status, contentType: reply.contentType, body: reply.body }).catch(() => {});
              return;
            }
            if (request.method() !== "GET") { outside.push(request.method() + " " + request.url()); return route.abort(); }
            return route.continue();
          });
          try {
            await page.goto(origin + (language === "es" ? "/es" : "") + "/join");
            await page.locator('[data-signup-step="3"]').waitFor();
            await page.waitForFunction(() => document.activeElement?.matches('[data-signup-step="3"]'));
            for (const input of await page.locator('input[type="checkbox"][required]').all()) await input.check();
            await action(page, queues, requests);
            assert.deepEqual(errors, [], "no browser or React crashes");
            assert.deepEqual(outside, [], "no external or unexpected requests");
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "form fits the phone");
            result.status = "passed";
          } catch (error) { result.status = "failed"; result.error = error.stack ?? error.message; }
          finally {
            for (const pending of gates) pending.release();
            result.requests = requests;
            result.browserErrors = errors;
            if (outputDir && result.status === "failed") await page.screenshot({ path: resolve(outputDir, result.browser + "-" + language + "-" + name + ".png"), fullPage: true }).catch(() => {});
            await context.close();
          }
          report.cases.push(result);
          console.log(result.status.toUpperCase() + " " + result.browser + " " + language + " " + name + (result.error ? ": " + result.error : ""));
        }

        await run("completion-requires-receipt", async (page, queues) => {
          queues.application.push(...[{}, [], { ok: false }, { ok: "true" }, { ok: true, onboardingUrl: {} }].map(json));
          await confirm(page);
          await code(page).fill("123456");
          for (let attempt = 0; attempt < 5; attempt++) {
            await code(page).press("Enter");
            await errorShown(page, language);
            await savedDetails(page);
            assert.equal(await code(page).inputValue(), "123456");
          }
          await code(page).press("Enter");
          await page.locator(".provider-success").waitFor();
          assert.equal(await page.evaluate(key => localStorage.getItem(key), draftKey), null);
        });

        await run("challenge-requires-valid-id", async (page, queues) => {
          queues.challenge.push(...[{ ok: true, challengeId: {} }, { challengeId: "fixture-code" }, { ok: false, challengeId: "fixture-code" }, { ok: true, challengeId: "   " }].map(json));
          for (let attempt = 0; attempt < 4; attempt++) {
            await confirm(page);
            await errorShown(page, language);
            assert.equal(await code(page).count(), 0);
            await savedDetails(page);
          }
          await confirm(page);
          await code(page).waitFor();
        });

        await run("invalid-resend-preserves-code", async (page, queues, requests) => {
          await confirm(page);
          await code(page).fill("123456");
          queues.challenge.push(json({ ok: true, challengeId: {} }));
          await sendAgain(page).press("Enter");
          await errorShown(page, language);
          assert.equal(await code(page).inputValue(), "123456");
          await code(page).press("Enter");
          await page.locator(".provider-success").waitFor();
          assert.equal(requests.find(item => item.stage === "application").body.challengeId, "fixture-code-1");
        });

        for (const stage of ["challenge", "application"]) {
          await run("stalled-" + stage, async (page, queues, requests) => {
            if (stage === "application") { await confirm(page); await code(page).fill("123456"); }
            await page.clock.install();
            const pending = { ...(stage === "challenge" ? challenge : complete), ...gate() };
            queues[stage].push(pending);
            if (stage === "challenge") await confirm(page);
            else await code(page).press("Enter");
            await submit(page).filter({ hasText: /Sending|Enviando|Verifying|Verificando/ }).waitFor();
            const detailsLocked = await page.locator('[name="performing-person-first-name"]').isDisabled();
            await page.clock.fastForward(46000);
            await errorShown(page, language);
            await savedDetails(page);
            assert.equal(detailsLocked, true, "details cannot change while the submitted version is awaiting a reply");
            assert.equal(await page.locator('[name="performing-person-first-name"]').isEnabled(), true);
            assert.equal(requests.filter(item => item.stage === stage).length, 1, "no automatic resubmission");
            pending.release();
            await page.clock.resume();
            if (stage === "challenge") { await confirm(page); await code(page).waitFor(); }
            else { await code(page).press("Enter"); await page.locator(".provider-success").waitFor(); }
          });
        }

        await run("malformed-address-suggestions", async (page, queues) => {
          await page.locator('[name="provider-work-location"][value="Customers come to my business"]').check();
          queues.address.push(json({ suggestions: {} }));
          const received = page.waitForResponse(response => response.url().includes("/api/places/autocomplete"));
          await address(page).fill("100 Example Street");
          await received;
          await page.waitForTimeout(100);
          assert.equal(await address(page).inputValue(), "100 Example Street");
          assert.deepEqual(await options(page), []);
          queues.address.push(json({ suggestions: [null, {}, "200 Example Street", "200 Example Street"] }));
          const next = page.waitForResponse(response => response.url().includes("/api/places/autocomplete"));
          await address(page).fill("200 Example");
          await next;
          await page.waitForFunction(() => [...document.querySelectorAll("datalist option")].some(option => option.value === "200 Example Street"));
          assert.deepEqual(await options(page), ["200 Example Street"]);
        });

        await run("late-address-reply", async (page, queues, requests) => {
          await page.locator('[name="provider-work-location"][value="Customers come to my business"]').check();
          const older = { ...json({ suggestions: ["100 Old Result"] }), ...gate() };
          queues.address.push(older, json({ suggestions: ["200 Current Result"] }));
          await address(page).fill("100 Old");
          await page.waitForRequest(request => request.url().includes("input=100"));
          await address(page).fill("200 Current");
          await page.waitForFunction(() => document.querySelector("datalist option")?.value === "200 Current Result");
          older.release();
          await page.waitForTimeout(100);
          assert.deepEqual(await options(page), ["200 Current Result"]);
          assert.equal(requests.filter(item => item.stage === "address").length, 2);
          const clearing = { ...json({ suggestions: ["300 Cleared Result"] }), ...gate() };
          queues.address.push(clearing);
          await address(page).fill("300 Clear");
          await page.waitForRequest(request => request.url().includes("input=300"));
          await address(page).fill("");
          clearing.release();
          await page.waitForTimeout(100);
          assert.deepEqual(await options(page), []);
          assert.equal(await address(page).inputValue(), "");
        });
      }
    } finally { await browser.close(); }
  }
} finally {
  await new Promise(done => server.close(done));
  if (outputDir) writeFileSync(resolve(outputDir, "report.json"), JSON.stringify(report, null, 2));
}
assert.equal(report.cases.filter(item => item.status === "failed").length, 0, "all provider submission cases pass");
