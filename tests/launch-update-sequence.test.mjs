import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

const {
  LAUNCH_UPDATE_SEQUENCE,
  LAUNCH_UPDATE_CONSENT_VERSION,
  nextDueStep,
  marketingFooter,
} = await import(new URL("lib/launch-updates.ts", root).href);
const { classifyEmailEvent } = await import(new URL("lib/email-event-policy.ts", root).href);

test("sequence steps are uniquely numbered and ordered by delay", () => {
  const steps = LAUNCH_UPDATE_SEQUENCE.map((entry) => entry.step);
  assert.deepEqual(steps, [...new Set(steps)], "step numbers must be unique");
  assert.deepEqual(steps, [...steps].sort((a, b) => a - b));

  const delays = LAUNCH_UPDATE_SEQUENCE.map((entry) => entry.afterDays);
  assert.deepEqual(delays, [...delays].sort((a, b) => a - b), "delays must not go backwards");
  assert.equal(delays[0], 0, "the welcome must send immediately");
  assert.ok(LAUNCH_UPDATE_CONSENT_VERSION.length > 0);
});

test("every step carries both languages and never overstates launch", () => {
  for (const step of LAUNCH_UPDATE_SEQUENCE) {
    assert.ok(step.subject && step.subjectEs, `step ${step.step} needs both subjects`);
    assert.ok(step.body.length && step.bodyEs.length, `step ${step.step} needs both bodies`);

    const english = step.body.join(" ").toLowerCase();
    // Pre-launch honesty: nothing may invite a customer to transact today.
    // These are calls to action, so unlike a phrase such as "not available
    // today" they cannot appear in an honest negated sentence.
    for (const forbidden of ["book now", "order now", "buy now", "get a quote today"]) {
      assert.equal(english.includes(forbidden), false, `step ${step.step} implies ${forbidden}`);
    }
    // No income or volume promises to providers.
    for (const forbidden of ["guaranteed", "you'll earn", "make $"]) {
      assert.equal(english.includes(forbidden), false, `step ${step.step} promises ${forbidden}`);
    }
  }

  // The blocklist above only proves the copy avoids bad phrasing. This proves
  // it actively says where the marketplace really is.
  const wholeSequence = LAUNCH_UPDATE_SEQUENCE
    .flatMap((step) => step.body).join(" ").toLowerCase();
  assert.match(wholeSequence, /not (?:open|available|live)/);
});

test("a step comes due only once its delay has elapsed", () => {
  const consentedAt = "2026-01-01T00:00:00.000Z";
  const at = (days) => new Date(Date.parse(consentedAt) + days * 86_400_000);

  // Nothing sent yet: the welcome is due immediately.
  assert.equal(nextDueStep({ lastStepSent: -1, consentedAt, now: at(0) })?.step, 0);

  // Step 1 waits for its delay.
  const stepOne = LAUNCH_UPDATE_SEQUENCE[1];
  assert.equal(nextDueStep({ lastStepSent: 0, consentedAt, now: at(0) }), undefined);
  assert.equal(
    nextDueStep({ lastStepSent: 0, consentedAt, now: at(stepOne.afterDays) })?.step,
    stepOne.step,
  );

  // Steps only move forward — a finished sequence yields nothing.
  const last = LAUNCH_UPDATE_SEQUENCE.at(-1).step;
  assert.equal(nextDueStep({ lastStepSent: last, consentedAt, now: at(9999) }), undefined);

  // An unparseable consent timestamp must not be treated as "due now".
  assert.equal(nextDueStep({ lastStepSent: -1, consentedAt: "", now: at(0) }), undefined);
});

test("marketing mail is its own class, gated on the recipient not release state", () => {
  const classification = classifyEmailEvent("launch-updates:0:someone@example.com");
  assert.equal(classification.kind, "marketing");

  // Unrelated keys must not fall into the marketing class.
  assert.equal(classifyEmailEvent("security:password_reset").kind, "protective");
  assert.equal(classifyEmailEvent("totally-unknown:thing").kind, "quarantine");
});

test("every marketing email carries an opt-out and a postal address", () => {
  const footer = marketingFooter({
    unsubscribeUrl: "https://tuveloz.com/api/launch-updates/unsubscribe?token=abc",
    postalAddress: "123 Example St, Rockville, MD 20850",
    spanish: false,
  }).join("\n");
  assert.match(footer, /unsubscribe/i);
  assert.match(footer, /token=abc/);
  assert.match(footer, /Rockville, MD/);

  const spanish = marketingFooter({
    unsubscribeUrl: "https://tuveloz.com/u?token=abc",
    postalAddress: "123 Example St",
    spanish: true,
  }).join("\n");
  assert.match(spanish, /Cancelar la suscripción/i);
});

test("delivery is refused outright when the postal address is unconfigured", async () => {
  const delivery = await read("lib/launch-update-delivery.ts");
  assert.match(delivery, /LAUNCH_UPDATES_POSTAL_ADDRESS/);
  assert.match(delivery, /missing_postal_address/);
  // The guard must return before any send, not merely warn.
  const guardIndex = delivery.indexOf("missing_postal_address");
  const sendIndex = delivery.indexOf("sendLaunchUpdateEmail({");
  assert.ok(guardIndex > 0 && guardIndex < sendIndex, "the guard must precede sending");
});

test("subscribing requires an affirmative consent flag and unsubscribing needs no login", async () => {
  const subscribe = await read("app/api/launch-updates/subscribe/route.ts");
  assert.match(subscribe, /body\.consent === true/, "consent must be an explicit true");
  assert.match(subscribe, /consentText/, "the exact consent wording must be stored");
  assert.match(subscribe, /consumeFixedWindow/, "public writes must be rate limited");

  const unsubscribe = await read("app/api/launch-updates/unsubscribe/route.ts");
  assert.match(unsubscribe, /export async function GET/, "mail clients follow links with GET");
  assert.doesNotMatch(unsubscribe, /getAccountSession|verifyOwnerRequest/, "must not require sign-in");

  // The consent checkbox must never ship pre-checked.
  const form = await read("app/components/launch-updates-form.tsx");
  assert.match(form, /useState\(false\)/);
  assert.doesNotMatch(form, /checked=\{true\}|defaultChecked/);
});
