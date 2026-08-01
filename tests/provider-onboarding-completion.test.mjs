import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("provider evidence is quarantined until the latest malware scan is clean", async () => {
  const route = await read("../app/api/provider-evidence/route.ts");

  assert.match(route, /insert\(evidenceFileScans\)/);
  assert.match(route, /status: "pending"/);
  assert.match(route, /scans\[0\]\?\.status !== "clean"/);
  assert.match(route, /status: 423/);
  assert.match(route, /blocked_until_clean_scan/);
  assert.match(route, /"cross-origin-resource-policy": "same-origin"/);
  assert.match(route, /"content-security-policy": "sandbox"/);
  assert.match(route, /downloadAllowed: scan\?\.status === "clean"/);
});

test("corrected evidence preserves history and cannot cross provider or service scope", async () => {
  const route = await read("../app/api/provider-evidence/route.ts");

  assert.match(route, /supersedesEvidenceId/);
  assert.match(route, /target\.providerId !== account\.provider\.id/);
  assert.match(route, /target\.personId !== profile\.providerPersonId/);
  assert.match(route, /target\.requirementKey !== requirementKey/);
  assert.match(route, /target\.serviceCode !== serviceCodeValue/);
  assert.match(route, /target\.jurisdiction !== POLICY_JURISDICTION/);
  assert.match(route, /Upload the new document as a replacement from the existing evidence record/);
  assert.match(route, /A replacement for this evidence is already under review/);
  assert.doesNotMatch(route, /update\(providerEvidenceSubmissions\).*supersedesEvidenceId/s);
});

test("expiration reminders are explicit records and never extend eligibility", async () => {
  const route = await read("../app/api/provider-evidence/route.ts");
  const page = await read("../app/provider-onboarding/page.tsx");

  for (const days of [60, 30, 14, 7, 1]) {
    assert.ok(route.includes(days.toString()));
  }
  assert.match(route, /insert\(complianceReminders\)/);
  assert.match(route, /status: "scheduled"/);
  assert.match(route, /provider-evidence-expiration:/);
  assert.match(page, /Renewal reminders do not extend eligibility/);
  assert.match(page, /Expiration and reminders/);
  assert.match(page, /reminderLabel/);
});

test("signed-in providers can submit scoped appeals without restoring access", async () => {
  const route = await read("../app/api/provider-onboarding/route.ts");
  const page = await read("../app/provider-onboarding/page.tsx");

  assert.match(route, /action === "submit-evidence-appeal"/);
  assert.match(route, /evidence\.providerId !== account\.provider\.id/);
  assert.match(route, /APPEALABLE_EVIDENCE_STATUSES/);
  assert.match(route, /An appeal for this evidence is already pending/);
  assert.match(route, /insert\(providerAppeals\)/);
  assert.match(route, /submitted_service_remains_blocked/);
  assert.match(page, /An appeal does not approve evidence or restore job access/);
  assert.match(page, /Corrections and appeals/);
});

test("provider privacy requests disclose retention limits and expose status", async () => {
  const route = await read("../app/api/provider-onboarding/route.ts");
  const page = await read("../app/provider-onboarding/page.tsx");

  assert.match(route, /action === "submit-data-rights-request"/);
  assert.match(route, /DATA_RIGHTS_REQUEST_TYPES/);
  assert.match(route, /OPEN_REQUEST_STATUSES[\s\S]*"identity_verification"[\s\S]*"in_review"/);
  assert.match(route, /provider_account_and_restricted_documents/);
  assert.match(route, /insert\(dataRightsRequests\)/);
  assert.match(route, /legalHold: "no"/);
  assert.match(page, /Privacy, retention, and deletion/);
  assert.match(page, /security, fraud prevention, legal obligations/);
  assert.match(page, /Submit privacy request/);
});

test("provider completion remains onboarding-only and creates no employment or training promise", async () => {
  const route = await read("../app/api/provider-onboarding/route.ts");
  const page = await read("../app/provider-onboarding/page.tsx");

  assert.match(route, /marketplaceMode: "onboarding_only"/);
  assert.match(route, /Real customer jobs, checkout, completion, and payout remain disabled/);
  assert.match(page, /TUVELOZ does not employ or train anybody/);
  assert.match(page, /does not create employment/);
  assert.match(page, /provides no training or\s+customer jobs/);
});
