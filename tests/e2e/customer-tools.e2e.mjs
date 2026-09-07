// Real account component; all account data and writes stay in this loopback fixture.
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
  build: { write: false, lib: { entry: resolve(root, "tests/e2e/fixtures/customer-tools.tsx"), name: "CustomerToolsFixture", formats: ["iife"] } },
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
  } else if (request.method === "GET" && path === "/customer") {
    response.writeHead(200, { "content-type": "text/html" });
    response.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/${css}"></head><body><div id="root"></div><script src="/${js}"></script></body></html>`);
  } else { response.writeHead(404); response.end(); }
});
await new Promise(done => server.listen(0, "127.0.0.1", done));
const origin = `http://127.0.0.1:${server.address().port}`;
const json = (status, body) => ({ status, contentType: "application/json", body: JSON.stringify(body) });
const profile = { email: "customer@example.test", displayName: "Example Customer", municipality: "Rockville", zip: "20850", serviceLocations: ["I can go to the provider"], serviceAddress: "" };
const provider = { id: "example-provider", name: "Example Car Care", service: "Car cleaning", serviceArea: "Montgomery County", publicSlug: "example-car-care" };
const ready = json(200, { profile, providerChoices: [provider], savedProviders: [] });
const saved = json(200, { profile, providerChoices: [provider], savedProviders: [provider] });
const confirmedProfile = payload => json(200, { profile: { ...profile, ...payload, displayName: payload.displayName.trim(), municipality: payload.municipality.trim() } });
const gate = () => { let release; const waitFor = new Promise(done => { release = done; }); return { ...ready, waitFor, release }; };
const report = { testedAt: new Date().toISOString(), cases: [] };
const saveButton = page => page.getByRole("button", { name: "Save profile and service area", exact: true });
const field = page => page.locator('[name="displayName"]');
const success = page => page.getByText("✓ Profile and service area saved", { exact: true });
async function submit(page) { await field(page).press("Enter"); }

try {
  for (const browserType of [chromium, webkit]) {
    const browser = await browserType.launch({ headless: true });
    try {
      async function run(name, view, responses, action, clock = false) {
        const context = await browser.newContext({ viewport: { width: browserType === webkit ? 320 : 390, height: 844 }, reducedMotion: "reduce" });
        const page = await context.newPage();
        page.setDefaultTimeout(3000);
        if (clock) await page.clock.install();
        const requests = [], errors = [], unexpected = [];
        page.on("pageerror", error => errors.push(error.message));
        await page.route("**/*", async route => {
          const request = route.request(), url = new URL(request.url());
          if (url.origin !== origin) { unexpected.push(request.url()); return route.abort(); }
          if (url.pathname === "/api/customer-tools") {
            const payload = request.method() === "POST" ? request.postDataJSON() : null;
            const planned = responses[requests.length];
            requests.push({ method: request.method(), payload });
            if (planned === undefined) { unexpected.push("unplanned account request"); return route.abort(); }
            const reply = typeof planned === "function" ? planned(payload) : planned;
            if (reply?.waitFor) await reply.waitFor;
            if (reply === null) return route.abort("failed").catch(() => {});
            return route.fulfill({ status: reply.status, contentType: reply.contentType, body: reply.body }).catch(() => {});
          }
          if (url.pathname === "/api/places/autocomplete") return route.fulfill(json(200, { suggestions: [] }));
          if (request.method() !== "GET" || (!assets.has(url.pathname) && url.pathname !== "/customer")) {
            unexpected.push(request.method() + " " + url.pathname); return route.abort();
          }
          return route.continue();
        });
        const result = { browser: browserType.name(), name };
        try {
          const firstRequest = page.waitForRequest(request => new URL(request.url()).pathname === "/api/customer-tools");
          await page.goto(origin + "/customer?view=" + view);
          await firstRequest;
          await action(page, requests);
          assert.equal(requests.length, responses.length, "requests require deliberate user actions");
          assert.deepEqual(errors, [], "malformed replies must not crash the account page");
          assert.deepEqual(unexpected, [], "no external requests or unplanned writes");
          result.layout = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
          assert.ok(result.layout.scrollWidth <= result.layout.width, "account panel fits a phone");
          result.status = "passed";
        } catch (error) { result.status = "failed"; result.error = error.stack ?? error.message; }
        finally {
          responses.forEach(response => response?.release?.());
          result.requests = requests;
          result.browserErrors = errors;
          if (outputDir) await page.screenshot({ path: resolve(outputDir, `${browserType.name()}-${name}.png`), fullPage: true });
          await context.close();
        }
        report.cases.push(result);
        console.log(`${result.status.toUpperCase()} ${result.browser} ${name}${result.error ? ": " + result.error : ""}`);
      }
      for (const [name, reply] of [
        ["load-outage", json(503, { error: "private internal detail" })],
        ["load-malformed", json(200, { profile: { ...profile, serviceLocations: {} }, providerChoices: [], savedProviders: [] })],
        ["load-network", null],
      ]) await run(name, "settings", [reply, ready], async page => {
        await page.getByRole("alert").waitFor();
        assert.equal(await page.getByText("private internal detail", { exact: true }).count(), 0);
        await page.getByRole("button", { name: "Try again", exact: true }).click();
        await field(page).waitFor();
        assert.equal(await field(page).inputValue(), profile.displayName);
      });
      await run("saved-list-outage-is-not-empty", "saved", [json(503, {}), ready], async page => {
        await page.getByRole("alert").waitFor();
        assert.equal(await page.getByText("No saved providers yet", { exact: true }).count(), 0);
        await page.getByRole("button", { name: "Try again", exact: true }).click();
        await page.getByText("No saved providers yet", { exact: true }).waitFor();
      });
      await run("expired-session-guidance", "settings", [json(401, {})], async page => {
        await page.getByRole("alert").waitFor();
        const signIn = page.getByRole("link", { name: "Sign in again", exact: true });
        assert.equal(await signIn.getAttribute("href"), "/account?role=customer&mode=signin");
        assert.equal(await page.getByRole("button", { name: "Try again", exact: true }).count(), 0);
      });
      await run("load-timeout-and-retry", "settings", [gate(), ready], async (page, requests) => {
        await page.getByText("Loading customer settings…", { exact: true }).waitFor();
        await page.waitForFunction(() => document.body.innerText.includes("Loading customer settings"));
        await page.clock.fastForward(46000);
        await page.getByRole("alert").waitFor();
        assert.equal(requests.length, 1);
        await page.getByRole("button", { name: "Try again", exact: true }).click();
        await field(page).waitFor();
      }, true);
      for (const [name, reply] of [
        ["save-outage", json(503, { error: "private internal detail" })],
        ["save-malformed", json(200, { profile: {} })],
        ["save-wrong-account", json(200, { profile: { ...profile, email: "other@example.test", displayName: "Changed name" } })],
      ]) await run(name, "settings", [ready, reply, confirmedProfile], async page => {
        await field(page).fill("Changed name");
        await submit(page);
        await page.getByRole("alert").waitFor();
        assert.equal(await success(page).count(), 0);
        assert.equal(await field(page).inputValue(), "Changed name");
        assert.equal(await page.getByText("private internal detail", { exact: true }).count(), 0);
        await submit(page);
        await success(page).waitFor();
        await field(page).fill("Another change");
        assert.equal(await success(page).count(), 0, "editing clears the previous save confirmation");
      });
      await run("save-timeout-keeps-draft", "settings", [ready, gate(), confirmedProfile], async (page, requests) => {
        await field(page).fill("Changed name");
        await submit(page);
        await page.getByRole("button", { name: "Saving…", exact: true }).waitFor();
        assert.equal(await field(page).isDisabled(), true, "freeze the submitted fields until confirmed");
        await page.locator("form").evaluate(form => { form.requestSubmit(); form.requestSubmit(); });
        await page.clock.fastForward(46000);
        await page.getByRole("alert").waitFor();
        assert.equal(requests.length, 2, "double submits cannot start concurrent writes");
        assert.equal(await field(page).inputValue(), "Changed name");
        assert.equal(await saveButton(page).isEnabled(), true);
        await submit(page);
        await success(page).waitFor();
      }, true);
      await run("save-normalized-values", "settings", [ready, confirmedProfile], async page => {
        await page.locator('[name="municipality"]').fill("  Rockville  ");
        await submit(page);
        await success(page).waitFor();
        assert.equal(await page.locator('[name="municipality"]').inputValue(), "Rockville");
        const controls = await page.locator("form").evaluate(form => [...form.querySelectorAll("input")].map(input => ({
          type: input.type, width: input.getBoundingClientRect().width, height: input.getBoundingClientRect().height,
          fontSize: Number.parseFloat(getComputedStyle(input).fontSize),
        })));
        assert.ok(controls.filter(input => input.type === "checkbox").every(input => input.width <= 24 && input.height <= 24), "checkboxes stay compact");
        assert.ok(controls.filter(input => input.type !== "checkbox").every(input => input.fontSize >= 16), "readable fields avoid phone focus zoom");
      });
      await run("save-validation-guidance", "settings", [ready, json(400, { error: "Enter a valid ZIP code." }), confirmedProfile], async page => {
        await page.locator('[name="zip"]').fill("invalid");
        await submit(page);
        await page.getByRole("alert").waitFor();
        assert.equal(await page.getByRole("alert").textContent(), "Enter a valid ZIP code.");
        assert.equal(await page.locator('[name="zip"]').inputValue(), "invalid");
        await page.locator('[name="zip"]').fill("20850");
        await submit(page);
        await success(page).waitFor();
      });
      await run("saved-provider-needs-confirmation", "saved", [ready, json(200, { ok: false }), json(200, { ok: true }), saved], async page => {
        await page.getByRole("button", { name: "Save provider", exact: true }).click();
        await page.getByRole("alert").waitFor();
        assert.equal(await page.getByRole("button", { name: "Remove", exact: true }).count(), 0);
        await page.getByRole("button", { name: "Save provider", exact: true }).click();
        await page.getByRole("button", { name: "Remove", exact: true }).waitFor();
      });
      await run("saved-provider-refresh-retry", "saved", [ready, json(200, { ok: true }), json(503, {}), saved], async (page, requests) => {
        await page.getByRole("button", { name: "Save provider", exact: true }).click();
        await page.getByRole("alert").waitFor();
        await page.getByRole("button", { name: "Try again", exact: true }).click();
        await page.getByRole("button", { name: "Remove", exact: true }).waitFor();
        assert.equal(requests.filter(request => request.method === "POST").length, 1, "refresh retry does not repeat a write");
      });
    } finally { await browser.close(); }
  }
} finally {
  await new Promise(done => server.close(done));
  if (outputDir) writeFileSync(resolve(outputDir, "report.json"), JSON.stringify(report, null, 2));
}
assert.equal(report.cases.filter(result => result.status === "failed").length, 0, "all customer account cases must pass");
