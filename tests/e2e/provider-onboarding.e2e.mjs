// Actual onboarding page and React forms, with delayed loopback API fixtures.
// This checks browser receipts and retries; it makes no real provider records.
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, webkit } from "playwright";
import { build } from "vite";
import ts from "typescript";

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
    agreements: [{ key: "terms", title: "Terms of Use", href: "/terms", requiredVersion: "0.11", releaseStatus: "active", acceptedForApplicationReview: false, eligibilityCurrent: false }],
    appeals: [], dataRightsRequests: [], privacy: { storage: "Documents stay private.", access: "", retention: "", deletion: "", prohibitedUploads: "" },
    allAgreementsCurrent: false, allAgreementsAcknowledgedForApplicationReview: false, allAgreementsEligibilityCurrent: false, guide: [],
  };
}
// Pull service-independent response copy from the real route rather than a second
// English-only test fixture. Exercise every rendered text node in both languages.
const apiSource = ts.createSourceFile("route.ts", readFileSync(resolve(root, "app/api/provider-onboarding/route.ts"), "utf8"), ts.ScriptTarget.Latest, true);
const responseCopy = {};
function collectCopy(node) {
  if (ts.isPropertyAssignment(node)) {
    const name = node.name.getText(apiSource);
    if (["notice", "storage", "access", "retention", "deletion", "prohibitedUploads", "reason"].includes(name) && ts.isStringLiteral(node.initializer)) responseCopy[name] = node.initializer.text;
    if (name === "guide" && ts.isArrayLiteralExpression(node.initializer)) responseCopy.guide = node.initializer.elements.map(value => value.text);
  }
  ts.forEachChild(node, collectCopy);
}
collectCopy(apiSource);
async function interfaceText(page) {
  return page.evaluate(() => {
    const texts = [];
    const walker = document.createTreeWalker(document.querySelector("main"), NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.parentElement.closest('[data-language-control], [data-no-interface-translation], [data-manual-language], textarea, option, [translate="no"]')) continue;
      const value = node.textContent.trim();
      if (/[a-zA-Z]/.test(value)) texts.push(value);
    }
    return [...new Set(texts)];
  });
}
async function checkApplicationRecovery(browser) {
  for (const spanish of [false, true]) for (const scenario of ["missing-pathway", "missing-name", "no-services"]) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const state = fixture();
    state.provider.preferredLanguage = spanish ? "Spanish" : "English";
    state.identityVerification = { ...state.identityVerification, complete: false, status: "not_started", canStart: false,
      ownerOperatorEligible: scenario !== "missing-pathway", manualReattestationRequired: scenario === "missing-name" };
    if (scenario === "missing-pathway") state.pathway = null;
    if (scenario !== "missing-name") state.services = [];
    const posts = [], errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/*", route => {
      const request = route.request();
      if (!request.url().startsWith(origin)) return route.abort();
      const pathname = new URL(request.url()).pathname;
      if (!pathname.startsWith("/api/")) return route.continue();
      if (request.method() === "GET") return route.fulfill(json(200, state));
      const payload = request.postDataJSON(); posts.push({ pathname, payload });
      return route.fulfill(json(200, posts.length === 1 ? {} : { ok: true, status: "queued", reference: payload.requestId }));
    });
    const caseName = `${browser.browserType().name()}-${spanish ? "es" : "en"}-recovery-${scenario}`;
    try {
      await page.goto(origin + "/provider-onboarding");
      await page.locator('.provider-service-status-card').waitFor();
      const recovery = page.locator('.provider-application-recovery');
      await recovery.waitFor({ timeout: 3000 });
      if (scenario === "missing-pathway") {
        assert.equal(await page.locator('#identity-verification').count(), 0, "missing details must not label the applicant an employee or trainee");
      }
      const draft = spanish ? "Necesito ayuda para actualizar los datos de mi solicitud." : "Please help me update the details on my application.";
      await recovery.getByRole('button', { name: spanish ? 'Pedir ayuda con mi solicitud' : 'Get help with my application' }).click();
      const form = recovery.locator('form');
      assert.equal(await form.locator('input[type="email"]').inputValue(), state.provider.email);
      assert.doesNotMatch(await form.innerText(), /chat history|historial del chat/);
      await form.locator('textarea').fill(draft);
      await form.locator('input[type="checkbox"]').check();
      await form.locator('button[type="submit"]').click();
      await form.getByRole('alert').waitFor();
      assert.equal(await form.locator('textarea').inputValue(), draft, "unconfirmed response preserves the help request");
      assert.equal(await recovery.getByRole('status').count(), 0);
      await form.locator('button[type="submit"]').click();
      await recovery.getByRole('status').waitFor();
      assert.equal(posts.length, 2);
      assert.equal(posts[0].pathname, '/api/support');
      assert.equal(posts[1].pathname, '/api/support');
      assert.equal(posts[0].payload.requestId, posts[1].payload.requestId, "retry keeps the same request reference");
      assert.equal(posts[1].payload.message, draft);
      assert.equal(posts[1].payload.audience, 'provider');
      assert.equal(posts[1].payload.language, spanish ? 'es' : 'en');
      assert.equal(posts[1].payload.email, state.provider.email);
      assert.equal(posts[1].payload.consent, true);
      assert.deepEqual(errors, []);
      for (const width of [320, 768, 1280, 390]) {
        await page.setViewportSize({ width, height: 844 });
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        const receiptLayout = await recovery.evaluate(card => {
          const bottom = card.getBoundingClientRect().bottom;
          return [...card.querySelectorAll('[role="status"], [role="status"] *')]
            .filter(element => element.getBoundingClientRect().bottom > bottom + 1)
            .map(element => ({ tag: element.tagName, excess: element.getBoundingClientRect().bottom - bottom }));
        });
        assert.deepEqual(receiptLayout, [], `the saved message and reference fit inside the card at ${width}px`);
      }
      if (outputDir && scenario === "missing-pathway") {
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
        await page.screenshot({ path: resolve(outputDir, `${caseName}.png`), fullPage: true });
      }
      report.cases.push({ name: caseName, status: 'passed' });
      console.log(`PASS ${caseName}`);
    } catch (error) {
      console.error(`FAIL ${caseName}: ${error.message}; page errors: ${JSON.stringify(errors)}`);
      throw error;
    } finally { await page.close(); }
  }
}

async function checkFullPage(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  let state = fixture();
  const posts = [], errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/*", route => {
    if (!route.request().url().startsWith(origin)) return route.abort();
    if (!route.request().url().includes("/api/")) return route.continue();
    if (route.request().method() === "GET") return route.fulfill(json(200, state));
    posts.push(route.request().postDataJSON());
    return route.fulfill(json(400, { error: "Please check your request and try again." }));
  });
  try {
    await page.goto(origin + "/provider-onboarding");
    await page.locator('.provider-service-status-card').waitFor();
    assert.equal(await page.locator('.tuveloz-launch-pause').count(), 0, 'private checklist already has the launch status and should not repeat a global English banner');
    const catalog = await page.evaluate(() => window.onboardingTest);
    const allowedUnchanged = new Set(["Tuveloz", "Stripe", "hello@tuveloz.com"]);
    for (const scenario of ["documents", "initial", "requires_input", "processing", "blocked", "expired", "manual", "conflict", "employee", "old-application"]) {
      state = fixture();
      state.policy.notice = responseCopy.notice;
      state.provider.name = "Pending"; // A real name equal to interface copy must never be translated.
      state.provider.email = "test@example.invalid";
      state.pathway.label = catalog.pathways[report.cases.length % catalog.pathways.length];
      state.pathway.providerLevelLabel = catalog.levels[report.cases.length % catalog.levels.length];
      state.privacy = Object.fromEntries(["storage", "access", "retention", "deletion", "prohibitedUploads"].map(key => [key, responseCopy[key]]));
      state.guide = responseCopy.guide;
      state.services = catalog.services.map((service, i) => ({
        ...service, statusLabel: "✕ Not available for customer jobs", reason: responseCopy.reason,
        requirements: service.requirements.map((doc, j) => ({
          ...doc, uploadAllowed: i === 0 && j === 0,
          status: ["missing", "under_review", "needs_correction", "rejected", "expired", "accepted"][j % 6],
          submission: j % 6 === 0 && j > 0 ? null : {
            id: `document-${i}-${j}`, status: "accepted", submittedAt: "2030-01-01", expiresAt: "2030-12-31",
            reviewNotes: "Pending", downloadAllowed: j % 2 === 0,
            scanLabel: ["Clean — private download allowed", "Pending — quarantined and blocked", "Scanning — quarantined and blocked", "Threat detected — blocked", "Scan failed — blocked pending a new clean result", "Scan error — blocked pending a new clean result"][j % 6],
            expirationStatus: "current", expirationLabel: j % 3 === 0 ? "Expires on 2030-12-31 (1 day remaining)" : j % 3 === 1 ? "Expired on 2030-01-01; the dependent service stays blocked" : "Expires on 2030-12-31",
            reminderLabel: j % 2 ? "Next email reminder scheduled for 2030-12-30" : "Last expiration reminder sent 2030-12-01",
          },
        })),
      }));
      state.appeals = [{ id: "appeal", evidenceId: "document-0-0", status: "under_review", submittedAt: "2030-01-01", dueAt: "2030-02-01", statement: "Pending", resolutionNotes: "Pending" }];
      state.dataRightsRequests = [{ id: "privacy", requestType: "deletion", status: "completed", submittedAt: "2030-01-01", dueAt: "2030-02-01", completedAt: "2030-01-20", legalHold: "yes", responseNotes: "Pending" }];
      state.identityVerification = {
        ...state.identityVerification, configuredForThisProvider: true,
        complete: ["documents", "manual"].includes(scenario), canStart: true,
        method: scenario === "manual" ? "manual" : "stripe",
        status: ["initial", "employee", "old-application"].includes(scenario) ? "not_started" : scenario === "conflict" ? "manual_review_required" : scenario === "documents" || scenario === "manual" ? "verified" : scenario,
        failureCode: ["blocked", "requires_input"].includes(scenario) ? "test_failure" : "",
        ownerOperatorEligible: scenario !== "employee", manualReattestationRequired: scenario === "old-application",
        expiredManualVerificationRequiresReplacement: scenario === "expired",
        conflictingExternalVerificationRequiresReview: scenario === "conflict",
      };
      await page.reload();
      await page.locator('.provider-service-status-card').waitFor();
      assert.equal(await page.locator('.provider-application-recovery').count(), scenario === 'old-application' ? 1 : 0);
      await page.evaluate(() => document.querySelectorAll('details').forEach(item => { item.open = true; }));
      const english = await interfaceText(page);
      const englishOptions = await page.locator('option').allTextContents();
      // Enter data before switching; translation must not remount the form.
      await page.locator('[name="signerName"]').fill("Test Signer");
      await page.locator('[name="termsBundleAccepted"]').check();
      const upload = page.locator('input[type="file"]').first();
      await upload.setInputFiles({ name: "Pending.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\nsynthetic-only") });
      await page.locator('header [data-language-control]').click();
      assert.equal(await page.locator('main').getAttribute('lang'), "es");
      assert.equal(await page.locator('[name="signerName"]').inputValue(), "Test Signer");
      assert.equal(await page.locator('[name="termsBundleAccepted"]').isChecked(), false, "new displayed consent needs a fresh check");
      assert.match(await page.locator('.provider-document-filename').first().textContent(), /Pending.pdf/);
      for (const node of await page.locator('[data-no-interface-translation]').all()) assert.match(await node.textContent(), /Pending|test@example.invalid/);
      const spanish = await interfaceText(page);
      const untranslated = spanish.filter(value => english.includes(value) && !allowedUnchanged.has(value));
      const spanishOptions = await page.locator('option').allTextContents();
      assert.deepEqual(untranslated, [], `${scenario}: untranslated interface text`);
      assert.equal(spanishOptions.some((value, index) => value === englishOptions[index] && /[a-zA-Z]/.test(value)), false, "select labels must also translate");
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, scenario + " has no horizontal overflow");
      assert.equal(await page.locator('a[href="/es/terms"]').count(), 1);
      if (scenario === "initial") {
        await page.setViewportSize({ width: 320, height: 740 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "small phone has no horizontal overflow: " + JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('main *')].filter(el => el.getBoundingClientRect().right > innerWidth + 1).slice(0, 5).map(el => ({ tag: el.tagName, className: el.className, text: el.textContent.slice(0, 50) })))));
        await page.setViewportSize({ width: 390, height: 844 });
        if (outputDir) {
          await page.evaluate(() => { document.querySelector('.account-welcome details').open = false; window.scrollTo({ top: 0, behavior: "instant" }); });
          await page.screenshot({ path: resolve(outputDir, browser.browserType().name() + '-full-spanish-top.png') });
        }
        await page.locator('[name="signerTitle"]').fill("Owner");
        await page.locator('[name="termsBundleAccepted"]').check();
        await page.locator('[name="privacyAcknowledged"]').check();
        await page.getByRole('button', { name: 'Confirmar las versiones mostradas', exact: true }).click();
        await page.locator('[role="alert"]').waitFor();
        assert.equal(posts.at(-1).policyPresentation, catalog.policies.es);
        const shownPolicy = JSON.parse(catalog.policies.es);
        assert.equal(await page.locator('[name="termsBundleAccepted"]').locator('..').locator('span').textContent(), shownPolicy.termsText);
        for (const checkbox of await page.locator('#identity-verification input[type="checkbox"]').all()) await checkbox.check();
        await page.getByRole('button', { name: 'Verificar de forma segura con Stripe', exact: true }).click();
        await page.waitForFunction(() => !document.querySelector('#identity-verification button[type="submit"]').disabled);
        assert.equal(posts.at(-1).consentPresentation, catalog.identities.es);
        const shownIdentity = JSON.parse(catalog.identities.es);
        assert.equal(await page.locator('[name="identityConsentAcknowledged"]').locator('..').locator('span').textContent(), shownIdentity.document);
      }
      assert.deepEqual(errors, []);
      report.cases.push({ name: browser.browserType().name() + '-full-spanish-' + scenario, status: 'passed' });
      console.log('PASS full Spanish ' + browser.browserType().name() + ' ' + scenario);
    }
  } finally { await page.close(); }
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
      await checkApplicationRecovery(browser);
      if (process.env.ONBOARDING_TEST_RECOVERY_ONLY === "1") continue;
      await checkFullPage(browser);
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
            await page.getByRole("heading", { name: spanish ? "Sus próximos pasos" : "Your next steps", exact: true }).waitFor();
            await page.getByRole("heading", { name: spanish ? "Documentos para sus servicios" : "Documents for your services", exact: true }).waitFor();
            assert.equal(await page.getByRole("heading", { name: spanish ? "Vencimientos y recordatorios" : "Expiration and reminders", exact: true }).count(), 0, "do not show an empty renewal panel");
            const { button } = await prepare(page, kind);
            if (spanish && kind !== "agreements") assert.equal(await button.textContent(), kind === "appeal" ? "Enviar apelación" : "Enviar solicitud de privacidad");
            await button.click();
            await page.waitForFunction(() => document.querySelector('button[type="submit"]:disabled'));
            assert.equal(posts.length, 1);
            assert.equal(posts[0].action, actions[kind]);
            if (kind === "privacy") assert.equal(posts[0].requestType, "access", "translated select keeps its submitted value");
            if (kind === "agreements") assert.equal(JSON.parse(posts[0].policyPresentation).language, spanish ? "es" : "en");
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
