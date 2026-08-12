import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

/**
 * Guards the three silent dead ends that stalled account creation: a throttle
 * the visitor was never told about, a provider create form that refused
 * without saying why, and code entry steps that never mentioned spam folders
 * or the send limit.
 *
 * The ordering assertions matter more than they look. Surfacing a 429 is only
 * safe because the throttle is consumed before any lookup that distinguishes a
 * real address from an unknown one. Move the throttle back below the
 * eligibility check and the 429 becomes an account-enumeration oracle, which
 * is exactly why the generic "if that email is eligible" wording exists.
 */
const source = async (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [accountAuth, passwordRequest, requestCode, accountPage] = await Promise.all([
  source("lib/account-auth.ts"),
  source("app/api/auth/password/request/route.ts"),
  source("app/api/auth/request-code/route.ts"),
  source("app/account/page.tsx"),
]);

function bodyOf(text, signature) {
  const start = text.indexOf(signature);
  assert.notEqual(start, -1, `${signature} is no longer present`);
  return text.slice(start, start + 1200);
}

test("emailed-code throttles are consumed before any eligibility lookup", () => {
  for (const signature of [
    "export async function requestAccountCode(",
    "export async function requestPasswordVerification(",
  ]) {
    const body = bodyOf(accountAuth, signature);
    const throttleAt = body.indexOf("withinCodeRequestWindow");
    const eligibilityAt = body.indexOf("eligibleAccountRoles");
    assert.notEqual(throttleAt, -1, `${signature} no longer throttles`);
    assert.notEqual(eligibilityAt, -1, `${signature} no longer checks eligibility`);
    assert.ok(
      throttleAt < eligibilityAt,
      `${signature} must throttle before the eligibility lookup, or its 429 enumerates accounts`,
    );
  }
});

test("the throttle key is a hash, never a raw email address", () => {
  assert.match(
    accountAuth,
    /async function withinCodeRequestWindow\([\s\S]*?await rateLimitKeyHash\(/,
  );
});

test("password sign-in throttles only after the password is verified", () => {
  const body = bodyOf(accountAuth, "  // Safe to throttle after the password check here");
  assert.match(body, /withinCodeRequestWindow\("password_code", email, role, "signin"\)/);
  assert.match(body, /rateLimited: true as const/);
});

test("both code-request routes surface the throttle instead of reporting success", () => {
  for (const [name, route] of [
    ["password request", passwordRequest],
    ["sign-in code request", requestCode],
  ]) {
    assert.match(
      route,
      /"rateLimited" in result && result\.rateLimited === true/,
      `${name} route ignores the rate-limit result`,
    );
    assert.match(route, /status: 429/, `${name} route does not answer 429`);
    assert.match(
      route,
      /RATE_LIMITED_MESSAGE\s*=\s*\n?\s*"Too many codes were requested/,
      `${name} route has no throttle message`,
    );
  }
});

test("provider create mode explains that an application comes first", () => {
  const panel = accountPage.slice(
    accountPage.indexOf('{mode === "create" && role === "provider" && ('),
  ).slice(0, 900);
  assert.ok(panel.length > 0, "the provider create panel is gone");
  assert.match(panel, /Providers apply first/);
  assert.match(panel, /href="\/join"/);
  assert.match(panel, /same email address you applied with/);
});

test("every 6-digit entry step states the delivery window and the send limit", () => {
  assert.match(
    accountPage,
    /function CodeDeliveryHint\(\)[\s\S]*?spam or junk folder[\s\S]*?3 codes/,
  );
  // Password sign-in challenge, password create/reset, and passwordless code.
  const uses = accountPage.match(/<CodeDeliveryHint \/>/g) ?? [];
  assert.equal(uses.length, 3, "a code entry step is missing its delivery hint");
});
