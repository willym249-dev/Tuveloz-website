import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("a scheduled worker delivers provider compliance reminders with claims and retries", async () => {
  const [worker, delivery, config] = await Promise.all([
    source("worker/index.ts"),
    source("lib/compliance-reminder-delivery.ts"),
    source("wrangler.jsonc"),
  ]);

  assert.match(worker, /async scheduled\(/);
  assert.match(worker, /processDueComplianceReminders\(\)/);
  assert.match(worker, /flushPendingEmailNotifications\(20\)/);
  assert.match(config, /"crons"\s*:\s*\[/);
  assert.match(config, /"\*\/15 \* \* \* \*"/);

  assert.match(delivery, /status: "processing"/);
  assert.match(delivery, /eq\(complianceReminders\.updatedAt, item\.updatedAt\)/);
  assert.match(delivery, /STALE_CLAIM_MS/);
  assert.match(delivery, /MAX_DELIVERY_ATTEMPTS/);
  assert.match(delivery, /emailNotificationOutbox/);
  assert.match(delivery, /evidence\.status !== "accepted"/);
  assert.match(delivery, /cancelled_evidence_not_currently_accepted/);
  assert.match(delivery, /Affected services remain or become blocked/);
  assert.match(delivery, /compliance_reminder_failed/);
});
