// Real quote card, synthetic loopback replies. The production launch lock stays closed.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, webkit } from "playwright";
import { build } from "vite";
import { checkoutModule, syntheticCheckoutAcceptance } from "../helpers/checkout-evidence.mjs";

const policy = checkoutModule("./lib/customer-policy-acceptance");

const root = fileURLToPath(new URL("../..", import.meta.url));
const built = await build({ root, configFile: false, envFile: false, logLevel: "error",
  define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" },
  resolve: { alias: { "next/link": fileURLToPath(import.meta.resolve("vinext/shims/link")),
    "next/navigation": fileURLToPath(import.meta.resolve("vinext/shims/navigation")) } },
  plugins: [{ name: "expose-private-quote-card-for-isolated-test", transform(source, id) {
    if (id.replaceAll("\\", "/").endsWith("/app/components/quote-payment-card.tsx")) {
      return source + "\nexport { ActiveQuotePaymentCard };\n";
    }
  } }],
  build: { write: false, lib: { entry: resolve(root, "tests/e2e/fixtures/quote-checkout.tsx"), name: "QuoteFixture", formats: ["iife"] } },
});
const bundle = Array.isArray(built) ? built[0] : built;
const assets = new Map(bundle.output.map(asset => ["/" + asset.fileName, asset.type === "chunk" ? asset.code : asset.source]));
const js = bundle.output.find(asset => asset.type === "chunk").fileName;
const css = bundle.output.find(asset => asset.fileName.endsWith(".css")).fileName;
const server = createServer((request, response) => {
  const path = request.url.split("?")[0];
  if (assets.has(path)) {
    response.writeHead(200, { "content-type": path.endsWith(".css") ? "text/css" : "text/javascript" });
    response.end(assets.get(path));
  } else if (path === "/account") {
    response.writeHead(200, { "content-type": "text/html" });
    response.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/${css}"></head><body><div id="root"></div><script src="/${js}"></script></body></html>`);
  } else { response.writeHead(404); response.end(); }
});
await new Promise(done => server.listen(0, "127.0.0.1", done));
const origin = `http://127.0.0.1:${server.address().port}`;
const acceptance = (scopeVersion = 1, overrides = {}) => ({
  language: "en",
  agreementKey: "synthetic-authorization", agreementVersion: "synthetic:1",
  agreementHash: `synthetic-hash-${scopeVersion}`, presentedText: `SYNTHETIC consent for scope ${scopeVersion}.`,
  agreementText: "SYNTHETIC test record",
  policyRelease: policy.customerPolicyPresentationEvidence("checkout", "en"),
  cancellationRefundSummary: "SYNTHETIC refund summary; not an actual agreement.",
  scope: { quoteId: "synthetic-quote-a", scopeVersion, providerLegalName: "SYNTHETIC provider A",
    serviceCodes: ["SYNTHETIC-SERVICE"], scheduledFor: "2026-10-01T12:00:00Z",
    performingPersonId: "synthetic-performer", supervisorPersonId: "", workmanshipWarranty: "",
    laborAmountCents: 10000, partsAmountCents: 0, taxAmountCents: 0, otherAmountCents: 0,
    providerAmountCents: 10000, customerFeeRateBps: 500, customerFeeCents: 500, customerTotalCents: 10500, ...overrides },
});
const ready = (record = acceptance()) => ({ checkoutAllowed: true, payment: null,
  checkoutAcceptance: record ? { ...record,
    policyRelease: policy.customerPolicyPresentationEvidence("checkout", record.language === "es" ? "es" : "en"),
  } : null });
const card = page => page.locator(".quote-payment-card");
const pay = page => card(page).getByRole("button", { name: /with Stripe|Opening Stripe|Continue secure checkout/ });
const consent = page => card(page).getByRole("checkbox");
const settled = page => card(page).getByText("Checking Stripe payment readiness…").waitFor({ state: "hidden" });

try {
  for (const browserType of [chromium, webkit]) {
    const browser = await browserType.launch({ headless: true });
    try {
      async function run(name, action, { closed = false } = {}) {
        if (process.env.QUOTE_CASE && !name.includes(process.env.QUOTE_CASE)) return;
        const context = await browser.newContext({ viewport: { width: browserType === webkit ? 320 : 390, height: 844 } });
        const page = await context.newPage(); page.setDefaultTimeout(5000);
        const requests = [], pending = [], errors = [], unexpected = [];
        page.on("pageerror", error => errors.push(error.message));
        await context.route("**/*", async route => {
          const request = route.request(), url = new URL(request.url());
          if (url.origin !== origin) { unexpected.push(request.url()); return route.abort(); }
          if (url.pathname === "/api/stripe/checkout") {
            requests.push({ method: request.method(), url: request.url(), headers: request.headers(),
              body: request.method() === "POST" ? request.postDataJSON() : null });
            pending.push(route);
            return;
          }
          return route.continue();
        });
        async function waitForRequest(index) {
          const deadline = Date.now() + 5000;
          while (!pending[index] && Date.now() < deadline) await new Promise(done => setTimeout(done, 20));
          assert.ok(pending[index], `${name}: missing request ${index}`);
        }
        async function next(index, body, status = 200) {
          await waitForRequest(index);
          if (body === "network") await pending[index].abort("failed");
          else await pending[index].fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
        }
        try {
          // The production launch lock remains closed. All API replies and
          // navigation destinations here are synthetic loopback fixtures.
          await page.goto(`${origin}/account${closed ? "?closed=1" : ""}`);
          await card(page).waitFor();
          if (!closed) await waitForRequest(0);
          await action({ page, next, requests, pending, waitForRequest });
          assert.deepEqual(errors, []); assert.deepEqual(unexpected, []);
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
          for (const request of requests) assert.ok(!request.url.includes("synthetic-token"));
          console.log(`PASS ${browserType.name()}: ${name}`);
        } finally { await context.close(); }
      }

      await run("scope-change-clears-consent-before-refresh", async ({ page, next, requests }) => {
        await next(0, ready()); await settled(page); await consent(page).check();
        assert.equal(await pay(page).isEnabled(), true);
        await page.getByRole("button", { name: "Change scope", exact: true }).click();
        await card(page).getByText("Checking Stripe payment readiness…").waitFor();
        assert.equal(await consent(page).count(), 0);
        assert.equal(await card(page).getByRole("button", { name: "Download this exact authorization" }).count(), 0);
        await next(1, ready(acceptance(2))); await settled(page);
        assert.equal(await consent(page).isChecked(), false); assert.equal(await pay(page).isDisabled(), true);
        await consent(page).check(); await pay(page).click();
        await next(2, { error: "Synthetic stop before Stripe" }, 503);
        await page.getByRole("alert").waitFor();
        assert.equal(requests[2].body.checkoutAgreementHash, "synthetic-hash-2");
        assert.equal(requests[2].body.policyAccepted, true);
      });

      await run("late-readiness-cannot-replace-new-quote", async ({ page, next, requests }) => {
        await page.getByRole("button", { name: "Change quote", exact: true }).click();
        const current = acceptance(1, { quoteId: "synthetic-quote-b", providerLegalName: "SYNTHETIC provider B" });
        await next(1, ready(current)); await settled(page); await consent(page).check();
        await next(0, ready());
        assert.equal(await card(page).getByText("SYNTHETIC provider A", { exact: true }).count(), 0);
        assert.equal(await consent(page).isChecked(), true);
        assert.equal(new URL(requests[1].url).searchParams.get("quoteId"), "synthetic-quote-b");
      });

      await run("price-access-and-language-each-reset-consent", async ({ page, next, requests }) => {
        await next(0, ready()); await settled(page); await consent(page).check();
        const record = acceptance(1, { laborAmountCents: 20000, providerAmountCents: 20000, customerFeeCents: 1000, customerTotalCents: 21000 });
        for (const [index, button] of ["Change price", "Change access", "Change language"].entries()) {
          await page.getByRole("button", { name: button, exact: true }).click();
          await card(page).getByText("Checking Stripe payment readiness…").waitFor();
          assert.equal(await consent(page).count(), 0);
          await next(index + 1, ready({ ...record, language: index === 2 ? "es" : "en" })); await settled(page);
          assert.equal(await consent(page).isChecked(), false); assert.equal(await pay(page).isDisabled(), true);
          await consent(page).check();
        }
        assert.equal(requests[2].headers["x-tuveloz-request-token"], "synthetic-token-b");
        assert.equal(new URL(requests[0].url).searchParams.get("language"), "en");
        assert.equal(new URL(requests[3].url).searchParams.get("language"), "es");
        await pay(page).click(); await next(4, { error: "Synthetic stop before Stripe" }, 503);
        await page.getByRole("alert").waitFor();
        assert.equal(requests[4].body.language, "es"); assert.equal(requests[4].body.token, "synthetic-token-b");
      });

      await run("failed-refresh-and-retry-never-reuse-consent", async ({ page, next }) => {
        await next(0, ready()); await settled(page); await consent(page).check();
        await page.getByRole("button", { name: "Change scope", exact: true }).click();
        await next(1, "network"); await page.getByRole("alert").waitFor();
        assert.equal(await pay(page).isDisabled(), true); assert.equal(await consent(page).count(), 0);
        await page.getByRole("button", { name: "Check quote again", exact: true }).click();
        await next(2, ready(acceptance(2))); await settled(page);
        assert.equal(await page.getByRole("alert").count(), 0); assert.equal(await consent(page).isChecked(), false);
      });

      await run("mismatched-server-scope-blocks-payment", async ({ page, next }) => {
        await next(0, ready(acceptance(2))); await page.getByRole("alert").waitFor();
        assert.equal(await pay(page).isDisabled(), true); assert.equal(await consent(page).count(), 0);
        await page.getByRole("button", { name: "Refresh quote details", exact: true }).click();
        await next(1, ready()); await settled(page);
        assert.equal(await page.getByRole("alert").count(), 0);
        assert.equal(await consent(page).isChecked(), false);
      });

      await run("missing-or-mismatched-language-never-enables-payment", async ({ page, next, requests }) => {
        await next(0, ready({ ...acceptance(), language: undefined }));
        await page.getByRole("alert").filter({ hasText: "payment agreement in English" }).waitFor();
        assert.equal(await consent(page).count(), 0); assert.equal(await pay(page).isDisabled(), true);
        await page.getByRole("button", { name: "Check quote again", exact: true }).click();
        await next(1, ready({ ...acceptance(), language: "es" }));
        await page.getByRole("alert").filter({ hasText: "payment agreement in English" }).waitFor();
        assert.equal(await consent(page).count(), 0);
        await page.getByRole("button", { name: "Change language", exact: true }).click();
        await next(2, ready());
        await page.getByRole("alert").filter({ hasText: "acuerdo de pago en español" }).waitFor();
        assert.equal(await consent(page).count(), 0); assert.equal(await pay(page).isDisabled(), true);
        assert.equal(await card(page).getByRole("button", { name: "Download this exact authorization" }).count(), 0);
        assert.equal(requests.filter(request => request.method === "POST").length, 0);
      });

      await run("unavailable-spanish-agreement-clears-consent-with-a-readable-explanation", async ({ page, next, requests }) => {
        await next(0, ready()); await settled(page); await consent(page).check();
        await page.getByRole("button", { name: "Change language", exact: true }).click();
        await next(1, { checkoutAllowed: false, checkoutAcceptance: null, payment: null,
          code: "CHECKOUT_LANGUAGE_UNAVAILABLE",
          reason: "El pago en español aún no está disponible. Si necesitas ayuda, escribe a hello@tuveloz.com." });
        await settled(page);
        await card(page).getByRole("status").filter({ hasText: "El pago en español aún no está disponible." }).waitFor();
        assert.equal(await consent(page).count(), 0); assert.equal(await pay(page).isDisabled(), true);
        assert.equal(new URL(requests[1].url).searchParams.get("language"), "es");
        assert.equal(requests.filter(request => request.method === "POST").length, 0);
        await page.getByRole("button", { name: "Change language", exact: true }).click();
        await next(2, ready()); await settled(page);
        assert.equal(await consent(page).isChecked(), false); assert.equal(await pay(page).isDisabled(), true);
      });

      await run("incomplete-or-mismatched-policy-presentation-recovers-without-crashing", async ({ page, next, requests }) => {
        for (const [index, change] of [
          { policyRelease: undefined },
          { agreementText: undefined },
          { policyRelease: policy.customerPolicyPresentationEvidence("checkout", "es") },
        ].entries()) {
          await next(index, { checkoutAllowed: true, payment: null, checkoutAcceptance: { ...acceptance(), ...change } });
          await page.getByRole("alert").filter({ hasText: "payment agreement in English" }).waitFor();
          assert.equal(await consent(page).count(), 0); assert.equal(await pay(page).isDisabled(), true);
          await page.getByRole("button", { name: "Check quote again", exact: true }).click();
        }
        await next(3, ready()); await settled(page);
        assert.equal(await consent(page).isChecked(), false);
        assert.equal(requests.filter(request => request.method === "POST").length, 0);
      });

      await run("stalled-readiness-times-out-and-recovers", async ({ page, next, waitForRequest }) => {
        await next(0, ready()); await settled(page);
        await page.clock.install();
        await page.getByRole("button", { name: "Change scope", exact: true }).click();
        await waitForRequest(1); await page.clock.fastForward(20_001);
        await page.getByRole("alert").waitFor(); assert.equal(await pay(page).isDisabled(), true);
        await page.getByRole("button", { name: "Check quote again", exact: true }).click();
        await next(2, ready(acceptance(2))); await settled(page);
        assert.equal(await consent(page).isChecked(), false);
      });

      await run("stalled-checkout-requires-status-refresh-without-resubmitting", async ({ page, next, requests, waitForRequest }) => {
        await next(0, ready()); await settled(page); await consent(page).check();
        await page.clock.install(); await pay(page).click(); await waitForRequest(1);
        await page.clock.fastForward(20_001);
        await page.getByRole("alert").waitFor();
        assert.equal(await pay(page).isDisabled(), true); assert.equal(await consent(page).count(), 0);
        assert.equal(requests.filter(request => request.method === "POST").length, 1);
        await next(1, { url: `${origin}/should-not-open` });
        assert.equal(new URL(page.url()).pathname, "/account");
        assert.equal(await page.evaluate(() => sessionStorage.getItem("tuveloz:checkout-status-token")), null);
        await page.getByRole("button", { name: "Check quote again", exact: true }).click();
        await next(2, { ...ready(), payment: { id: "synthetic-paid", scopeVersion: 1,
          status: "paid_pending_completion", paidAt: "2026-09-29", releasedAt: "", refundAmountCents: 0, disputeStatus: "" } });
        await card(page).getByText(/Paid\. The provider amount/).waitFor();
        assert.equal(requests[2].method, "GET");
        assert.equal(requests.filter(request => request.method === "POST").length, 1);
        assert.equal(await pay(page).count(), 0);
      });

      await run("lost-checkout-response-requires-new-review", async ({ page, next, requests }) => {
        await next(0, ready()); await settled(page); await consent(page).check(); await pay(page).click();
        await next(1, "network"); await page.getByRole("alert").waitFor();
        assert.equal(await consent(page).count(), 0); assert.equal(await pay(page).isDisabled(), true);
        await page.getByRole("button", { name: "Check quote again", exact: true }).click();
        await next(2, { ...ready(), payment: { id: "synthetic-open", scopeVersion: 1,
          status: "checkout_open", paidAt: "", releasedAt: "", refundAmountCents: 0, disputeStatus: "" } });
        await settled(page); assert.equal(await consent(page).isChecked(), false);
        assert.equal(await pay(page).isDisabled(), true);
        assert.equal(requests[2].method, "GET");
        assert.equal(requests.filter(request => request.method === "POST").length, 1);
        await consent(page).check(); await pay(page).click();
        await next(3, { url: `${origin}/synthetic-existing-checkout` });
        await page.waitForURL(`${origin}/synthetic-existing-checkout`);
      });

      await run("stalled-checkout-shows-spanish-recovery", async ({ page, next, requests, waitForRequest }) => {
        await next(0, ready()); await settled(page);
        await page.getByRole("button", { name: "Change language", exact: true }).click();
        await next(1, ready({ ...acceptance(), language: "es" })); await settled(page); await consent(page).check();
        await page.clock.install(); await pay(page).click(); await waitForRequest(2);
        await page.clock.fastForward(20_001);
        await page.getByRole("alert").filter({ hasText: "No pudimos confirmar si se abrió el pago en Stripe." }).waitFor();
        assert.equal(await consent(page).count(), 0); assert.equal(await pay(page).isDisabled(), true);
        assert.equal(requests.filter(request => request.method === "POST").length, 1);
        await page.getByRole("button", { name: "Revisar cotización", exact: true }).click();
        await next(3, ready({ ...acceptance(), language: "es" })); await settled(page);
        assert.equal(await consent(page).isChecked(), false);
        assert.equal(requests[3].method, "GET");
      });

      await run("server-conflict-requires-new-review-and-download", async ({ page, next, requests }) => {
        const record = acceptance();
        await next(0, ready(record)); await settled(page); await consent(page).check();
        await pay(page).dblclick(); await next(1, { error: "The authorization changed. Review the quote again." }, 409);
        await page.getByRole("alert").waitFor();
        assert.equal(requests.filter(request => request.method === "POST").length, 1);
        assert.equal(await consent(page).count(), 0); assert.equal(await pay(page).isDisabled(), true);
        await page.getByRole("button", { name: "Check quote again", exact: true }).click();
        const revised = { ...record, agreementHash: "synthetic-new-policy", presentedText: "SYNTHETIC revised consent." };
        await next(2, ready(revised)); await settled(page);
        assert.equal(await consent(page).isChecked(), false);
        const downloading = page.waitForEvent("download");
        await page.getByRole("button", { name: "Download this exact authorization" }).click();
        const download = await downloading;
        let content = ""; for await (const chunk of await download.createReadStream()) content += chunk.toString();
        assert.deepEqual(JSON.parse(content), { quoteId: "synthetic-quote-a", ...revised });
      });

      await run("checkbox-and-download-contain-the-same-entire-authorization", async ({ page, next }) => {
        const record = { ...acceptance(), presentedText:
          "I confirm this payment includes vehicle-service labor only and no provider-supplied parts, parts reimbursement, parts tax, or parts charge. SYNTHETIC authorization; not a real transaction." };
        await next(0, ready(record)); await settled(page);
        const label = card(page).locator(".payment-policy-consent");
        assert.equal(await label.innerText(), record.presentedText);
        assert.equal(await consent(page).getAttribute("checked"), null);
        assert.equal(await card(page).getByRole("checkbox", { name: record.presentedText, exact: true }).count(), 1);
        assert.equal(await label.getByRole("link").count(), 0, "policy links must not add unrecorded checkbox wording");
        const downloading = page.waitForEvent("download");
        await card(page).getByRole("button", { name: "Download this exact authorization" }).click();
        const download = await downloading;
        let content = ""; for await (const chunk of await download.createReadStream()) content += chunk.toString();
        assert.deepEqual(JSON.parse(content), { quoteId: "synthetic-quote-a", ...record });
        assert.equal(JSON.parse(content).presentedText, await label.innerText());
        assert.equal(await consent(page).isChecked(), false, "downloading never gives consent");
        const details = await card(page).locator('dl[aria-label="Exact checkout authorization"] > div')
          .evaluateAll(rows => rows.slice(0, 6).map(row => {
            const term = row.querySelector("dt"), value = row.querySelector("dd");
            return { label: term.textContent, labelWidth: term.getBoundingClientRect().width,
              valueClipped: value.scrollWidth > value.clientWidth + 1,
              right: value.getBoundingClientRect().right, rowRight: row.getBoundingClientRect().right };
          }));
        for (const detail of details) {
          assert.ok(detail.labelWidth >= 100, `readable metadata label: ${detail.label}`);
          assert.equal(detail.valueClipped, false, `unclipped metadata: ${detail.label}`);
          assert.ok(detail.right <= detail.rowRight, `metadata stays inside card: ${detail.label}`);
        }
        if (process.env.QUOTE_EVIDENCE_DIR) {
          await card(page).screenshot({ path: resolve(process.env.QUOTE_EVIDENCE_DIR,
            `checkout-consent-${browserType.name()}.png`) });
        }
      });

      await run("language-change-preserves-literal-authorization-and-provider-data", async ({ page, next }) => {
        // Deliberate dictionary collisions: these are opaque synthetic values,
        // not permission to translate a legal name, provider warranty or record.
        const literal = "Terms of Use";
        const record = { ...acceptance(1, { providerLegalName: literal, workmanshipWarranty: literal }),
          presentedText: literal, cancellationRefundSummary: literal };
        await next(0, ready(record)); await settled(page);
        await consent(page).check();
        await page.getByRole("button", { name: "Change language", exact: true }).click();
        await next(1, ready({ ...record, language: "es" })); await settled(page);
        assert.equal(await page.locator("html").getAttribute("lang"), "es");
        assert.equal(await card(page).locator(".payment-policy-consent").innerText(), literal);
        assert.equal(await card(page).getByRole("checkbox", { name: literal, exact: true }).count(), 1);
        assert.equal(await card(page).locator("dd").filter({ hasText: literal }).count(), 2);
        assert.equal(await card(page).locator(".payment-policy-consent span").getAttribute("lang"), "es");
        assert.equal(await consent(page).isChecked(), false);
      });

      await run("late-post-cannot-navigate-after-leaving", async ({ page, next }) => {
        await next(0, ready()); await settled(page); await consent(page).check(); await pay(page).click();
        await page.getByRole("button", { name: "Leave quote", exact: true }).click();
        await next(1, { url: `${origin}/should-not-open` });
        await page.waitForTimeout(100);
        assert.equal(new URL(page.url()).pathname, "/account");
        assert.equal(await page.evaluate(() => sessionStorage.getItem("tuveloz:checkout-status-token")), null);
      });

      await run("late-post-cannot-navigate-after-scope-change", async ({ page, next, waitForRequest }) => {
        await next(0, ready()); await settled(page); await consent(page).check(); await pay(page).click();
        await waitForRequest(1);
        await page.getByRole("button", { name: "Change scope", exact: true }).click();
        await next(2, ready(acceptance(2))); await settled(page);
        await next(1, { url: `${origin}/should-not-open` });
        await page.waitForTimeout(100);
        assert.equal(new URL(page.url()).pathname, "/account");
        assert.equal(await consent(page).isChecked(), false);
      });

      await run("unchanged-accepted-quote-still-opens-returned-checkout", async ({ page, next, requests }) => {
        await next(0, ready()); await settled(page); await consent(page).check(); await pay(page).click();
        await next(1, { url: `${origin}/synthetic-checkout` });
        await page.waitForURL(`${origin}/synthetic-checkout`);
        assert.equal(await page.evaluate(() => sessionStorage.getItem("tuveloz:checkout-status-token")), "synthetic-token-a");
        assert.equal(requests.filter(request => request.method === "POST").length, 1);
      });

      await run("production-lock-contacts-no-payment-api", async ({ page, requests }) => {
        await page.getByRole("heading", { name: "No payment is due through Tuveloz." }).waitFor();
        assert.equal(await consent(page).count(), 0); assert.equal(requests.length, 0);
      }, { closed: true });

      for (const language of ["en", "es"]) for (const warranty of ["", "SYNTHETIC garantía: Terms of Use & <test>"]) {
        await run(`released-${language}-${warranty ? "warranty" : "no-warranty"}-checkbox-download-and-post-match`, async ({ page, next, requests }) => {
          let index = 0;
          if (language === "es") {
            await next(index++, ready()); await settled(page); await consent(page).check();
            await page.getByRole("button", { name: "Change language", exact: true }).click();
          }
          const record = await syntheticCheckoutAcceptance(language, { quoteId: "synthetic-quote-a", workmanshipWarranty: warranty });
          await next(index++, ready(record)); await settled(page);
          const label = card(page).locator(".payment-policy-consent");
          assert.equal(await label.innerText(), record.presentedText);
          assert.equal(await consent(page).isChecked(), false);
          assert.equal(await pay(page).isDisabled(), true);
          for (const document of record.policyRelease.documents) {
            const link = card(page).getByRole("link", { name: document.title, exact: true });
            assert.equal(await link.getAttribute("href"), document.href);
            assert.equal(await link.getAttribute("target"), "_blank", "reading a policy must preserve the quote");
          }
          const downloading = page.waitForEvent("download");
          await card(page).getByRole("button", { name: language === "es" ? "Descargar esta autorización exacta" : "Download this exact authorization", exact: true }).click();
          const download = await downloading;
          let content = ""; for await (const chunk of await download.createReadStream()) content += chunk.toString();
          const downloaded = JSON.parse(content);
          assert.deepEqual(downloaded, { quoteId: "synthetic-quote-a", ...record });
          const saved = JSON.parse(downloaded.agreementText);
          assert.equal(saved.presentedText, await label.innerText());
          assert.equal(saved.scopeSnapshot.workmanshipWarranty, warranty);
          assert.equal(saved.scopeSnapshot.providerLegalName, record.scope.providerLegalName);
          assert.equal(await checkoutModule("./lib/provider-policy-acceptance").sha256Text(downloaded.agreementText), downloaded.agreementHash);
          assert.equal(await consent(page).isChecked(), false);
          await consent(page).check(); await pay(page).click();
          await next(index, { error: "Synthetic stop before Stripe" }, 503);
          assert.equal(requests[index].body.language, language);
          assert.equal(requests[index].body.checkoutAgreementVersion, record.agreementVersion);
          assert.equal(requests[index].body.checkoutAgreementHash, record.agreementHash);
          await page.getByRole("alert").waitFor();
          assert.equal(await consent(page).count(), 0);
        });
      }

      await run("language-changes-ignore-stale-readiness-and-checkout-redirects", async ({ page, next, waitForRequest }) => {
        await page.getByRole("button", { name: "Change language", exact: true }).click();
        await waitForRequest(1);
        const spanish = await syntheticCheckoutAcceptance("es", { quoteId: "synthetic-quote-a" });
        await next(1, ready(spanish)); await settled(page);
        await next(0, ready());
        assert.equal(await card(page).locator(".payment-policy-consent").innerText(), spanish.presentedText);
        await consent(page).check(); await pay(page).click(); await waitForRequest(2);
        await page.getByRole("button", { name: "Change language", exact: true }).click();
        await next(3, ready()); await settled(page);
        await next(2, { url: `${origin}/should-not-open` });
        await page.waitForTimeout(100);
        assert.equal(new URL(page.url()).pathname, "/account");
        assert.equal(await consent(page).isChecked(), false);
        assert.equal(await page.evaluate(() => sessionStorage.getItem("tuveloz:checkout-status-token")), null);
      });
    } finally { await browser.close(); }
  }
} finally { await new Promise(done => server.close(done)); }
