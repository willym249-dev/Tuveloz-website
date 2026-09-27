// Actual privacy page; synthetic responses over loopback, no external access.
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
  resolve: { alias: { "next/link": fileURLToPath(import.meta.resolve("vinext/shims/link")),
    "next/navigation": fileURLToPath(import.meta.resolve("vinext/shims/navigation")) } },
  build: { write: false, lib: { entry: resolve(root, "tests/e2e/fixtures/privacy-center.tsx"), name: "PrivacyFixture", formats: ["iife"] } },
});
const bundle = Array.isArray(built) ? built[0] : built;
const assets = new Map(bundle.output.map(asset => ["/" + asset.fileName, asset.type === "chunk" ? asset.code : asset.source]));
const js = bundle.output.find(asset => asset.type === "chunk").fileName;
const css = bundle.output.find(asset => asset.fileName.endsWith(".css")).fileName;
assets.set("/brand-badge.png", readFileSync(resolve(root, "public/brand-badge.png")));
const server = createServer((request, response) => {
  const path = request.url.split("?")[0];
  response.writeHead(200, { "content-type": assets.has(path) ? path.endsWith(".png") ? "image/png" : path.endsWith(".css") ? "text/css" : "text/javascript" : "text/html" });
  response.end(assets.get(path) ?? `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/${css}"></head><body><div id="root"></div><script src="/${js}"></script></body></html>`);
});
await new Promise(done => server.listen(0, "127.0.0.1", done));
const origin = `http://127.0.0.1:${server.address().port}`;
const snapshot = role => ({ role, email: "synthetic@example.invalid", availablePrivacyScopes: ["customer", "provider"],
  preferences: { marketingEmail: false, productUpdateEmail: false, optionalReminderEmail: true,
    essentialTransactionalEmail: true, securityEmail: true, launchNotificationEmail: false,
    launchNotificationConsentAt: "", launchNotificationConsentVersion: "", launchNotificationConsentSource: "" },
  requests: [], immediateTools: { dataExport: `/api/privacy-center/export?scope=${role}`, profileCorrection: "/customer" }, notices: [] });
const json = (body, status = 200) => ({ status, contentType: "application/json", body: JSON.stringify(body) });
const failed = json({ error: "We couldn't load your privacy center. Please try again." }, 503);
try {
  for (const browserType of [chromium, webkit]) {
    const browser = await browserType.launch({ headless: true });
    try {
      {
        // The private privacy center currently has no reviewed Spanish route.
        // Preserve that boundary; this fixture exercises its actual English UI.
        const refreshName = "Refresh privacy center";
        const providerName = "Provider application data";
        async function run(name, responses, action, initial = "", clock = false) {
          const context = await browser.newContext({ viewport: { width: browserType === webkit ? 320 : 390, height: 844 } });
          const page = await context.newPage(); page.setDefaultTimeout(5000);
          if (clock) await page.clock.install();
          const queries = [], methods = [], errors = [], unexpected = [];
          page.on("pageerror", error => errors.push(error.message));
          await page.route("**/*", route => {
            const request = route.request(), url = new URL(request.url());
            if (url.origin !== origin || (request.method() !== "GET" && url.pathname !== "/api/privacy-center")) { unexpected.push(request.url()); return route.abort(); }
            if (url.pathname === "/api/account") return route.fulfill(json({ error: "Synthetic" }, 401));
            if (url.pathname === "/api/privacy-center") {
              const planned = responses[queries.length]; queries.push(url.searchParams.get("scope")); methods.push(request.method());
              if (planned === "timeout") return;
              if (planned === null) return route.abort("failed");
              if (!planned) { unexpected.push("Unexpected privacy request"); return route.abort(); }
              return route.fulfill(planned);
            }
            return route.continue();
          });
          try {
            await page.goto(origin + "/privacy-center" + initial);
            await action(page, queries, methods);
            assert.equal(queries.length, responses.length);
            assert.deepEqual(unexpected, []); assert.deepEqual(errors, []);
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, "privacy controls fit the phone");
            console.log(`PASS ${browserType.name()}: ${name}`);
          } finally { await context.close(); }
        }
        const exportedScope = (page, scope) => page.locator(`a[href="/api/privacy-center/export?scope=${scope}"]`).first().waitFor();
        for (const [name, failure] of [["server outage", failed], ["malformed response", json({})], ["connection failure", null]]) {
          await run(name, [failure, json(snapshot("customer"))], async page => {
            await page.getByRole("alert").waitFor();
            await page.getByRole("button", { name: refreshName, exact: true }).click();
            await exportedScope(page, "customer");
            assert.equal(await page.getByRole("alert").count(), 0);
          });
        }
        await run("provider link keeps the requested view", [json(snapshot("provider"))], async (page, queries) => {
          await exportedScope(page, "provider"); assert.deepEqual(queries, ["provider"]);
        }, "?scope=provider");
        await run("retry keeps the selected provider view", [json(snapshot("customer")), failed, json(snapshot("provider"))], async (page, queries) => {
          await page.getByRole("button", { name: providerName, exact: true }).click();
          await page.getByRole("alert").waitFor();
          await page.getByRole("button", { name: refreshName, exact: true }).click();
          await exportedScope(page, "provider"); assert.deepEqual(queries, [null, "provider", "provider"]);
        });
        await run("stalled request can be retried", ["timeout", json(snapshot("provider"))], async (page, queries) => {
          while (queries.length === 0) await page.waitForTimeout(10);
          await page.clock.runFor(15050);
          await page.getByRole("alert").waitFor();
          await page.getByRole("button", { name: refreshName, exact: true }).click();
          await exportedScope(page, "provider"); assert.deepEqual(queries, ["provider", "provider"]);
        }, "?scope=provider", true);
        for (const [name, failure] of [["save outage", json({ error: "We couldn't confirm this update. Refresh your privacy center to check it before trying again." }, 503)],
          ["malformed save confirmation", json({})], ["stalled save", "timeout"]]) {
          await run(name, [json(snapshot("customer")), failure, json(snapshot("customer"))], async (page, queries, methods) => {
            await page.getByRole("button", { name: "Save communication choices", exact: true }).click();
            if (failure === "timeout") {
              while (queries.length < 2) await page.waitForTimeout(10);
              await page.clock.runFor(15050);
            }
            await page.getByRole("alert").filter({ hasText: "couldn't confirm" }).waitFor();
            assert.equal(await page.getByRole("status").count(), 0, "uncertain writes must not claim success");
            await page.getByRole("button", { name: refreshName, exact: true }).click();
            await page.waitForFunction(() => !document.querySelector('[role="alert"]'));
            assert.deepEqual(methods, ["GET", "POST", "GET"], "refresh only reads the saved result, without repeating the write");
          }, "", failure === "timeout");
        }
      }
    } finally { await browser.close(); }
  }
} finally { await new Promise(done => server.close(done)); }
