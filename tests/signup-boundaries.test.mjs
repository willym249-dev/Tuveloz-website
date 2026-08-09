import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = async (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [siteLanguage, homepage, providerSignup, accountAuth, passwordComplete, privacyCenter] = await Promise.all([
  source("app/components/site-language.tsx"),
  source("app/page.tsx"),
  source("app/components/provider-signup-form.tsx"),
  source("lib/account-auth.ts"),
  source("app/api/auth/password/complete/route.ts"),
  source("app/api/privacy-center/route.ts"),
]);

function quotedDictionaryKeys(text) {
  return [...text.matchAll(/^\s*"((?:[^"\\]|\\.)*)"\s*:/gm)]
    .map((match) => JSON.parse(`"${match[1]}"`));
}

function quotedLiterals(text) {
  return [...text.matchAll(/(["'`])((?:\\.|(?!\1)[\s\S])*)\1/g)]
    .map((match) => match[2].replace(/\\(["'`\\])/g, "$1"));
}

test("dictionary keys never target the manually translated provider signup subtree", () => {
  assert.match(
    homepage,
    /<div className="provider-panel" data-manual-language>[\s\S]*?<ProviderSignupForm/,
  );
  const keys = new Set(quotedDictionaryKeys(siteLanguage));
  const overlap = [...new Set(quotedLiterals(providerSignup).filter((literal) => keys.has(literal)))];
  assert.deepEqual(overlap, []);
});

test("every launch-notification consent write is customer-create-only", () => {
  assert.match(
    passwordComplete,
    /body\.purpose === "create"\s*&&\s*body\.role === "customer"\s*&&\s*policyAccepted\(body\.launchNotificationConsent\)/,
  );
  assert.match(
    accountAuth,
    /if \(launchNotificationConsent && purpose === "create" && role === "customer"\)[\s\S]*?launchNotificationEmail: "yes"/,
  );
  assert.match(
    privacyCenter,
    /const launchNotification = account\.role === "customer"\s*\? yesNo\(body\.launchNotificationEmail\)\s*:\s*"no"/,
  );
  assert.match(privacyCenter, /launch_notification_email = \?/);
});
