// Real policy and language components, local rendering only; no accounts or payments.
import assert from "node:assert/strict";
import { mkdirSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, webkit } from "playwright";
import { build } from "vite";

const root = fileURLToPath(new URL("../..", import.meta.url));
const output = process.argv[2] ? resolve(process.argv[2]) : null;
if (output) mkdirSync(output, { recursive: true });
const built = await build({ root, configFile: false, envFile: false, logLevel: "error",
  define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" },
  resolve: { alias: { "next/link": fileURLToPath(import.meta.resolve("vinext/shims/link")),
    "next/navigation": fileURLToPath(import.meta.resolve("vinext/shims/navigation")) } },
  build: { write: false, lib: { entry: resolve(root, "tests/e2e/fixtures/customer-policy.tsx"), name: "CustomerPolicyFixture", formats: ["iife"] } },
});
const bundle = Array.isArray(built) ? built[0] : built;
const assets = new Map(bundle.output.map(asset => ["/" + asset.fileName, asset.type === "chunk" ? asset.code : asset.source]));
const js = bundle.output.find(asset => asset.type === "chunk").fileName;
const css = bundle.output.find(asset => asset.fileName.endsWith(".css")).fileName;
assets.set("/brand-badge.png", readFileSync(resolve(root, "public/brand-badge.png")));
const server = createServer((request, response) => {
  const path = request.url.split("?")[0];
  if (assets.has(path)) {
    response.writeHead(200, { "content-type": path.endsWith(".png") ? "image/png" : path.endsWith(".css") ? "text/css" : "text/javascript" });
    response.end(assets.get(path));
  } else if (["/customer-agreement", "/es/customer-agreement"].includes(path)) {
    response.writeHead(200, { "content-type": "text/html" });
    response.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/${css}"></head><body><div id="root"></div><script src="/${js}"></script></body></html>`);
  } else {
    response.writeHead(404); response.end();
  }
});
await new Promise(done => server.listen(0, "127.0.0.1", done));
const origin = `http://127.0.0.1:${server.address().port}`;
const normalize = text => text.replace(/\s+/g, " ").trim();
const spanishSource = readFileSync(resolve(root, "lib/policy-spanish/customer-agreement.ts"), "utf8");
const expectedSpanish = spanishSource.match(/html: `([\s\S]+)`/)[1];
try {
  for (const type of [chromium, webkit]) {
    const browser = await type.launch({ headless: true });
    try {
      for (const width of [320, 390, 1280]) {
        const context = await browser.newContext({ viewport: { width, height: 844 } });
        const page = await context.newPage(); page.setDefaultTimeout(7000);
        const errors = [], external = [];
        page.on("pageerror", error => errors.push(error.message));
        await page.route("**/*", route => {
          if (new URL(route.request().url()).origin !== origin) {
            external.push(route.request().url()); return route.abort();
          }
          return route.continue();
        });
        try {
          await page.goto(`${origin}/es/customer-agreement`);
          const englishButton = () => page.getByRole("button", { name: "Change the whole page to English", exact: true });
          const spanishButton = () => page.getByRole("button", { name: "Cambiar toda la página a español", exact: true });
          await englishButton().waitFor();
          assert.equal(await page.locator("h1").textContent(), "Acuerdo del cliente");
          assert.equal(await page.locator(".policy-shell").getAttribute("lang"), "es");
          assert.equal(await page.locator(".policy-content h2").count(), 11);
          const expected = await page.evaluate(html => {
            const div = document.createElement("div"); div.innerHTML = html;
            return div.textContent;
          }, expectedSpanish);
          assert.equal(normalize(await page.locator("[data-spanish-policy]").textContent()), normalize(expected));
          for (const path of ["terms", "customer-agreement", "provider-agreement", "privacy", "payments"]) {
            assert.equal(await page.locator(`.policy-links a[href="/es/${path}"]`).count(), 1);
          }
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
          if (output && width === 390) await page.screenshot({ path: resolve(output, `customer-policy-${type.name()}-es.png`), fullPage: true });
          await englishButton().click();
          await page.waitForURL(`${origin}/customer-agreement`);
          await spanishButton().waitFor();
          assert.equal(await page.locator("h1").textContent(), "Customer Agreement");
          assert.equal(await page.locator(".policy-content h2").count(), 11);
          assert.match(await page.locator(".policy-content").textContent(), /You pay that total at\s+checkout/);
          assert.equal(await page.locator('.policy-links a[href="/customer-agreement"]').count(), 1);
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
          await spanishButton().click();
          await englishButton().waitFor();
          assert.equal(await page.locator("h1").textContent(), "Acuerdo del cliente");
          await page.reload();
          await englishButton().waitFor();
          assert.equal(await page.locator("h1").textContent(), "Acuerdo del cliente", "language survives reload");
          assert.deepEqual(errors, []);
          assert.deepEqual(external, []);
          console.log(`PASS — ${type.name()} ${width}px: complete Spanish policy, English/Spanish switching, links, saved language and width`);
        } finally { await context.close(); }
      }
    } finally { await browser.close(); }
  }
} finally { await new Promise(done => server.close(done)); }
