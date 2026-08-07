import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

const accountAuth = await source("lib/account-auth.ts");

/**
 * Mirrors appReviewFixedCode in lib/account-auth.ts so the gate is exercised
 * rather than only read. Any change to the guard there should change this too.
 */
function appReviewFixedCode(env, email) {
  const reviewEmail = (env.APP_REVIEW_EMAIL ?? "").trim().toLowerCase().slice(0, 180);
  const reviewCode = (env.APP_REVIEW_CODE ?? "").trim();
  if (!reviewEmail || !/^\d{6}$/.test(reviewCode)) return null;
  return email === reviewEmail ? reviewCode : null;
}

const CONFIGURED = {
  APP_REVIEW_EMAIL: "appreview@tuveloz.com",
  APP_REVIEW_CODE: "424242",
};

test("the review code is off unless both values are configured", () => {
  assert.equal(appReviewFixedCode({}, "appreview@tuveloz.com"), null);
  assert.equal(
    appReviewFixedCode({ APP_REVIEW_EMAIL: "appreview@tuveloz.com" }, "appreview@tuveloz.com"),
    null,
    "an email with no code must not enable the path",
  );
  assert.equal(
    appReviewFixedCode({ APP_REVIEW_CODE: "424242" }, "appreview@tuveloz.com"),
    null,
    "a code with no email must not enable the path",
  );
});

test("a malformed review code leaves the path disabled", () => {
  for (const bad of ["", "  ", "12345", "1234567", "abcdef", "12 34 56", "42424a"]) {
    assert.equal(
      appReviewFixedCode({ ...CONFIGURED, APP_REVIEW_CODE: bad }, "appreview@tuveloz.com"),
      null,
      `expected ${JSON.stringify(bad)} to be rejected`,
    );
  }
});

test("only the configured address gets the fixed code", () => {
  assert.equal(appReviewFixedCode(CONFIGURED, "appreview@tuveloz.com"), "424242");
  for (const other of [
    "someone@tuveloz.com",
    "appreview@example.com",
    "appreview+1@tuveloz.com",
    "",
  ]) {
    assert.equal(
      appReviewFixedCode(CONFIGURED, other),
      null,
      `${other} must not receive the fixed code`,
    );
  }
});

test("verification is not weakened for the review account", () => {
  // The whole safety argument rests on verifyAccountCode being untouched: the
  // fixed code is still hashed, compared in constant time, expiring, attempt
  // capped, single use, and role checked.
  const verify = accountAuth.slice(accountAuth.indexOf("export async function verifyAccountCode"));
  assert.ok(
    !/APP_REVIEW|appReview/i.test(verify),
    "verifyAccountCode must contain no review-account branch",
  );
  for (const guard of [
    "constantTimeEqual(challenge.codeHash, suppliedHash)",
    "challenge.attempts >= LOGIN_MAX_ATTEMPTS",
    "parseStoredDate(challenge.expiresAt) <= Date.now()",
    "eq(loginCodes.usedAt, \"\")",
    "roles.includes(role)",
  ]) {
    assert.ok(verify.includes(guard), `verifyAccountCode lost the guard: ${guard}`);
  }
});

test("the review branch sits below the rate limit, not above it", () => {
  const request = accountAuth.slice(
    accountAuth.indexOf("export async function requestAccountCode"),
    accountAuth.indexOf("export async function verifyAccountCode"),
  );
  const rateLimit = request.indexOf("rateLimited: true");
  const reviewBranch = request.indexOf("appReviewFixedCode(email)");
  assert.ok(rateLimit > 0 && reviewBranch > 0, "expected both blocks to be present");
  assert.ok(
    reviewBranch > rateLimit,
    "the review account must be rate limited like every other address",
  );
});

test("the fixed code is never emailed", () => {
  const request = accountAuth.slice(
    accountAuth.indexOf("export async function requestAccountCode"),
    accountAuth.indexOf("export async function verifyAccountCode"),
  );
  const branch = request.slice(
    request.indexOf("appReviewFixedCode(email)"),
    request.indexOf("const code = randomDigits()"),
  );
  assert.ok(
    !branch.includes("sendLoginCodeEmail"),
    "the review branch must not send mail — there is nowhere to send it",
  );
  assert.ok(
    branch.includes("delivered: false"),
    "the review branch must report that nothing was delivered",
  );
});
