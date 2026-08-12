import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  REFERRAL_CODE_ALPHABET,
  REFERRAL_CODE_LENGTH,
  generateReferralCode,
  normalizeReferralCode,
} from "../lib/referral-code.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("share codes avoid look-alike characters and accept only their own shape", () => {
  // Look-alikes and vowels are excluded so a code survives being read aloud or
  // written down, and cannot spell anything.
  for (const excluded of ["E", "I", "O", "U", "0", "1"]) {
    assert.ok(
      !REFERRAL_CODE_ALPHABET.includes(excluded),
      `alphabet must not contain ${excluded}`,
    );
  }

  for (let attempt = 0; attempt < 200; attempt += 1) {
    const code = generateReferralCode();
    assert.equal(code.length, REFERRAL_CODE_LENGTH);
    assert.equal(normalizeReferralCode(code), code);
  }

  // Case, surrounding space, and separators a person adds are forgiven.
  assert.equal(normalizeReferralCode("bcdfghj2"), "BCDFGHJ2");
  assert.equal(normalizeReferralCode("  BCDF-GHJ2 "), "BCDFGHJ2");

  // Wrong length, excluded letters, and non-strings attribute nothing.
  assert.equal(normalizeReferralCode("BCDFGHJ"), "");
  assert.equal(normalizeReferralCode("BCDFGHJ22"), "");
  assert.equal(normalizeReferralCode("BCDFGHJ!"), "");
  assert.equal(normalizeReferralCode("AEIOU123"), "");
  assert.equal(normalizeReferralCode(""), "");
  assert.equal(normalizeReferralCode(null), "");
  assert.equal(normalizeReferralCode(undefined), "");
  assert.equal(normalizeReferralCode(12345678), "");
});

test("referrals grant attribution only, never ranking or routing preference", async () => {
  const [lib, panel, routing, matching] = await Promise.all([
    read("lib/referrals.ts"),
    read("app/components/referral-panel.tsx"),
    read("lib/automatic-job-routing.ts"),
    read("lib/service-matching.ts"),
  ]);

  // The founding-provider policy refuses ranking or routing preference; a
  // referral must not become a way around that.
  for (const source of [routing, matching]) {
    assert.ok(!/referr?al/i.test(source));
  }
  assert.ok(!/price|payout|reward|bonus|credit|discount/i.test(lib.replace(/^\s*\*.*$/gm, "")));

  // The panel says what a referral does not do, on the panel itself.
  assert.ok(panel.includes("There is no referral payment"));
  assert.ok(panel.includes("never affects search ranking"));
  assert.ok(panel.includes("only how many"));
});

test("attribution is deduped, self-referral proof, and never fails a signup", async () => {
  const lib = await read("lib/referrals.ts");

  assert.ok(lib.includes("onConflictDoNothing()"));
  assert.ok(lib.includes("Nobody refers themselves."));
  assert.match(lib, /recordReferralSignup[\s\S]*try \{[\s\S]*\} catch \(error\) \{[\s\S]*return null/);
  // Only an active code can be credited.
  assert.match(lib, /eq\(referralCodes\.status, "active"\)/);
  // The referred person's address is stored as a one-way key, not in the clear.
  assert.ok(lib.includes("referredKeyHash"));
  assert.ok(!lib.includes("referredEmail,\n      referredKey"));
});

test("provider signup records attribution outside the application evidence chain", async () => {
  const [route, form] = await Promise.all([
    read("app/api/providers/route.ts"),
    read("app/components/provider-signup-form.tsx"),
  ]);

  // Attribution runs after the atomic batch, so it can never fail or alter a
  // legal application record.
  assert.match(route, /await db\.batch\(\[[\s\S]*\] as const\);[\s\S]*recordReferralSignup/);
  assert.ok(route.includes("rawCode: body.referralCode"));
  // The code must not enter the normalized application or its payload hash.
  assert.ok(!route.includes("referralCode: application"));
  assert.ok(!/providerApplicationNormalizedSnapshot[\s\S]{0,200}referral/i.test(route));

  assert.ok(form.includes("referralCode: referralCode()"));
  assert.ok(form.includes('searchParams.get("ref")'));
  // The browser applies the same shape rule the server does.
  assert.ok(form.includes('from "../../lib/referral-code"'));
});

test("the share endpoint returns a count and never who signed up", async () => {
  const route = await read("app/api/referrals/route.ts");

  assert.ok(route.includes("getAccountSession"));
  assert.ok(route.includes("isReferralRole"));
  assert.ok(route.includes("signupCount"));
  // No referred identity ever leaves this endpoint.
  for (const leak of ["referredEmail", "referredKey", "referredEntityId", "signups:"]) {
    assert.ok(!route.includes(leak), `share endpoint must not return ${leak}`);
  }
});
