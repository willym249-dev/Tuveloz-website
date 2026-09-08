// Real About-page forms. All submissions are intercepted; no messages or records leave loopback.
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
  build: { write: false, lib: { entry: resolve(root, "tests/e2e/fixtures/about-forms.tsx"), name: "AboutFormsFixture", formats: ["iife"] } },
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
  } else if (request.method === "GET" && ["/about", "/es/about"].includes(path)) {
    response.writeHead(200, { "content-type": "text/html" });
    response.end('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/' + css + '"></head><body><div id="root"></div><script src="/' + js + '"></script></body></html>');
  } else {
    response.writeHead(404);
    response.end();
  }
});
await new Promise(done => server.listen(0, "127.0.0.1", done));
const origin = "http://127.0.0.1:" + server.address().port;
const json = (status, body) => ({ status, contentType: "application/json", body: JSON.stringify(body) });
const report = { testedAt: new Date().toISOString(), cases: [] };
const receipt = json(201, { ok: true });
const email = "about-audit@example.test";
const formFor = (page, kind) => page.locator(`.${kind}-form`);
async function fill(page, kind) {
  const form = formFor(page, kind);
  if (kind === "expansion") {
    await form.locator('input[value="Provider"]').check();
    await form.locator('select[name="expansion-provider-type"]').selectOption("Mobile detailer");
    await form.locator('select[name="expansion-state"]').selectOption("Maryland");
    await form.locator('input[name="expansion-locality"]').fill("Howard County");
  } else {
    await form.locator('select[name="audience"]').selectOption("Provider");
    for (const name of ["jobs-wanted", "provider-features", "customer-improvements"]) {
      await form.locator(`input[name="${name}"]`).first().check();
    }
  }
  await form.locator(`input[name="${kind}-email"]`).fill(email);
}
async function send(page, kind) {
  const form = formFor(page, kind);
  await form.locator('button[type="submit"]').click();
  if (kind === "feedback") await form.locator('.action-confirm button[type="submit"]').click();
}
try {
  for (const type of [chromium, webkit]) {
    const browser = await type.launch();
    try {
      for (const spanish of [false, true]) {
        for (const kind of ["expansion", "feedback"]) {
          for (const scenario of ["missing-receipt", "malformed-receipt", "private-error", "rate-limit", "stalled-request", "confirmation-and-reset"]) {
            if (process.env.ABOUT_FORM_CASE && scenario !== process.env.ABOUT_FORM_CASE) continue;
            const context = await browser.newContext({ viewport: { width: spanish ? 320 : 390, height: 844 } });
            const page = await context.newPage();
            page.setDefaultTimeout(3000);
            const errors = [], requests = [], unexpected = [];
            let release;
            const gate = new Promise(done => { release = done; });
            page.on("pageerror", error => errors.push(error.message));
            await page.route("**/*", async route => {
              const request = route.request(), url = new URL(request.url());
              if (url.origin !== origin) { unexpected.push(request.url()); return route.abort(); }
              if (url.pathname === "/api/analytics") return route.fulfill({ status: 204 });
              if (url.pathname === "/api/account") return route.fulfill(json(401, { error: "Signed out fixture" }));
              if (url.pathname === "/api/owner-access") return route.fulfill(json(200, { isOwner: false }));
              if (url.pathname === (kind === "feedback" ? "/api/feedback" : "/api/expansion-interest") && request.method() === "POST") {
                requests.push(request.postDataJSON());
                let response = receipt;
                if (requests.length === 1) {
                  if (scenario === "missing-receipt") response = json(200, { ok: false });
                  if (scenario === "malformed-receipt") response = { status: 200, contentType: "text/html", body: "<html>Unexpected reply</html>" };
                  if (scenario === "private-error") response = json(500, { error: "PRIVATE_DATABASE_ERROR" });
                  if (scenario === "rate-limit") response = json(429, { error: "PRIVATE_RATE_ERROR" });
                  if (scenario === "stalled-request") await gate;
                }
                return route.fulfill(response).catch(() => {});
              }
              if (!["GET", "HEAD"].includes(request.method())) { unexpected.push(request.method() + " " + request.url()); return route.abort(); }
              return route.continue();
            });
            const result = { browser: type.name(), language: spanish ? "es" : "en", kind, scenario };
            try {
              if (scenario === "stalled-request") await page.clock.install();
              await page.goto(origin + (spanish ? "/es/about" : "/about"));
              await page.locator(".site-language-button").waitFor();
              const form = formFor(page, kind);
              await fill(page, kind);
              if (scenario === "confirmation-and-reset") {
                if (kind === "feedback") {
                  await form.locator('button[type="submit"]').click();
                  assert.equal(requests.length, 0, "review does not send feedback");
                  await form.locator('.action-confirm button[type="button"]').click();
                  assert.equal(await form.locator(".action-confirm").count(), 0, "Back returns to editing");
                }
                await send(page, kind);
              } else {
                await send(page, kind);
                if (scenario === "stalled-request") {
                  await page.waitForFunction(selector => document.querySelector(selector)?.disabled, `.${kind}-form button[type="submit"]`);
                  await page.clock.fastForward(46000);
                }
                await form.getByRole("alert").waitFor();
                assert.equal(await form.locator(".success-message").count(), 0, "no false success");
                const message = await form.getByRole("alert").innerText();
                assert.doesNotMatch(message, /PRIVATE_|SyntaxError|JSON|Unexpected/);
                assert.match(message, spanish ? /Intente|Espere/ : /try again/);
                assert.equal(await form.locator(`input[name="${kind}-email"]`).inputValue(), email, "keep details for retry");
                assert.ok(await form.locator('button[type="submit"]').isEnabled(), "retry available");
                release();
                if (scenario === "stalled-request") await page.clock.resume();
                await send(page, kind);
                assert.deepEqual(requests[1], requests[0], "retry keeps the entered answers");
              }
              await form.locator(".success-message").waitFor();
              await form.locator('.success-message button[type="button"]').click();
              assert.equal(await form.locator(`input[name="${kind}-email"]`).inputValue(), "", "start another response with a clean form");
              if (kind === "expansion") assert.equal(await form.locator('select[name="expansion-provider-type"]').count(), 0);
              assert.equal(requests.length, scenario === "confirmation-and-reset" ? 1 : 2);
              assert.deepEqual(errors, []);
              assert.deepEqual(unexpected, []);
              assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "fits a phone");
              result.status = "passed";
            } catch (error) {
              result.status = "failed";
              result.error = error.message;
            } finally {
              release();
              result.requests = requests.length;
              report.cases.push(result);
              if (outputDir) writeFileSync(resolve(outputDir, "report.json"), JSON.stringify(report, null, 2));
              await context.close();
            }
            console.log(JSON.stringify(result));
          }
        }
      }
    } finally { await browser.close(); }
  }
} finally { await new Promise(done => server.close(done)); }
assert.equal(report.cases.filter(result => result.status === "failed").length, 0, "all About forms recover and confirm acceptance");

