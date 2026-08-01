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
  assert.match(notifications, /affected service remains blocked/);
  assert.match(notifications, /lawful retention or legal-hold limits/);
  assert.match(notifications, /\/admin\/provider-compliance/);
  assert.match(notifications, /\/provider-onboarding/);
});

test("application, evidence, appeal, privacy, and review routes call the safe notifier", async () => {
  const [applications, evidence, onboarding, admin] = await Promise.all([
    source("app/api/providers/route.ts"),
    source("app/api/provider-evidence/route.ts"),
    source("app/api/provider-onboarding/route.ts"),
    source("app/api/admin/provider-compliance/route.ts"),
  ]);

  assert.match(applications, /notifyProviderApplicationReceived/);
  assert.match(evidence, /notifyProviderEvidenceReceived/);
  assert.match(onboarding, /notifyProviderAppealReceived/);
  assert.match(onboarding, /notifyProviderPrivacyRequestReceived/);
  assert.match(admin, /notifyProviderEvidenceDecision/);
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
