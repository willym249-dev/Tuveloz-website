// Actual form/page components, isolated HTTP fixtures and synthetic data only.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, webkit } from "playwright";
import { build } from "vite";
import { consentApi, scopeApi, syntheticRequestScope, syntheticSelectionScope, syntheticSelectionConsent } from "../helpers/customer-job-consent.mjs";

const root = fileURLToPath(new URL("../..", import.meta.url));
const built = await build({ root, configFile: false, envFile: false, logLevel: "error",
  define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" },
  resolve: { alias: { "next/link": fileURLToPath(import.meta.resolve("vinext/shims/link")),
    "next/navigation": fileURLToPath(import.meta.resolve("vinext/shims/navigation")) } },
  build: { write: false, lib: { entry: resolve(root, "tests/e2e/fixtures/customer-job-consent.tsx"), name: "ConsentFixture", formats: ["iife"] } },
});
const bundle = Array.isArray(built) ? built[0] : built;
const assets = new Map(bundle.output.map(asset => ["/" + asset.fileName, asset.type === "chunk" ? asset.code : asset.source]));
const js = bundle.output.find(asset => asset.type === "chunk").fileName;
const css = bundle.output.find(asset => asset.fileName.endsWith(".css")).fileName;
const server = createServer((request, response) => {
  const path = request.url.split("?")[0];
  if (assets.has(path)) {
    response.writeHead(200, { "content-type": path.endsWith(".css") ? "text/css" : "text/javascript" }); response.end(assets.get(path));
  } else if (["/post-job", "/my-request"].includes(path)) {
    response.writeHead(200, { "content-type": "text/html" });
    response.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/${css}"></head><body><div id="root"></div><script src="/${js}"></script></body></html>`);
  } else { response.writeHead(404); response.end(); }
});
await new Promise(done => server.listen(0, "127.0.0.1", done));
const origin = `http://127.0.0.1:${server.address().port}`;
const json = (body, status = 200) => ({ status, contentType: "application/json", body: JSON.stringify(body) });
const report = [];
const terms = page => page.locator('[name="terms-accepted"]');
const privacy = page => page.locator('[name="privacy-acknowledged"]');
const quoteCheck = page => page.locator('.quote-confirm input[type="checkbox"]');
const quoteConfirm = page => page.getByRole("button", { name: /^(Confirm quote|Confirmar cotización)$/ });
const langSelect = page => page.getByLabel("Language for authorizations and messages / Idioma de autorizaciones y mensajes");
const quote = async language => ({ ...syntheticSelectionScope.quote, id: "synthetic-quote", priceCents: "10000", status: "submitted", declineReason: "",
  providerEmail: undefined, ratingAverage: 0, reviewCount: 0, providerWorkLocations: "I travel to customers",
  providerBusinessMunicipality: "Rockville", selectionAcceptance: await syntheticSelectionConsent(language), selectionBlockedReason: "" });
async function quoteReply(language, changes = {}) {
  return { accessToken: "synthetic-token", job: { ...syntheticRequestScope, id: "synthetic-request", isTestJob: true,
    status: "approved", service: "Battery replacement", customerName: "SYNTHETIC Customer", customerEmail: "customer@example.invalid" },
    quotes: [{ ...await quote(language), ...changes }], review: null };
}
async function fillRequest(page) {
  for (const [name, value] of Object.entries({ name: "SYNTHETIC Customer", email: "customer@example.invalid", vehicle: "SYNTHETIC car",
    "job-details": "SYNTHETIC car question", municipality: "Rockville", zip: "20850", "service-address": syntheticRequestScope.serviceAddress,
    "scheduled-for": "2030-10-01T12:00" })) await page.locator(`[name="${name}"]`).fill(value);
}
async function chooseQuote(page) {
  await page.getByRole("button", { name: "Choose provider", exact: true }).click();
  await quoteCheck(page).waitFor();
}
try {
  for (const browserType of [chromium, webkit]) {
    const browser = await browserType.launch({ headless: true });
    try {
      async function run(name, path, action, handler = null) {
        if (process.env.CONSENT_CASE && !name.includes(process.env.CONSENT_CASE)) return;
        const context = await browser.newContext({ viewport: { width: browserType === webkit ? 320 : 390, height: 844 } });
        const page = await context.newPage(); page.setDefaultTimeout(5000);
        const posts = [], errors = [], unexpected = [];
        page.on("pageerror", error => errors.push(error.message));
        await context.route("**/*", async route => {
          const request = route.request(), url = new URL(request.url());
          if (url.origin !== origin) { unexpected.push(url.href); return route.abort(); }
          if (url.pathname === "/brand-badge.png") return route.fulfill({ status: 200, contentType: "image/png", body: await readFile(resolve(root, "public/brand-badge.png")) });
          if (url.pathname === "/api/analytics") return route.fulfill(json({ ok: true }));
          if (request.method() === "GET" && url.pathname === "/api/job-appointment") return route.fulfill(json({ appointment: null, role: "customer", canEdit: false }));
          if (request.method() === "GET" && url.pathname === "/api/job-inspection") return route.fulfill(json({ items: [], suggestions: [], serviceLabels: [], role: "customer", canEdit: false }));
          if (url.pathname === "/api/places/autocomplete") return route.fulfill(json({ suggestions: [] }));
          if (["/api/requests", "/api/customer-quotes"].includes(url.pathname)) {
            if (request.method() === "POST") posts.push(request);
            if (handler) return handler(route, posts);
            return route.fulfill(json(await quoteReply(url.searchParams.get("language") || "en")));
          }
          if (/^\/(es\/)?(terms|privacy|customer-agreement|payments)$/.test(url.pathname)) {
            return route.fulfill({ status: 200, contentType: "text/html", body: "<title>Synthetic policy page</title>Policy navigation fixture" });
          }
          if (assets.has(url.pathname) || ["/post-job", "/my-request"].includes(url.pathname)) return route.continue();
          unexpected.push(url.pathname); return route.abort();
        });
        try {
          await page.goto(origin + path);
          await action(page, posts);
          assert.deepEqual(errors, []);
          assert.deepEqual(unexpected, []);
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "fits a phone without sideways scrolling");
          if (process.env.CONSENT_CASE && await page.locator(".quote-confirm").count()) {
            await page.locator(".quote-confirm").screenshot({ path: resolve(root, `outputs/consent-${browserType.name()}-verified.png`) });
          }
          report.push({ browser: browserType.name(), name, status: "passed" });
          console.log(`PASS ${browserType.name()} ${name}`);
        } catch (error) {
          const overflow = await page.evaluate(() => [...document.querySelectorAll("body *")].filter(element => element.getBoundingClientRect().right > innerWidth + 1)
            .slice(-12).map(element => ({ tag: element.tagName, class: element.className, width: element.getBoundingClientRect().width, text: element.textContent?.slice(0, 65) })));
          console.error(JSON.stringify({ overflow }));
          if (process.env.CONSENT_CASE) await page.screenshot({ path: resolve(root, `outputs/consent-${browserType.name()}.png`), fullPage: true });
          report.push({ browser: browserType.name(), name, status: "failed", error: String(error) });
          console.error(`FAIL ${browserType.name()} ${name}: ${error.stack}`);
        } finally { await context.close(); }
      }
      await run("request-language-and-scope-reset-preserve-draft", "/post-job", async page => {
        await fillRequest(page); await terms(page).check(); await privacy(page).check();
        await page.getByRole("button", { name: "Switch language" }).click();
        assert.equal(await terms(page).isChecked(), false); assert.equal(await privacy(page).isChecked(), false);
        assert.equal(await page.locator('[name="vehicle"]').inputValue(), "SYNTHETIC car");
        assert.equal(await page.locator('[name="customer-consent-language"]').inputValue(), "es");
        const presentation = await consentApi.customerRequestConsentPresentation("es");
        assert.equal(await terms(page).locator("..").locator("span").innerText(), presentation.request.presentedText);
        await terms(page).check(); await privacy(page).check();
        await page.locator('[name="job-details"]').fill("SYNTHETIC changed scope");
        assert.equal(await terms(page).isChecked(), false); assert.equal(await privacy(page).isChecked(), false);
      });
      await run("request-failed-receipt-preserves-draft-and-clears-consent", "/post-job", async (page, posts) => {
        await fillRequest(page); await terms(page).check(); await privacy(page).check();
        await page.locator('button[type="submit"]').click(); await page.locator('button[type="submit"]').click();
        await page.getByRole("alert").waitFor();
        assert.equal(posts.length, 1); assert.equal(await terms(page).isChecked(), false);
        assert.equal(await page.locator('[name="vehicle"]').inputValue(), "SYNTHETIC car");
        assert.equal(await page.getByRole("heading", { name: "Request received." }).count(), 0);
      }, async route => route.fulfill(json({ ok: true })));
      for (const language of ["en", "es"]) {
        await run(`request-${language}-exact-links-submit-receipt`, "/post-job", async (page, posts) => {
          await fillRequest(page);
          if (language === "es") await page.getByRole("button", { name: "Switch language" }).click();
          const presentation = await consentApi.customerRequestConsentPresentation(language);
          const link = page.locator(`a[href="${language === "es" ? "/es" : ""}/terms"]`);
          const popupPromise = page.waitForEvent("popup"); await link.click(); const popup = await popupPromise;
          await popup.waitForLoadState(); assert.ok(popup.url().endsWith(`${language === "es" ? "/es" : ""}/terms`)); await popup.close();
          assert.equal(await terms(page).isChecked(), false, "opening policies is not acceptance");
          await terms(page).check(); await privacy(page).check();
          await page.locator('button[type="submit"]').click();
          assert.equal(posts.length, 0, "first step only opens confirmation");
          await page.locator('button[type="submit"]').click();
          const downloadButton = page.getByRole("button", { name: language === "es" ? "Descargar mi aceptación" : "Download my acceptance" });
          await downloadButton.waitFor(); assert.equal(posts.length, 1);
          assert.ok(posts[0].postData().includes(presentation.request.agreementHash));
          assert.ok(posts[0].postData().includes(presentation.privacy.agreementHash));
          const downloadPromise = page.waitForEvent("download"); await downloadButton.click(); const download = await downloadPromise;
          const content = JSON.parse(await readFile(await download.path(), "utf8"));
          assert.equal(content.request.presentedText, presentation.request.presentedText);
          assert.equal(content.request.language, language);
        }, async route => route.fulfill(json({ ok: true, accessToken: "synthetic-token", consent: await consentApi.customerRequestConsentPresentation(language,
          scopeApi.customerRequestScopeSnapshot(syntheticRequestScope)) }, 201)));

        await run(`selection-${language}-exact-download-and-submit`, "/my-request?token=synthetic-token", async (page, posts) => {
          await langSelect(page).waitFor();
          if (language === "es") await langSelect(page).selectOption("es");
          await chooseQuote(page);
          const record = await syntheticSelectionConsent(language);
          assert.equal(await quoteCheck(page).locator("..").locator("span").innerText(), record.presentedText);
          assert.equal(await quoteConfirm(page).isDisabled(), true);
          const popupPromise = page.waitForEvent("popup");
          await page.locator(`.quote-confirm a[href="${language === "es" ? "/es" : ""}/payments"]`).click();
          const popup = await popupPromise; await popup.waitForLoadState(); await popup.close();
          assert.equal(await quoteCheck(page).isChecked(), false);
          const downloadPromise = page.waitForEvent("download");
          await page.getByRole("button", { name: language === "es" ? "Descargar autorización" : "Download authorization" }).click();
          const saved = JSON.parse(await readFile(await (await downloadPromise).path(), "utf8"));
          assert.equal(saved.agreementText, record.agreementText);
          await quoteCheck(page).check(); await quoteConfirm(page).click();
          await page.getByText("Quote accepted", { exact: true }).first().waitFor();
          assert.equal(posts.length, 1); const submitted = posts[0].postDataJSON();
          assert.equal(submitted.language, language); assert.equal(submitted.selectionAgreementHash, record.agreementHash);
        }, async route => route.fulfill(route.request().method() === "POST"
          ? json({ ok: true, customerAcceptanceId: "synthetic-acceptance", providerEmail: "provider@example.invalid" })
          : json(await quoteReply(new URL(route.request().url()).searchParams.get("language")))));
      }
      await run("selection-language-change-requires-new-consent", "/my-request?token=synthetic-token", async page => {
        await chooseQuote(page); await quoteCheck(page).check();
        await langSelect(page).selectOption("es");
        await quoteCheck(page).waitFor();
        assert.equal(await quoteCheck(page).isChecked(), false); assert.equal(await quoteConfirm(page).isDisabled(), true);
        assert.equal(await page.locator('.quote-confirm a[href="/es/payments"]').count(), 1);
      });
      await run("selection-incomplete-evidence-cannot-be-selected", "/my-request?token=synthetic-token", async page => {
        await page.getByRole("button", { name: "Choose provider", exact: true }).waitFor();
        assert.equal(await page.getByRole("button", { name: "Choose provider", exact: true }).isDisabled(), true);
      }, async route => route.fulfill(json(await quoteReply("en", { selectionAcceptance: { language: "en", presentedText: "Incomplete record" } }))));
      let reads = 0, lateResponse;
      await run("selection-late-english-response-cannot-replace-spanish", "/my-request?token=synthetic-token", async page => {
        await chooseQuote(page); await quoteCheck(page).check();
        await page.getByRole("button", { name: "Refresh request", exact: true }).click();
        await page.waitForRequest(request => new URL(request.url()).pathname === "/api/customer-quotes", { timeout: 1000 }).catch(() => {});
        await langSelect(page).selectOption("es"); await quoteCheck(page).waitFor();
        assert.ok(lateResponse); await lateResponse.fulfill(json(await quoteReply("en"))).catch(() => {});
        assert.equal(await quoteCheck(page).locator("..").locator("span").innerText(), (await syntheticSelectionConsent("es")).presentedText);
        assert.equal(await quoteCheck(page).isChecked(), false);
      }, async route => {
        reads++;
        if (reads === 2) { lateResponse = route; return; }
        return route.fulfill(json(await quoteReply(new URL(route.request().url()).searchParams.get("language"))));
      });
      let revision = 0;
      await run("selection-refreshed-price-clears-consent", "/my-request?token=synthetic-token", async page => {
        await chooseQuote(page); await quoteCheck(page).check();
        await page.getByRole("button", { name: "Refresh request", exact: true }).click();
        await page.getByText(/\$210\.00/).first().waitFor(); await quoteCheck(page).waitFor();
        assert.equal(await quoteCheck(page).isChecked(), false); assert.equal(await quoteConfirm(page).isDisabled(), true);
      }, async route => {
        revision++;
        const changed = revision > 1 ? { customerTotalCents: "21000", selectionAcceptance: await syntheticSelectionConsent("en", { customerTotalCents: "21000" }) } : {};
        return route.fulfill(json(await quoteReply("en", changed)));
      });
      for (const failure of ["malformed", "network", "timeout"]) {
        await run(`selection-${failure}-requires-status-refresh`, "/my-request?token=synthetic-token", async (page, posts) => {
          if (failure === "timeout") await page.clock.install();
          await chooseQuote(page); await quoteCheck(page).check(); await quoteConfirm(page).click();
          if (failure === "timeout") await page.clock.fastForward(46000);
          await page.getByRole("alert").first().waitFor();
          assert.equal(posts.length, 1); assert.equal(await quoteConfirm(page).isDisabled(), true);
          await page.getByRole("button", { name: "Refresh request", exact: true }).click();
          await quoteCheck(page).waitFor(); assert.equal(await quoteCheck(page).isChecked(), false);
          assert.equal(posts.length, 1, "refresh never repeats a booking decision");
        }, async route => {
          if (route.request().method() === "GET") return route.fulfill(json(await quoteReply("en")));
          if (failure === "network") return route.abort("failed");
          if (failure === "timeout") return;
          return route.fulfill(json({ ok: true }));
        });
      }
    } finally { await browser.close(); }
  }
} finally { await new Promise(done => server.close(done)); }
await mkdir(resolve(root, "outputs"), { recursive: true });
const { writeFile } = await import("node:fs/promises");
await writeFile(resolve(root, process.env.CONSENT_CASE ? "outputs/customer-job-consent-preview.json" : "outputs/customer-job-consent-browser.json"), JSON.stringify(report, null, 2));
console.log(`${report.filter(item => item.status === "passed").length}/${report.length} cases passed`);
if (report.some(item => item.status !== "passed")) process.exitCode = 1;
