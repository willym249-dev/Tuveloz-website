// Real owner page; synthetic loopback responses. No account mutation or email.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, webkit } from "playwright";
import { build } from "vite";

const root = fileURLToPath(new URL("../..", import.meta.url));
const output = process.argv[2] ? resolve(process.argv[2]) : null;
if (output) mkdirSync(output, { recursive: true });
const builds = await build({ root, configFile: false, envFile: false, logLevel: "error",
  define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" },
  resolve: { alias: { "next/link": fileURLToPath(import.meta.resolve("vinext/shims/link")),
    "next/navigation": fileURLToPath(import.meta.resolve("vinext/shims/navigation")) } },
  build: { write: false, lib: { entry: resolve(root, "tests/e2e/fixtures/privacy-owner.tsx"), name: "PrivacyOwnerFixture", formats: ["iife"] } },
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
  } else if (request.method === "GET" && path === "/admin/privacy") {
    response.writeHead(200, { "content-type": "text/html" });
    response.end(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/${css}"></head><body><div id="root"></div><script src="/${js}"></script></body></html>`);
  } else { response.writeHead(404); response.end(); }
});
await new Promise(done => server.listen(0, "127.0.0.1", done));
const origin = `http://127.0.0.1:${server.address().port}`;
const base = { email: "synthetic@example.invalid", role: "customer", requestType: "account-closure", relatedRequestId: "",
  details: "Please close my account.", status: "submitted", identitySource: "signed-in-account", resolutionNote: "", createdAt: "2026-10-07T00:00:00Z", updatedAt: "2026-10-07T00:00:00Z", resolvedAt: "" };
const requests = [{ ...base, id: "closure-alpha" }, { ...base, id: "closure-withdrawn", status: "withdrawn" }, { ...base, id: "access-alpha", requestType: "access" }];
const preview = { mode: "review-only", scope: "whole-account", canExecute: false, coverageComplete: false,
  request: requests[0], generatedAt: "2026-10-07T00:00:00Z",
  groups: [{ id: "access", label: "Sign-in and account settings", recordCount: 2, sources: [{ table: "auth_sessions", recordCount: 2 }] }],
  flags: { legalHolds: 1, incidents: 1 }, manualSources: [{ table: "stripe_webhook_events", reason: "Requires a separate review." }],
  nextSteps: ["Account closure and deletion execution are not available in this preview."] };
const report = [];
try {
  for (const type of [chromium, webkit]) {
    const browser = await type.launch({ headless: true });
    try {
      for (const width of [320, 1280]) {
        const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
        const page = await context.newPage();
        page.setDefaultTimeout(6000);
        const errors = [], unexpected = [];
        let mode = "success", calls = 0, mutations = 0, release, markStarted;
        const started = new Promise(done => { markStarted = done; });
        page.on("pageerror", error => errors.push(error.message));
        await page.route("**/*", async route => {
          const req = route.request(), url = new URL(req.url());
          if (url.origin !== origin || (req.method() !== "GET" && !(req.method() === "POST" && url.pathname === "/api/admin/privacy-requests/close-access"))) {
            unexpected.push(req.method() + " " + req.url()); return route.abort();
          }
          const json = (status, body) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
          if (url.pathname === "/api/admin/privacy-requests/close-access") { mutations++; const body = req.postDataJSON(); assert.equal(body.confirmWholeAccount, true); assert.equal(body.confirmIdentityAndAuthority, true); assert.equal(body.confirmRetainedDataReview, true); return mode === "action-failure" ? json(503, { error: "Closure unavailable; refresh the account review." }) : json(200, { accessClosed: true, privacyFulfillmentComplete: false }); }
          if (url.pathname === "/api/admin/privacy-requests") return json(200, { requests });
          if (url.pathname === "/api/admin/privacy-requests/closure-preview") {
            calls++;
            assert.equal(url.searchParams.get("id"), "closure-alpha");
            if (mode === "wait") await new Promise(done => { release = done; markStarted(); });
            if (mode === "failure") return json(503, { error: "The account review could not be loaded. Nothing was changed. Please try again." });
            if (mode === "withdrawn") return json(409, { error: "Only an open account-closure request can be previewed. Refresh the request queue." });
            return json(200, { preview: mode === "unused" ? { ...preview, accessClosureAllowed: true, accessClosed: false, reviewToken: "a".repeat(64), flags: { legalHolds: 0, incidents: 0 } } : preview });
          }
          return route.continue();
        });
        await page.goto(origin + "/admin/privacy");
        const panel = page.getByRole("region", { name: "Account closure review" });
        await panel.waitFor();
        assert.equal(await panel.count(), 1, "only open closure requests offer a preview");
        assert.equal(calls, 0, "no automatic account scan");
        mode = "wait";
        await panel.getByRole("button", { name: "Preview account records" }).click();
        await page.waitForFunction(() => document.querySelector('[aria-label="Account closure review"] button').disabled);
        await started;
        assert.equal(calls, 1);
        mode = "success"; release();
        await panel.getByText("Review loaded. No account or data was changed.", { exact: true }).waitFor();
        await panel.getByText("Sign-in and account settings: 2 records", { exact: true }).click();
        await panel.getByText("auth sessions: 2", { exact: true }).waitFor();
        assert.equal(await panel.getByRole("alert").count(), 2);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "preview fits screen");
        if (output) await page.screenshot({ path: resolve(output, `${type.name()}-${width}.png`), fullPage: true });
        mode = "failure";
        await panel.getByRole("button", { name: "Refresh account review" }).click();
        await panel.getByRole("alert").filter({ hasText: "Nothing was changed" }).waitFor();
        assert.equal(await panel.getByText("auth sessions: 2", { exact: true }).count(), 0, "failed refresh removes stale counts");
        mode = "withdrawn";
        await panel.getByRole("button", { name: "Preview account records" }).click();
        await panel.getByRole("alert").filter({ hasText: "Refresh the request queue" }).waitFor();
        assert.equal(calls, 3);
        mode = "unused";
        await panel.getByRole("button", { name: "Preview account records" }).click();
        const close = panel.getByRole("button", { name: "Close sign-in access", exact: true });
        await close.waitFor();
        assert.equal(await close.isDisabled(), true);
        await panel.getByLabel("Verified case reference", { exact: true }).fill("CASE-synthetic-verified");
        await panel.getByLabel("Next data-review date", { exact: true }).fill("2099-01-01");
        await panel.getByLabel("Records to retain and reason", { exact: true }).fill("Keep records pending separate disposition review.");
        for (const checkbox of await panel.getByRole("checkbox").all()) await checkbox.check();
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "closure form fits screen");
        mode = "action-failure";
        await close.click();
        await panel.getByRole("alert").filter({ hasText: "Closure unavailable" }).waitFor();
        assert.equal(await close.count(), 0, "failed action requires a fresh snapshot");
        mode = "unused";
        await panel.getByRole("button", { name: "Preview account records" }).click();
        await close.waitFor();
        assert.equal(await panel.getByLabel("Verified case reference", { exact: true }).inputValue(), "CASE-synthetic-verified");
        assert.equal(await panel.getByLabel("Records to retain and reason", { exact: true }).inputValue(), "Keep records pending separate disposition review.");
        assert.equal(mutations, 1, "no automatic retry after failure");
        await close.click();
        await panel.getByText("Sign-in access closed. The privacy request remains open for data review.", { exact: true }).waitFor();
        assert.equal(mutations, 2, "two deliberate synthetic attempts, no automatic retry");
        assert.deepEqual(errors, []); assert.deepEqual(unexpected, []);
        report.push({ browser: type.name(), width, passed: true, previewRequests: calls, mutations });
        await context.close();
      }
    } finally { await browser.close(); }
  }
} finally { await new Promise(done => server.close(done)); }
if (output) writeFileSync(resolve(output, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
