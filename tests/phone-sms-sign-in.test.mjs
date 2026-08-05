import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("phone sign-in stays fail-closed until SMS is configured and the lock is released", async () => {
  const lib = await source("lib/phone-auth.ts");

  // Production SMS delivery is code-locked off by default, mirroring the
  // fail-closed Stripe live-mode pattern.
  assert.match(lib, /export const PHONE_SMS_LIVE_MODE_ENABLED = false;/);

  // Sending requires BOTH the released lock and every SMS secret present.
  assert.match(
    lib,
    /return PHONE_SMS_LIVE_MODE_ENABLED\s*&&\s*Boolean\(variables\.SMS_PROVIDER\)\s*&&\s*Boolean\(variables\.SMS_API_URL\)\s*&&\s*Boolean\(variables\.SMS_API_KEY\)\s*&&\s*Boolean\(variables\.SMS_SENDER_ID\);/,
  );
  // The sender throws (never silently no-ops) when not configured.
  assert.match(lib, /if \(!smsIsConfigured\(\)\) \{\s*throw new Error\("SMS sign-in is not configured\."\);/);
});

test("one-time SMS codes are hashed, single-use, expiring, attempt-capped, and rate-limited", async () => {
  const lib = await source("lib/phone-auth.ts");

  // Codes are HMAC-hashed with the server pepper before storage; the plaintext
  // is only used to send the text.
  assert.match(lib, /const codeHash = await hmacHex\(`\$\{id\}:\$\{phone\}:\$\{purpose\}:\$\{email\}:\$\{code\}`\);/);
  assert.match(lib, /codeHash,/);
  assert.doesNotMatch(lib, /code:\s*code\b/); // never persist the plaintext code column

  // Lifetimes and limits.
  assert.match(lib, /const CODE_LIFETIME_MS = 10 \* 60 \* 1000;/);
  assert.match(lib, /const SEND_RATE_LIMIT = 3;/);
  assert.match(lib, /const RESEND_COOLDOWN_MS = 60 \* 1000;/);
  assert.match(lib, /const DAILY_SEND_LIMIT = 5;/);
  assert.match(lib, /const MAX_ATTEMPTS = 5;/);

  // Single-use + attempt cap on verify.
  assert.match(lib, /challenge\.attempts >= MAX_ATTEMPTS/);
  assert.match(lib, /usedAt: attempts >= MAX_ATTEMPTS \? new Date\(\)\.toISOString\(\) : "",/);
  assert.match(lib, /eq\(phoneLoginCodes\.usedAt, ""\)/);

  // Rate-limit gate covers window, daily cap, and resend cooldown.
  assert.match(lib, /sends\.inWindow >= SEND_RATE_LIMIT/);
  assert.match(lib, /sends\.inDay >= DAILY_SEND_LIMIT/);
  assert.match(lib, /now - sends\.lastAt < RESEND_COOLDOWN_MS/);
});

test("phone sign-in resists enumeration and never leaks whether a number is registered", async () => {
  const lib = await source("lib/phone-auth.ts");

  // Invalid, unknown, and no-eligible-role numbers all return the same generic
  // accepted shape with nothing sent.
  assert.match(lib, /if \(!phone\) return \{ accepted: true, delivered: false \} as const;/);
  assert.match(lib, /if \(!email\) return \{ accepted: true, delivered: false \} as const;/);
  assert.match(lib, /if \(roles\.length === 0\) return \{ accepted: true, delivered: false \} as const;/);

  // The request route replies with a fixed generic message regardless of state.
  const requestRoute = await source("app/api/auth/phone/request-code/route.ts");
  assert.match(requestRoute, /If that number can sign in to Tuveloz, a code is on its way\./);
  assert.match(requestRoute, /await requestPhoneSignInCode\(body\.phone\)/);
  assert.match(requestRoute, /"cache-control": "no-store"/);
});

test("phone sign-in only creates a customer/provider session and never owner access", async () => {
  const lib = await source("lib/phone-auth.ts");

  // Ownership is re-checked at verification (number-recycling safeguard).
  assert.match(lib, /const currentOwner = await verifiedPhoneOwnerEmail\(phone\);/);
  assert.match(lib, /if \(!currentOwner \|\| currentOwner !== challenge\.email\)/);

  // The session is created through the shared account-session helper, which is
  // limited to customer/provider roles.
  assert.match(lib, /const session = await createAccountSession\(challenge\.email, role\);/);
  // The module never touches the separate Cloudflare Access owner path.
  assert.doesNotMatch(lib, /owner-auth|isVerifiedOwnerRequest|OWNER_ACCESS/);

  // The account page states the separation in the UI.
  const accountPage = await source("app/account/page.tsx");
  assert.match(
    accountPage,
    /Customer or provider sign-in[\s\S]*never grants owner or admin access\./,
  );
  assert.match(accountPage, /Owner\/admin sign-in/);
  assert.match(accountPage, /href="\/admin"/);
});

test("normalization enforces a valid U.S. E.164 mobile format", async () => {
  const lib = await source("lib/phone-auth.ts");
  // The exact NANP-aware pattern is used for both normalization and validation.
  assert.match(lib, /\/\^\[2-9\]\\d\{2\}\[2-9\]\\d\{6\}\$\//);
  assert.match(lib, /export function isValidUsE164\(value: string\): boolean \{\s*return \/\^\\\+1\[2-9\]\\d\{2\}\[2-9\]\\d\{6\}\$\/\.test\(value\);/);

  // Behavioral check of the same E.164 shape the library enforces.
  const e164 = /^\+1[2-9]\d{2}[2-9]\d{6}$/;
  assert.equal(e164.test("+12025550123"), true);
  assert.equal(e164.test("+11025550123"), false); // area code cannot start with 1
  assert.equal(e164.test("+1202555012"), false); // too short
  assert.equal(e164.test("2025550123"), false); // missing +1
});

test("adding or changing a phone requires step-up password re-authentication", async () => {
  const route = await source("app/api/account/phone/route.ts");

  assert.match(route, /const session = await getAccountSession\(request\);/);
  assert.match(route, /if \(!session\) \{[\s\S]*Sign in to manage your phone number\./);
  assert.match(route, /if \(!\(await accountHasPassword\(session\.email\)\)\)/);
  assert.match(route, /!\(await accountPasswordMatches\(session\.email, password\)\)/);
  assert.match(route, /await requestPhoneChangeCode\(session\.email, body\.phone\)/);
  assert.match(route, /await confirmPhoneChange\(\s*session\.email,\s*session\.role,\s*body\.phone,\s*body\.code,\s*\)/);
  assert.match(route, /if \(!isSameOriginRequest\(request\)\)/);

  // The password re-check honors the account lockout window.
  const auth = await source("lib/account-auth.ts");
  assert.match(auth, /export async function accountPasswordMatches\(email: string, password: string\)/);
  assert.match(auth, /if \(!credential \|\| lockExpiresAt > Date\.now\(\)\) return false;/);
});

test("a phone change binds one number per account and alerts the account out of band", async () => {
  const lib = await source("lib/phone-auth.ts");

  assert.match(lib, /onConflictDoUpdate\(\{\s*target: accountPhoneNumbers\.email,/);
  // Commit-time ownership recheck plus the unique index prevent hijacking a
  // number verified by another account.
  assert.match(lib, /const existingOwner = await verifiedPhoneOwnerEmail\(phone\);/);
  assert.match(lib, /await sendAccountSecurityAlert\(\{[\s\S]*action: "phone_updated",/);

  const email = await source("lib/email-notifications.ts");
  assert.match(email, /\| "phone_updated";/);
  assert.match(email, /phone_updated: "A phone number for text sign-in was added or changed",/);
});

test("SMS content includes the rates disclosure and no message body or code is logged", async () => {
  const lib = await source("lib/phone-auth.ts");
  assert.match(lib, /Message and data rates may apply\. Reply STOP to opt out\./);
  // Only a delivery status is logged on failure — never the code or message.
  assert.match(lib, /console\.error\("SMS provider rejected a sign-in code", \{\s*status: response\.status,\s*\}\);/);
  // The plaintext code variable is never interpolated into a log call.
  assert.doesNotMatch(lib, /console\.(log|error|warn)\([^;]*\$\{code\}/);

  // The UI collects explicit consent and shows the rates disclosure.
  const accountPage = await source("app/account/page.tsx");
  assert.match(accountPage, /phoneConsent/);
  assert.match(accountPage, /Message and data rates may apply\./);
  assert.match(accountPage, /This is\s*[\s\S]*not marketing\./);
});

test("verify-code route requires same-origin, a 6-digit code, and sets a session cookie", async () => {
  const route = await source("app/api/auth/phone/verify-code/route.ts");
  assert.match(route, /if \(!isSameOriginRequest\(request\)\)/);
  assert.match(route, /if \(!\/\^\\d\{6\}\$\/\.test\(code\)\)/);
  assert.match(route, /response\.headers\.append\("set-cookie", sessionCookie\(request, result\.token\)\)/);
  assert.match(route, /"cache-control": "no-store"/);
});

test("migration 0051 creates the phone tables with a unique number index and is journaled", async () => {
  const migration = await source("drizzle/0051_sms_phone_sign_in.sql");
  assert.match(migration, /CREATE TABLE `account_phone_numbers`/);
  assert.match(migration, /CREATE UNIQUE INDEX `account_phone_numbers_phone_unique` ON `account_phone_numbers` \(`phone_e164`\)/);
  assert.match(migration, /CREATE TABLE `phone_login_codes`/);
  // The renumbering migration must not touch unrelated tables.
  assert.doesNotMatch(migration, /customer_requests|provider_quotes|provider_profiles/);

  const journal = JSON.parse(await source("drizzle/meta/_journal.json"));
  assert.equal(journal.entries.at(-1).tag, "0051_sms_phone_sign_in");

  const schema = await source("db/schema.ts");
  assert.match(schema, /export const accountPhoneNumbers = sqliteTable\(\s*"account_phone_numbers"/);
  assert.match(schema, /export const phoneLoginCodes = sqliteTable\(\s*"phone_login_codes"/);
});
