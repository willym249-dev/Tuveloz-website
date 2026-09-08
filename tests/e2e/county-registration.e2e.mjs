// Actual owner lookup component with synthetic HTTP responses, never approvals.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import { chromium, webkit } from "playwright";
const root = fileURLToPath(new URL("../..", import.meta.url));
const output = process.argv[2] ? resolve(process.argv[2]) : null;
if (output) mkdirSync(output, { recursive: true });
const built = await build({ root, configFile: false, envFile: false, logLevel: "error",
  define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" },
  build: { write: false, lib: { entry: resolve(root, "tests/e2e/fixtures/county-registration.tsx"), name: "CountyFixture", formats: ["iife"] } },
});
const bundle = Array.isArray(built) ? built[0] : built;
const assets = new Map(bundle.output.map(asset => ["/" + asset.fileName, asset.type === "chunk" ? asset.code : asset.source]));
const js = bundle.output.find(asset => asset.type === "chunk").fileName;
const css = bundle.output.find(asset => asset.fileName.endsWith(".css")).fileName;
const server = createServer((request, response) => {
  const path = request.url.split("?")[0];
  if (assets.has(path)) {
    response.writeHead(200, { "content-type": path.endsWith(".css") ? "text/css" : "text/javascript" }); response.end(assets.get(path));
  } else {
    response.writeHead(200, { "content-type": "text/html" });
    response.end(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/${css}"></head><body><div id="root"></div><script src="/${js}"></script></body></html>`);
  }
});
await new Promise(done => server.listen(0, "127.0.0.1", done));
const origin = "http://127.0.0.1:" + server.address().port;
const receipt = { status: "record_match", message: "The number and legal business name match an unexpired county record. OCP still needs to confirm current standing and the services covered before acceptance.",
  registrationNumber: "26-MT-123456", expectedLegalName: "SYNTHETIC BUSINESS LLC", checkedAt: new Date().toISOString(), sourceUpdatedAt: new Date().toISOString(),
  records: [{ registrationNumber: "26-MT-123456", legalName: "SYNTHETIC BUSINESS LLC", tradeName: "Synthetic Example", issuedOn: "2026-01-01", expiresOn: "2027-01-01" }], receiptId: "synthetic-11111111-2222-3333-4444-555555555555", requiresIssuerConfirmation: true };
const report = [];
try {
  for (const type of [chromium, webkit]) {
    const browser = await type.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 320, height: 844 } });
      const errors = [], calls = [];
      page.on("pageerror", error => errors.push(error.message));
      let reply = "success";
      await page.route("**/*", route => {
        const request = route.request(), url = new URL(request.url());
        if (url.origin !== origin) return route.abort();
        if (url.pathname === "/api/admin/provider-compliance") {
          if (request.method() === "GET") return route.fulfill({ json: { check: null } });
          calls.push(request.postDataJSON());
          if (reply === "network") return route.abort();
          return route.fulfill({ status: reply === "blocked" ? 423 : 200,
            json: reply === "blocked" ? { error: "Wait for the file safety scan." } : { check: receipt } });
        }
        return route.continue();
      });
      await page.goto(origin);
      await page.getByLabel("Registration number", { exact: true }).fill(receipt.registrationNumber);
      await page.getByLabel("Legal business name on the document", { exact: true }).fill(receipt.expectedLegalName);
      await page.getByRole("button", { name: "Check county records", exact: true }).click();
      await page.getByText("County record found — confirmation still needed", { exact: true }).waitFor();
      assert.equal(await page.locator(".county-registration-check > p").first().evaluate(node => getComputedStyle(node).fontSize), "14px");
      assert.equal(calls[0].action, "check-county-registration");
      assert.equal(calls[0].providerId, "synthetic-provider");
      assert.equal(calls[0].evidenceId, "synthetic-document");
      for (const width of [320, 390, 768]) {
        await page.setViewportSize({ width, height: 844 });
        await page.waitForFunction(expected => innerWidth === expected, width);
        await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      }
      await page.setViewportSize({ width: 320, height: 844 });
      await page.waitForFunction(() => innerWidth === 320);
      await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
      if (output) await page.screenshot({ path: resolve(output, `${type.name()}-receipt.png`), fullPage: true });
      await page.getByLabel("Registration number", { exact: true }).fill("26-MT-999999");
      assert.equal(await page.getByRole("status").count(), 0, "Editing input removes the old result");
      for (const failure of ["blocked", "network"]) {
        reply = failure;
        await page.getByRole("button", { name: "Check county records", exact: true }).click();
        await page.getByRole("alert").waitFor();
        assert.equal(await page.getByLabel("Registration number", { exact: true }).inputValue(), "26-MT-999999");
        assert.equal(await page.getByRole("button", { name: "Check county records", exact: true }).isEnabled(), true);
        assert.equal(await page.getByRole("status").count(), 0);
      }
      const before = calls.length;
      await page.goto(origin + "?quarantined=1");
      await page.getByRole("button", { name: "Check county records", exact: true }).waitFor();
      assert.equal(await page.getByRole("button", { name: "Check county records", exact: true }).isDisabled(), true);
      assert.equal(calls.length, before);
      assert.deepEqual(errors, []);
      assert.ok(calls.every(call => call.action === "check-county-registration"), "No review or activation request");
      report.push({ browser: type.name(), result: "passed", cases: ["real labeled inputs and lookup button", "exact application/document request", "visible source receipt", "320/390/768 layout", "old result cleared on edit", "server failure retry", "network failure retry", "quarantined control", "no approval or activation"] });
      await page.close();
    } finally { await browser.close(); }
  }
  if (output) writeFileSync(resolve(output, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally { await new Promise(done => server.close(done)); }
