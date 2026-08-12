import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

/**
 * Source-level guards on the cookies that carry authentication.
 *
 * These cannot be exercised at runtime from a plain Node test — lib/account-auth.ts
 * imports `cloudflare:workers`, so the builders are unreachable outside a Worker,
 * and the end-to-end suite deliberately stays on parity and what a person can
 * see rather than on cookie flags. That leaves the source as the place to pin
 * them, which is also where a regression would be introduced.
 *
 * The flags are not decoration. HttpOnly is what keeps a session token out of
 * reach of injected script; without it any XSS anywhere on the site becomes
 * account takeover for every signed-in customer and provider.
 */
const source = async (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [accountAuth, passkeys] = await Promise.all([
  source("lib/account-auth.ts"),
  source("lib/passkeys.ts"),
]);

function builderBody(text, signature) {
  const start = text.indexOf(signature);
  assert.notEqual(start, -1, `${signature} is no longer present`);
  const body = text.slice(start, start + 700);
  const end = body.indexOf("\n}");
  return end === -1 ? body : body.slice(0, end);
}

test("the session cookie is HttpOnly", () => {
  const body = builderBody(accountAuth, "export function sessionCookie(");
  assert.match(
    body,
    /"HttpOnly"/,
    "a session cookie readable from script turns any XSS into account takeover",
  );
});

test("the session cookie carries its other hardening flags", () => {
  const body = builderBody(accountAuth, "export function sessionCookie(");
  assert.match(body, /"Path=\/"/);
  assert.match(body, /"SameSite=Lax"/);
  // Secure is conditional on the request being https so local http development
  // still works; it must never be unconditionally absent.
  assert.match(body, /secure \? "Secure" : ""/);
  assert.match(body, /Max-Age=\$\{SESSION_LIFETIME_SECONDS\}/);
});

test("the production session cookie keeps the __Host- prefix", () => {
  // __Host- is enforced by the browser: it requires Secure, Path=/, and no
  // Domain attribute, so a subdomain cannot plant a session cookie on the site.
  assert.match(
    accountAuth,
    /const PRODUCTION_COOKIE_NAME = "__Host-tuveloz_session"/,
  );
});

test("signing out clears the session cookie with the same protection", () => {
  const body = builderBody(accountAuth, "export function expiredSessionCookies(");
  assert.match(body, /HttpOnly/);
  assert.match(body, /Max-Age=0/);
  assert.match(body, /Expires=Thu, 01 Jan 1970/);
});

test("passkey challenge cookies are HttpOnly and SameSite=Strict", () => {
  // Stricter than the session cookie on purpose: a challenge is only ever
  // completed by the page that requested it, so it never travels cross-site.
  const issued = builderBody(passkeys, "async function challengeCookie(");
  assert.match(issued, /"HttpOnly"/);
  assert.match(issued, /"SameSite=Strict"/);
  const cleared = builderBody(passkeys, "export function expiredPasskeyChallengeCookies(");
  assert.match(cleared, /HttpOnly/);
  assert.match(cleared, /SameSite=Strict/);
});

test("every route that grants a session builds the cookie with sessionCookie()", async () => {
  // The regression this is really guarding: a new sign-in route that hand-rolls
  // its own Set-Cookie header would silently skip every flag above. Routes must
  // go through the one builder.
  const files = (await readdir(new URL("../app/api/auth/", import.meta.url), { recursive: true }))
    .map((path) => path.replaceAll("\\", "/"))
    .filter((path) => path.endsWith("route.ts"));
  assert.ok(files.length > 0, "no auth routes were found to check");

  const sessionGranting = [];
  for (const path of files) {
    const text = await source(`app/api/auth/${path}`);
    for (const line of text.split("\n")) {
      if (!/set-cookie/.test(line)) continue;
      // Passkey challenge cookies come from lib/passkeys.ts and are covered
      // above; only session grants are in scope here.
      if (!/result\.token|sessionCookie/.test(line)) continue;
      sessionGranting.push(path);
      assert.match(
        line,
        /sessionCookie\(request, result\.token\)/,
        `${path} sets a session cookie without the shared builder`,
      );
    }
  }

  // Pinned as a set, not a count: an added sign-in path should fail here and be
  // reviewed, rather than sliding in because the number still looked plausible.
  assert.deepEqual(
    [...new Set(sessionGranting)].sort(),
    [
      "passkeys/authenticate/verify/route.ts",
      "password/complete/route.ts",
      "password/verify/route.ts",
      "phone/verify-code/route.ts",
      "verify-code/route.ts",
    ],
    "the set of session-granting routes changed; confirm the new one is intended",
  );
});
