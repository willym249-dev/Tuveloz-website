// Actual privacy page; synthetic responses over loopback, no external access.
import assert from "node:assert/strict";
import { mkdirSync, readFileSync } from "node:fs";
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
const dictionarySource = readFileSync(resolve(root, "lib/spanish-dictionary.ts"), "utf8");
const dictionary = Object.fromEntries([...dictionarySource.matchAll(/^ {2}("(?:[^"\\]|\\.)*"):\s*("(?:[^"\\]|\\.)*")/gm)]
  .map(([, key, value]) => [JSON.parse(key), JSON.parse(value)]));
const translate = (value, language) => language === "es" ? dictionary[value] ?? value : value;
const notices = [
  "Essential account-security, payment, appointment, authorization, and active-job messages remain enabled because they help protect the account and complete requested marketplace activity.",
  "An account-closure request does not instantly erase transaction, authorization, safety, fraud-prevention, tax, accounting, dispute, or other records that Tuveloz may need or be permitted to retain.",
  "Tuveloz does not sell personal information or use it for cross-site behavioral advertising.",
];
const snapshot = role => ({ role, email: "synthetic@example.invalid", availablePrivacyScopes: ["customer", "provider"],
  preferences: { marketingEmail: false, productUpdateEmail: false, optionalReminderEmail: true,
    essentialTransactionalEmail: true, securityEmail: true, launchNotificationEmail: false,
    launchNotificationConsentAt: "", launchNotificationConsentVersion: "", launchNotificationConsentSource: "" },
  requests: [], immediateTools: { dataExport: `/api/privacy-center/export?scope=${role}`, profileCorrection: role === "provider" ? "/privacy-center?scope=provider#privacy-request" : "/customer" }, notices });
async function checkCopy(page, language) {
  const copy = await page.evaluate(() => {
    const skip = '[data-no-interface-translation], [data-language-control], script, style';
    const found = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.parentElement.closest(skip) && node.textContent.trim()) found.push(node.textContent.trim());
    }
    document.querySelectorAll('[aria-label], [placeholder], [title]').forEach(element => {
      if (!element.closest(skip)) for (const name of ['aria-label', 'placeholder', 'title']) {
        if (element.getAttribute(name)) found.push(element.getAttribute(name).trim());
      }
    });
    return [...new Set(found)];
  });
  const meaningful = copy.filter(value => /[a-z]/i.test(value) && value !== 'Tuveloz' && !value.startsWith('· policy version'));
  if (language === 'en') assert.deepEqual(meaningful.filter(value => !dictionary[value]), [], 'every displayed privacy control needs Spanish');
  else assert.deepEqual(meaningful.filter(value => dictionary[value] && dictionary[value] !== value), [], 'no English interface text remains');
}
const json = (body, status = 200) => ({ status, contentType: "application/json", body: JSON.stringify(body) });
const failed = json({ error: "We couldn't load your privacy center. Please try again." }, 503);
try {
  for (const browserType of [chromium, webkit]) {
    const browser = await browserType.launch({ headless: true });
    try {
      for (const language of ["en", "es"]) {
        const label = value => translate(value, language);
        const refreshName = label("Refresh privacy center");
        const providerName = label("Provider application data");
        async function run(name, responses, action, initial = "", clock = false, blockedStorage = false) {
          const context = await browser.newContext({ viewport: { width: browserType === webkit ? 320 : 390, height: 844 } });
          const page = await context.newPage(); page.setDefaultTimeout(5000);
          if (blockedStorage) await page.addInitScript(() => {
            Object.defineProperty(window, 'localStorage', { get() { throw new Error('Storage unavailable'); } });
          });
          if (clock) await page.clock.install();
          const queries = [], methods = [], bodies = [], errors = [], unexpected = [];
          page.on("pageerror", error => errors.push(error.message));
          await page.route("**/*", route => {
            const request = route.request(), url = new URL(request.url());
            if (url.origin !== origin || (request.method() !== "GET" && url.pathname !== "/api/privacy-center")) { unexpected.push(request.url()); return route.abort(); }
            if (url.pathname === "/account") return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: `<html lang="${language}"><meta charset="utf-8"><h1>${label("Sign in")}</h1></html>` });
            if (url.pathname === "/api/account") return route.fulfill(json({ error: "Synthetic" }, 401));
            if (url.pathname === "/api/privacy-center") {
              const planned = responses[queries.length]; queries.push(url.searchParams.get("scope")); methods.push(request.method());
              if (request.method() === "POST") bodies.push(request.postDataJSON());
              if (planned === "timeout") return;
              if (planned === null) return route.abort("failed");
              if (!planned) { unexpected.push("Unexpected privacy request"); return route.abort(); }
              return route.fulfill(planned);
            }
            return route.continue();
          });
          try {
            const url = new URL("/privacy-center" + initial, origin); url.searchParams.set('lang', language);
            await page.goto(url.href);
            await page.waitForFunction(expected => document.documentElement.lang === expected, language);
            await action(page, queries, methods, bodies);
            assert.equal(queries.length, responses.length);
            assert.deepEqual(unexpected, []); assert.deepEqual(errors, []);
            const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
            if (overflow) console.error(await page.evaluate(() => [...document.querySelectorAll('body *')]
              .filter(element => element.getBoundingClientRect().right > innerWidth + 1)
              .slice(0, 20).map(element => ({ tag: element.tagName, className: element.className,
                right: element.getBoundingClientRect().right, width: getComputedStyle(element).width,
                minWidth: getComputedStyle(element).minWidth, text: element.textContent.trim().slice(0, 70) }))));
            assert.equal(overflow, false, "privacy controls fit the phone");
            await checkCopy(page, language);
            console.log(`PASS ${browserType.name()} ${language}: ${name}`);
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
            await page.getByRole("button", { name: label("Save communication choices"), exact: true }).click();
            if (failure === "timeout") {
              while (queries.length < 2) await page.waitForTimeout(10);
              await page.clock.runFor(15050);
            }
            await page.getByRole("alert").filter({ hasText: label("We couldn't confirm this update. Refresh your privacy center to check it before trying again.") }).waitFor();
            assert.equal(await page.getByRole("status").count(), 0, "uncertain writes must not claim success");
            await page.getByRole("button", { name: refreshName, exact: true }).click();
            await page.waitForFunction(() => !document.querySelector('[role="alert"]'));
            assert.deepEqual(methods, ["GET", "POST", "GET"], "refresh only reads the saved result, without repeating the write");
          }, "", failure === "timeout");
        }
        const history = () => ["submitted", "in-review", "completed", "denied", "withdrawn"].map((status, index) => ({
          id: `${index + 1}1111111-synthetic`, requestType: "access", status, relatedRequestId: "",
          details: "How it works", resolutionNote: "Account", createdAt: "2026-09-25T12:00:00Z",
          updatedAt: "2026-09-25T12:00:00Z", resolvedAt: "",
        }));
        await run("all request views translate and switching retains a draft", [json({ ...snapshot("customer"), requests: history() })], async page => {
          await exportedScope(page, "customer");
          await checkCopy(page, language);
          assert.deepEqual(await page.locator('.account-request small[data-no-interface-translation]').allTextContents(), Array(5).fill("How it works"));
          assert.deepEqual(await page.locator('.account-request small > span[data-no-interface-translation]').filter({ hasText: /^Account$/ }).allTextContents(), Array(5).fill("Account"));
          for (const type of ["account-closure", "appeal", "correction"]) {
            await page.locator('select[name="requestType"]').selectOption(type);
            await checkCopy(page, language);
          }
          await page.locator('textarea[name="details"]').fill("How it works: please correct this test entry.");
          await page.getByRole('checkbox', { name: label('Occasional promotions and offers'), exact: true }).check();
          const other = language === "es" ? "en" : "es";
          await page.locator('[data-language-control]').click();
          await page.waitForFunction(expected => document.documentElement.lang === expected, other);
          await checkCopy(page, other);
          assert.equal(await page.locator('textarea[name="details"]').inputValue(), "How it works: please correct this test entry.");
          assert.equal(await page.locator('select[name="requestType"]').inputValue(), "correction");
          assert.equal(await page.getByRole('checkbox', { name: translate('Occasional promotions and offers', other), exact: true }).isChecked(), true);
          await page.locator('[data-language-control]').click();
          await page.waitForFunction(expected => document.documentElement.lang === expected, language);
          if (process.env.PRIVACY_SCREENSHOT_DIR && language === "es") {
            mkdirSync(process.env.PRIVACY_SCREENSHOT_DIR, { recursive: true });
            await page.evaluate(async () => {
              if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
              document.documentElement.style.scrollBehavior = 'auto';
              await new Promise(requestAnimationFrame);
              window.scrollTo(0, 0);
            });
            await page.screenshot({ path: resolve(process.env.PRIVACY_SCREENSHOT_DIR, `privacy-spanish-${browserType.name()}.png`), fullPage: true });
          }
        });
        const consent = { ...snapshot("customer"), preferences: { ...snapshot("customer").preferences,
          launchNotificationEmail: true, launchNotificationConsentAt: "2026-09-25T12:00:00Z",
          launchNotificationConsentVersion: "test-policy-1", launchNotificationConsentSource: "account_create" } };
        await run("preference values and consent survive translated saving", [json(consent), json({ ...consent, preferences: { ...consent.preferences, marketingEmail: true, launchNotificationConsentSource: "privacy_center" } })], async (page, queries, methods, bodies) => {
          await exportedScope(page, "customer"); await checkCopy(page, language);
          await page.getByRole('checkbox', { name: label('Occasional promotions and offers'), exact: true }).check();
          await page.getByRole('button', { name: label('Save communication choices'), exact: true }).click();
          await page.getByRole('status').filter({ hasText: label('Communication choices saved.') }).waitFor();
          assert.deepEqual(bodies, [{ action: "save-preferences", marketingEmail: true, productUpdateEmail: false, optionalReminderEmail: true, launchNotificationEmail: true }]);
        });
        await run("translated request submits original values and protects entered text", [json(snapshot("customer")), json({ ...snapshot("customer"), requests: [history()[0]], ok: true })], async (page, queries, methods, bodies) => {
          await page.locator('select[name="requestType"]').selectOption("correction");
          await page.locator('textarea[name="details"]').fill("How it works: please correct this test entry.");
          await page.getByRole('button', { name: label('Submit verified request'), exact: true }).click();
          await page.getByRole('status').filter({ hasText: label('Privacy request submitted from your verified account.') }).waitFor();
          assert.deepEqual(bodies, [{ action: "submit-request", requestType: "correction", details: "How it works: please correct this test entry." }]);
          assert.equal(await page.locator('textarea[name="details"]').inputValue(), "");
        });
        await run("translated withdrawal keeps the original request identifier", [json({ ...snapshot("provider"), requests: [history()[0]] }), json({ ...snapshot("provider"), requests: [{ ...history()[0], status: "withdrawn" }], ok: true })], async (page, queries, methods, bodies) => {
          await page.getByRole('button', { name: label('Withdraw'), exact: true }).click();
          await page.getByRole('status').filter({ hasText: label('Privacy request withdrawn.') }).waitFor();
          assert.deepEqual(bodies, [{ action: "withdraw-request", id: history()[0].id }]);
          assert.deepEqual(queries, ["provider", "provider"]);
        }, "?scope=provider");
        await run("language reload works with blocked storage and preserves provider links", [json(snapshot("provider")), json(snapshot("provider"))], async page => {
          await exportedScope(page, "provider");
          const expectedLink = `/privacy-center?scope=provider${language === 'es' ? '&lang=es' : ''}#privacy-request`;
          assert.equal(await page.getByRole('link', { name: label('Correct my profile'), exact: true }).getAttribute('href'), expectedLink);
          if (language === 'es') assert.equal(await page.getByRole('link', { name: label('Privacy policy'), exact: true }).getAttribute('href'), '/es/privacy');
          await page.locator('[data-language-control]').click();
          await page.waitForFunction(expected => document.documentElement.lang === expected, language === 'es' ? 'en' : 'es');
          await page.locator('[data-language-control]').click();
          await page.waitForFunction(expected => document.documentElement.lang === expected, language);
          await page.reload();
          await page.waitForFunction(expected => document.documentElement.lang === expected, language);
          await exportedScope(page, "provider");
          assert.equal(new URL(page.url()).searchParams.get('scope'), 'provider');
        }, "?scope=provider#privacy-request", false, true);
        const correctionError = "Explain what should be corrected or why the earlier decision should be reviewed.";
        await run("validation errors translate without clearing the request", [json(snapshot("customer")), json({ error: correctionError }, 400)], async page => {
          await page.locator('select[name="requestType"]').selectOption("correction");
          await page.locator('textarea[name="details"]').fill("Test");
          await page.getByRole('button', { name: label('Submit verified request'), exact: true }).click();
          await page.getByRole('alert').filter({ hasText: label(correctionError) }).waitFor();
          assert.equal(await page.locator('textarea[name="details"]').inputValue(), "Test");
          assert.equal(await page.getByRole('status').count(), 0);
        });
        await run("expired session carries Spanish into sign-in", [json({ error: "Sign in to manage privacy choices." }, 401)], async page => {
          await page.waitForURL(url => url.pathname === '/account');
          assert.equal(new URL(page.url()).searchParams.get('privacy'), '1');
          assert.equal(new URL(page.url()).searchParams.get('role'), 'customer');
          assert.equal(new URL(page.url()).searchParams.get('lang'), language);
          await page.getByRole('heading', { name: label('Sign in'), exact: true }).waitFor();
        });
      }
    } finally { await browser.close(); }
  }
} finally { await new Promise(done => server.close(done)); }
