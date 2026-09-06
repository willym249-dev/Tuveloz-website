// Real account UI, synthetic requests only. No credentials, messages, or accounts leave loopback.
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
  build: { write: false, lib: { entry: resolve(root, "tests/e2e/fixtures/account-form.tsx"), name: "AccountFormFixture", formats: ["iife"] } },
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
  } else if (request.method === "GET" && path === "/account") {
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
const gate = () => { let release; const waitFor = new Promise(done => { release = done; }); return { waitFor, release }; };
const email = "account-fixture@example.test";
const password = "FixtureOnly!2026";
const report = { testedAt: new Date().toISOString(), cases: [] };
const form = page => page.locator(".account-login-form");
const submit = page => form(page).locator('button[type="submit"]');
const codeInput = page => form(page).locator('input[autocomplete="one-time-code"]');
async function fillPassword(page) {
  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
}
async function pressSubmit(page) {
  await form(page).locator("input").last().press("Enter");
}

try {
  for (const browserType of [chromium, webkit]) {
    const browser = await browserType.launch({ headless: true });
    try {
      for (const role of ["customer", "provider"]) {
        const challenge = json(200, { ok: true, challengeRequired: true, message: "Enter the 6-digit code sent to your email to finish signing in." });
        async function run(name, responses, action, options = {}) {
          const context = await browser.newContext({ viewport: { width: browserType === webkit ? 320 : 390, height: 844 } });
          const page = await context.newPage();
          page.setDefaultTimeout(2500);
          const errors = [], unexpected = [], requests = [];
          page.on("pageerror", error => errors.push(error.message));
          await page.route("**/*", async route => {
            const request = route.request();
            const url = new URL(request.url());
            if (url.origin !== origin) { unexpected.push(request.method() + " " + request.url()); return route.abort(); }
            if (url.pathname === "/api/analytics") return route.fulfill({ status: 204 });
            if (url.pathname === "/api/auth/options") return route.fulfill(json(200, { phoneSignIn: true }));
            if (url.pathname === "/api/account") {
              if (options.sessionGate) await options.sessionGate.waitFor;
              return route.fulfill(json(401, { error: "Synthetic signed-out visitor" })).catch(() => {});
            }
            if (url.pathname.startsWith("/api/auth/") && request.method() === "POST") {
              const index = requests.length;
              requests.push({ path: url.pathname, body: request.postDataJSON() });
              const response = responses[Math.min(index, responses.length - 1)];
              if (response?.waitFor) await response.waitFor;
              if (!response) return route.abort("failed").catch(() => {});
              return route.fulfill({ status: response.status, contentType: response.contentType, body: response.body }).catch(() => {});
            }
            if (!["GET", "HEAD"].includes(request.method())) { unexpected.push(request.method() + " " + request.url()); return route.abort(); }
            return route.continue();
          });
          const result = { browser: browserType.name(), role, name };
          try {
            if (options.clock) await page.clock.install();
            await page.goto(origin + "/account?role=" + role + "&mode=" + (options.mode ?? "signin"));
            await page.locator('.account-role-tabs button[aria-pressed="true"]').filter({ hasText: role === "provider" ? "Provider" : "Customer" }).waitFor();
            await action(page, requests);
            assert.deepEqual(errors, [], "no account-page render crashes");
            assert.deepEqual(unexpected, [], "no external requests or unexpected mutations");
            result.layout = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
            assert.ok(result.layout.scrollWidth <= result.layout.width, "account controls fit the phone");
            result.status = "passed";
          } catch (error) {
            result.status = "failed";
            result.error = error.stack ?? error.message;
          } finally {
            options.sessionGate?.release();
            for (const response of responses) response?.release?.();
            result.requests = requests;
            result.browserErrors = errors;
            if (outputDir && result.status === "failed") await page.screenshot({ path: resolve(outputDir, result.browser + "-" + role + "-" + name + ".png"), fullPage: true });
            await context.close();
          }
          report.cases.push(result);
          console.log(result.status.toUpperCase() + " " + result.browser + " " + role + " " + name + (result.error ? ": " + result.error : ""));
        }

        const sessionGate = gate();
        await run("stalled-session-check", [], async page => {
          await page.clock.fastForward(16000);
          await page.waitForFunction(() => !document.querySelector('input[name="email"]').disabled);
          assert.equal(await submit(page).isEnabled(), true, "a stalled session lookup must not lock sign-in forever");
        }, { sessionGate, clock: true });

        const requestGate = gate();
        await run("stalled-password-request", [{ ...challenge, ...requestGate }, challenge], async page => {
          await fillPassword(page);
          await pressSubmit(page);
          await page.getByRole("button", { name: "Signing in…", exact: true }).waitFor();
          await page.clock.fastForward(46000);
          await page.getByRole("alert").waitFor();
          assert.equal(await page.getByLabel("Password", { exact: true }).inputValue(), password);
          assert.equal(await submit(page).isEnabled(), true);
          requestGate.release();
          await page.clock.resume();
          await pressSubmit(page);
          await codeInput(page).waitFor();
        }, { clock: true });

        await run("malformed-error-retry", [json(500, { error: { private: "Not display text" } }), challenge], async page => {
          await fillPassword(page);
          await pressSubmit(page);
          await page.getByRole("alert").waitFor();
          assert.equal(await page.getByLabel("Email address", { exact: true }).inputValue(), email);
          await pressSubmit(page);
          await codeInput(page).waitFor();
        });

        for (const mode of ["create", "reset", "code", "phone"]) {
          await run(mode + "-invalid-confirmation", [json(200, { ok: true, message: { unexpected: true } }), json(200, []), json(200, {}), json(200, { ok: false }), json(200, { ok: true, message: "Check for your verification code." })], async (page, requests) => {
            if (mode === "phone") {
              await page.getByRole("button", { name: "Text me a one-time code instead", exact: true }).click();
              await page.getByLabel("Mobile phone number", { exact: true }).fill("2025550123");
              await page.locator('input[name="phone-consent"]').check();
            } else {
              await page.getByLabel("Email address", { exact: true }).fill(email);
              if (mode === "create" || mode === "reset") {
                await page.getByLabel(mode === "create" ? "Create password" : "New password", { exact: true }).fill(password);
                await page.getByLabel("Confirm password", { exact: true }).fill(password);
                if (mode === "create") await page.locator('input[name="policy-consent"]').check();
              }
            }
            for (let attempt = 0; attempt < 4; attempt++) {
              await pressSubmit(page);
              await page.getByRole("alert").waitFor();
              assert.equal(await codeInput(page).count(), 0, "a malformed reply cannot confirm that a code was requested");
              assert.equal(await submit(page).isEnabled(), true);
            }
            await pressSubmit(page);
            await codeInput(page).waitFor();
            assert.equal(requests.length, 5);
            if (mode !== "phone") assert.equal(requests[4].body.role, role);
          }, { mode: mode === "phone" ? "signin" : mode });
        }

        await run("invalid-verification-destination", [challenge, json(200, { destination: { invalid: true } })], async page => {
          await fillPassword(page);
          await pressSubmit(page);
          await codeInput(page).fill("123456");
          await pressSubmit(page);
          await page.getByRole("alert").waitFor();
          assert.equal(new URL(page.url()).pathname, "/account");
          assert.equal(await codeInput(page).inputValue(), "123456");
          assert.equal(await submit(page).isEnabled(), true);
        });
      }
    } finally { await browser.close(); }
  }
} finally {
  await new Promise(done => server.close(done));
  if (outputDir) writeFileSync(resolve(outputDir, "report.json"), JSON.stringify(report, null, 2));
}
assert.equal(report.cases.filter(result => result.status === "failed").length, 0, "all account-form cases must pass");
