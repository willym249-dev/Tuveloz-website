// Real public React pages, synthetic responses, and a loopback server only.
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
  build: {
    write: false,
    lib: { entry: resolve(root, "tests/e2e/fixtures/public-guidance.tsx"), name: "PublicGuidanceFixture", formats: ["iife"] },
  },
});
const bundle = Array.isArray(builds) ? builds[0] : builds;
const assets = new Map(bundle.output.map(asset => [`/${asset.fileName}`, asset.type === "chunk" ? asset.code : asset.source]));
const js = bundle.output.find(asset => asset.type === "chunk").fileName;
const css = bundle.output.find(asset => asset.fileName.endsWith(".css")).fileName;
assets.set("/brand-badge.png", readFileSync(resolve(root, "public/brand-badge.png")));
const server = createServer((request, response) => {
  const path = request.url.split("?")[0];
  if (assets.has(path)) {
    response.writeHead(200, { "content-type": path.endsWith(".css") ? "text/css" : path.endsWith(".png") ? "image/png" : "text/javascript" });
    response.end(assets.get(path));
  } else if (["/providers", "/system-status"].includes(path)) {
    response.writeHead(200, { "content-type": "text/html" });
    response.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/${css}"></head><body><div id="root"></div><script src="/${js}"></script></body></html>`);
  } else {
    response.writeHead(404);
    response.end();
  }
});
await new Promise(done => server.listen(0, "127.0.0.1", done));
const origin = `http://127.0.0.1:${server.address().port}`;
const provider = {
  slug: "example-vehicle-care", businessName: "Example Vehicle Care", headline: "Synthetic browser fixture",
  businessMunicipality: "Rockville", workMode: "Mobile", areas: [], services: [],
};
const healthy = {
  status: "ok", checkedAt: "2026-01-01T12:00:00Z",
  release: { commit: "synthetic-release", builtAt: "2026-01-01T11:00:00Z" },
  checks: { application: "ready", database: "ready", schema: "ready" },
  launch: { mode: "onboarding_only", customerAccounts: "open", providerApplications: "open", customerJobRequests: "closed", customerPayments: "closed" },
  missingTables: [], missingGuardedTriggers: [], privacy: "Synthetic public status only.",
};
const json = (status, body) => ({ status, contentType: "application/json", body: JSON.stringify(body) });
const directoryReady = json(200, { providers: [provider] });
const paused = json(503, { code: "MARKETPLACE_ONBOARDING_ONLY", providers: [] });
const report = { testedAt: new Date().toISOString(), cases: [] };

async function retry(page) {
  const button = page.getByRole("button", { name: "Try again", exact: true });
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
      async function run(name, path, responses, action) {
        const context = await browser.newContext({ viewport: { width: browserType === webkit ? 320 : 390, height: 844 } });
        const page = await context.newPage();
        page.setDefaultTimeout(5000);
        const errors = [];
        const unexpected = [];
        let requests = 0;
        page.on("pageerror", error => errors.push(error.stack ?? error.message));
        await page.route("**/*", route => {
          const request = route.request();
          const url = new URL(request.url());
          if (url.origin !== origin || !["GET", "HEAD"].includes(request.method())) {
            unexpected.push(`${request.method()} ${request.url()}`);
            return route.abort();
          }
          if (url.pathname === "/api/account") return route.fulfill(json(401, { error: "Synthetic signed-out visitor" }));
          if (["/api/public-provider-directory", "/api/health"].includes(url.pathname)) {
            const response = responses[Math.min(requests++, responses.length - 1)];
            return response === null ? route.abort("failed") : route.fulfill(response);
          }
          return route.continue();
        });
        const result = { browser: browserType.name(), name };
        try {
          await page.goto(origin + path);
          await action(page);
          assert.equal(requests, responses.length, "each retry makes one fresh request");
          assert.deepEqual(errors, [], "the page must not crash on failed or malformed responses");
          assert.deepEqual(unexpected, [], "no external requests or mutations");
          const layout = await page.evaluate(() => ({
            width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
            overflowing: [...document.querySelectorAll("body *")].filter(element => {
              const rect = element.getBoundingClientRect();
              return rect.width > 0 && (rect.right > innerWidth || rect.left < 0);
            }).slice(0, 12).map(element => ({ tag: element.tagName, class: element.className, width: element.getBoundingClientRect().width })),
          }));
          result.layout = layout;
          assert.equal(layout.scrollWidth <= layout.width, true, `page fits a phone: ${JSON.stringify(layout)}`);
          result.status = "passed";
        } catch (error) {
          result.status = "failed";
          result.error = error.stack ?? error.message;
          result.browserErrors = errors;
        } finally {
          result.requests = requests;
          if (outputDir && (result.status === "failed" || name === "healthy-launch-status")) {
            await page.screenshot({ path: resolve(outputDir, `${browserType.name()}-${name}.png`), fullPage: true });
          }
          await context.close();
        }
        report.cases.push(result);
        console.log(`${result.status.toUpperCase()} ${result.browser} ${name}${result.error ? `: ${result.error}` : ""}`);
      }

      for (const [name, failure] of [
        ["http-error", json(500, { providers: [] })],
        ["unmarked-503", json(503, { error: "Temporary outage" })],
        ["malformed-json", { status: 200, contentType: "application/json", body: "not JSON" }],
        ["missing-list", json(200, {})],
        ["network-error", null],
      ]) await run(`directory-${name}-recovery`, "/providers", [failure, directoryReady], async page => {
        await page.getByRole("alert").waitFor();
        assert.equal(await page.getByText("No provider profiles are published yet.", { exact: true }).count(), 0);
        assert.equal(await page.getByText(/Provider profiles are not public yet/).count(), 0);
        await retry(page);
        await page.getByRole("link", { name: /Example Vehicle Care/ }).waitFor();
        assert.equal(await page.getByRole("alert").count(), 0);
      });

      await run("directory-launch-closed", "/providers", [paused], async page => {
        await page.getByText(/Provider profiles are not public yet/).waitFor();
        assert.equal(await page.getByRole("alert").count(), 0);
        assert.equal(await page.locator('a[href="/providers/example-vehicle-care"]').count(), 0);
      });
      await run("directory-empty", "/providers", [json(200, { providers: [] })], async page => {
        await page.getByText("No provider profiles are published yet.", { exact: true }).waitFor();
        assert.equal(await page.getByRole("alert").count(), 0);
      });

      for (const [name, failure] of [
        ["http-error", json(500, { error: "Temporary outage" })],
        ["malformed-response", json(200, {})],
        ["network-error", null],
      ]) await run(`status-${name}-recovery`, "/system-status", [failure, json(200, healthy)], async page => {
        await page.getByRole("alert").waitFor();
        assert.equal(await page.getByRole("heading", { name: "Status unavailable", exact: true }).count(), 1);
        assert.equal(await page.getByRole("heading", { name: "Checking", exact: true }).count(), 0);
        await retry(page);
        await page.getByRole("heading", { name: "Operational", exact: true }).waitFor();
        assert.equal(await page.getByRole("alert").count(), 0);
      });

      await run("healthy-launch-status", "/system-status", [json(200, healthy)], async page => {
        await page.getByRole("heading", { name: "Operational", exact: true }).waitFor();
        await page.getByText("Provider applications", { exact: true }).locator("..").getByText("Open", { exact: true }).waitFor();
        await page.getByText("Customer payments", { exact: true }).locator("..").getByText("Closed", { exact: true }).waitFor();
        assert.equal(await page.getByRole("heading", { name: "Verified deployment", exact: true }).isVisible(), false);
        await page.getByText("Technical details", { exact: true }).click();
        await page.getByRole("heading", { name: "Verified deployment", exact: true }).waitFor();
      });
      await run("status-degraded", "/system-status", [json(503, { ...healthy, status: "degraded", checks: { application: "ready", database: "unavailable", schema: "migration-required" }, missingTables: ["synthetic_missing_table"] })], async page => {
        await page.getByRole("heading", { name: "Attention required", exact: true }).waitFor();
        assert.equal(await page.getByRole("heading", { name: "Operational", exact: true }).count(), 0);
        assert.equal(await page.getByRole("heading", { name: "Status unavailable", exact: true }).count(), 0);
      });
    } finally {
      await browser.close();
    }
  }
} finally {
  await new Promise(done => server.close(done));
  if (outputDir) writeFileSync(resolve(outputDir, "report.json"), JSON.stringify(report, null, 2));
}
assert.equal(report.cases.filter(result => result.status === "failed").length, 0, "all public guidance cases must pass");
