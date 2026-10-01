// Real customer page, loopback-only synthetic replies; no account or live job.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, webkit } from "playwright";
import { build } from "vite";
import { syntheticRequestScope, syntheticSelectionScope, syntheticSelectionConsent } from "../helpers/customer-job-consent.mjs";

const root = fileURLToPath(new URL("../..", import.meta.url));
const built = await build({ root, configFile: false, envFile: false, logLevel: "error",
  define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" },
  resolve: { alias: { "next/link": fileURLToPath(import.meta.resolve("vinext/shims/link")),
    "next/navigation": fileURLToPath(import.meta.resolve("vinext/shims/navigation")) } },
  build: { write: false, lib: { entry: resolve(root, "tests/e2e/fixtures/customer-job-consent.tsx"), name: "RecoveryFixture", formats: ["iife"] } },
});
const output = (Array.isArray(built) ? built[0] : built).output;
const assets = new Map(output.map(asset => ["/" + asset.fileName, asset.type === "chunk" ? asset.code : asset.source]));
const js = output.find(asset => asset.type === "chunk").fileName;
const css = output.find(asset => asset.fileName.endsWith(".css")).fileName;
const server = createServer((request, response) => {
  const path = request.url.split("?")[0];
  if (assets.has(path)) {
    response.writeHead(200, { "content-type": path.endsWith(".css") ? "text/css" : "text/javascript" }); response.end(assets.get(path));
  } else if (path === "/my-request") {
    response.writeHead(200, { "content-type": "text/html" });
    response.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/${css}"></head><body><div id="root"></div><script src="/${js}"></script></body></html>`);
  } else { response.writeHead(404); response.end(); }
});
await new Promise(done => server.listen(0, "127.0.0.1", done));
const origin = `http://127.0.0.1:${server.address().port}`;
const json = (body, status = 200) => ({ status, contentType: "application/json", body: JSON.stringify(body) });
const review = { id: "synthetic-review", providerName: syntheticSelectionScope.quote.providerName,
  customerDisplayName: "SYNTHETIC C.", service: "Battery replacement", rating: 5, comment: "SYNTHETIC saved review draft" };
async function snapshot(action, saved) {
  const status = action === "review" ? "accepted" : action === "decline" ? saved ? "declined" : "submitted" : saved ? "submitted" : "declined";
  return { accessToken: "synthetic-token", job: { ...syntheticRequestScope, id: "synthetic-request", isTestJob: true,
    status: action === "review" ? "completed" : "approved", service: "Battery replacement", customerName: "SYNTHETIC Customer", customerEmail: "customer@example.invalid" },
    quotes: [{ ...syntheticSelectionScope.quote, id: "synthetic-quote", priceCents: "10000", status,
      declineReason: status === "declined" ? "price" : "", ratingAverage: 0, reviewCount: 0,
      providerWorkLocations: "I travel to customers", providerBusinessMunicipality: "Rockville",
      selectionAcceptance: await syntheticSelectionConsent("en"), selectionBlockedReason: "" }],
    review: action === "review" && saved ? review : null };
}
const recovery = page => page.locator("[data-request-recovery]");
const report = [];
try {
  for (const browserType of [chromium, webkit]) {
    const browser = await browserType.launch({ headless: true });
    try {
      async function run(action, mode, language = "en") {
        const name = `${action}-${mode}-${language}`;
        if (process.env.REQUEST_CASE && !name.includes(process.env.REQUEST_CASE)) return;
        const context = await browser.newContext({ viewport: { width: browserType === webkit ? 320 : 390, height: 844 } });
        const page = await context.newPage(); page.setDefaultTimeout(4000);
        const errors = [], unexpected = [], posts = [];
        let saved = false, reads = 0, pending;
        page.on("pageerror", error => errors.push(error.message));
        await page.addInitScript(language => localStorage.setItem("tuveloz-language", language), language);
        await context.route("**/*", async route => {
          const request = route.request(), url = new URL(request.url());
          if (url.origin !== origin) { unexpected.push(url.href); return route.abort(); }
          if (url.pathname === "/brand-badge.png") return route.fulfill({ status: 200, contentType: "image/png", body: await readFile(resolve(root, "public/brand-badge.png")) });
          if (url.pathname === "/api/analytics") return route.fulfill(json({ ok: true }));
          if (url.pathname === "/api/job-appointment") return route.fulfill(json({ appointment: null, role: "customer", canEdit: false }));
          if (url.pathname === "/api/job-inspection") return route.fulfill(json({ items: [], suggestions: [], serviceLabels: [], role: "customer", canEdit: false }));
          if (url.pathname === "/api/customer-completion") return mode === "completion-failure" ? route.abort() : route.fulfill(json({ available: false, reason: "Synthetic test only." }));
          if (url.pathname === "/api/customer-quotes" && request.method() === "GET") {
            reads++;
            const state = await snapshot(action, saved);
            if (mode === "bad-refresh" && reads === 2) delete state.review;
            return route.fulfill(json(state));
          }
          if (["/api/customer-quotes", "/api/reviews"].includes(url.pathname) && request.method() === "POST") {
            posts.push(request.postDataJSON());
            if (["saved-lost-reply", "bad-refresh"].includes(mode)) { saved = true; return route.abort(); }
            if (mode === "network") return route.abort();
            if (mode === "timeout") { pending = route; return; }
            if (mode === "malformed") return route.fulfill({ status: 200, contentType: "text/html", body: "not JSON" });
            if (mode === "incomplete") return route.fulfill(json(action === "review" ? { ok: true, review: { ...review, rating: 8 } } : { ok: true, status: "accepted" }));
            pending = route;
            return;
          }
          if (assets.has(url.pathname) || url.pathname === "/my-request") return route.continue();
          unexpected.push(url.pathname); return route.abort();
        });
        try {
          if (mode === "timeout") await page.clock.install();
          await page.goto(`${origin}/my-request?token=synthetic-token&lang=${language}`);
          if (language === "es") await page.getByLabel("Language for authorizations and messages / Idioma de autorizaciones y mensajes").selectOption("es");
          let submit;
          if (action === "review") {
            await page.locator(".star-picker button").nth(4).click();
            await page.locator(".review-comment textarea").fill(review.comment);
            await page.locator(".review-button").click();
            submit = page.locator(".review-confirm .button.primary");
          } else if (action === "decline") {
            await page.locator(".quote-pass-link").click(); submit = page.locator(".quote-reason-grid button").first();
          } else { submit = page.locator(".quote-passed button"); }
          // Two immediate clicks exercise the synchronous duplicate guard.
          await page.waitForFunction(button => button && !button.disabled, await submit.elementHandle());
          await submit.evaluate(button => { button.click(); button.click(); });
          await page.waitForFunction(() => true);
          if (mode === "timeout") await page.clock.fastForward(46000);
          if (["success", "completion-failure"].includes(mode)) {
            await page.waitForFunction(() => [...document.querySelectorAll('button')].some(button => button.disabled));
            assert.equal(posts.length, 1, "only one mutation while busy");
            if (action === "review") assert.equal(await page.locator(".review-comment textarea").isDisabled(), true);
            saved = true;
            await pending.fulfill(json(action === "review" ? { ok: true, review } : {
              ok: true, status: action === "decline" ? "declined" : "submitted", declineReason: action === "decline" ? "price" : "",
            }));
          } else {
            await recovery(page).getByRole("alert").waitFor();
            assert.equal(posts.length, 1);
            if (action === "review") assert.equal(await page.locator(".review-comment textarea").inputValue(), review.comment);
            assert.equal(await submit.count() ? await submit.isDisabled() : true, true, "uncertain mutations cannot be immediately repeated");
            const check = recovery(page).getByRole("button", { name: language === "es" ? "Comprobar si se guardó" : "Check saved status", exact: true });
            await check.click();
            if (mode === "bad-refresh") {
              await recovery(page).getByRole("alert").filter({ hasText: "We could not check the request" }).waitFor();
              assert.equal(await page.locator(".review-panel blockquote").count(), 0);
              await check.click();
            }
            if (!saved) {
              await recovery(page).waitFor({ state: "detached" });
              if (action === "review") {
                assert.equal(await page.locator(".review-comment textarea").inputValue(), review.comment);
                assert.equal(await page.locator(".star-picker button").nth(4).getAttribute("aria-pressed"), "true");
                assert.equal(await page.locator(".review-confirm").count(), 0, "fresh confirmation required");
              }
            }
          }
          if (saved) {
            if (action === "review") {
              await page.locator(".review-panel blockquote").waitFor();
              assert.equal(await page.locator(".review-panel blockquote").innerText(), review.comment);
              assert.equal(await page.locator(".review-button").count(), 0);
            } else if (action === "decline") await page.locator(".quote-passed").waitFor();
            else await page.locator(".quote-pass-link").waitFor();
          }
          assert.equal(posts.length, 1, "status refresh never repeats the write");
          assert.equal(posts[0].token, "synthetic-token");
          if (action !== "review") assert.equal(posts[0].action, `${action}-quote`);
          assert.deepEqual(errors, []); assert.deepEqual(unexpected, []);
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "fits a phone");
          report.push({ browser: browserType.name(), name, passed: true }); console.log(`PASS ${browserType.name()} ${name}`);
        } catch (error) {
          report.push({ browser: browserType.name(), name, passed: false, error: String(error), pageErrors: errors,
            disabledButtons: await page.locator('button:disabled').allTextContents(), writes: posts.length });
          console.error(`FAIL ${browserType.name()} ${name}: ${error.message}`);
        } finally { await context.close(); }
      }
      for (const action of ["decline", "restore", "review"]) {
        for (const mode of ["network", "timeout", "malformed", "incomplete", "saved-lost-reply", "bad-refresh", "success"]) await run(action, mode);
        await run(action, "network", "es");
      }
      await run("review", "completion-failure");
    } finally { await browser.close(); }
  }
} finally { await new Promise(done => server.close(done)); }
await mkdir(resolve(root, "outputs"), { recursive: true });
await writeFile(resolve(root, process.env.REQUEST_REPORT || "outputs/customer-request-recovery-browser.json"), JSON.stringify(report, null, 2));
console.log(`${report.filter(item => item.passed).length}/${report.length} cases passed`);
if (report.some(item => !item.passed)) process.exitCode = 1;
