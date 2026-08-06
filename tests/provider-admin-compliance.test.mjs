import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("owner compliance writes require signed owner auth and same-origin requests", async () => {
  const route = await read("../app/api/admin/provider-compliance/route.ts");
  const post = route.slice(route.indexOf("export async function POST"));

  assert.match(post, /await verifyOwnerRequest\(request\)/);
  assert.match(post, /if \(!verification\.ok\)/);
  assert.match(post, /if \(!isSameOriginRequest\(request\)\)/);
  assert.match(post, /const actorId = verification\.email/);
});

test("owner queue metadata and private evidence responses do not expose storage secrets", async () => {
  const route = await read("../app/api/admin/provider-compliance/route.ts");
  const safeMetadata = route.slice(
    route.indexOf("function safeEvidence"),
    route.indexOf("function evidenceMatches"),
  );

  assert.doesNotMatch(safeMetadata, /storageKey:|documentHash|evidenceScope|sourceUrl/);
  assert.match(safeMetadata, /hasPrivateFile: Boolean\(row\.storageKey\)/);
  assert.match(route, /"cache-control": "private, no-store, max-age=0"/);
  assert.match(route, /"content-security-policy": "sandbox"/);
  assert.match(route, /"cross-origin-resource-policy": "same-origin"/);
  assert.match(route, /"x-content-type-options": "nosniff"/);
  assert.match(route, /"x-frame-options": "DENY"/);
  assert.match(route, /Cross-origin evidence downloads are not allowed/);
});

test("service activation binds official legal-compliance and insurer evidence to exact scope without mandatory counsel", async () => {
  const [route, legalEvidence, page] = await Promise.all([
    read("../app/api/admin/provider-compliance/route.ts"),
    read("../lib/legal-compliance-evidence.ts"),
    read("../app/admin/provider-compliance/page.tsx"),
  ]);
  const activation = route.slice(
    route.indexOf('if (action === "activate-service")'),
    route.indexOf('if (action === "disable-service")'),
  );

  assert.match(activation, /runtimeProviderActivationPrerequisitesDecision\(\)/);
  assert.match(activation, /if \(!releaseDecision\.approved\)/);
  assert.match(activation, /stable provider-onboarding, security, and policy-catalog prerequisites are current/);
  assert.ok(
    activation.lastIndexOf("runtimeProviderActivationPrerequisitesDecision")
      < activation.indexOf('decision: "enabled_live"'),
  );
  assert.match(activation, /launchReadinessDecisionIds: releaseDecision\.decisionIds/);
  assert.match(activation, /launchReadinessCheckedAt: releaseDecision\.checkedAt/);
  assert.match(activation, /serviceCode === "general_auto_repair"/);
  assert.match(activation, /servicePolicy\.launchState !== "enabled"/);
  assert.match(activation, /!servicePolicy\.customerVisible/);
  assert.match(activation, /jurisdiction !== POLICY_JURISDICTION/);
  assert.match(activation, /!currentThrough\(validThrough\)/);
  for (const field of [
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
    "insurerApprovedAt",
    "insurerValidThrough",
    "insurerApprovedBy",
    "insurerReference",
  ]) {
    assert.ok(activation.includes(field), `missing ${field}`);
  }
  assert.match(activation, /hasCompleteMandatoryLegalComplianceEvidence\(legalComplianceContext, \{[\s\S]*serviceCode,[\s\S]*jurisdiction,[\s\S]*\}, dateTime\(validThrough\)\)/);
  assert.match(activation, /annualVerificationWindowIsValid\([\s\S]*legalRequirementsReviewedAt,[\s\S]*legalRequirementsValidThrough/);
  assert.match(activation, /annualVerificationWindowIsValid\(insurerApprovedAt, insurerValidThrough\)/);
  assert.match(activation, /dateTime\(validThrough\) > dateTime\(legalRequirementsValidThrough\)/);
  assert.match(activation, /dateTime\(validThrough\) > dateTime\(insurerValidThrough\)/);
  assert.match(route, /hasCompleteMandatoryLegalComplianceEvidence\(context, \{[\s\S]*serviceCode: row\.serviceCode,[\s\S]*jurisdiction: row\.jurisdiction/);
  assert.match(route, /requiredOfficialLegalSourceReferences\([\s\S]*service\.code,[\s\S]*POLICY_JURISDICTION/);
  assert.match(legalEvidence, /professionalReviewStatus !== "not_obtained_owner_proceeding"[\s\S]*proceedingWithoutCounselAcknowledged/);
  assert.match(page, /Evidence jurisdiction\/location:[\s\S]*data\.policy\.jurisdiction/);
  assert.match(page, /cannot[\s\S]*be reused for another service or location/);
  assert.match(page, /Minimum required official source set/);
  assert.match(page, /Mandatory-requirements review valid through \(maximum one year\)/);
  assert.match(page, /Insurer or broker approval valid through \(maximum one year\)/);
  assert.match(legalEvidence, /not_obtained_owner_proceeding/);
  assert.match(legalEvidence, /obtained_optional/);
  assert.doesNotMatch(activation, /counselApprovedAt|counselApprovedBy|counselReference/);
  assert.match(activation, /body\.explicitConfirmation !== true/);
  assert.match(activation, /decision: "enabled_live"/);
  assert.match(activation, /policyVersion: POLICY_VERSION/);
  assert.match(activation, /supersedesDecisionId/);
});

test("legacy initialization creates only pending pathway/person records", async () => {
  const route = await read("../app/api/admin/provider-compliance/route.ts");
  const legacy = route.slice(
    route.indexOf('if (action === "initialize-provider-pathway")'),
    route.indexOf('if (action === "review-evidence")'),
  );

  assert.match(legacy, /status: "pending_review"/);
  assert.match(legacy, /status: "pending"/);
  assert.match(legacy, /approvedServices: ""/);
  assert.match(legacy, /verificationStatus: "in review"/);
  assert.doesNotMatch(legacy, /insert\(agreementAcceptances\)/);
  assert.doesNotMatch(legacy, /employerAttestedAt|workAuthorizationAttestedAt|lawfulPayAttestedAt/);
});

test("real identity and evidence approvals require current external verification", async () => {
  const [route, page, helper, engine, migration] = await Promise.all([
    read("../app/api/admin/provider-compliance/route.ts"),
    read("../app/admin/provider-compliance/page.tsx"),
    read("../lib/provider-verification-evidence.ts"),
    read("../lib/provider-eligibility-engine.ts"),
    read("../drizzle/0040_living_gressill.sql"),
  ]);

  assert.match(route, /EVIDENCE_AUTHENTICITY_METHODS\.includes/);
  assert.match(route, /evidenceAuthenticityIsCurrent\(authenticityRecord, new Date\(\)\)/);
  assert.match(route, /authenticityValidThrough[\s\S]*evidence\.expiresAt/);
  assert.match(route, /Evidence without its own expiration date requires an authenticity recheck within one year/);
  assert.match(route, /authenticityVerificationMethod: status === "accepted"[\s\S]*\? authenticityVerificationMethod[\s\S]*: ""/);
  assert.match(route, /externalIdentityAgeVerificationIsCurrent\([\s\S]*externalVerificationRecord/);
  assert.match(route, /TUVELOZ, the owner, or self-attestation cannot be the verification provider/);
  assert.match(helper, /official_online_lookup/);
  assert.match(helper, /officialSourceReferenceIsValid\(sourceUrl\)/);
  assert.match(helper, /providerNameIsProhibited\(normalized\)/);
  assert.match(helper, /approvedProviders\.includes\(normalized\)/);
  assert.match(helper, /IDENTITY_VERIFICATION_PROVIDERS/);
  assert.match(engine, /evidence_authenticity_not_current/);
  assert.match(engine, /externalIdentityAgeVerificationIsCurrent\(supervisor, options\.through\)/);
  assert.match(page, /External identity verification/);
  assert.match(page, /Do not enter an SSN, driver-license number/);
  assert.match(page, /Official online lookup/);
  assert.match(migration, /authenticity_verification_method/);
  assert.match(migration, /identity_verification_provider/);
});

test("relationship gates prevent blanket or borrowed-credential approval", async () => {
  const route = await read("../app/api/admin/provider-compliance/route.ts");
  const policy = await read("../lib/provider-policy.ts");

  assert.match(policy, /RELATIONSHIP_EVIDENCE_REQUIREMENTS/);
  assert.match(policy, /"no_employee_attestation"/);
  assert.match(policy, /"workers_comp_coverage"/);
  assert.match(policy, /"provider_personnel_roster"/);
  assert.match(policy, /"provider_employee_record"/);
  assert.match(route, /sponsoring_provider_not_eligible_for_exact_service/);
  assert.match(route, /provider_of_record_model_not_approved/);
  assert.match(route, /providerOfRecordGate\?\.approved/);
  assert.match(route, /employeeAttestationsComplete/);
  assert.match(route, /eligibleServices\.length > 0/);
  assert.match(route, /approvedServices: serializeProviderServices\(eligibleServices\)/);
  assert.doesNotMatch(route, /action === "approve-provider"|action === "verify-provider"/);
});
