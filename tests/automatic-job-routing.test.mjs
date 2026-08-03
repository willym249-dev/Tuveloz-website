import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  hasCompleteMandatoryLegalComplianceEvidence,
  requiredOfficialLegalSourceReferences,
} from "../lib/legal-compliance-evidence.ts";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("an activation database row alone cannot open a real service", async () => {
  const [routing, legalEvidence] = await Promise.all([
    source("lib/automatic-job-routing.ts"),
    source("lib/legal-compliance-evidence.ts"),
  ]);

  assert.match(routing, /PLATFORM_SERVICE_ACTIVATION_PROVIDER_ID as SHARED_PLATFORM_SERVICE_ACTIVATION_PROVIDER_ID/);
  assert.match(routing, /PLATFORM_SERVICE_ACTIVATION_STAGE as SHARED_PLATFORM_SERVICE_ACTIVATION_STAGE/);
  assert.match(routing, /await runtimeRealMarketplaceReleaseDecision\(\)/);
  assert.match(routing, /runtimeReleaseApproved: initialReleaseDecision\.approved/);
  assert.match(routing, /runtimeReleaseApproved: finalReleaseDecision\.approved/);
  assert.match(routing, /MARKETPLACE_RELEASE_NOT_APPROVED/);
  assert.match(routing, /launchReadinessDecisionIds: finalReleaseDecision\.decisionIds/);
  assert.match(routing, /launchReadinessCheckedAt: finalReleaseDecision\.checkedAt/);
  assert.match(routing, /orderBy\([\s\S]*desc\(serviceActivationDecisions\.decisionVersion\)/);
  assert.match(routing, /activation\.decision !== "enabled_live"/);
  assert.match(routing, /activation\.policyVersion !== POLICY_VERSION/);
  assert.match(routing, /!validThroughSchedule\(activation\.validThrough, scheduledTime\)/);
  assert.match(routing, /servicePolicy\.launch_state !== "enabled"/);
  assert.match(routing, /!servicePolicy\.customer_visible/);

  for (const requiredLegalField of [
    "legalRequirementsServiceCode",
    "legalRequirementsJurisdiction",
    "legalRequirementsReviewedAt",
    "legalRequirementsValidThrough",
    "legalRequirementsReviewedBy",
    "legalRequirementsReference",
    "applicableRequirementsSummary",
    "officialSourceReferences",
    "ownerLegalComplianceAcknowledged",
    "legalProfessionalReviewStatus",
    "explicitProceedingWithoutCounsel",
  ]) {
    assert.ok(legalEvidence.includes(requiredLegalField), `missing mandatory legal field ${requiredLegalField}`);
  }
  for (const requiredInsurerField of [
    "insurerApprovedAt",
    "insurerValidThrough",
    "insurerApprovedBy",
    "insurerReference",
  ]) {
    assert.ok(routing.includes(requiredInsurerField), `missing insurer field ${requiredInsurerField}`);
  }
  assert.match(routing, /!hasCompleteMandatoryLegalComplianceEvidence\(context, \{[\s\S]*serviceCode,[\s\S]*jurisdiction,[\s\S]*\}, activationThrough\)/);
  assert.match(routing, /!hasCompleteWrittenApproval\(insurerApproval, activationThrough\)/);
  assert.match(routing, /annualComplianceReviewWindowIsValid/);
  assert.match(legalEvidence, /host\.endsWith\("\.gov"\)/);
  assert.doesNotMatch(routing, /counselApproval|counselApprovedAt|counselReference/);
  assert.ok(
    routing.indexOf("await runtimeRealMarketplaceReleaseDecision()")
      < routing.indexOf("const jobFactsEvaluation = evaluateJobScopeFacts"),
  );
  assert.ok(
    routing.indexOf('activation.decision !== "enabled_live"')
      < routing.indexOf("activationDecisionIds.push(activation.id)"),
  );
});

test("mandatory legal evidence is read-time bound to one exact service and jurisdiction", () => {
  const reviewedAt = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const validThrough = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  const context = {
    legalRequirementsServiceCode: "battery_replacement",
    legalRequirementsJurisdiction: "US-MD-MontgomeryCounty",
    legalRequirementsReviewedAt: reviewedAt,
    legalRequirementsValidThrough: validThrough,
    legalRequirementsReviewedBy: "TUVELOZ owner",
    legalRequirementsReference: "LEGAL-MATRIX-001",
    applicableRequirementsSummary: "Applicable registrations, records, invoices, and service restrictions were reviewed.",
    officialSourceReferences: requiredOfficialLegalSourceReferences(
      "battery_replacement",
      "US-MD-MontgomeryCounty",
    ),
    ownerLegalComplianceAcknowledged: true,
    legalProfessionalReviewStatus: "not_obtained_owner_proceeding",
    explicitProceedingWithoutCounsel: true,
  };

  assert.equal(hasCompleteMandatoryLegalComplianceEvidence(context, {
    serviceCode: "battery_replacement",
    jurisdiction: "US-MD-MontgomeryCounty",
  }), true);
  assert.equal(hasCompleteMandatoryLegalComplianceEvidence(context, {
    serviceCode: "oil_change",
    jurisdiction: "US-MD-MontgomeryCounty",
  }), false);
  assert.equal(hasCompleteMandatoryLegalComplianceEvidence(context, {
    serviceCode: "battery_replacement",
    jurisdiction: "US-MD-PrinceGeorgesCounty",
  }), false);
  assert.equal(hasCompleteMandatoryLegalComplianceEvidence({
    ...context,
    explicitProceedingWithoutCounsel: false,
  }, {
    serviceCode: "battery_replacement",
    jurisdiction: "US-MD-MontgomeryCounty",
  }), false);
  assert.equal(hasCompleteMandatoryLegalComplianceEvidence({
    ...context,
    officialSourceReferences: ["https://www.irs.gov/forms-pubs/about-form-w-9"],
  }, {
    serviceCode: "battery_replacement",
    jurisdiction: "US-MD-MontgomeryCounty",
  }), false);
  assert.equal(hasCompleteMandatoryLegalComplianceEvidence({
    ...context,
    legalProfessionalReviewStatus: "obtained_optional",
    explicitProceedingWithoutCounsel: false,
  }, {
    serviceCode: "battery_replacement",
    jurisdiction: "US-MD-MontgomeryCounty",
  }), true);
  assert.equal(hasCompleteMandatoryLegalComplianceEvidence({
    ...context,
    legalRequirementsValidThrough: new Date(Date.now() - 86_400_000).toISOString().slice(0, 10),
  }, {
    serviceCode: "battery_replacement",
    jurisdiction: "US-MD-MontgomeryCounty",
  }), false);
  assert.equal(hasCompleteMandatoryLegalComplianceEvidence({
    ...context,
    legalRequirementsValidThrough: new Date(Date.now() + 400 * 86_400_000).toISOString().slice(0, 10),
  }, {
    serviceCode: "battery_replacement",
    jurisdiction: "US-MD-MontgomeryCounty",
  }), false);
});

test("every configured service has a mandatory official-source baseline", async () => {
  const matrix = JSON.parse(await readFile(
    new URL("../config/provider-eligibility-matrix.json", import.meta.url),
    "utf8",
  ));
  const serviceCodes = Object.keys(matrix.services);

  assert.equal(serviceCodes.length, 25);
  for (const serviceCode of serviceCodes) {
    const references = requiredOfficialLegalSourceReferences(
      serviceCode,
      matrix.jurisdiction,
    );
    assert.ok(references.length > 0, `missing official-source baseline for ${serviceCode}`);
    assert.ok(
      references.every((reference) => reference.startsWith("https://") && new URL(reference).hostname.endsWith(".gov")),
      `non-government baseline source for ${serviceCode}`,
    );
  }
});

test("automatic approval requires one verified provider eligible for every exact service", async () => {
  const routing = await source("lib/automatic-job-routing.ts");

  assert.match(routing, /serviceCode === "general_auto_repair"/);
  assert.match(routing, /!isServiceCode\(rawCode\.trim\(\)\)/);
  assert.match(routing, /providerServiceEligibility\.eligibilityState, "eligible"/);
  assert.match(routing, /eligibility\.policyVersion !== POLICY_VERSION/);
  assert.match(routing, /!validThroughSchedule\(eligibility\.validThrough, scheduledTime\)/);
  assert.match(routing, /eligibility\.relationshipPath !== "independent_startup"/);
  assert.match(routing, /eligibleForService\.has\(providerId\)/);
  assert.match(routing, /providerApplications\.status, "approved"/);
  assert.match(routing, /providerApplications\.verificationStatus, "verified"/);
  assert.match(routing, /providerApplications\.isTestProvider, "no"/);
  assert.match(routing, /approvedServices\.size > 0/);
  assert.match(routing, /serviceCodes\.every\(\(serviceCode\) => approvedServices\.has\(serviceCode\)\)/);
  assert.match(routing, /if \(matchingProviders\.length === 0\)/);
});

test("the request route stays launch-closed, fails closed, and never queues owner review", async () => {
  const route = await source("app/api/requests/route.ts");
  const pause = route.indexOf("if (CUSTOMER_JOB_POSTING_PAUSED)");
  const bodyRead = Math.min(
    route.indexOf("request.formData()"),
    route.indexOf("request.json()"),
  );
  const decision = route.indexOf("await decideAutomaticJobRouting");
  const insertion = route.indexOf("insert(customerRequests)");

  assert.ok(pause >= 0 && pause < bodyRead);
  assert.ok(decision >= 0 && decision < insertion);
  assert.match(route, /if \(!automaticDecision\.allowed\)/);
  assert.match(route, /status: automaticDecision \? "approved" : "new"/);
  assert.match(route, /approvedAt: automaticDecision \? recordedAt : ""/);
  assert.match(route, /serviceCodes: JSON\.stringify\(automaticDecision \? automaticDecision\.serviceCodes : \[\]\)/);
  assert.match(route, /jurisdiction: automaticDecision \? automaticDecision\.jurisdiction : jurisdiction/);
  assert.match(route, /scheduledFor: automaticDecision \? automaticDecision\.scheduledFor : scheduledFor/);
  assert.match(route, /policyVersion: POLICY_VERSION/);
  assert.match(route, /automaticDecision\.matchingProviders\.map/);
  assert.match(route, /routingActivationDecisionIds: automaticDecision\.activationDecisionIds/);
  assert.match(route, /automaticDecision\.launchReadinessDecisionIds/);
  assert.match(route, /automaticDecision\.launchReadinessCheckedAt/);
  assert.match(route, /sendMarketplaceUpdateEmail/);
  assert.doesNotMatch(route, /sendNewCustomerRequestAlert/);
  assert.doesNotMatch(route, /body\.testOnly|searchParams\.get\("testOnly"\)/);
});

test("owner review cannot manually turn a real request into an approved job", async () => {
  const route = await source("app/api/admin/requests/route.ts");

  assert.match(route, /body\.status === "approved" && job\.isTestJob !== "yes"/);
  assert.match(route, /REAL_REQUESTS_AUTO_DECIDED/);
  assert.match(route, /Owner approval cannot substitute/);
  assert.match(route, /testOnly: job\.isTestJob === "yes"/);
  assert.match(route, /body\.status === "declined"/);
  assert.match(route, /\["new", "approved"\]/);
  assert.doesNotMatch(route, /body\.testOnly|searchParams\.get\("testOnly"\)/);
});
