// Actual evidence page with synthetic loopback replies. The separate storage
// test runs real authentication, multipart routes and SQL without remote data.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, webkit } from "playwright";
import { build } from "vite";

const root = fileURLToPath(new URL("../..", import.meta.url));
const built = await build({ root, configFile: false, envFile: false, logLevel: "error",
  define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" },
  resolve: { alias: {
    "next/link": fileURLToPath(import.meta.resolve("vinext/shims/link")),
    "next/navigation": fileURLToPath(import.meta.resolve("vinext/shims/navigation")),
  } },
  build: { write: false, lib: { entry: resolve(root, "tests/e2e/fixtures/job-evidence.tsx"), name: "EvidenceFixture", formats: ["iife"] } },
});
const bundle = Array.isArray(built) ? built[0] : built;
const assets = new Map(bundle.output.map(asset => ["/" + asset.fileName, asset.type === "chunk" ? asset.code : asset.source]));
const js = bundle.output.find(asset => asset.type === "chunk").fileName;
const css = bundle.output.find(asset => asset.fileName.endsWith(".css")).fileName;
assets.set("/brand-badge.png", readFileSync(resolve(root, "public/brand-badge.png")));
let apiHandler;
const server = createServer(async (request, response) => {
  const path = request.url.split("?")[0];
  if (path === "/api/job-evidence/image") {
    response.writeHead(200, { "content-type": "image/png" }); response.end(photo); return;
  }
  if (path === "/api/job-evidence") {
    try {
      const result = await apiHandler(request);
      response.writeHead(result.status ?? 200, { "content-type": "application/json" });
      response.end(JSON.stringify(result.json));
    } catch (error) {
      response.writeHead(500, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: String(error) }));
    }
    return;
  }
  response.writeHead(200, { "content-type": assets.has(path) ? path.endsWith(".png") ? "image/png" : path.endsWith(".css") ? "text/css" : "text/javascript" : "text/html" });
  response.end(assets.get(path) ?? `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/${css}"></head><body><div id="root"></div><script src="/${js}"></script></body></html>`);
});
await new Promise(done => server.listen(0, "127.0.0.1", done));
const origin = `http://127.0.0.1:${server.address().port}`;
const photo = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aS1cAAAAASUVORK5CYII=", "base64");
const savedNote = "SYNTHETIC: vehicle condition before work.";
const savedItem = { id: "synthetic-evidence", requestId: "synthetic-job", uploadedByRole: "customer", evidenceType: "customer-condition",
  imageAvailable: true, imageUrl: "/api/job-evidence/image?id=synthetic-evidence", note: savedNote, odometerMiles: 0, technicianName: "", createdAt: "2026-09-26T14:00:00Z" };
const snapshot = saved => ({ role: "customer", email: "customer@example.invalid", principles: [], jobs: [{
  requestId: "synthetic-job", vehicle: "Synthetic vehicle", service: "Synthetic service", requestStatus: "quote accepted",
  customerName: "Synthetic customer", customerEmail: "customer@example.invalid", providerName: "Synthetic provider", providerEmail: "provider@example.invalid",
  evidence: saved ? [savedItem] : [],
}] });
try {
  for (const browserType of [chromium, webkit]) {
    const browser = await browserType.launch({ headless: true });
    try {
      for (const mode of ["normal", "refresh-fails", "retry-rejected-upload"]) {
        const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
        const page = await context.newPage();
        const errors = []; page.on("pageerror", error => errors.push(error.message));
        let saved = false, posts = 0, refreshFailures = mode === "refresh-fails" ? 1 : 0;
        apiHandler = async request => {
          if (request.method === "GET") {
            if (saved && refreshFailures-- > 0) return { status: 503, json: { error: "SYNTHETIC: list unavailable" } };
            return { json: snapshot(saved) };
          }
          posts++;
          assert.ok(request.headers["content-type"].includes("multipart/form-data"));
          const chunks = []; for await (const chunk of request) chunks.push(chunk);
          const form = await new Request(origin, { method: "POST", headers: { "content-type": request.headers["content-type"] }, body: Buffer.concat(chunks) }).formData();
          assert.deepEqual(Buffer.from(await form.get("image").arrayBuffer()), photo);
          assert.equal(form.get("note"), savedNote);
          assert.equal(form.get("requestId"), "synthetic-job");
          if (mode === "retry-rejected-upload" && posts === 1) return { status: 400, json: { error: "SYNTHETIC: upload was not saved" } };
          saved = true;
          return { status: 201, json: mode === "normal" ? { ok: true, evidenceId: savedItem.id, ...snapshot(true) }
            : { ok: true, evidenceId: savedItem.id, refreshRequired: true } };
        };
        await page.route("**/*", async route => {
          assert.equal(new URL(route.request().url()).origin, origin, "fixture must never contact an external service");
          return route.continue();
        });
        try {
          await page.goto(origin + "/job-evidence");
          const note = page.getByLabel("Factual note", { exact: true });
          const file = page.locator('input[type="file"]');
          const submit = page.getByRole("button", { name: "Add private job record", exact: true });
          await note.fill(savedNote);
          await file.setInputFiles({ name: "synthetic.png", mimeType: "image/png", buffer: photo });
          await submit.click();
          if (mode === "retry-rejected-upload") {
            await page.getByRole("alert").waitFor();
            assert.equal(await note.inputValue(), savedNote);
            assert.equal(await file.evaluate(input => input.files.length), 1);
            await submit.click();
          }
          if (mode === "refresh-fails") {
            const refresh = page.getByRole("button", { name: "Refresh saved records", exact: true });
            await refresh.waitFor();
            await page.getByText("Your photo or note is saved. Refresh the records to see it. You do not need to submit it again.", { exact: true }).waitFor();
            assert.equal(await submit.isDisabled(), true);
            assert.equal(await note.inputValue(), "");
            assert.equal(await file.evaluate(input => input.files.length), 0);
            assert.equal(posts, 1);
            await refresh.click();
            await refresh.waitFor({ state: "detached" });
          }
          await page.getByText(savedNote, { exact: true }).waitFor();
          await page.getByRole("status").filter({ hasText: "Private job record added" }).waitFor();
          assert.equal(await submit.isEnabled(), true);
          assert.equal(await note.inputValue(), "");
          assert.equal(posts, mode === "retry-rejected-upload" ? 2 : 1, "refreshing must not resubmit evidence");
          assert.equal(await page.getByRole("alert").count(), 0);
          assert.deepEqual(errors, []);
          console.log(`PASS ${browserType.name()}: ${mode}, saved receipt, photo and draft handling`);
        } finally { await context.close(); }
      }
    } finally { await browser.close(); }
  }
} finally { await new Promise(done => server.close(done)); }
