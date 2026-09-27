// Render the real provider tools page; all reads/writes stay in this synthetic loopback fixture.
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
  resolve: { alias: { "next/link": fileURLToPath(import.meta.resolve("vinext/shims/link")) } },
  build: { write: false, lib: { entry: resolve(root, "tests/e2e/fixtures/provider-tools.tsx"), name: "ProviderToolsFixture", formats: ["iife"] } },
});
const bundle = Array.isArray(builds) ? builds[0] : builds;
const assets = new Map(bundle.output.map(asset => ["/" + asset.fileName, asset.type === "chunk" ? asset.code : asset.source]));
assets.set("/brand-badge.png", readFileSync(resolve(root, "public/brand-badge.png")));
const js = bundle.output.find(asset => asset.type === "chunk").fileName;
const css = bundle.output.find(asset => asset.fileName.endsWith(".css")).fileName;
const server = createServer((request, response) => {
  const pathname = request.url.split("?")[0];
  if (assets.has(pathname)) {
    response.writeHead(200, { "content-type": pathname.endsWith(".png") ? "image/png" : pathname.endsWith(".css") ? "text/css" : "text/javascript" });
    response.end(assets.get(pathname));
  } else if (request.method === "GET" && pathname === "/provider-services") {
    response.writeHead(200, { "content-type": "text/html" });
    response.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/${css}"></head><body><div id="root"></div><script src="/${js}"></script></body></html>`);
  } else { response.writeHead(404); response.end(); }
});
await new Promise(done => server.listen(0, "127.0.0.1", done));
const origin = `http://127.0.0.1:${server.address().port}`;
const data = {
  provider: { id: "synthetic-provider", name: "Example Provider", approvedServices: ["Interior detailing"] },
  priceTypes: [{ value: "starting_at", label: "Starting at" }, { value: "fixed", label: "Fixed price" }],
  catalogItems: [], credentials: [], credentialNotice: "Synthetic credentials stay pending review.",
};
const json = (status, body) => ({ status, contentType: "application/json", body: JSON.stringify(body) });
const forms = [
  { kind: "service", action: "save-catalog-item", button: "Save service and price", success: "Service and provider-set price saved.",
    fields: { service: "Interior detailing", priceType: "fixed", startingPrice: "87.50", durationMinutes: "60", description: "Synthetic labor-only service description." },
    saved: { ...data, ok: true, catalogItems: [{ id: "example-price", service: "Interior detailing", priceType: "fixed", startingPriceCents: 8750, description: "Synthetic labor-only service description.", durationMinutes: 60, active: "yes" }] } },
  { kind: "credential", action: "add-credential", button: "Submit credential for review", success: "Credential submitted for Tuveloz review.",
    fields: { credentialName: "SYNTHETIC TEST ONLY", issuingAuthority: "Example issuer", credentialIdentifier: "NOT-A-REAL-LICENSE", jurisdiction: "Example jurisdiction", expiresAt: "2027-06-01" },
    saved: { ...data, ok: true, credentials: [{ id: "example-credential", credentialName: "SYNTHETIC TEST ONLY", issuingAuthority: "Example issuer", credentialIdentifier: "NOT-A-REAL-LICENSE", jurisdiction: "Example jurisdiction", expiresAt: "2027-06-01", status: "pending", reviewNote: "", publicDisplay: "no" }] } },
];
const failures = [
  ["validation", json(400, { error: "Synthetic validation failure." })],
  ["unavailable", json(503, { error: "Synthetic service unavailable." })],
  ["network", null],
];
const report = { testedAt: new Date().toISOString(), cases: [] };
try {
  for (const browserType of [chromium, webkit]) {
    const browser = await browserType.launch({ headless: true });
    try {
      for (const form of forms) for (const [failureName, failure] of failures) {
        const context = await browser.newContext({ viewport: { width: browserType === webkit ? 320 : 390, height: 844 }, reducedMotion: "reduce" });
        const page = await context.newPage();
        page.setDefaultTimeout(3000);
        const writes = [], errors = [], unexpected = [];
        page.on("pageerror", error => errors.push(error.message));
        await page.route("**/*", async route => {
          const request = route.request(), url = new URL(request.url());
          if (url.origin !== origin) { unexpected.push(request.url()); return route.abort(); }
          if (url.pathname === "/api/provider-marketplace-tools") {
            if (request.method() === "GET") return route.fulfill(json(200, data));
            writes.push(request.postDataJSON());
            const reply = writes.length === 1 ? failure : writes.length === 2 ? json(form.kind === "credential" ? 201 : 200, form.saved) : undefined;
            if (reply === undefined) { unexpected.push("unexpected duplicate write"); return route.abort(); }
            return reply === null ? route.abort("failed") : route.fulfill(reply);
          }
          if (request.method() !== "GET" || (!assets.has(url.pathname) && url.pathname !== "/provider-services")) {
            unexpected.push(request.method() + " " + url.pathname); return route.abort();
          }
          return route.continue();
        });
        const result = { browser: browserType.name(), name: `${form.kind}-${failureName}-retry` };
        try {
          await page.goto(origin + "/provider-services");
          const button = page.getByRole("button", { name: form.button, exact: true });
          await button.waitFor();
          for (const [name, value] of Object.entries(form.fields)) {
            const field = page.locator(`[name="${name}"]`);
            if (name === "service" || name === "priceType") await field.selectOption(value);
            else await field.fill(value);
          }
          await button.click();
          await page.getByRole("alert").waitFor();
          await page.waitForFunction(label => [...document.querySelectorAll("button")].some(button => button.textContent.trim() === label && !button.disabled), form.button);
          for (const [name, value] of Object.entries(form.fields)) assert.equal(await page.locator(`[name="${name}"]`).inputValue(), value, `${name} must survive the failed save`);
          assert.equal(await page.getByRole("status").count(), 0, "failed saves must not claim success");
          assert.equal(writes.length, 1, "no automatic resubmission");
          await button.click();
          await page.getByRole("status").waitFor();
          assert.equal(await page.getByRole("status").textContent(), form.success);
          assert.deepEqual(writes[1], writes[0], "deliberate retry keeps the original values");
          assert.equal(writes[1].action, form.action);
          const clearedName = form.kind === "service" ? "description" : "credentialName";
          assert.equal(await page.locator(`[name="${clearedName}"]`).inputValue(), "", "successful saves still clear the submitted form");
          if (form.kind === "credential") await page.getByText("Status: pending · private", { exact: true }).waitFor();
          assert.deepEqual(errors, []); assert.deepEqual(unexpected, []);
          const layout = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
          assert.ok(layout.scrollWidth <= layout.width, "page fits a phone");
          result.status = "passed"; result.layout = layout;
        } catch (error) { result.status = "failed"; result.error = error.stack ?? error.message; }
        finally {
          result.writes = writes; result.browserErrors = errors;
          if (outputDir) await page.screenshot({ path: resolve(outputDir, `${browserType.name()}-${result.name}.png`), fullPage: true });
          await context.close();
        }
        report.cases.push(result);
        console.log(`${result.status.toUpperCase()} ${result.browser} ${result.name}${result.error ? ": " + result.error : ""}`);
      }
    } finally { await browser.close(); }
  }
} finally {
  await new Promise(done => server.close(done));
  if (outputDir) writeFileSync(resolve(outputDir, "report.json"), JSON.stringify(report, null, 2));
}
assert.equal(report.cases.filter(result => result.status === "failed").length, 0, "all provider draft-recovery cases must pass");
