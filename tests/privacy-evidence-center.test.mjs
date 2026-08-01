import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("privacy center stores signed-in choices and a durable request history", async () => {
  const [migration, api, page] = await Promise.all([
    source("drizzle/0034_privacy_center.sql"),
    source("app/api/privacy-center/route.ts"),
    source("app/privacy-center/page.tsx"),
  ]);

  assert.match(migration, /CREATE TABLE `account_communication_preferences`/);
  assert.match(migration, /CREATE TABLE `privacy_requests`/);
  assert.match(migration, /privacy_requests_one_active_type_unique/);
  assert.match(api, /getPrivacyAccountSession/);
  assert.match(api, /isSameOriginRequest/);
  assert.match(api, /essentialTransactionalEmail: true/);
  assert.match(api, /securityEmail: true/);
  assert.match(api, /account-closure request does not instantly erase/);
  assert.match(api, /OWNER_EMAIL/);
  assert.match(page, /Download my data/);
  assert.match(page, /Essential messages stay on/);
  assert.match(page, /Closure is reviewed before deletion/);
  assert.match(page, /Appeal an earlier privacy decision/);
});

test("account export excludes authentication secrets and limits third-party disclosure", async () => {
  const exportApi = await source("app/api/privacy-center/export/route.ts");

  assert.match(exportApi, /content-disposition/);
  assert.match(exportApi, /cache-control": "private, no-store"/);
  assert.match(exportApi, /Password hashes, password salts, verification codes/);
  assert.match(exportApi, /Internal security signals/);
  assert.match(exportApi, /Private image file bytes/);
  assert.doesNotMatch(exportApi, /password_hash AS/);
  assert.doesNotMatch(exportApi, /password_salt AS/);
  assert.doesNotMatch(exportApi, /token_hash AS/);
  assert.doesNotMatch(exportApi, /access_token AS/);
  assert.doesNotMatch(exportApi, /payment_intent_id AS/);
  assert.doesNotMatch(exportApi, /provider_email AS providerEmail/);
  assert.doesNotMatch(exportApi, /customer_email AS customerEmail/);
  for (const providerRecord of [
    "providerPathwayHistory",
    "providerPersonnelRecords",
    "providerIdentityVerificationHistory",
    "providerAgreementAcceptanceHistory",
    "providerEvidenceMetadata",
    "providerEvidenceScanHistory",
    "exactServiceEligibilityHistory",
    "providerAppeals",
    "providerAuditHistory",
    "providerDataRightsRequests",
  ]) {
    assert.ok(exportApi.includes(providerRecord), `provider export omits ${providerRecord}`);
  }
  assert.doesNotMatch(exportApi, /storage_key AS/);
  assert.doesNotMatch(exportApi, /document_hash AS/);
  assert.doesNotMatch(exportApi, /identity_verification_reference AS/);
  assert.doesNotMatch(exportApi, /account_session_hash AS/);
});

test("private job evidence is append-only, participant-only, and separate from payment authorization", async () => {
  const [migration, api, imageApi, page, helper] = await Promise.all([
    source("drizzle/0035_private_job_evidence.sql"),
    source("app/api/job-evidence/route.ts"),
    source("app/api/job-evidence/image/route.ts"),
    source("app/job-evidence/page.tsx"),
    source("lib/job-evidence-images.ts"),
  ]);

  assert.match(migration, /CREATE TABLE `job_evidence_items`/);
  assert.match(migration, /CHECK \(trim\(`image_key`\) <> '' OR trim\(`note`\) <> ''\)/);
  assert.match(api, /Only the customer and selected provider can add records/);
  assert.match(api, /accepted/);
  assert.match(api, /immutable marketplace record/);
  assert.match(api, /does not authorize additional work or charges/);
  assert.match(api, /MAX_EVIDENCE_ITEMS_PER_JOB/);
  assert.doesNotMatch(api, /stripePayments/);
  assert.doesNotMatch(api, /payment_intent/);
  assert.doesNotMatch(api, /export async function DELETE/);
  assert.match(imageApi, /This private image does not belong to your account/);
  assert.match(imageApi, /cache-control": "private, no-store"/);
  assert.match(helper, /jobs\/\$\{requestId\}\/evidence/);
  assert.match(page, /Add, do not overwrite/);
  assert.match(page, /does not approve extra work/);
  assert.match(page, /Avoid photographing unrelated personal belongings/);
});

test("owner privacy review records explanations and supports appeals", async () => {
  const [api, page] = await Promise.all([
    source("app/api/admin/privacy-requests/route.ts"),
    source("app/admin/privacy/page.tsx"),
  ]);

  assert.match(api, /isVerifiedOwnerRequest/);
  assert.match(api, /Record a clear customer-facing explanation/);
  assert.match(api, /You may submit an appeal/);
  assert.match(api, /notifyMarketplaceAccount/);
  assert.match(api, /sendMarketplaceUpdateEmail/);
  assert.match(page, /Verified privacy requests/);
  assert.match(page, /does not automatically erase/);
  assert.match(page, /Customer-facing explanation/);
});

test("new private routes are discoverable and protected from shared caching", async () => {
  const [worker, privacyPolicy, standards] = await Promise.all([
    source("worker/index.ts"),
    source("app/privacy/page.tsx"),
    source("app/service-standards/page.tsx"),
  ]);

  assert.match(worker, /"\/job-evidence"/);
  assert.match(worker, /"\/privacy-center"/);
  assert.match(privacyPolicy, /href="\/privacy-center"/);
  assert.match(privacyPolicy, /download an[\s\S]*account-data copy/);
  assert.match(standards, /Open private job records/);
  assert.match(standards, /Privacy and data choices/);
});
