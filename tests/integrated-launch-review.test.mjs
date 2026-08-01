import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("integrated launch review records evidence but cannot enable the marketplace", async () => {
  const [route, catalog, page, platformActivation] = await Promise.all([
    read("../app/api/admin/launch-readiness/route.ts"),
    read("../lib/launch-readiness.ts"),
    read("../app/admin/launch-readiness/page.tsx"),
    read("../lib/platform-service-activation.ts"),
  ]);
  const get = route.slice(
    route.indexOf("export async function GET"),
    route.indexOf("export async function POST"),
  );
  const post = route.slice(route.indexOf("export async function POST"));

  assert.match(route, /await verifyOwnerRequest\(request\)/);
  assert.match(post, /isSameOriginRequest\(request\)/);
  assert.match(post, /db\.insert\(launchGateDecisions\)/);
  assert.doesNotMatch(post, /serviceActivationDecisions\)\.values|providerServiceEligibility\)\.values/);
  assert.doesNotMatch(post, /STRIPE_ALLOW_LIVE_MODE\s*=|CUSTOMER_JOB_POSTING_PAUSED\s*=/);
  assert.match(route, /stripeLiveModeEnabled\(\)/);
  assert.match(route, /automaticEnablement: false/);
  assert.doesNotMatch(get, /expireOpenCheckoutSessionsForLaunchShutdown/);
  assert.doesNotMatch(post, /runtimeRealMarketplaceReleaseDecision\(\)/);
  assert.match(post, /expireOpenCheckoutSessionsForLaunchShutdown\(\)/);
  assert.match(post, /checkoutShutdownCleanup/);
  assert.match(post, /cleanup_unavailable/);
  assert.ok(
    post.lastIndexOf("db.insert(launchGateDecisions)")
      < post.indexOf("expireOpenCheckoutSessionsForLaunchShutdown()"),
  );
  assert.match(route, /approvedAt > today/);
  assert.match(route, /Each required authority must have a distinct evidence reference/);
  assert.match(route, /stripeConfigured && stripeMode === "test"/);
  assert.match(route, /currentPlatformServiceActivations\(\)/);
  assert.match(route, /const activatedServiceCount = activeServiceActivations\.length/);
  assert.match(catalog, /Recording a decision here never/);
  assert.match(catalog, /authority_evidence_missing/);
  assert.match(catalog, /authority === "Official legal or licensing source"/);
  assert.match(catalog, /officialSourceReferenceIsAllowedForLaunchGate\([\s\S]*approval\.evidenceReference/);
  assert.match(catalog, /invalid_official_source/);
  assert.match(catalog, /acceptedOfficialSourceReferences/);
  assert.match(catalog, /requiresValidThrough: true/);
  assert.match(catalog, /provider_onboarding_legal_requirements/);
  assert.match(catalog, /provider_evidence_and_insurance_matrix/);
  assert.match(catalog, /privacy_retention_and_data_rights/);
  assert.match(catalog, /cpa_tax_mor_and_transaction_map/);
  assert.match(catalog, /employee_and_trainee_provider_of_record/);
  assert.match(platformActivation, /hasCompleteMandatoryLegalComplianceEvidence\(context, \{[\s\S]*serviceCode: activation\.serviceCode,[\s\S]*jurisdiction: activation\.jurisdiction/);
  assert.match(platformActivation, /hasCompleteMandatoryLegalComplianceEvidence\(context, \{[\s\S]*\}, validThrough\)/);
  assert.match(platformActivation, /activationInsurerEvidenceIsCurrent\(context, validThrough, now\)/);
  assert.match(platformActivation, /PLATFORM_SERVICE_ACTIVATION_RULES_VERSION = "0\.11\.0"/);
  assert.match(platformActivation, /activation\.rulesEngineVersion === PLATFORM_SERVICE_ACTIVATION_RULES_VERSION/);
  assert.match(page, /Nothing was automatically enabled/);
});

test("proceeding without counsel is a versioned owner choice, never legal approval or a launch-gate substitute", async () => {
  const [route, catalog, page] = await Promise.all([
    read("../app/api/admin/launch-readiness/route.ts"),
    read("../lib/launch-readiness.ts"),
    read("../app/admin/launch-readiness/page.tsx"),
  ]);
  const post = route.slice(route.indexOf("export async function POST"));
  const catalogBlock = catalog.slice(
    catalog.indexOf("export const LAUNCH_GATE_CATALOG"),
    catalog.indexOf("export type StoredLaunchGateDecision"),
  );

  assert.doesNotMatch(catalogBlock, /Maryland counsel|counsel_provider|counsel_customer/);
  assert.doesNotMatch(catalogBlock, /owner_legal_review_choice/);
  assert.match(catalogBlock, /Official legal or licensing source/);
  assert.match(catalogBlock, /Insurance broker or carrier/);
  assert.match(catalogBlock, /CPA or tax adviser/);
  assert.match(catalogBlock, /Payment processor/);
  assert.match(catalogBlock, /Security or privacy reviewer/);
  assert.match(catalogBlock, /Identity or business verification provider/);
  assert.match(catalogBlock, /employee_and_trainee_provider_of_record/);

  assert.match(catalog, /tuveloz_owner_legal_review_choice_v1/);
  assert.match(catalog, /decision: "proceeding_without_counsel"/);
  assert.match(catalog, /acknowledgedNoLegalApproval: true/);
  assert.match(catalog, /acknowledgedMandatoryRequirementsRemain: true/);
  assert.match(catalog, /does not remove or satisfy any applicable legal, licensing, insurance, tax, payment, privacy, security, identity-verification, service-matrix, or provider-of-record requirement/);
  assert.match(post, /gateKey === OWNER_LEGAL_REVIEW_CHOICE_GATE_KEY/);
  assert.ok(
    post.indexOf("gateKey === OWNER_LEGAL_REVIEW_CHOICE_GATE_KEY")
      < post.indexOf("const gate = launchGateByKey"),
  );
  assert.match(post, /status: "recorded"/);
  assert.match(post, /required: "no"/);
  assert.match(post, /approvedBy: ""/);
  assert.match(post, /approvedAt: ""/);
  assert.match(post, /decidedAt: now/);
  assert.match(post, /decidedBy: verification\.email/);
  assert.match(post, /encodeOwnerLegalReviewChoice\(choice\)/);
  assert.match(route, /Choosing to proceed without counsel does not satisfy this check/);
  assert.match(route, /officialSourceReferenceIsAllowedForLaunchGate\([\s\S]*approval\.evidenceReference/);
  assert.match(route, /An unrelated \.gov page, general search result, private memo, or owner choice cannot satisfy the gate/);
  assert.match(route, /Official-law reviews must be rechecked at least annually/);

  assert.match(page, /Hiring counsel is an optional owner decision/);
  assert.match(page, /I understand this owner choice is not legal approval/);
  assert.match(page, /name="acknowledgedNoLegalApproval"/);
  assert.match(page, /name="acknowledgedMandatoryRequirementsRemain"/);
  assert.doesNotMatch(page, /defaultChecked/);
  assert.match(page, /It did not approve or satisfy any mandatory launch gate/);
});

test("owner compliance operations are record-only and fail closed", async () => {
  const [route, page] = await Promise.all([
    read("../app/api/admin/compliance-operations/route.ts"),
    read("../app/admin/compliance-operations/page.tsx"),
  ]);
  const post = route.slice(route.indexOf("export async function POST"));

  assert.match(route, /verifyOwnerRequest/);
  assert.match(post, /verifiedOwner\(request\)/);
  assert.match(post, /isSameOriginRequest/);
  assert.match(post, /eligibilityAutomaticallyChanged: false/);
  assert.match(post, /automatedDeletionPerformed: false/);
  assert.match(post, /automatedDeliveryPerformed: false/);
  assert.match(route, /where\(inArray\(providerAppeals\.status/);
  assert.match(route, /where\(inArray\(dataRightsRequests\.status/);
  assert.match(route, /where\(eq\(complianceReminders\.status, "scheduled"\)\)/);
  assert.match(route, /queueSummary/);
  assert.match(route, /totalOpen: appealCount/);
  assert.match(route, /totalOpen: rightsCount/);
  assert.match(route, /totalOpen: reminderCount/);
  assert.match(route, /hasMore:/);
  assert.match(post, /\.\.\.metadataRecord\(item\.metadata\)/);
  assert.match(post, /deliveryResult:/);
  assert.match(page, /Counts cover every open record/);
  assert.match(page, /additional records remain in the queue/);
  assert.match(post, /cannot be fulfilled or closed until identity is recorded as verified/);
  assert.match(post, /item\.requestType === "deletion"/);
  assert.match(post, /A deletion request cannot be fulfilled or closed until deletion completion and its reference are recorded/);
  assert.match(post, /Deletion completion can be recorded only for a deletion request/);
  assert.match(post, /item\.legalHold === "yes"/);
  assert.match(post, /already final/);
  assert.doesNotMatch(post, /deleteProviderEvidence|\.delete\(|getStripeClient|stripe\./);
  assert.doesNotMatch(post, /db\.delete/);
  assert.match(page, /This queue never accepts provider/);
  assert.match(page, /this form does not perform the deletion/i);
});

test("private evidence requires an authenticated clean latest scan in every authorization layer", async () => {
  const [adminRoute, providerRoute, scannerRoute, engine, page] = await Promise.all([
    read("../app/api/admin/provider-compliance/route.ts"),
    read("../app/api/provider-evidence/route.ts"),
    read("../app/api/internal/evidence-scan-result/route.ts"),
    read("../lib/provider-eligibility-engine.ts"),
    read("../app/admin/provider-compliance/page.tsx"),
  ]);

  assert.match(adminRoute, /scans\[0\]\?\.status !== "clean"/);
  assert.match(adminRoute, /record-evidence-scan/);
  assert.match(adminRoute, /An owner visual review is not a malware scan/);
  assert.match(adminRoute, /Owner-entered clean results are prohibited/);
  assert.match(scannerRoute, /EVIDENCE_SCAN_WEBHOOK_SECRET/);
  assert.match(scannerRoute, /x-tuveloz-scan-signature/);
  assert.match(scannerRoute, /constantTimeEqual/);
  assert.match(scannerRoute, /scanRequestId/);
  assert.match(scannerRoute, /eq\(evidenceFileScans\.status, "pending"\)/);
  assert.match(scannerRoute, /status: "result_received"/);
  assert.match(scannerRoute, /evidence\.documentHash\.toLowerCase\(\) !== fileHash/);
  assert.match(scannerRoute, /evidenceAutomaticallyAccepted: false/);
  assert.match(providerRoute, /blocked_until_clean_scan/);
  assert.match(engine, /evidence_malware_scan_not_clean/);
  assert.match(engine, /latestScanByEvidence\.get\(item\.id\)\?\.status === "clean"/);
  assert.match(page, /Looking at the file yourself is not a malware scan/);
  assert.doesNotMatch(page, /<option value="clean">/);
});
