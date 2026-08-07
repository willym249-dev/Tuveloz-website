import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { classifyEmailEvent, emailEventAllowedByReleaseState } from "../lib/email-event-policy.ts";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

/**
 * Section 13 of the Terms makes four promises about opting out of
 * arbitration: 30 days, no cost, a written confirmation, and no consequence.
 * These tests pin the parts of the system that keep them.
 */

test("the Terms promise both an opt-out route and both routes exist", async () => {
  const terms = await source("app/terms/page.tsx");

  // Both routes are named, and both are said to count the same.
  assert.match(terms, /\/arbitration-opt-out/);
  assert.match(terms, /hello@tuveloz\.com/);
  assert.match(terms, /30 days/);
  assert.match(terms, /Arbitration opt-out/);

  // The page the Terms point at actually exists, with a form on it.
  const page = await source("app/arbitration-opt-out/page.tsx");
  assert.match(page, /ArbitrationOptOutForm/);
  const route = await source("app/api/arbitration-opt-out/route.ts");
  assert.match(route, /export async function POST/);
});

test("the fee provision covers provider businesses, not only consumers", async () => {
  const terms = await source("app/terms/page.tsx");
  const costs = terms.slice(terms.indexOf("<h3>Costs</h3>"));

  // "as a consumer" left a one-person provider business unsure whether the
  // fee promise reached them. The scope is now stated, not implied.
  assert.doesNotMatch(costs.slice(0, 1200), /you bring as a consumer/);
  assert.match(costs, /whether you are\s*\n?\s*an individual or a provider business/);
});

test("an opt-out is recorded per Terms version and never edited after the fact", async () => {
  const lib = await source("lib/arbitration-opt-out.ts");

  // Scoped to a version, because the Terms say a new version restarts the 30
  // days. A single row keyed by email alone would silently claim otherwise.
  assert.match(lib, /termsVersion/);
  assert.match(lib, /onConflictDoNothing/);
  assert.match(lib, /arbitrationOptOuts\.email, arbitrationOptOuts\.termsVersion/);

  // Resubmitting returns the first record rather than moving its date, so the
  // timestamp always reflects when the right was actually exercised.
  assert.match(lib, /already_recorded/);

  // The only update ever written is the confirmation stamp — never the email,
  // the version, the method, or the recorded date.
  const updates = [...lib.matchAll(/\.set\(\{([^}]*)\}/g)].map((match) => match[1]);
  assert.equal(updates.length, 1);
  assert.match(updates[0], /confirmationSentAt/);
  for (const field of ["email:", "termsVersion:", "method:", "recordedAt:"]) {
    assert.ok(!updates[0].includes(field), `an opt-out row rewrote ${field}`);
  }

  // Nothing deletes an opt-out.
  assert.doesNotMatch(lib, /\.delete\(/);

  const schema = await source("db/schema.ts");
  assert.match(schema, /arbitration_opt_outs/);
  assert.match(schema, /arbitration_opt_outs_email_terms_version_unique/);
});

test("recording an opt-out fails loudly, while the confirmation fails quietly", async () => {
  const lib = await source("lib/arbitration-opt-out.ts");
  const route = await source("app/api/arbitration-opt-out/route.ts");

  // A failed write must reach the caller. Someone who believes they opted out
  // and did not is worse off than someone who saw an error.
  assert.match(lib, /throw new Error\("The arbitration opt-out did not save\."\)/);
  assert.match(route, /status: 500/);
  assert.match(route, /Email hello@tuveloz\.com/);

  // The confirmation is a separate promise: the opt-out is valid without it,
  // so a mail failure is caught and never reported as a failed opt-out.
  assert.match(
    route,
    /try \{\s*await sendArbitrationOptOutConfirmation/,
  );
  assert.match(lib, /markArbitrationOptOutConfirmed[\s\S]*?catch \(error\)/);
});

test("the confirmation is protective mail, so nothing suppresses it", async () => {
  // It confirms a legal right the person just exercised. It is not marketing,
  // and it must not wait on the marketplace being open for transactions.
  const classification = classifyEmailEvent(
    "dispute:arbitration-opt-out:someone@example.com:2026-08-07",
  );
  assert.equal(classification.kind, "protective");
  assert.equal(
    emailEventAllowedByReleaseState(
      "dispute:arbitration-opt-out:someone@example.com:2026-08-07",
      false,
    ),
    true,
  );

  const notifications = await source("lib/email-notifications.ts");
  assert.match(notifications, /eventKey: `dispute:arbitration-opt-out:/);
  // Keyed by address and version, so a resubmission cannot send a second copy.
  assert.match(notifications, /arbitration-opt-out:\$\{recipientEmail\}:\$\{input\.termsVersion\}/);
});

test("the opt-out endpoint is same-origin, rate limited, and discloses nothing", async () => {
  const route = await source("app/api/arbitration-opt-out/route.ts");

  assert.match(route, /isStrictSameOriginWriteRequest/);
  assert.match(route, /consumeFixedWindow\(\s*"arbitration-opt-out:email"/);
  assert.match(route, /consumeFixedWindow\(\s*"arbitration-opt-out:ip"/);
  assert.match(route, /rateLimitKeyHash/);

  // No account lookup and no sign-in: the Terms say an email address is all it
  // takes, so requiring more here would make the right harder to use than the
  // document says it is. Comments are stripped first so prose about accounts
  // cannot fail a test that is about what the code does.
  const code = route
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(code, /requireSession|currentAccount|accounts\b/);

  // And no branch reveals whether the address exists elsewhere: the answer is
  // the same either way, so this cannot be used to test for an account.
  assert.doesNotMatch(code, /no account|not found|unknown address/i);
});

test("the opt-out page states the four promises the Terms make", async () => {
  const page = await source("app/arbitration-opt-out/page.tsx");

  assert.match(page, /30 days/);
  assert.match(page, /no cost|costs? you nothing|Free/i);
  assert.match(page, /written confirmation|confirmation by email/i);
  assert.match(page, /won&apos;t treat you differently/);
  // Montgomery County courts are where disputes go instead.
  assert.match(page, /Montgomery County, Maryland/);
  // The email route stays offered, because the Terms accept it equally.
  assert.match(page, /hello@tuveloz\.com/);

  // The page is discoverable rather than buried.
  const sitemap = await source("app/sitemap.ts");
  assert.match(sitemap, /\/arbitration-opt-out/);
});
