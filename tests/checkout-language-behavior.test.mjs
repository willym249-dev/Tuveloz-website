import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const root = new URL("../", import.meta.url);
const modules = new Map();
function pureModule(path, parent = root) {
  let url = new URL(path, parent);
  if (url.pathname.endsWith(".json")) return JSON.parse(readFileSync(url, "utf8"));
  if (!url.pathname.endsWith(".ts")) url = new URL(`${url.href}.ts`);
  if (modules.has(url.href)) return modules.get(url.href);
  const exports = {};
  modules.set(url.href, exports);
  const compiled = ts.transpileModule(readFileSync(url, "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  new Function("exports", "require", compiled)(exports, name => {
    assert.ok(name.startsWith("."), "Only local pure evidence modules are loaded");
    return pureModule(name, url);
  });
  return exports;
}
const acceptance = pureModule("./lib/customer-checkout-acceptance");
const policy = pureModule("./lib/customer-policy-acceptance");
const policies = pureModule("./lib/policies");

// Execute the unchanged route, with synthetic read-only records and no network
// clients. These fixtures exercise the language boundary, not provider approval.
function harness({ open = true, payment = null, signedIn = false } = {}) {
  const schema = Object.fromEntries([
    "customerAgreementAcceptances", "customerRequests", "jobAuthorizationSnapshots",
    "jobScopeVersions", "providerApplications", "providerEvidenceSubmissions",
    "providerQuotes", "stripePayments",
  ].map(name => [name, new Proxy({ name }, { get: (target, key) => target[key] ?? `${name}.${String(key)}` })]));
  const calls = { reads: 0, stripe: 0, writes: 0 };
  const selection = {
    quoteId: "synthetic-quote", requestId: "synthetic-request", scopeVersion: 1,
    requestAccessToken: "synthetic-token", customerEmail: "customer@example.invalid",
    isTestJob: "no", connectedAccountId: "acct_synthetic", providerApplicationId: "synthetic-provider",
    performingPersonId: "synthetic-performer", quoteWorkmanshipWarranty: "SYNTHETIC literal warranty",
    providerStatus: "approved", providerVerificationStatus: "verified", providerIsTest: "no",
    providerAmount: "10000", customerFeeCents: "500", customerTotalCents: "10500",
    quoteAuthorizationDecisionId: "synthetic-decision", assignmentVersion: 1,
    partsSource: "customer", quoteScheduledFor: "2026-10-01T12:00:00Z", requestScheduledFor: "2026-10-01T12:00:00Z",
  };
  const scope = {
    version: 1, serviceCodes: '["SYNTHETIC-SERVICE"]', scheduledFor: "2026-10-01T12:00:00Z",
    authorizationDecisionId: "synthetic-decision",
    customerAuthorizedAt: "2026-09-30T00:00:00Z", scopeDetails: "{}",
    priceBreakdown: JSON.stringify({ laborAmountCents: 10000, partsAmountCents: 0, taxAmountCents: 0,
      otherAmountCents: 0, totalAmountCents: 10000, customerFeeRateBps: 500,
      customerFeeCents: 500, customerTotalCents: 10500 }),
  };
  const db = {
    select() {
      calls.reads++;
      let table;
      const query = {
        from(value) { table = value; return query; },
        innerJoin() { return query; }, where() { return query; },
        orderBy() { return query; }, limit() { return query; },
        then(resolve) {
          resolve(table === schema.providerQuotes ? [selection]
            : table === schema.jobScopeVersions ? [scope]
              : table === schema.jobAuthorizationSnapshots ? [{ ...scope, stage: "booking", decision: "allow",
                requestId: selection.requestId, quoteId: selection.quoteId, providerId: selection.providerApplicationId,
                performingPersonId: selection.performingPersonId, scopeVersion: 1, assignmentVersion: 1 }]
              : table === schema.stripePayments ? payment ? [payment] : []
                : table === schema.customerRequests
                  ? [{ customerEmail: selection.customerEmail, accessToken: selection.requestAccessToken }] : []);
        },
      };
      return query;
    },
    insert() { calls.writes++; throw new Error("Unexpected database write"); },
    update() { calls.writes++; throw new Error("Unexpected database write"); },
  };
  const bindings = {
    ...schema, ...acceptance, ...policy, ...policies,
    eq: () => null, and: () => null, desc: () => null,
    getDb: () => db, isSameOriginRequest: () => true,
    getAccountSession: async () => signedIn ? { role: "customer", email: selection.customerEmail } : null,
    runtimeMarketplaceActionAllowed: async () => open,
    marketplacePausedMessage: () => "Synthetic marketplace is closed.",
    customerPriceFor: amount => ({ customerFeeCents: amount * 0.05, customerTotalCents: amount * 1.05 }),
    parseExactServiceCodes: JSON.parse,
    verifiedProviderLegalIdentity: () => ({ legalBusinessName: "SYNTHETIC Álvarez & Sons",
      sourceEvidenceId: "synthetic-source", reviewDecisionId: "synthetic-review", verifiedAt: "2026-09-30T00:00:00Z" }),
    publicPaymentSummary: value => value ?? null,
    getStripeClient: () => { calls.stripe++; return {}; },
    retrieveRecipientAccountStatus: async () => ({ readyToReceivePayments: true }),
    connectedAccountPayoutSafety: async () => ({ allowed: true, reasons: [] }),
    siteUrlFor: () => "https://tuveloz.com",
    isLaborOnlyPartsSource: () => true, jobScopeFactsFromScopeDetails: () => ({}),
    // Stop after real exact-consent validation. Nothing can create a session.
    activeJobOperationHoldReasons: async () => ["Synthetic deliberate stop after acceptance validation"],
    stripeErrorResponse: () => Response.json({ code: "UNEXPECTED_STRIPE_PATH" }, { status: 500 }),
  };
  const source = readFileSync(new URL("app/api/stripe/checkout/route.ts", root), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const exports = {};
  new Function("exports", "require", compiled)(exports, () => bindings);
  return { ...exports, calls };
}
const get = (query, token = "synthetic-token") => new Request(
  `https://tuveloz.com/api/stripe/checkout?${query}`,
  { headers: { "x-tuveloz-request-token": token } },
);
const post = (language, overrides = {}) => new Request("https://tuveloz.com/api/stripe/checkout", {
  method: "POST", headers: { "content-type": "application/json", origin: "https://tuveloz.com" },
  body: JSON.stringify({ quoteId: "synthetic-quote", token: "synthetic-token", policyAccepted: true,
    language, checkoutAgreementKey: acceptance.CUSTOMER_CHECKOUT_AGREEMENT_KEY,
    checkoutAgreementVersion: acceptance.CUSTOMER_CHECKOUT_AGREEMENT_VERSION,
    checkoutAgreementHash: "synthetic-existing-English-hash", ...overrides }),
});

test("Spanish readiness never substitutes English consent and preserves existing payment status", async () => {
  for (const payment of [null, { id: "synthetic-paid", status: "paid_pending_completion" }]) {
    const route = harness({ payment });
    const response = await route.GET(get("quoteId=synthetic-quote&language=es"));
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.equal(body.checkoutAllowed, false);
    assert.equal(body.checkoutAcceptance, null);
    assert.equal(body.code, "CHECKOUT_LANGUAGE_UNAVAILABLE");
    assert.match(body.reason, /El pago en español aún no está disponible/);
    assert.deepEqual(body.payment, payment);
    assert.equal(route.calls.stripe, 0);
    assert.equal(route.calls.writes, 0);
  }
});

test("English readiness identifies the exact saved language and immutable agreement version", async () => {
  const route = harness();
  const response = await route.GET(get("quoteId=synthetic-quote&language=en"));
  const body = await response.json();
  assert.equal(body.checkoutAllowed, true);
  assert.equal(body.checkoutAcceptance.language, "en");
  assert.equal(body.checkoutAcceptance.agreementVersion, acceptance.CUSTOMER_CHECKOUT_AGREEMENT_VERSION);
  assert.equal(body.checkoutAcceptance.agreementHash,
    await acceptance.customerCheckoutAgreementHash(body.checkoutAcceptance.scope));
  assert.equal(body.checkoutAcceptance.presentedText,
    JSON.parse(acceptance.customerCheckoutAgreementEvidenceText(body.checkoutAcceptance.scope)).presentedText);
  assert.equal(route.calls.writes, 0);
});

test("missing, invalid and unavailable POST languages cannot create acceptance or contact Stripe", async () => {
  for (const language of [undefined, null, "", "EN", "fr", " en ", {}, ["en"], "es"]) {
    const route = harness();
    const response = await route.POST(post(language));
    assert.equal(response.status, language === "es" ? 409 : 400, String(language));
    const body = await response.json();
    assert.equal(body.code, language === "es" ? "CHECKOUT_LANGUAGE_UNAVAILABLE" : "CHECKOUT_LANGUAGE_REQUIRED");
    assert.equal(body.checkoutAllowed, false);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.deepEqual(route.calls, { reads: 0, stripe: 0, writes: 0 });
  }
});

test("readiness requires explicit language and still authenticates before disclosing payment records", async () => {
  const route = harness();
  const response = await route.GET(get("quoteId=synthetic-quote"));
  assert.equal((await response.json()).code, "CHECKOUT_LANGUAGE_REQUIRED");
  const unauthorized = await route.GET(get("quoteId=synthetic-quote&language=es", "wrong-token"));
  assert.equal(unauthorized.status, 404);
  assert.equal(route.calls.stripe, 0);
});

test("previous and tampered language evidence is rejected before acceptance writes", async () => {
  const route = harness();
  const { checkoutAcceptance: current } = await (await route.GET(get("quoteId=synthetic-quote&language=en"))).json();
  const expected = { checkoutAgreementKey: current.agreementKey,
    checkoutAgreementVersion: current.agreementVersion, checkoutAgreementHash: current.agreementHash };
  const currentResponse = await route.POST(post("en", expected));
  assert.equal((await currentResponse.json()).code, "CHECKOUT_OPERATIONAL_HOLD",
    "the current English evidence must pass validation and reach the deliberate later hold");
  const evidence = JSON.parse(acceptance.customerCheckoutAgreementEvidenceText(current.scope));
  const hash = pureModule("./lib/provider-policy-acceptance").sha256Text;
  for (const invalid of [
    { checkoutAgreementVersion: current.agreementVersion.replace("checkout:5|lang:en", "checkout:4") },
    { checkoutAgreementHash: await hash(JSON.stringify({ ...evidence, language: "es" })) },
    { checkoutAgreementVersion: current.agreementVersion.replace("lang:en", "lang:es") },
  ]) {
    const response = await route.POST(post("en", { ...expected, ...invalid }));
    assert.equal(response.status, 409);
    assert.equal((await response.json()).code, "CHECKOUT_ACCEPTANCE_REFRESH_REQUIRED");
  }
  assert.equal(route.calls.writes, 0);
});

test("launch locks remain ahead of language checks, while authorized payment-status reads remain available", async () => {
  const payment = { id: "synthetic-paid", status: "paid_pending_completion", paymentType: "quote",
    requestId: "synthetic-request", customerEmail: "customer@example.invalid" };
  const route = harness({ open: false, payment });
  for (const response of [await route.GET(get("quoteId=synthetic-quote&language=en")), await route.POST(post("en"))]) {
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, "MARKETPLACE_ONBOARDING_ONLY");
  }
  const status = await route.GET(get("sessionId=cs_synthetic&language=es"));
  assert.equal(status.status, 200);
  assert.deepEqual((await status.json()).payment, payment);
  const unauthorized = await route.GET(get("sessionId=cs_synthetic&language=es", "wrong-token"));
  assert.equal(unauthorized.status, 404);
  assert.equal(route.calls.stripe, 0);
  assert.equal(route.calls.writes, 0);
});
