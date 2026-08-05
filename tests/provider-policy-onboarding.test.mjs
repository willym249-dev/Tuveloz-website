import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("provider policy v0.11 is exact-code and default deny", async () => {
  const matrix = JSON.parse(await read("../config/provider-eligibility-matrix.json"));
  const services = Object.entries(matrix.services);
  assert.equal(matrix.schema_version, "0.11");
  assert.equal(matrix.status, "draft_pending_mandatory_compliance_insurance_tax");
  assert.equal(matrix.default_policy, "deny");
  assert.equal(matrix.jurisdiction, "US-MD-MontgomeryCounty");
  assert.equal(services.length, 25);
  assert.equal(matrix.services.general_auto_repair.launch_state, "prohibited_broad_category");
  assert.equal(matrix.services.general_auto_repair.customer_visible, false);
  assert.equal(
    services.filter(([, service]) => service.launch_state === "enabled").length,
    0,
  );
  assert.doesNotMatch(JSON.stringify(matrix), /counsel/i);
  assert.deepEqual(Object.keys(matrix.provider_pathways).sort(), [
    "independent_startup",
    "provider_business_employee",
    "sponsored_trainee_employee",
  ]);
});

test("provider applications create pathways, people, and immutable agreement evidence", async () => {
  const route = await read("../app/api/providers/route.ts");
  const verification = await read("../lib/provider-application-verification.ts");
  const acceptance = await read("../lib/provider-policy-acceptance.ts");
  assert.ok(verification.includes('serviceCodes.includes("general_auto_repair")'));
  assert.ok(verification.includes("serviceLevelsForApplication"));
  assert.ok(route.includes("providerPathwayProfiles"));
  assert.ok(route.includes("providerPersonnel"));
  assert.ok(route.includes("agreementAcceptances"));
  assert.ok(route.includes("agreementHash: documentBinding.finalAgreementHash"));
  assert.ok(verification.includes("finalAgreementHash: await sha256Text(agreementText)"));
  assert.ok(route.includes("providerApplicationSubmissionEvidence"));
  assert.ok(route.includes("acceptanceEvidenceId: verified.challenge.id"));
  assert.ok(verification.includes("privacyAcknowledged"));
  assert.ok(route.includes("sponsor_or_employer_confirmation_required"));
  assert.ok(acceptance.includes("PROVIDER_TERMS_ACCEPTANCE_TEXT"));
  assert.ok(acceptance.includes("PROVIDER_PRIVACY_ACKNOWLEDGMENT_TEXT"));
  assert.ok(acceptance.includes('href: "/payments"'));
  assert.ok(acceptance.includes('href: "/marketplace-conduct"'));
  assert.ok(acceptance.includes('href: "/provisional-provider-policy"'));
});

test("draft policy acknowledgments are bound for review but fail closed for job eligibility", async () => {
  const acceptance = await read("../lib/provider-policy-acceptance.ts");
  const releaseManifest = JSON.parse(await read("../config/policy-releases.json"));
  const onboarding = await read("../app/api/provider-onboarding/route.ts");
  const onboardingPage = await read("../app/provider-onboarding/page.tsx");
  const eligibility = await read("../lib/provider-eligibility-engine.ts");

  assert.ok(acceptance.includes('PROVIDER_ACCEPTANCE_EVIDENCE_SCHEMA_VERSION = "2"'));
  assert.ok(acceptance.includes('"application_review_only"'));
  assert.ok(acceptance.includes('"provider_eligibility"'));
  assert.match(acceptance, /policyDocumentRelease\("provider_agreement"\)/);
  assert.ok(Object.entries(releaseManifest).every(([key, release]) => (
    ["terms", "provider_agreement", "customer_agreement", "payment_policy", "provisional_provider_policy", "marketplace_conduct", "privacy"].includes(key)
      ? release.releaseStatus === "active"
        && release.effectiveAt !== ""
        && release.releaseId !== ""
        && /^[a-f0-9]{64}$/i.test(release.canonicalBodyHash)
      : release.releaseStatus === "draft"
        && release.effectiveAt === ""
        && release.releaseId === ""
        && release.canonicalBodyHash === ""
  )));
  assert.match(acceptance, /SHA256_HEX\.test\(document\.canonicalBodyHash\)/);
  assert.match(acceptance, /document\.releaseStatus === "active"/);
  assert.match(acceptance, /effectiveAt <= asOf\.getTime\(\)/);
  assert.match(acceptance, /acceptancePurpose === "application_review_only"[\s\S]*crypto\.randomUUID\(\)/);
  assert.ok(acceptance.includes("canonicalBodyHash: document.canonicalBodyHash"));
  assert.ok(acceptance.includes("releaseId: document.releaseId"));

  assert.match(onboarding, /purpose: "provider_eligibility"/);
  assert.ok(onboarding.includes("acceptanceEvidenceId: acceptanceSessionId"));
  assert.ok(onboarding.includes("current: eligibilityCurrent"));
  assert.ok(onboarding.includes("allAgreementsAcknowledgedForApplicationReview"));
  assert.ok(onboarding.includes("allAgreementsEligibilityCurrent"));
  assert.ok(onboarding.includes("acceptance.agreementHash === expectedEligibilityHash"));
  assert.ok(onboarding.includes("They cannot qualify a provider for jobs."));

  // The eligibility engine asks for the default provider-eligibility envelope.
  // While documents are drafts, every stored acknowledgment has its own review
  // evidence ID, so this later exact-text comparison cannot match it.
  assert.match(eligibility, /providerAgreementEvidenceText\(requiredDocument\)/);
  assert.match(eligibility, /item\.agreementText === expectedText/);
  assert.match(eligibility, /const expectedHash = expectedText \? await sha256Text\(expectedText\) : ""/);
  assert.match(eligibility, /item\.agreementHash === expectedHash/);
  assert.match(onboardingPage, /allAgreementsAcknowledgedForApplicationReview/);
  assert.match(onboardingPage, /Acknowledging a draft lets TUVELOZ review the application/);
  assert.match(onboardingPage, /Not current for job eligibility/);
  assert.doesNotMatch(onboardingPage, /!data\.allAgreementsCurrent && \(\s*<form onSubmit=\{acceptAgreements\}/);
});

test("public onboarding and agreements clearly deny TUVELOZ employment or training", async () => {
  const homepage = await read("../app/page.tsx");
  const signupForm = await read("../app/components/provider-signup-form.tsx");
  const terms = await read("../app/terms/page.tsx");
  const providerAgreement = await read("../app/provider-agreement/page.tsx");
  const faq = await read("../app/faq/page.tsx");
  assert.ok(homepage.includes("Tuveloz doesn&apos;t employ, train, or assign work to providers"));
  assert.match(signupForm, /provider business—not Tuveloz—is responsible for lawful\s+employment classification/);
  assert.ok(terms.includes("doesn&apos;t hire, employ, train, sponsor, assign"));
  assert.ok(providerAgreement.includes("doesn&apos;t promise you any customer work"));
  assert.ok(faq.includes("Applicant-only accounts receive no training or jobs."));
  assert.ok(!homepage.includes("Training and application review only"));
});

test("private evidence stays scoped and work authorization documents are rejected", async () => {
  const evidenceRoute = await read("../app/api/provider-evidence/route.ts");
  const storage = await read("../lib/provider-evidence.ts");
  assert.ok(evidenceRoute.includes("STRUCTURED_ONLY_REQUIREMENTS"));
  assert.ok(evidenceRoute.includes("Do not upload work-authorization documents, SSNs, or I-9 records"));
  assert.ok(evidenceRoute.includes("getEvidenceRequirements(serviceCodeValue, profile.relationshipPath)"));
  assert.ok(evidenceRoute.includes("const documentHash = await sha256Buffer(document.bytes)"));
  assert.ok(evidenceRoute.includes("documentHash,"));
  assert.ok(evidenceRoute.includes('status: "pending"'));
  assert.ok(evidenceRoute.includes('"cache-control": "private, no-store, max-age=0"'));
  assert.ok(storage.includes('access: "private"'));
  assert.ok(storage.includes("MAX_EVIDENCE_BYTES = 10 * 1024 * 1024"));
});

test("every operational stage uses the central eligibility model and no real provider fails open", async () => {
  const engine = await read("../lib/provider-eligibility-engine.ts");
  const policy = await read("../lib/provider-policy.ts");
  const matching = await read("../lib/service-matching.ts");
  for (const stage of [
    "discovery",
    "quote",
    "booking",
    "job_start",
    "scope_change",
    "completion",
    "payout",
  ]) {
    assert.ok(engine.includes(`"${stage}"`));
  }
  assert.match(engine, /hasCompleteMandatoryLegalComplianceEvidence\(context, \{[\s\S]*serviceCode,[\s\S]*jurisdiction/);
  assert.match(engine, /await runtimeRealMarketplaceReleaseDecision\(\)/);
  assert.match(engine, /marketplaceActionAllowed\(stageToMarketplaceAction\(input\.stage\), \{[\s\S]*runtimeReleaseApproved/);
  assert.match(engine, /input\.testOnly === true[\s\S]*\? null[\s\S]*: await runtimeRealMarketplaceReleaseDecision/);
  assert.match(engine, /launchReadinessDecisionIds/);
  assert.match(engine, /launchReadinessCheckedAt/);
  assert.ok(engine.includes("completeInsurerApproval(context, activationThrough)"));
  assert.ok(!engine.includes('completeWrittenApproval(context, "counsel")'));
  assert.ok(engine.includes("required_evidence_missing_or_expired"));
  assert.ok(engine.includes("evidence_authenticity_not_current"));
  assert.ok(engine.includes("performer_external_identity_age_verification_not_current"));
  assert.match(engine, /!options\.testOnly[\s\S]*externalIdentityAgeVerificationIsCurrent\(person, options\.through\)/);
  assert.match(engine, /options\.testOnly[\s\S]*\|\| evidenceAuthenticityIsCurrent\(item, options\.through\)/);
  assert.ok(engine.includes("service_not_enabled_by_policy_catalog"));
  assert.ok(engine.includes("customer_assignment_acceptance_required"));
  assert.ok(engine.includes("supervision_checkpoint_missing"));
  assert.ok(engine.includes("sponsoring_provider_not_eligible_for_exact_service"));
  assert.ok(engine.includes("provider_of_record_assignment_not_implemented"));
  assert.ok(engine.includes("owner_operator_registration_binding_missing"));
  assert.ok(policy.includes("RELATIONSHIP_EVIDENCE_REQUIREMENTS"));
  assert.match(policy, /independent_startup: Object\.freeze\(\[\s*"no_employee_attestation"/);
  assert.match(policy, /provider_business_employee: Object\.freeze\(\[\s*"workers_comp_coverage"/);
  assert.ok(matching.includes("An empty approved list must stay empty"));
  assert.ok(!matching.includes("return approvedServices.trim() || requestedServices"));
});

test("policy migration adds only the new provider-control layer", async () => {
  const migration = await read("../drizzle/0037_provider_policy_controls.sql");
  for (const table of [
    "agreement_acceptances",
    "provider_pathway_profiles",
    "provider_personnel",
    "provider_evidence_submissions",
    "provider_service_eligibility",
    "service_activation_decisions",
    "job_authorization_snapshots",
    "provider_audit_events",
  ]) {
    assert.ok(migration.includes(`CREATE TABLE \`${table}\``));
  }
  assert.ok(!migration.includes("CREATE TABLE `email_notification_outbox`"));
  assert.ok(!migration.includes("CREATE TABLE `provider_credential_verifications`"));
  assert.ok(!migration.includes("CREATE TABLE `stripe_customers`"));
  assert.ok(!migration.includes("ADD `remember_email_consent`"));
});
