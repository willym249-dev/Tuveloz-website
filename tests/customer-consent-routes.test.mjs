import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { and, eq, desc, exists, inArray } from "drizzle-orm";
import * as schema from "../db/schema.ts";
import { checkoutModule } from "./helpers/checkout-evidence.mjs";
import { consentApi, scopeApi, policyApi, factsApi, providerApi, matchingApi, syntheticRequestScope as scope, syntheticSelectionScope } from "./helpers/customer-job-consent.mjs";

const root = new URL("../", import.meta.url);
const recovery = checkoutModule("./lib/customer-request-response");
// Real request/selection routes, evidence, scope reader, all migrations and SQL.
// Only launch/provider eligibility and external side effects are synthetic here.
// This proves consent persistence, not provider approval or real marketplace readiness.
function harness({ open = true, released = true } = {}) {
  const sqlite = new DatabaseSync(":memory:");
  for (const entry of JSON.parse(readFileSync(new URL("drizzle/meta/_journal.json", root), "utf8")).entries) {
    for (const sql of readFileSync(new URL(`drizzle/${entry.tag}.sql`, root), "utf8").split("--> statement-breakpoint")) {
      if (sql.trim()) sqlite.exec(sql);
    }
  }
  const execute = (sql, params, method) => {
    const statement = sqlite.prepare(sql);
    if (method === "run") { statement.run(...params); return { rows: [] }; }
    return { rows: method === "get" ? Object.values(statement.get(...params) ?? {})
      : statement.all(...params).map(row => Object.values(row)) };
  };
  const db = drizzle(execute, async queries => {
    sqlite.exec("BEGIN");
    try { const results = queries.map(query => execute(query.sql, query.params, query.method)); sqlite.exec("COMMIT"); return results; }
    catch (error) { sqlite.exec("ROLLBACK"); throw error; }
  });
  const bindings = {
    ...schema, ...scopeApi, ...consentApi, ...policyApi, ...factsApi, ...providerApi, ...matchingApi,
    ...checkoutModule("./lib/policies"), and, eq, desc, exists, inArray, getDb: () => db,
    CUSTOMER_JOB_POSTING_PAUSED: !open, runtimeMarketplaceActionAllowed: async () => open,
    marketplacePausedMessage: () => "Synthetic launch closed", isSameOriginRequest: () => true,
    customerPolicyPresentationIsReleased: (...args) => released && policyApi.customerPolicyPresentationIsReleased(...args),
    getAccountSession: async () => null, normalizeContactPhone: () => "", recordPhoneContactConsent: async () => {},
    enrollLaunchUpdateSubscriber: async () => {}, validateJobImage: async () => null,
    ImageValidationError: class extends Error {},
    decideAutomaticJobRouting: async input => ({ ...input, allowed: true, activationDecisionIds: [],
      launchReadinessDecisionIds: [], launchReadinessCheckedAt: "", matchingProviders: [] }),
    requiredProviderCredentialRequirements: () => [], parseProviderSelfAssessment: () => ({}),
    externalIdentityAgeVerificationIsCurrent: () => false,
    customerPriceFor: amount => ({ customerFeeRateBps: 500, customerFeeCents: amount * .05, customerTotalCents: amount * 1.05 }),
    evaluateStageEligibility: async () => ({ allowed: true, decisionId: "synthetic-decision" }),
    QUOTE_DECLINE_REASON_VALUES: checkoutModule("./lib/quote-feedback").QUOTE_DECLINE_REASON_VALUES,
    sendAcceptedQuoteAlert: async () => ({ sent: false, reason: "isolated test" }),
  };
  function module(path) {
    const exports = {};
    const compiled = ts.transpileModule(readFileSync(new URL(path, root), "utf8"), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText;
    new Function("exports", "require", compiled)(exports, () => bindings);
    return exports;
  }
  Object.assign(bindings, module("lib/job-scope-records.ts"));
  const requests = module("app/api/requests/route.ts"), quotes = module("app/api/customer-quotes/route.ts");
  const seed = (table, values) => {
    const columns = Object.keys(values);
    sqlite.prepare(`INSERT INTO ${table} (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})`).run(...Object.values(values));
  };
  return { sqlite, requests, quotes, seed, bindings };
}
const post = (path, body) => new Request(`https://tuveloz.invalid/api/${path}`, {
  method: "POST", headers: { "content-type": "application/json", origin: "https://tuveloz.invalid" }, body: JSON.stringify(body),
});
async function requestBody(language) {
  const consent = await consentApi.customerRequestConsentPresentation(language);
  return { language, name: "SYNTHETIC Customer", email: "customer@example.invalid", ...scope,
    launchArea: matchingApi.CURRENT_LAUNCH_AREA,
    serviceCodes: scope.serviceCodes, serviceLocations: [scope.serviceLocations],
    requestedOperations: scope.jobFacts.requestedOperations.map(operation => operation.operationCode),
    prohibitedOperationsAttestedAbsent: scope.jobFacts.prohibitedOperationsAttestedAbsent,
    jobLocationType: scope.jobFacts.location.type, propertyPermission: scope.jobFacts.location.propertyPermission,
    vehicleDriveability: "driveable", vehicleState: "normal_stationary", highVoltageStatus: "not_applicable_or_not_involved",
    safetyAttestations: scope.jobFacts.safetyAttestations, laborOnlyPartsAcknowledged: true,
    termsAccepted: true, privacyAcknowledged: true,
    customerAcceptanceKey: consent.request.agreementKey, customerAcceptanceVersion: consent.request.agreementVersion,
    customerAcceptanceHash: consent.request.agreementHash, customerPrivacyKey: consent.privacy.agreementKey,
    customerPrivacyVersion: consent.privacy.agreementVersion, customerPrivacyHash: consent.privacy.agreementHash };
}
async function seedQuote(h, language) {
  const response = await h.requests.POST(post("requests", await requestBody(language)));
  const result = await response.json();
  assert.equal(response.status, 201, JSON.stringify(result));
  const q = syntheticSelectionScope.quote;
  h.seed("provider_applications", { id: q.providerId, name: q.providerName, email: "provider@example.invalid",
    service: "Battery replacement", experience: "SYNTHETIC", insurance_status: "SYNTHETIC", status: "approved", is_test_provider: "no", verification_status: "verified", service_area: "Montgomery County", work_locations: matchingApi.PROVIDER_WORK_LOCATION_OPTIONS[0] });
  h.seed("provider_pathway_profiles", { id: "synthetic-profile", provider_id: q.providerId, provider_person_id: q.performingPersonId,
    status: "active", provider_level: "standard_provider", policy_version: providerApi.POLICY_VERSION, relationship_path: "independent_startup" });
  h.seed("provider_quotes", { id: q.quoteId, request_id: result.requestId, provider_name: q.providerName, provider_email: "provider@example.invalid",
    price_cents: "10000", labor_price_cents: "10000", parts_price_cents: "0", customer_fee_rate_bps: 500, labor_only_parts_confirmed_at: "2026-10-01T00:00:00Z",
    customer_fee_cents: "500", customer_total_cents: "10500", service_codes: JSON.stringify(scope.serviceCodes),
    availability: "SYNTHETIC", message: "SYNTHETIC", part_type: "Customer supplied", status: "submitted", scope_version: 1, scheduled_for: scope.scheduledFor, performing_person_id: q.performingPersonId });
  return result;
}

for (const language of ["en", "es"]) {
  test(`${language} request route rejects stale consent, saves exact records, and returns a matching receipt`, async () => {
    const h = harness();
    try {
      const body = await requestBody(language);
      for (const change of [{ language: undefined }, { language: "fr" }, { language: language === "en" ? "es" : "en" },
        { customerAcceptanceHash: "0".repeat(64) }, { customerPrivacyHash: "1".repeat(64) }, { termsAccepted: false }, { privacyAcknowledged: false }]) {
        const response = await h.requests.POST(post("requests", { ...body, ...change }));
        assert.ok([400, 409].includes(response.status), JSON.stringify(await response.json()));
        assert.equal(h.sqlite.prepare("SELECT count(*) n FROM customer_requests").get().n, 0);
      }
      const response = await h.requests.POST(post("requests", body));
      const saved = await response.json();
      assert.equal(response.status, 201, JSON.stringify(saved));
      const records = h.sqlite.prepare("SELECT * FROM customer_agreement_acceptances WHERE request_id=? ORDER BY agreement_key").all(saved.requestId);
      assert.equal(records.length, 2);
      for (const record of records) {
        const receipt = record.agreement_key === scopeApi.CUSTOMER_REQUEST_AGREEMENT_KEY ? saved.consent.request : saved.consent.privacy;
        assert.equal(record.agreement_text, receipt.agreementText);
        assert.equal(record.agreement_hash, receipt.agreementHash);
        assert.equal(JSON.parse(record.agreement_text).language, language);
      }
      assert.equal((await h.bindings.loadCurrentAcceptedCustomerRequestScope(saved.requestId, body.email)).requestId, saved.requestId);
      assert.equal(await h.bindings.loadCurrentAcceptedCustomerRequestScope(saved.requestId, "someone-else@example.invalid"), null);
    } finally { h.sqlite.close(); }
  });

  test(`${language} quote GET, POST and immutable SQL agree; mismatched and repeated approvals cannot write`, async () => {
    const h = harness();
    try {
      const saved = await seedQuote(h, language);
      const get = chosen => h.quotes.GET(new Request(`https://tuveloz.invalid/api/customer-quotes?token=${saved.accessToken}${chosen ? `&language=${chosen}` : ""}`));
      const missing = await (await get("")).json();
      assert.equal(missing.quotes[0].selectionAcceptance, null);
      const response = await get(language), result = await response.json();
      assert.equal(response.status, 200, JSON.stringify(result));
      assert.equal(recovery.validCustomerRequestSnapshot(result), true, "real route supplies a complete recovery snapshot");
      for (const [action, status, declineReason] of [["decline-quote", "declined", "price"], ["restore-quote", "submitted", ""]]) {
        const changed = await h.quotes.POST(post("customer-quotes", { action, token: saved.accessToken, quoteId: "synthetic-quote", declineReason }));
        assert.equal(changed.status, 200);
        assert.equal(recovery.validQuoteFeedbackReply(await changed.json(), action, declineReason), true);
        const refreshed = await (await get(language)).json();
        assert.equal(recovery.validCustomerRequestSnapshot(refreshed), true);
        assert.equal(refreshed.quotes[0].status, status);
        assert.equal(refreshed.quotes[0].declineReason, declineReason);
      }
      const consent = result.quotes[0].selectionAcceptance;
      assert.ok(consent, result.quotes[0].selectionBlockedReason);
      const body = { language, action: "accept-quote", quoteId: "synthetic-quote", token: saved.accessToken,
        selectionAccepted: true, selectionAgreementKey: consent.agreementKey,
        selectionAgreementVersion: consent.agreementVersion, selectionAgreementHash: consent.agreementHash };
      for (const change of [{ language: undefined }, { language: language === "en" ? "es" : "en" },
        { selectionAgreementHash: "0".repeat(64) }, { selectionAgreementHash: 123 }, { selectionAccepted: false }]) {
        const denied = await h.quotes.POST(post("customer-quotes", { ...body, ...change }));
        assert.equal(denied.status, 400, JSON.stringify(await denied.json()));
        assert.equal(h.sqlite.prepare("SELECT count(*) n FROM job_scope_versions").get().n, 0);
      }
      h.sqlite.prepare("UPDATE provider_quotes SET workmanship_warranty=? WHERE id=?").run("Changed after presentation", "synthetic-quote");
      assert.equal((await h.quotes.POST(post("customer-quotes", body))).status, 400, "a changed provider promise requires new consent");
      h.sqlite.prepare("UPDATE provider_quotes SET workmanship_warranty='' WHERE id=?").run("synthetic-quote");
      const accepted = await h.quotes.POST(post("customer-quotes", body));
      assert.equal(accepted.status, 200, JSON.stringify(await accepted.json()));
      const original = h.sqlite.prepare("SELECT * FROM customer_agreement_acceptances WHERE quote_id=?").get("synthetic-quote");
      assert.equal(original.agreement_text, consent.agreementText);
      assert.equal(original.agreement_hash, consent.agreementHash);
      assert.equal(original.agreement_version, consent.agreementVersion);
      assert.equal(h.sqlite.prepare("SELECT status FROM customer_requests WHERE id=?").get(saved.requestId).status, "quote accepted");
      assert.equal((await h.quotes.POST(post("customer-quotes", body))).status, 409);
      assert.deepEqual(h.sqlite.prepare("SELECT * FROM customer_agreement_acceptances WHERE quote_id=?").get("synthetic-quote"), original);
    } finally { h.sqlite.close(); }
  });
}

test("closed launch and unreleased language deny intake before writes", async () => {
  for (const options of [{ open: false }, { released: false }]) {
    const h = harness(options);
    try {
      assert.equal((await h.requests.POST(post("requests", await requestBody("es")))).status, 503);
      assert.equal(h.sqlite.prepare("SELECT count(*) n FROM customer_requests").get().n, 0);
    } finally { h.sqlite.close(); }
  }
});
