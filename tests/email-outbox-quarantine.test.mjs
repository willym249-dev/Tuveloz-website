import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  PROTECTIVE_EMAIL_EVENT_SQL_PATTERNS,
  TRANSACTION_EMAIL_EVENT_SQL_PATTERNS,
  classifyEmailEvent,
  emailEventAllowedByReleaseState,
} from "../lib/email-event-policy.ts";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("pending real transaction emails remain quarantined while release is closed", () => {
  const transactionEvents = [
    "owner:new-request:req-1",
    "marketplace:automatic-request:req-1:provider-1",
    "marketplace:appointment-request:apt-1:provider",
    "marketplace:appointment-response:apt-1:confirmed:customer",
    "marketplace:job-authorization-created:auth-1:customer",
    "marketplace:job-authorization-response:auth-1:accepted:provider",
    "marketplace:tracking-started:req-1",
    "email:job-status:req-1:on my way",
    "email:job-status:req-1:arrived",
    "email:job-status:req-1:completed",
    "marketplace:payment:payment-1:paid",
    "marketplace:payout:payment-1:released",
  ];

  for (const eventKey of transactionEvents) {
    assert.equal(classifyEmailEvent(eventKey).kind, "transaction", eventKey);
    assert.equal(emailEventAllowedByReleaseState(eventKey, false), false, eventKey);
    assert.equal(emailEventAllowedByReleaseState(eventKey, true), true, eventKey);
  }
  assert.equal(classifyEmailEvent("email:job-status:req-1:completed").action, "completion");
  assert.equal(classifyEmailEvent("marketplace:payment:payment-1:paid").action, "checkout");
});

test("protective, account, cleanup, and compliance email events can send", () => {
  const allowedEvents = [
    "security:password_reset:event-1:user@example.com",
    "security:account_created:event-2:user@example.com",
    "marketplace:privacy-confirmation:privacy-1",
    "marketplace:privacy-status-email:privacy-1:completed",
    "marketplace:provider-onboarding:provider-1:received",
    "marketplace:provider-compliance:provider-1:expiring",
    "marketplace:incident:incident-1:opened",
    "marketplace:job-evidence:evidence-1:customer",
    "marketplace:refund:payment-1:completed",
    "marketplace:job-authorization-response:auth-1:declined:provider",
    "marketplace:job-authorization-withdrawn:auth-1:customer",
    "marketplace:appointment-response:apt-1:cancelled:provider",
  ];

  for (const eventKey of allowedEvents) {
    assert.notEqual(classifyEmailEvent(eventKey).kind, "transaction", eventKey);
    assert.notEqual(classifyEmailEvent(eventKey).kind, "quarantine", eventKey);
    assert.equal(emailEventAllowedByReleaseState(eventKey, false), true, eventKey);
  }
});

test("persisted test-fixture events never use the production email channel", () => {
  const flushCandidatePatterns = [
    ...PROTECTIVE_EMAIL_EVENT_SQL_PATTERNS,
    ...TRANSACTION_EMAIL_EVENT_SQL_PATTERNS,
  ];
  const matchesSqlLikePattern = (eventKey, pattern) => {
    const expression = pattern
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .replaceAll("%", ".*")
      .replaceAll("_", ".");
    return new RegExp(`^${expression}$`, "i").test(eventKey);
  };

  for (const eventKey of [
    "test:job-status:req-test:completed",
    "marketplace:test:appointment-request:apt-test:provider",
  ]) {
    assert.equal(classifyEmailEvent(eventKey).kind, "isolated_test", eventKey);
    assert.equal(emailEventAllowedByReleaseState(eventKey, false), false, eventKey);
    assert.equal(emailEventAllowedByReleaseState(eventKey, true), false, eventKey);
    assert.equal(
      flushCandidatePatterns.some((pattern) => matchesSqlLikePattern(eventKey, pattern)),
      false,
      `${eventKey} must not occupy the production flush candidate window`,
    );
  }
});

test("unknown outbox events fail closed and delivery checks happen before attempts", async () => {
  const emailNotifications = await source("lib/email-notifications.ts");

  for (const eventKey of [
    "marketplace:future-transaction:req-1",
    "email:legacy-unknown:req-1",
    "owner:unknown:req-1",
    "unclassified:event-1",
  ]) {
    assert.equal(classifyEmailEvent(eventKey).kind, "quarantine", eventKey);
    assert.equal(emailEventAllowedByReleaseState(eventKey, true), false, eventKey);
  }

  // Matched on the call and its early return rather than one exact line, so
  // adding an argument does not fail a check that is really about ordering.
  const deliveryGate = emailNotifications.indexOf(
    "if (!(await emailEventDeliveryIsAllowed(",
  );
  const attemptIncrement = emailNotifications.indexOf(
    "const attempts = notification.attempts + 1;",
  );
  assert.ok(deliveryGate >= 0 && deliveryGate < attemptIncrement);
  assert.match(
    emailNotifications.slice(deliveryGate, attemptIncrement),
    /\)\)\) return;/,
    "the gate must return early, not fall through",
  );
  assert.match(emailNotifications, /PROTECTIVE_EMAIL_EVENT_SQL_PATTERNS/);
  assert.match(emailNotifications, /TRANSACTION_EMAIL_EVENT_SQL_PATTERNS/);
  assert.match(emailNotifications, /MARKETING_EMAIL_EVENT_SQL_PATTERNS/);
  assert.match(emailNotifications, /CUSTOMER_JOB_POSTING_PAUSED/);
  assert.match(emailNotifications, /runtimeMarketplaceActionAllowed/);
});

test("account-created email accurately describes onboarding-only availability", async () => {
  const emailNotifications = await source("lib/email-notifications.ts");

  assert.match(emailNotifications, /open for account and provider onboarding only/);
  assert.match(emailNotifications, /Real service requests, jobs, provider quotes, appointments, and payments are not open yet/);
  assert.match(emailNotifications, /open for provider applications and compliance onboarding only/);
  assert.match(emailNotifications, /Applying does not activate a service or make jobs available/);
  assert.match(emailNotifications, /service activation are closed/);
});
