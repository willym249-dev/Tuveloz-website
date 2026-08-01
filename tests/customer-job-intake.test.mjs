import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("the review intake replaces broad categories with one exact service scope", async () => {
  const [page, scope, homepage] = await Promise.all([
    source("app/post-job/page.tsx"),
    source("lib/customer-job-scope.ts"),
    source("app/page.tsx"),
  ]);

  for (const field of [
    'name="service-code"',
    'name="jurisdiction"',
    'name="municipality"',
    'name="scheduled-for"',
    'name="scheduled-time-zone"',
    'name="requested-operation"',
    'name="prohibited-operation-absent"',
    'name="job-location-type"',
    'name="service-address"',
    'name="property-permission"',
    'name="vehicle-driveability"',
    'name="vehicle-state"',
    'name="high-voltage-status"',
    'name="safety-attestation"',
    'name="job-details"',
    'name="terms-accepted"',
    'name="privacy-acknowledged"',
  ]) {
    assert.ok(page.includes(field), `missing exact intake field ${field}`);
  }
  assert.match(page, /service\.code !== "general_auto_repair"/);
  assert.match(page, /Broad categories such as\s+“general auto repair” are not accepted/);
  assert.doesNotMatch(page, /name="service"/);
  assert.match(page, /Request posting is not open/);
  assert.match(page, /TUVELOZ does not employ, hire, train, assign, or place anyone on/);
  assert.match(page, /Current service area/);
  assert.match(page, /<strong>\{CURRENT_LAUNCH_AREA\}<\/strong>/);
  assert.doesNotMatch(page, /Policy code:/);

  assert.match(scope, /CUSTOMER_REQUEST_SCOPE_VERSION = 1/);
  assert.match(scope, /parseExactServiceCodes/);
  assert.match(scope, /normalized === "general_auto_repair"/);
  assert.match(scope, /America\/New_York/);
  assert.match(scope, /nonexistent or ambiguous DST wall time is rejected/);
  assert.match(scope, /does not authorize a repair, payment, added work/);
  assert.match(scope, /affirmative-separate-customer-privacy-checkbox/);
  assert.match(homepage, /function legacyHomepageRequestFormEnabled\(\) \{\s*return false;/);
  assert.match(homepage, /href="\/post-job"/);
  assert.match(homepage, /The old multi-service homepage form is disabled/);
});

test("new real requests fail before data reads and require immutable exact-scope acceptances", async () => {
  const route = await source("app/api/requests/route.ts");
  const pause = route.indexOf("if (CUSTOMER_JOB_POSTING_PAUSED)");
  const formRead = route.indexOf("request.formData()");
  const jsonRead = route.indexOf("request.json()");
  const routing = route.indexOf("await decideAutomaticJobRouting");
  const requestInsert = route.indexOf("insert(customerRequests)");
  const acceptanceInsert = route.indexOf("insert(customerAgreementAcceptances)");

  assert.ok(pause >= 0 && pause < formRead && pause < jsonRead);
  assert.ok(routing >= 0 && routing < requestInsert);
  assert.ok(requestInsert >= 0 && requestInsert < acceptanceInsert);
  assert.match(route, /serviceCodes\.length !== 1/);
  assert.match(route, /jurisdiction !== POLICY_JURISDICTION/);
  assert.match(route, /Date\.parse\(scheduledFor\) <= Date\.now\(\)/);
  assert.match(route, /jobScopeFactsFromInput/);
  assert.match(route, /evaluateJobScopeFacts\(\[serviceCode\], jobFacts\)/);
  assert.match(route, /jobFacts: jobFactsEvaluation\.facts/);
  assert.match(route, /service: serviceLabel/);
  assert.match(route, /serviceCodes: JSON\.stringify\(automaticDecision\.serviceCodes\)/);
  assert.match(route, /scopeSnapshot: customerRequestScopeSnapshot|const scopeSnapshot = customerRequestScopeSnapshot/);
  assert.match(route, /CUSTOMER_REQUEST_AGREEMENT_KEY/);
  assert.match(route, /CUSTOMER_REQUEST_PRIVACY_AGREEMENT_KEY/);
  assert.match(route, /agreementText: customerRequestAgreementEvidenceText\(scopeSnapshot\)/);
  assert.match(route, /agreementText: customerRequestPrivacyAgreementEvidenceText\(scopeSnapshot\)/);
  assert.match(route, /customerRequestScopedAgreementHash\(scopeSnapshot\)/);
  assert.match(route, /customerRequestScopedPrivacyAgreementHash\(scopeSnapshot\)/);
  assert.match(route, /acceptanceAction: "affirmative-customer-request-scope-checkbox"/);
  assert.match(route, /acceptanceAction: "affirmative-separate-customer-privacy-checkbox"/);
  assert.doesNotMatch(route, /CUSTOMER_JOB_SERVICE_OPTIONS|ALLOWED_SERVICES/);
  assert.doesNotMatch(route, /body\.testOnly|searchParams\.get\("testOnly"\)/);
});

test("quote selection is an exact booking decision with a persisted authorization snapshot", async () => {
  const route = await source("app/api/customer-quotes/route.ts");
  const evaluation = route.indexOf("await evaluateStageEligibility");
  const bookingBatch = route.indexOf("await db.batch");
  const baseScopeInsert = route.indexOf("db.insert(jobScopeVersions)");

  assert.match(route, /isSameOriginRequest\(request\)/);
  assert.match(route, /testOnly: job\.isTestJob === "yes"/);
  assert.doesNotMatch(route, /body\.testOnly|searchParams\.get\("testOnly"\)/);
  assert.match(route, /requestServiceCodes\.length !== 1/);
  assert.match(route, /requestServiceCodes\[0\] !== quoteServiceCodes\[0\]/);
  assert.match(route, /quote\.scopeVersion !== CUSTOMER_REQUEST_SCOPE_VERSION/);
  assert.match(route, /quote\.scheduledFor !== job\.scheduledFor/);
  assert.match(route, /!quote\.performingPersonId/);
  assert.match(route, /profile\.providerPersonId !== quote\.performingPersonId/);
  assert.match(route, /requestAcceptanceIsCurrent/);
  assert.match(route, /CUSTOMER_PROVIDER_SELECTION_AGREEMENT_KEY/);
  assert.match(route, /stage: "booking"/);
  assert.match(route, /customerProviderDisclosureAcceptedAt: acceptedAt/);
  assert.match(route, /jobFacts: selection\.scope\.request\.jobFacts/);
  assert.match(route, /effectiveAt: acceptedAt/);
  assert.match(route, /testOnly: job\.isTestJob === "yes" && activeProvider\.isTestProvider === "yes"/);
  assert.match(route, /persist: true/);
  assert.ok(evaluation >= 0 && evaluation < bookingBatch);
  assert.ok(evaluation < bookingBatch && bookingBatch < baseScopeInsert);
  assert.match(route, /authorizationDecisionId: eligibility\.decisionId/);
  assert.match(route, /db\.insert\(jobScopeVersions\)/);
  assert.match(route, /version: CUSTOMER_REQUEST_SCOPE_VERSION/);
  assert.match(route, /changeReason: "initial_customer_quote_selection"/);
  assert.match(route, /jobFacts: selection\.scope\.request\.jobFacts/);
  assert.match(route, /supersedesScopeVersionId: ""/);
  assert.match(route, /assignedPersonId: quote\.performingPersonId/);
  assert.match(route, /assignedSupervisorPersonId: quote\.supervisorPersonId/);
  assert.match(route, /scopeSnapshot: selectionSnapshot/);
  assert.match(route, /affirmative-provider-quote-selection-checkbox/);
  assert.match(route, /PROVIDER_NOT_ELIGIBLE_AT_BOOKING/);
});

test("operation and location facts default-deny and survive every eligibility stage", async () => {
  const [facts, engine, routing, jobs, operations, records] = await Promise.all([
    source("lib/job-scope-facts.ts"),
    source("lib/provider-eligibility-engine.ts"),
    source("lib/automatic-job-routing.ts"),
    source("app/api/jobs/route.ts"),
    source("lib/job-operations.ts"),
    source("lib/job-scope-records.ts"),
  ]);

  assert.match(facts, /allowedOperations\.includes\(operation\.operationCode\)/);
  assert.match(facts, /prohibited_operation_absence_not_attested/);
  assert.match(facts, /location_rule_missing_or_unknown/);
  assert.match(facts, /required_safety_attestation_missing/);
  assert.match(facts, /high_voltage_status_not_cleared/);
  assert.match(facts, /denied_missing_or_invalid_job_facts/);
  assert.match(facts, /structured_address_binding_failed/);
  assert.match(facts, /areaForZip\(location\.postalCode\) === JOB_SCOPE_COUNTY/);
  assert.match(facts, /compareArrivalJobScopeFacts/);
  assert.match(engine, /evaluateJobScopeFacts\(serviceCodes, input\.jobFacts\)/);
  assert.match(engine, /locationRuleResult: JSON\.stringify\(jobFactsEvaluation\.locationRuleResults\)/);
  assert.match(engine, /scopeCheckResult: jobFactsEvaluation\.scopeCheckResult/);
  assert.doesNotMatch(engine, /pending_route_specific_check|exact_service_codes_checked/);
  assert.match(engine, /jobFactsHash/);
  assert.match(engine, /jobFactsSource/);
  assert.match(engine, /jobFactsSnapshot/);
  assert.match(engine, /effectiveAt/);
  assert.match(routing, /jobFacts: unknown/);
  assert.match(routing, /evaluateJobScopeFacts\(serviceCodes, input\.jobFacts\)/);
  assert.match(jobs, /loadCurrentAcceptedCustomerRequestScope/);
  assert.match(jobs, /jobFacts: acceptedRequestScope\.jobFacts/);
  assert.match(operations, /loadAuthorizedJobScopeFacts/);
  assert.match(operations, /candidateJobFacts/);
  assert.match(operations, /jobFacts,/);
  assert.match(operations, /arrivalJobFacts/);
  assert.match(operations, /provider_arrival_recheck/);
  assert.match(records, /jobScopeFactsFromScopeDetails/);
});

test("customers must check the server-generated provider and quote acceptance", async () => {
  const page = await source("app/my-request/page.tsx");

  assert.match(page, /selectionAcceptance: null/);
  assert.match(page, /acceptedSelectionQuoteId/);
  assert.match(page, /selectionAccepted: true/);
  assert.match(page, /selectionAgreementKey/);
  assert.match(page, /selectionAgreementVersion/);
  assert.match(page, /selectionAgreementHash/);
  assert.match(page, /quote\.selectionAcceptance\.presentedText/);
  assert.match(page, /Authorize this exact provider and quote/);
  assert.match(page, /disabled=\{!quote\.selectionAcceptance\}/);
});
