// Real owner screen, synthetic loopback responses only. No remote account/mail.
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
    response.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/${css}"></head><body><div id="root"></div><script src="/${js}"></script></body></html>`);
  } else { response.writeHead(404); response.end(); }
});
await new Promise(done => server.listen(0, "127.0.0.1", done));
const origin = `http://127.0.0.1:${server.address().port}`;
const base = { email: "synthetic@example.invalid", role: "customer", requestType: "access",
  relatedRequestId: "", details: "Synthetic request", identitySource: "signed-in-account",
  resolutionNote: "", createdAt: "2026-10-20T00:00:00Z", updatedAt: "2026-10-20T00:00:00Z", resolvedAt: "",
  reviewVersion: "a".repeat(64) };
const report = [];
try {
  for (const type of [chromium, webkit]) {
    const browser = await type.launch({ headless: true });
    try {
      for (const width of [320, 1280]) {
        const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
        const page = await context.newPage(); page.setDefaultTimeout(6000);
        const errors = [], unexpected = [], posts = [];
        const rows = ["in-review", "completed", "denied", "withdrawn"].map(status => ({ ...base, id: status, status }));
        let conflict = true;
        page.on("pageerror", error => errors.push(error.message));
        await page.route("**/*", async route => {
          const request = route.request(), url = new URL(request.url());
          if (url.origin !== origin) { unexpected.push(request.url()); return route.abort(); }
          if (url.pathname === "/api/admin/privacy-requests") {
            if (request.method() === "POST") {
              posts.push(request.postDataJSON());
              if (conflict) return route.fulfill({ status: 409, contentType: "application/json",
                body: JSON.stringify({ error: "This privacy request changed while you were reviewing it. Refresh the page before saving another decision." }) });
              rows[0] = { ...rows[0], status: "completed", reviewVersion: "b".repeat(64),
                resolutionNote: posts.at(-1).resolutionNote };
            }
            return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ requests: rows }) });
          }
          if (request.method() !== "GET" || url.pathname.startsWith("/api/")) {
            unexpected.push(request.method() + " " + url.pathname); return route.abort();
          }
          return route.continue();
        });
        await page.goto(origin + "/admin/privacy");
        const save = page.getByRole("button", { name: "Save review decision", exact: true });
        await save.waitFor();
        assert.equal(await save.count(), 1, "only the open request is editable");
        assert.equal(await page.getByText("This decision is final.", { exact: false }).count(), 2);
        assert.equal(posts.length, 0);
        await page.getByRole("combobox", { name: /^Review status/ }).selectOption("completed");
        const explanation = page.getByLabel("Customer-facing explanation", { exact: true });
        const note = "Your requested copy was provided through the verified support case.";
        await explanation.fill(note);
        await save.click();
        await page.getByRole("alert").filter({ hasText: "Refresh the page" }).waitFor();
        assert.equal(await explanation.inputValue(), note, "conflict preserves the owner's draft");
        assert.equal(posts.length, 1);
        assert.equal(posts[0].reviewVersion, base.reviewVersion);
        assert.equal(posts[0].id, "in-review");
        assert.equal(await page.getByRole("status").count(), 0, "conflict is not success");
        // Simulate a freshly loaded owner screen before accepting another review.
        conflict = false;
        await page.reload();
        await page.getByRole("combobox", { name: /^Review status/ }).selectOption("completed");
        await page.getByLabel("Customer-facing explanation", { exact: true }).fill(note);
        await page.getByRole("button", { name: "Save review decision", exact: true }).click();
        await page.getByRole("status").filter({ hasText: "updated" }).waitFor();
        assert.equal(await page.getByRole("button", { name: "Save review decision", exact: true }).count(), 0);
        assert.equal(await page.getByText("This decision is final.", { exact: false }).count(), 3);
        assert.equal(posts.length, 2, "no automatic resubmission");
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "no horizontal overflow");
        assert.deepEqual(errors, []); assert.deepEqual(unexpected, []);
        if (output) await page.screenshot({ path: resolve(output, `${type.name()}-${width}.png`), fullPage: true });
        report.push({ browser: type.name(), width, passed: true, posts: posts.length });
        await context.close();
      }
    } finally { await browser.close(); }
  }
  if (output) writeFileSync(resolve(output, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally { await new Promise(done => server.close(done)); }
