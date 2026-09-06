// Exercise the actual React form in isolated browsers. Every address and
// acknowledgment is synthetic; the only API receiver is this loopback fixture.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, webkit } from "playwright";
import { build } from "vite";

const root = fileURLToPath(new URL("../..", import.meta.url));
const outputDir = process.argv[2] ? resolve(process.argv[2]) : null;
if (outputDir) mkdirSync(outputDir, { recursive: true });
const builds = await build({
  root, configFile: false, envFile: false, logLevel: "error",
  define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" },
  // Use the same framework modules as the site's Vinext build.
  resolve: { alias: {
    "next/link": fileURLToPath(import.meta.resolve("vinext/shims/link")),
    "next/navigation": fileURLToPath(import.meta.resolve("vinext/shims/navigation")),
  } },
  build: {
    write: false,
    lib: { entry: resolve(root, "tests/e2e/fixtures/provider-form.tsx"), name: "ProviderFormFixture", formats: ["iife"] },
  },
});
const bundle = Array.isArray(builds) ? builds[0] : builds;
const assets = new Map(bundle.output.map(asset => [`/${asset.fileName}`, asset.type === "chunk" ? asset.code : asset.source]));
const js = bundle.output.find(asset => asset.type === "chunk").fileName;
const css = bundle.output.find(asset => asset.fileName.endsWith(".css")).fileName;
if (outputDir) writeFileSync(resolve(outputDir, "fixture.js"), assets.get(`/${js}`));
const challenges = [];
const unexpectedRequests = [];
const server = createServer(async (request, response) => {
  const path = request.url.split("?")[0];
  if (path === "/api/analytics" && request.method === "POST") {
    // The real form emits step events; discard them locally.
    request.resume();
    response.writeHead(204);
    response.end();
    return;
  }
  if (path === "/api/providers/challenge" && request.method === "POST") {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    challenges.push(JSON.parse(Buffer.concat(chunks).toString()));
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ challengeId: "synthetic-email-challenge" }));
    return;
  }
  if (assets.has(path)) {
    response.writeHead(200, { "content-type": path.endsWith(".css") ? "text/css" : "text/javascript" });
    response.end(assets.get(path));
    return;
  }
  if (["/join", "/es/join"].includes(path)) {
    response.writeHead(200, { "content-type": "text/html" });
    response.end(`<!doctype html><html lang="${path.startsWith("/es/") ? "es" : "en"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/${css}"></head><body><div id="root"></div><script src="/${js}"></script></body></html>`);
    return;
  }
  if (request.method === "POST") unexpectedRequests.push(path);
  response.writeHead(404);
  response.end();
});
await new Promise(done => server.listen(0, "127.0.0.1", done));
const origin = `http://127.0.0.1:${server.address().port}`;
const draftKey = "tuveloz-provider-signup-draft-v1";
const baseDraft = {
  step: 3, selectedProviderServices: ["battery_replacement"], soloBusiness: true,
  fields: { "provider-email": "synthetic-provider@example.invalid", "performing-person-first-name": "Example", "performing-person-last-name": "Fixture", "business-municipality": "Rockville" },
};
const report = { testedAt: new Date().toISOString(), cases: [] };
const next = page => page.getByRole("button", { name: /^(Continue|Continuar)\s*→$/ });
const back = page => page.getByRole("button", { name: /^←\s*(Back|Regresar)$/ });
const acknowledgment = page => page.locator(".legal-confirmation input");
const currentStep = page => page.locator("[data-signup-step]").getAttribute("data-signup-step");
async function settleViewport(page) {
  // Step changes and validation messages scroll the real form. WebKit can
  // finish its actionability check before smooth scrolling ends, so wait for
  // the viewport to settle instead of retrying a click that missed its target.
  await page.waitForFunction(() => new Promise(done => {
    let previous = window.scrollY;
    let stableFrames = 0;
    function measure() {
      const current = window.scrollY;
      stableFrames = current === previous ? stableFrames + 1 : 0;
      previous = current;
      if (stableFrames >= 3) done(true);
      else requestAnimationFrame(measure);
    }
    requestAnimationFrame(measure);
  }));
}
async function confirmChecklist(page) {
  await settleViewport(page);
  await acknowledgment(page).scrollIntoViewIfNeeded();
  await settleViewport(page);
  await acknowledgment(page).check();
}
async function chooseService(page, code) {
  const input = page.locator(`input[name="provider-service"][value="${code}"]`);
  if (!await input.isVisible()) await page.locator(".service-group").filter({ has: input }).locator(":scope > summary").click();
  await input.check();
}
async function freshDetails(page) {
  await chooseService(page, "battery_replacement");
  await page.locator('[name="provider-email"]').fill(baseDraft.fields["provider-email"]);
  await next(page).click();
  await confirmChecklist(page);
  await next(page).click();
  // The step transition deliberately moves keyboard focus in an animation
  // frame. Wait for that handoff before the browser starts typing, otherwise
  // WebKit can insert text into the step container instead of the input.
  await page.waitForFunction(() => document.activeElement?.matches('[data-signup-step="3"]'));
  for (const [name, value] of Object.entries(baseDraft.fields)) {
    if (name !== "provider-email") await page.locator(`[name="${name}"]`).fill(value);
  }
  await page.locator('[name="provider-work-location"]').first().check();
  for (const [name, value] of Object.entries(baseDraft.fields)) assert.equal(await page.locator(`[name="${name}"]`).inputValue(), value, `${name} was entered`);
}
async function fitsPhone(page) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, "form must fit a phone without horizontal scrolling");
}
async function checkFinalAcknowledgments(page) {
  for (const input of await page.locator('input[type="checkbox"][required]').all()) {
    assert.equal(await input.isChecked(), false, "legal acceptances must not be restored from a draft");
    await input.check();
  }
}
async function recordDraft(page, result, stage) {
  (result.checkpoints ??= []).push({ stage, ...await page.evaluate(key => ({
    saved: JSON.parse(localStorage.getItem(key)),
    visible: Object.fromEntries([...document.querySelectorAll('input[name], select[name]')]
      .filter(input => input.type !== "checkbox" && input.type !== "radio")
      .map(input => [input.name, input.value])),
  }), draftKey) });
}

try {
  for (const browserType of [chromium, webkit]) {
    const browser = await browserType.launch({ headless: true });
    try {
      for (const language of ["en", "es"]) {
        async function run(name, draft, action) {
          const context = await browser.newContext({ viewport: { width: language === "es" ? 320 : 390, height: 844 } });
          const page = await context.newPage();
          page.setDefaultTimeout(5000);
          const errors = [];
          const outside = [];
          page.on("pageerror", error => errors.push(error.stack ?? error.message));
          await page.route("**/*", route => {
            if (new URL(route.request().url()).origin === origin) return route.continue();
            outside.push(route.request().url());
            return route.abort();
          });
          if (draft) await page.addInitScript(({ key, draft }) => {
            if (!sessionStorage.getItem("fixture-seeded")) {
              localStorage.setItem(key, JSON.stringify(draft));
              sessionStorage.setItem("fixture-seeded", "yes");
            }
          }, { key: draftKey, draft });
          const result = { browser: browserType.name(), language, name };
          try {
            await page.goto(`${origin}${language === "es" ? "/es" : ""}/join`);
            await page.locator("[data-signup-step]").waitFor();
            if (draft) {
              await page.getByText(language === "es" ? /Bienvenido de nuevo/ : /Welcome back/).waitFor();
              const restoredStep = await currentStep(page);
              if (restoredStep !== "1") {
                await page.waitForFunction(step => document.activeElement?.matches(`[data-signup-step="${step}"]`), restoredStep);
              }
            }
            await action(page, result);
            await fitsPhone(page);
            assert.deepEqual(errors, [], "no React or browser errors");
            assert.deepEqual(outside, [], "no external services contacted");
            result.status = "passed";
          } catch (error) {
            result.status = "failed";
            result.error = error.stack ?? error.message;
          } finally {
            if (outputDir && (result.status === "failed" || ["resume", "changed-services"].includes(name))) {
              await page.screenshot({ path: resolve(outputDir, `${browserType.name()}-${language}-${name}.png`), fullPage: true });
            }
            await context.close();
          }
          report.cases.push(result);
          console.log(`${result.status.toUpperCase()} ${result.browser} ${language} ${name}${result.error ? `: ${result.error}` : ""}`);
          assert.deepEqual(errors, [], "fixture must render without browser errors");
        }
        await run("resume", null, async (page, result) => {
          await freshDetails(page);
          await recordDraft(page, result, "details-entered");
          // A real user-created draft, not just a hand-crafted storage object.
          await checkFinalAcknowledgments(page);
          await recordDraft(page, result, "before-reload");
          await page.reload();
          await page.getByText(language === "es" ? /Bienvenido de nuevo/ : /Welcome back/).waitFor();
          assert.equal(await currentStep(page), "2", "resuming must expose the unchecked service checklist before final submission");
          await page.waitForFunction(() => document.activeElement?.matches('[data-signup-step="2"]'));
          if (outputDir) await page.screenshot({ path: resolve(outputDir, `${browserType.name()}-${language}-resumed-checklist.png`) });
          await recordDraft(page, result, "restored-checklist");
          assert.equal(await acknowledgment(page).isChecked(), false);
          const prior = challenges.length;
          await next(page).click();
          assert.equal(await currentStep(page), "2", "unconfirmed checklist cannot advance");
          assert.equal(challenges.length, prior);
          await confirmChecklist(page);
          await next(page).click();
          await recordDraft(page, result, "resumed-details");
          for (const [name, value] of Object.entries(baseDraft.fields)) assert.equal(await page.locator(`[name="${name}"]`).inputValue(), value, `${name} survives resume`);
          assert.equal(await page.locator('[name="provider-work-location"]').first().isChecked(), true);
          await page.getByRole("button", { name: /^(Send my application|Enviar mi solicitud)\s*→$/ }).click();
          assert.equal(await page.locator(".action-confirm").count(), 0, "fresh final acceptances are still required");
          assert.equal(challenges.length, prior);
          await checkFinalAcknowledgments(page);
          await page.getByRole("button", { name: /^(Send my application|Enviar mi solicitud)\s*→$/ }).click();
          assert.equal(challenges.length, prior, "review confirmation comes before the email request");
          await page.getByRole("button", { name: language === "es" ? "Sí, envíenme el código" : "Yes, send my code", exact: true }).click();
          await page.locator('[name="provider-verification-code"]').waitFor();
          assert.equal(challenges.length, prior + 1);
          const sent = challenges.at(-1);
          for (const key of ["rulesReviewed", "providerAttestation", "legalResponsibility", "adultAcknowledged", "termsBundleAccepted", "privacyAcknowledged"]) assert.equal(sent[key], true, `fresh ${key} reaches the receiver`);
          assert.equal(sent.preferredLanguage, language === "es" ? "Spanish" : "English");
          const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), draftKey);
          assert.equal(Object.hasOwn(saved, "legalConfirmed"), false);
          assert.equal(Object.hasOwn(saved, "applicationVerificationCode"), false);
        });
        await run("changed-services", { ...baseDraft, step: 2 }, async page => {
          await confirmChecklist(page);
          await next(page).click();
          await back(page).click();
          assert.equal(await acknowledgment(page).isChecked(), true, "unchanged selections keep the current-session confirmation");
          await back(page).click();
          await chooseService(page, "mobile_car_wash");
          await next(page).click();
          await page.locator("#wash-water-question").waitFor();
          assert.equal(await acknowledgment(page).isChecked(), false, "adding a service requires reviewing the changed checklist");
          await next(page).click();
          assert.equal(await currentStep(page), "2");
          await confirmChecklist(page);
          await next(page).click();
          assert.equal(await currentStep(page), "3");
          await back(page).click();
          await back(page).click();
          await page.locator('input[name="provider-service"][value="mobile_car_wash"]').uncheck();
          await next(page).click();
          assert.equal(await page.locator("#wash-water-question").count(), 0);
          assert.equal(await acknowledgment(page).isChecked(), false, "removing a service also resets checklist confirmation");
        });
        await run("photo-only", { ...baseDraft, selectedProviderServices: ["photo_documentation_only"] }, async page => {
          assert.equal(await currentStep(page), "3", "a service without legal questions can resume its details directly");
          assert.equal(await acknowledgment(page).count(), 0);
          assert.equal(await page.locator('[name="performing-person-first-name"]').inputValue(), "Example");
        });
        for (const [name, draft] of [
          ["missing-email", { ...baseDraft, fields: { "performing-person-first-name": "Example" } }],
          ["removed-services", { ...baseDraft, selectedProviderServices: ["obsolete_service"] }],
          ["empty-checklist", { ...baseDraft, step: 2, selectedProviderServices: [] }],
          ["obsolete-step", { ...baseDraft, step: 4 }],
        ]) await run(name, draft, async page => {
          assert.equal(await currentStep(page), "1", "incomplete or stale drafts resume at an actionable step");
          assert.equal(await page.locator('[name="provider-email"]').isVisible(), true);
          const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), draftKey);
          assert.equal(saved.fields["performing-person-first-name"], "Example");
        });
      }
    } finally {
      await browser.close();
    }
  }
  assert.deepEqual(unexpectedRequests, [], "no application or other unexpected mutation was sent");
} finally {
  await new Promise(done => server.close(done));
  if (outputDir) writeFileSync(resolve(outputDir, "report.json"), JSON.stringify(report, null, 2));
}
assert.equal(report.cases.filter(item => item.status === "failed").length, 0, "all provider form cases must pass");
