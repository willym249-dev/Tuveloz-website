// Actual payment-result component; isolated synthetic responses, no Stripe calls.
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
  build: { write: false, lib: { entry: resolve(root, "tests/e2e/fixtures/payment-disclosure.tsx"), name: "PaymentFixture", formats: ["iife"] } },
});
const bundle = Array.isArray(built) ? built[0] : built;
const assets = new Map(bundle.output.map(asset => ["/" + asset.fileName, asset.type === "chunk" ? asset.code : asset.source]));
const js = bundle.output.find(asset => asset.type === "chunk").fileName;
const css = bundle.output.find(asset => asset.fileName.endsWith(".css")).fileName;
assets.set("/brand-badge.png", readFileSync(resolve(root, "public/brand-badge.png")));
const server = createServer((request, response) => {
  const path = request.url.split("?")[0];
  response.writeHead(200, { "content-type": assets.has(path) ? path.endsWith(".png") ? "image/png" : path.endsWith(".css") ? "text/css" : "text/javascript" : "text/html" });
  response.end(assets.get(path) ?? `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/${css}"></head><body><div id="root"></div><script src="/${js}"></script></body></html>`);
});
await new Promise(done => server.listen(0, "127.0.0.1", done));
const origin = `http://127.0.0.1:${server.address().port}`;
try {
  for (const browserType of [chromium, webkit]) {
    const browser = await browserType.launch({ headless: true });
    try {
      for (const language of ["en", "es"]) {
        for (const status of ["paid_pending_completion", "checkout_open", "payment_failed", "refunded", "unavailable", "network", "canceled", "closed"]) {
          const context = await browser.newContext({ viewport: { width: browserType === webkit ? 320 : 390, height: 844 } });
          const page = await context.newPage(); page.setDefaultTimeout(6000);
          const requests = [], errors = [], unexpected = [];
          const expectsRecord = !["canceled", "closed", "unavailable", "network"].includes(status);
          const expectsRequest = !["canceled", "closed"].includes(status);
          page.on("pageerror", error => errors.push(error.message));
          await page.addInitScript(() => {
            sessionStorage.setItem("tuveloz:checkout-status-token", "synthetic-private-token");
            localStorage.setItem("tuveloz-language", "en");
          });
          await page.route("**/*", async route => {
            const request = route.request(), url = new URL(request.url());
            if (url.origin !== origin) { unexpected.push(request.url()); return route.abort(); }
            if (url.pathname === "/api/stripe/checkout") {
              requests.push({ url: request.url(), headers: request.headers() });
              if (status === "network") return route.abort("failed");
              return route.fulfill({ status: status === "unavailable" ? 404 : 200, contentType: "application/json",
                body: JSON.stringify(status === "unavailable" ? { error: "Not found" } : { payment: {
                  productName: "SYNTHETIC service — not a real payment", customerTotalCents: 10500, status,
                } }) });
            }
            return route.continue();
          });
          try {
            const params = new URLSearchParams({ lang: language });
            if (expectsRequest) params.set("session_id", "cs_synthetic");
            if (status === "canceled") params.set("canceled", "1");
            await page.goto(`${origin}/success?${params}`);
            await page.getByRole("button", { name: language === "es" ? "Change the whole page to English" : "Cambiar toda la página a español", exact: true }).waitFor();
            await page.getByRole("heading", { level: 1, name: expectsRecord
              ? language === "es" ? "Su registro de pago está disponible." : "Your payment record is available."
              : ["unavailable", "network"].includes(status)
                ? language === "es" ? "No pudimos cargar este registro de pago." : "We couldn’t load this payment record."
                : status === "canceled" ? language === "es" ? "Se canceló el proceso de pago." : "Checkout was canceled."
                  : language === "es" ? "Los pagos de clientes aún no están disponibles." : "Customer payments are not open yet.", exact: true }).waitFor();
            const text = await page.locator("main").innerText();
            assert.equal(text.includes("TUVELOZ LLC"), expectsRecord);
            if (expectsRecord) {
              assert.ok(text.includes("SYNTHETIC service — not a real payment"));
              assert.ok(text.includes("$105.00"));
              if (status !== "paid_pending_completion") assert.doesNotMatch(text, /\bPaid;|\bPagado;/);
              assert.doesNotMatch(text, new RegExp(status));
            }
            assert.equal(requests.length, expectsRequest ? 1 : 0);
            for (const request of requests) {
              assert.equal(request.headers["x-tuveloz-request-token"], "synthetic-private-token");
              assert.ok(!request.url.includes("synthetic-private-token"));
            }
            assert.equal(await page.getByRole("link", { name: language === "es" ? "Política de pagos" : "Payment policy", exact: true }).getAttribute("href"), language === "es" ? "/es/payments" : "/payments");
            assert.equal(await page.getByRole("link", { name: language === "es" ? "Solicitar ingreso como proveedor" : "Apply as a provider", exact: true }).getAttribute("href"), language === "es" ? "/es/join#provider-apply" : "/join#provider-apply");
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
            assert.deepEqual(errors, []); assert.deepEqual(unexpected, []);
            if (output && status === "paid_pending_completion") await page.screenshot({ path: resolve(output, `${browserType.name()}-${language}-synthetic-payment.png`), fullPage: true });
            // Switching language must preserve the verified record and avoid another lookup.
            await page.getByRole("button", { name: language === "es" ? "Change the whole page to English" : "Cambiar toda la página a español", exact: true }).click();
            await page.getByRole("link", { name: language === "es" ? "Payment policy" : "Política de pagos", exact: true }).waitFor();
            assert.equal(requests.length, expectsRequest ? 1 : 0);
            console.log(`PASS ${browserType.name()}: ${language} ${status}, mobile layout, links and language switch`);
          } finally { await context.close(); }
        }
      }
    } finally { await browser.close(); }
  }
} finally { await new Promise(done => server.close(done)); }
