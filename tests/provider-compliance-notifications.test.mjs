import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("provider onboarding events create protected, privacy-limited notifications", async () => {
  const notifications = await source("lib/provider-compliance-notifications.ts");

  assert.match(notifications, /Promise\.allSettled/);
  assert.match(notifications, /applicant and evidence details are not included/);
  assert.match(notifications, /Applying does not activate services or create employment/);
  assert.match(notifications, /private quarantine/);
  assert.match(notifications, /external security scan did not clear/);
  assert.match(notifications, /affected service remains blocked/);
  assert.match(notifications, /lawful retention or legal-hold limits/);
  assert.match(notifications, /\/admin\/provider-compliance/);
  assert.match(notifications, /\/provider-onboarding/);
});

test("application, evidence, appeal, privacy, and review routes call the safe notifier", async () => {
  const [applications, evidence, onboarding, admin, scanner] = await Promise.all([
    source("app/api/providers/route.ts"),
    source("app/api/provider-evidence/route.ts"),
    source("app/api/provider-onboarding/route.ts"),
    source("app/api/admin/provider-compliance/route.ts"),
    source("app/api/internal/evidence-scan-result/route.ts"),
  ]);

  assert.match(applications, /notifyProviderApplicationReceived/);
  assert.match(evidence, /notifyProviderEvidenceReceived/);
  assert.match(onboarding, /notifyProviderAppealReceived/);
  assert.match(onboarding, /notifyProviderPrivacyRequestReceived/);
  assert.match(admin, /notifyProviderEvidenceDecision/);
  assert.match(scanner, /notifyProviderEvidenceScanBlocked/);
});

test("each controlled evidence review outcome notifies the provider after recalculation", async () => {
  const admin = await source("app/api/admin/provider-compliance/route.ts");
  const start = admin.indexOf('if (action === "review-evidence")');
  const end = admin.indexOf('if (action === "identity-age-review")', start);
  assert.ok(start >= 0 && end > start, "review-evidence branch not found");
  const branch = admin.slice(start, end);

  for (const status of ["accepted", "rejected", "needs_correction"]) {
    assert.ok(admin.includes(`"${status}"`), `missing controlled review status ${status}`);
  }
  assert.match(branch, /const \[evidenceProvider, evidenceProfiles\] = await Promise\.all/);
  assert.match(branch, /const recalculatedProvider = await recalculateProvider[\s\S]*notifyProviderEvidenceDecision\(\{[\s\S]*email: evidenceProvider\[0\]\.email,[\s\S]*status,/);
});

test("non-clean scan branches use a preloaded provider record and cannot hit the old undefined notification variables", async () => {
  const [admin, scanner, notifications] = await Promise.all([
    source("app/api/admin/provider-compliance/route.ts"),
    source("app/api/internal/evidence-scan-result/route.ts"),
    source("lib/provider-compliance-notifications.ts"),
  ]);
  const manualStart = admin.indexOf('if (action === "record-evidence-scan")');
  const manualEnd = admin.indexOf('if (action === "review-evidence")', manualStart);
  assert.ok(manualStart >= 0 && manualEnd > manualStart, "record-evidence-scan branch not found");
  const manualBranch = admin.slice(manualStart, manualEnd);

  assert.match(manualBranch, /const \[scanProviderRecord\] = await db\.select/);
  assert.match(manualBranch, /notifyProviderEvidenceScanBlocked\(\{[\s\S]*email: scanProviderRecord\.email,[\s\S]*scanStatus,/);
  assert.doesNotMatch(manualBranch, /evidenceProvider\[0\]/);
  assert.doesNotMatch(manualBranch, /notifyProviderEvidenceDecision/);

  const providerLookup = scanner.indexOf("const [evidenceProvider] = await db.select");
  const claim = scanner.indexOf("const claimed = await db.update");
  const notification = scanner.lastIndexOf("await notifyProviderEvidenceScanBlocked");
  assert.ok(providerLookup >= 0 && providerLookup < claim, "provider recipient must be loaded before scan state is committed");
  assert.ok(notification > claim, "non-clean scan notification must run after the state change");
  assert.match(notifications, /Promise\.allSettled/);
});

test("scan-block notifications persist durable account and email intents before best-effort delivery", async () => {
  const notifications = await source("lib/provider-compliance-notifications.ts");
  const start = notifications.indexOf("export async function notifyProviderEvidenceScanBlocked");
  const end = notifications.indexOf("export async function notifyProviderAppealReceived", start);
  assert.ok(start >= 0 && end > start, "scan-block notifier not found");
  const branch = notifications.slice(start, end);

  const durableBatch = branch.indexOf("await env.DB.batch");
  const delivery = branch.indexOf("await sendMarketplaceUpdateEmail");
  assert.ok(durableBatch >= 0 && delivery > durableBatch, "durable intents must exist before delivery is attempted");
  assert.match(branch, /INSERT OR IGNORE INTO account_notifications/);
  assert.match(branch, /INSERT OR IGNORE INTO email_notification_outbox/);
  assert.match(branch, /notificationId/);
  assert.doesNotMatch(branch, /safelyNotify/);
});

test("authenticated scanner replay re-ensures a non-clean notification idempotently", async () => {
  const scanner = await source("app/api/internal/evidence-scan-result/route.ts");
  const existingStart = scanner.indexOf("if (existingResult)");
  const existingEnd = scanner.indexOf("const [evidence]", existingStart);
  assert.ok(existingStart >= 0 && existingEnd > existingStart, "existing-result replay branch not found");
  const replayBranch = scanner.slice(existingStart, existingEnd);

  const notification = replayBranch.indexOf("await notifyProviderEvidenceScanBlocked");
  const alreadyRecorded = replayBranch.indexOf("alreadyRecorded: true");
  const evidenceBlock = replayBranch.indexOf('status: "needs_correction"');
  const serviceBlock = replayBranch.indexOf('eligibilityState: "blocked"');
  assert.ok(evidenceBlock >= 0 && serviceBlock > evidenceBlock, "replay must reassert evidence and service blocks");
  assert.ok(notification > serviceBlock, "replay must finish fail-closed mutations before ensuring the notice");
  assert.ok(notification >= 0 && alreadyRecorded > notification, "replay must ensure the notice before acknowledging the result");
  assert.match(replayBranch, /existingResult\.status !== "clean"/);
  assert.match(replayBranch, /notificationId: existingResult\.id/);
  assert.match(scanner, /notificationId: scanId/);
});

test("provider compliance notification event families remain deliverable while jobs are off", async () => {
  const policy = await source("lib/email-event-policy.ts");

  for (const prefix of [
    "marketplace:provider-onboarding:",
    "marketplace:provider-compliance:",
    "marketplace:provider-evidence:",
    "marketplace:privacy",
  ]) {
    assert.ok(policy.includes(`"${prefix}"`), `missing protective prefix ${prefix}`);
  }
});
