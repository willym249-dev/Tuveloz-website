// Actual onboarding page and React forms, with delayed loopback API fixtures.
// This checks browser receipts and retries; it makes no real provider records.
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
const built = await build({
  root, configFile: false, envFile: false, logLevel: "error",
  define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" },
  resolve: { alias: {
    "next/link": fileURLToPath(import.meta.resolve("vinext/shims/link")),
    "next/navigation": fileURLToPath(import.meta.resolve("vinext/shims/navigation")),
  } },
  build: { write: false, lib: {
    entry: resolve(root, "tests/e2e/fixtures/provider-onboarding.tsx"), name: "OnboardingFixture", formats: ["iife"],
  } },
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
const json = (status, body) => ({ status, contentType: "application/json", body: JSON.stringify(body) });
const report = { testedAt: new Date().toISOString(), cases: [] };
function fixture() {
  return {
    policy: { version: "0.11", status: "active", jurisdiction: "Maryland", marketplaceMode: "onboarding_only", notice: "Customer bookings are not open yet." },
    provider: { id: "synthetic", name: "Example provider", email: "test@example.invalid", preferredLanguage: "English", applicationStatus: "new", verificationStatus: "not reviewed" },
    pathway: { code: "independent_startup", label: "Independent startup", providerLevelLabel: "Independent", personId: "test-person" },
    identityVerification: { status: "verified", complete: true, attemptsUsed: 1, attemptsRemaining: 2, method: "stripe", ownerOperatorEligible: true, canStart: false },
    services: [{ code: "test-service", label: "Example service", statusLabel: "Not available for customer jobs", description: "Synthetic test only.", requirements: [{
      code: "test-document", label: "Example certificate", status: "rejected", uploadAllowed: false,
      submission: { id: "test-evidence", status: "rejected", submittedAt: "2030-01-01", scanStatus: "clean", scanLabel: "File scan complete", expiresAt: "", downloadAllowed: true, expirationStatus: "not_applicable" },
    }] }],
    agreements: [{ key: "terms", title: "Terms of Use", href: "/terms", requiredVersion: "test", releaseStatus: "active", acceptedForApplicationReview: false, eligibilityCurrent: false }],
    appeals: [], dataRightsRequests: [], privacy: { storage: "Documents stay private.", access: "", retention: "", deletion: "", prohibitedUploads: "" },
    allAgreementsCurrent: false, allAgreementsAcknowledgedForApplicationReview: false, allAgreementsEligibilityCurrent: false, guide: [],
  };
}
const actions = { appeal: "submit-evidence-appeal", privacy: "submit-data-rights-request", agreements: "accept-current-agreements" };
const field = { appeal: '[name="statement"]', privacy: '[name="details"]', agreements: '[name="signerName"]' };
const entered = { appeal: "Please review the issuing authority confirmation again.", privacy: "Please send a copy of the provider data in my account.", agreements: "Test Signer" };
const receipt = { appeal: /Appeal submitted|Apelación enviada/, privacy: /Privacy request submitted|Solicitud de privacidad enviada/, agreements: /Current agreement versions accepted|Versiones actuales de los acuerdos aceptadas/ };
async function prepare(page, kind) {
  if (kind === "appeal") await page.locator(".provider-requirement-list summary").click();
  await page.locator(field[kind]).fill(entered[kind]);
  const form = page.locator("form").filter({ has: page.locator(field[kind]) });
  if (kind === "privacy") await form.locator("select").selectOption("access");
  if (kind === "agreements") await form.locator('[name="signerTitle"]').fill("Owner");
  for (const checkbox of await form.locator('input[type="checkbox"]').all()) await checkbox.check();
  const button = form.locator('button[type="submit"]');
  await button.scrollIntoViewIfNeeded();
  // The site uses smooth scrolling; wait for the browser to settle before click.
  await page.waitForFunction(() => new Promise(done => {
    let previous = scrollY, stable = 0;
    const next = () => { stable = scrollY === previous ? stable + 1 : 0; previous = scrollY; if (stable >= 3) done(true); else requestAnimationFrame(next); };
    requestAnimationFrame(next);
  }));
  return { form, button };
}
try {
  for (const browserType of [chromium, webkit]) {
    const browser = await browserType.launch({ headless: true });
    try {
      for (const spanish of [false, true]) for (const kind of Object.keys(actions)) {
        for (const outcome of kind === "agreements" ? ["success", "rejected", "unconfirmed"] : ["success", "rejected", "unconfirmed", "refresh-fails"]) {
          const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
          const caseName = `${browserType.name()}-${spanish ? "es" : "en"}-${kind}-${outcome}`;
          const errors = [], posts = [];
          let state = fixture(), confirmed = false, releasePost;
          state.provider.preferredLanguage = spanish ? "Spanish" : "English";
          const delayed = new Promise(done => { releasePost = done; });
          page.on("pageerror", error => errors.push(error.message));
          await page.route("**/*", async route => {
            if (!route.request().url().startsWith(origin)) return route.abort();
            if (!route.request().url().includes("/api/provider-onboarding")) return route.continue();
            if (route.request().method() === "GET") return route.fulfill(confirmed && outcome === "refresh-fails" ? json(503, { error: "Synthetic refresh failed" }) : json(200, state));
            const data = route.request().postDataJSON(); posts.push(data);
            await delayed;
            if (outcome === "rejected") return route.fulfill(json(400, { error: "Please check your request and try again." }));
            if (outcome === "unconfirmed") return route.fulfill(json(200, {}));
            confirmed = true;
            if (kind === "agreements") state = { ...state, allAgreementsAcknowledgedForApplicationReview: true };
            if (kind === "appeal") state = { ...state, appeals: [{ id: "test-appeal", evidenceId: "test-evidence", status: "submitted", submittedAt: "2030-01-01" }] };
            return route.fulfill(json(200, { ok: true, ...state }));
          });
          try {
            await page.goto(`${origin}/provider-onboarding${spanish ? "?spanish" : ""}`);
            await page.locator('.provider-service-status-card').waitFor();
            // The full private page is English-only. These two request forms
            // use the saved applicant language, like document uploads do.
            await page.getByRole("heading", { name: "Your next steps", exact: true }).waitFor();
            await page.getByRole("heading", { name: "Documents for your services", exact: true }).waitFor();
            assert.equal(await page.getByRole("heading", { name: "Expiration and reminders", exact: true }).count(), 0, "do not show an empty renewal panel");
            const { button } = await prepare(page, kind);
            if (spanish && kind !== "agreements") assert.equal(await button.textContent(), kind === "appeal" ? "Enviar apelación" : "Enviar solicitud de privacidad");
            await button.click();
            await page.waitForFunction(() => document.querySelector('button[type="submit"]:disabled'));
            assert.equal(posts.length, 1);
            assert.equal(posts[0].action, actions[kind]);
            releasePost();
            if (outcome === "rejected" || outcome === "unconfirmed") {
              await page.locator('[role="alert"]').waitFor();
              assert.equal(await page.locator(field[kind]).inputValue(), entered[kind], "unconfirmed submission preserves the draft");
              assert.equal(await page.locator('main > section > .portal-success').count(), 0);
            } else {
              await page.getByRole("status").filter({ hasText: outcome === "refresh-fails" ? /Refresh the page|Actualice la página/ : receipt[kind] }).waitFor({ timeout: 4000 });
              if (spanish) assert.match(await page.locator('.account-main > .portal-success').textContent(), outcome === "refresh-fails" ? /Recibimos su solicitud/ : kind === "appeal" ? /Apelación enviada/ : kind === "privacy" ? /Solicitud de privacidad enviada/ : /Versiones actuales/);
              assert.equal(await page.locator('[role="alert"]').count(), 0, "confirmed write must not become a failure");
              if (kind === "privacy" || outcome === "refresh-fails") assert.equal(await page.locator(field[kind]).inputValue(), "");
              if (kind === "agreements") assert.equal(await page.locator(field[kind]).count(), 0);
            }
            assert.equal(posts.length, 1, "one submission only");
            assert.deepEqual(errors, []);
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
            if (outputDir && kind === "privacy" && outcome === "success") {
              await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
              await page.screenshot({ path: resolve(outputDir, `${caseName}.png`), fullPage: true });
              await page.screenshot({ path: resolve(outputDir, `${caseName}-top.png`) });
            }
            report.cases.push({ name: caseName, status: "passed" });
            console.log(`PASS ${caseName}`);
          } catch (error) {
            releasePost();
            report.cases.push({ name: caseName, status: "failed", error: error.message, alerts: await page.locator('[role="alert"]').allTextContents() });
            console.error(`FAIL ${caseName}: ${error.message}`);
            if (process.env.ONBOARDING_TEST_FAIL_FAST === "1") throw error;
          } finally { await page.close(); }
        }
      }
    } finally { await browser.close(); }
  }
} finally {
  await new Promise(done => server.close(done));
  if (outputDir) writeFileSync(resolve(outputDir, "report.json"), JSON.stringify(report, null, 2));
}
assert.equal(report.cases.filter(item => item.status === "failed").length, 0);
