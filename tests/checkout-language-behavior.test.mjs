import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { eq, and, desc } from "drizzle-orm";
import * as schema from "../db/schema.ts";

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
function harness({ open = true, payment = null, signedIn = false, presentationAvailable = true, recordAcceptance = false } = {}) {
  const sqlite = recordAcceptance ? new DatabaseSync(":memory:") : null;
  if (sqlite) {
    const migration = readFileSync(new URL("drizzle/0038_integrated_launch_controls.sql", root), "utf8");
    for (const statement of migration.split("--> statement-breakpoint")) {
      if (statement.includes("`customer_agreement_acceptances`")) sqlite.exec(statement);
    }
  }
  const acceptanceDb = sqlite ? drizzle(async (sql, params, method) => {
    const statement = sqlite.prepare(sql);
    // CI supports Node 22.13, which does not have setReturnArrays. These
    // acceptance-only queries have unique columns and need no join aliases.
    if (method === "run") { statement.run(...params); return { rows: [] }; }
    return { rows: method === "get" ? Object.values(statement.get(...params) ?? {})
      : statement.all(...params).map(row => Object.values(row)) };
  }) : null;
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
    customerName: "Synthetic Customer", providerName: "Synthetic Provider",
  };
  const scope = {
    version: 1, serviceCodes: '["SYNTHETIC-SERVICE"]', scheduledFor: "2026-10-01T12:00:00Z",
    authorizationDecisionId: "synthetic-decision",
    customerAuthorizedAt: "2026-09-30T00:00:00Z", scopeDetails: "{}",
    priceBreakdown: JSON.stringify({ laborAmountCents: 10000, partsAmountCents: 0, taxAmountCents: 0,
      otherAmountCents: 0, totalAmountCents: 10000, customerFeeRateBps: 500,
      customerFeeCents: 500, customerTotalCents: 10500 }),
  };
  // Stop after the real immutable write/reread with an already-paid synthetic
  // payment. No Stripe session, email, provider record or external call exists.
  if (recordAcceptance) payment = { id: "synthetic-paid", status: "paid_pending_completion",
    providerAmountCents: 10000, applicationFeeCents: 500, customerTotalCents: 10500,
    scopeVersion: 1, scopeAuthorizationDecisionId: "synthetic-decision", authorizedPriceSnapshot: scope.priceBreakdown };
  const db = {
    select() {
      calls.reads++;
      let table;
      const query = {
        from(value) {
          if (value === schema.customerAgreementAcceptances && acceptanceDb) return acceptanceDb.select().from(value);
          table = value; return query;
        },
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
    insert(table) {
      calls.writes++;
      if (table === schema.customerAgreementAcceptances && acceptanceDb) return acceptanceDb.insert(table);
      throw new Error("Unexpected database write");
    },
    update() { calls.writes++; throw new Error("Unexpected database write"); },
  };
  const bindings = {
    ...schema, ...acceptance, ...policy, ...policies,
    eq, and, desc,
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
    activeJobOperationHoldReasons: async () => recordAcceptance ? [] : ["Synthetic deliberate stop after acceptance validation"],
    customerPolicyPresentationIsReleased: (...args) => presentationAvailable && policy.customerPolicyPresentationIsReleased(...args),
    evaluateStageEligibility: async () => ({ allowed: true, decisionId: "synthetic-decision", validThrough: "2999-01-01" }),
    hostedCustomerServiceFeeText: () => ({ name: "Synthetic fee" }),
    requestIpAddress: () => "127.0.0.1", customerAcceptanceDeviceContext: () => "Synthetic local test",
    stripeErrorResponse: error => { throw error; },
  };
  const source = readFileSync(new URL("app/api/stripe/checkout/route.ts", root), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const exports = {};
  new Function("exports", "require", compiled)(exports, () => bindings);
  return { ...exports, calls, sqlite };
}
const get = (query, token = "synthetic-token") => new Request(
  `https://tuveloz.com/api/stripe/checkout?${query}`,
  { headers: { "x-tuveloz-request-token": token } },
);
const post = (language, overrides = {}) => new Request("https://tuveloz.com/api/stripe/checkout", {
  method: "POST", headers: { "content-type": "application/json", origin: "https://tuveloz.com" },
  body: JSON.stringify({ quoteId: "synthetic-quote", token: "synthetic-token", policyAccepted: true,
    language, checkoutAgreementKey: acceptance.CUSTOMER_CHECKOUT_AGREEMENT_KEY,
    checkoutAgreementVersion: acceptance.customerCheckoutAgreementVersion("en"),
    checkoutAgreementHash: "synthetic-existing-English-hash", ...overrides }),
});

test("unavailable translations never substitute English consent and preserve existing payment status", async () => {
  for (const payment of [null, { id: "synthetic-paid", status: "paid_pending_completion" }]) {
    const route = harness({ payment, presentationAvailable: false });
    const response = await route.GET(get("quoteId=synthetic-quote&language=es"));
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.equal(body.checkoutAllowed, false);
    assert.equal(body.checkoutAcceptance, null);
    assert.equal(body.code, "CHECKOUT_LANGUAGE_UNAVAILABLE");
    assert.match(body.reason, /acuerdos de pago vigentes en español/);
    assert.deepEqual(body.payment, payment);
    assert.equal(route.calls.stripe, 0);
    assert.equal(route.calls.writes, 0);
  }
});

for (const language of ["en", "es"]) test(`${language} readiness identifies the exact saved language, policy release and immutable agreement version`, async () => {
  const route = harness();
  const response = await route.GET(get(`quoteId=synthetic-quote&language=${language}`));
  const body = await response.json();
  assert.equal(body.checkoutAllowed, true);
  assert.equal(body.checkoutAcceptance.language, language);
  assert.equal(body.checkoutAcceptance.agreementVersion, acceptance.customerCheckoutAgreementVersion(language));
  assert.equal(body.checkoutAcceptance.agreementHash,
    await acceptance.customerCheckoutAgreementHash(body.checkoutAcceptance.scope, language));
  assert.equal(body.checkoutAcceptance.presentedText,
    JSON.parse(acceptance.customerCheckoutAgreementEvidenceText(body.checkoutAcceptance.scope, language)).presentedText);
  assert.equal(body.checkoutAcceptance.agreementText, acceptance.customerCheckoutAgreementEvidenceText(body.checkoutAcceptance.scope, language));
  assert.deepEqual(body.checkoutAcceptance.policyRelease, JSON.parse(body.checkoutAcceptance.agreementText).policyRelease);
  assert.equal(route.calls.writes, 0);
});

test("missing and invalid POST languages cannot create acceptance or contact Stripe", async () => {
  for (const language of [undefined, null, "", "EN", "fr", " en ", {}, ["en"]]) {
    const route = harness();
    const response = await route.POST(post(language));
    assert.equal(response.status, 400, String(language));
    const body = await response.json();
    assert.equal(body.code, "CHECKOUT_LANGUAGE_REQUIRED");
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

for (const language of ["en", "es"]) test(`${language} rejects previous and tampered evidence before acceptance writes`, async () => {
  const route = harness();
  const { checkoutAcceptance: current } = await (await route.GET(get(`quoteId=synthetic-quote&language=${language}`))).json();
  const expected = { checkoutAgreementKey: current.agreementKey,
    checkoutAgreementVersion: current.agreementVersion, checkoutAgreementHash: current.agreementHash };
  const currentResponse = await route.POST(post(language, expected));
  assert.equal((await currentResponse.json()).code, "CHECKOUT_OPERATIONAL_HOLD",
    "current evidence must pass validation and reach the deliberate later hold");
  const evidence = JSON.parse(current.agreementText);
  const hash = pureModule("./lib/provider-policy-acceptance").sha256Text;
  for (const invalid of [
    { checkoutAgreementVersion: current.agreementVersion.replace(/checkout:6\|lang:..$/, "checkout:5|lang:en") },
    { checkoutAgreementHash: await hash(JSON.stringify({ ...evidence, language: language === "en" ? "es" : "en" })) },
    { checkoutAgreementVersion: acceptance.customerCheckoutAgreementVersion(language === "en" ? "es" : "en") },
    { checkoutAgreementHash: await acceptance.customerCheckoutAgreementHash({ ...current.scope, workmanshipWarranty: "changed" }, language) },
  ]) {
    const response = await route.POST(post(language, { ...expected, ...invalid }));
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

test("unavailable presentation blocks POST before writes or Stripe access", async () => {
  for (const language of ["en", "es"]) {
    const route = harness({ presentationAvailable: false });
    const response = await route.POST(post(language));
    assert.equal(response.status, 409);
    assert.equal((await response.json()).code, "CHECKOUT_LANGUAGE_UNAVAILABLE");
    assert.deepEqual(route.calls, { reads: 0, stripe: 0, writes: 0 });
  }
});

test("both languages persist and reread independently under the actual SQLite unique key", async () => {
  const route = harness({ recordAcceptance: true });
  try {
    const history = JSON.parse(readFileSync(new URL("tests/fixtures/customer-checkout-v5-en.json", root), "utf8"));
    route.sqlite.prepare(`INSERT INTO customer_agreement_acceptances
      (id, customer_email, request_id, quote_id, scope_version, scope_snapshot,
       agreement_key, agreement_version, agreement_hash, agreement_text, accepted_by_name, accepted_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run("synthetic-legacy", "customer@example.invalid", "synthetic-request", "synthetic-quote", 1,
        history.scopeSnapshot, history.agreementKey, history.agreementVersion, history.agreementHash,
        history.agreementText, "Synthetic Customer", "2026-09-30T00:00:00Z", "2026-09-30T00:00:00Z");
    const before = route.sqlite.prepare("SELECT * FROM customer_agreement_acceptances WHERE id=?").get("synthetic-legacy");
    const records = {};
    for (const language of ["en", "es", "en", "es"]) {
      const { checkoutAcceptance: current } = await (await route.GET(get(`quoteId=synthetic-quote&language=${language}`))).json();
      const response = await route.POST(post(language, { checkoutAgreementVersion: current.agreementVersion,
        checkoutAgreementHash: current.agreementHash }));
      assert.equal(response.status, 409);
      assert.equal((await response.json()).error, "This accepted quote has already been paid.", "stop only after exact acceptance is saved and reread");
      const stored = route.sqlite.prepare("SELECT * FROM customer_agreement_acceptances WHERE agreement_version=?").get(current.agreementVersion);
      assert.equal(stored.agreement_text, current.agreementText);
      assert.equal(stored.agreement_hash, current.agreementHash);
      assert.equal(JSON.parse(stored.agreement_text).presentedText, current.presentedText);
      assert.equal(JSON.parse(stored.agreement_text).language, language);
      if (records[language]) assert.deepEqual(stored, records[language], "retry must not overwrite identity, timestamp or evidence");
      records[language] = stored;
    }
    assert.notEqual(records.en.id, records.es.id);
    assert.equal(route.sqlite.prepare("SELECT count(*) AS n FROM customer_agreement_acceptances").get().n, 3);
    assert.deepEqual(route.sqlite.prepare("SELECT * FROM customer_agreement_acceptances WHERE id=?").get("synthetic-legacy"), before);

    // An existing unique key with different evidence is rejected, not silently
    // accepted by onConflictDoNothing or overwritten to make a test pass.
    route.sqlite.prepare("UPDATE customer_agreement_acceptances SET agreement_text=? WHERE id=?").run("SYNTHETIC corrupted record", records.es.id);
    const response = await route.POST(post("es", { checkoutAgreementVersion: records.es.agreement_version,
      checkoutAgreementHash: records.es.agreement_hash }));
    assert.equal((await response.json()).code, "CHECKOUT_ACCEPTANCE_RECORD_FAILED");
    assert.equal(route.sqlite.prepare("SELECT agreement_text FROM customer_agreement_acceptances WHERE id=?").get(records.es.id).agreement_text,
      "SYNTHETIC corrupted record");
  } finally { route.sqlite.close(); }
});
