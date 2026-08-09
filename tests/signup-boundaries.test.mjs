import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
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

// Scans lib/ as well as app/. Copy reaches the page from both — service and
// marketing catalogs live in lib/ — and scanning only app/ made any string
// shared with lib/ look provider-exclusive. "Top off fluids" was deleted as
// unreachable on exactly that mistake, and main's rendered-coverage check
// caught it on three public pages.
async function sourcesUnder(dir, skip = []) {
  const files = (await readdir(new URL(`../${dir}/`, import.meta.url), { recursive: true }))
    .map((path) => path.replaceAll("\\", "/"))
    .filter((path) => /\.(?:ts|tsx)$/.test(path))
    .filter((path) => !skip.includes(path));
  return Promise.all(files.map((path) => source(`${dir}/${path}`)));
}

const otherAppSources = [
  ...(await sourcesUnder("app", [
    "components/provider-signup-form.tsx",
    "components/site-language.tsx",
  ])),
  ...(await sourcesUnder("lib")),
];

function quotedDictionaryKeys(text) {
  return [...text.matchAll(/^\s*"((?:[^"\\]|\\.)*)"\s*:/gm)]
    .map((match) => JSON.parse(`"${match[1]}"`));
}

function interfaceLiterals(text) {
  const quoted = [...text.matchAll(/"((?:\\.|[^"\\])*)"/g)]
    .map((match) => match[1].replace(/\\(["\\])/g, "$1"));
  const jsxText = [...text.matchAll(/>([^<>{}]*[A-Za-z][^<>{}]*)</g)]
    .map((match) => match[1]
      .replace(/&apos;/g, "'")
      .replace(/&quot;/g, "\"")
      .replace(/\s+/g, " ")
      .trim())
    .filter(Boolean);
  return new Set([...quoted, ...jsxText]);
}

test("dictionary keys never target the manually translated provider signup subtree", () => {
  assert.match(
    homepage,
    /<div className="provider-panel" data-manual-language>[\s\S]*?<ProviderSignupForm/,
  );
  const dictionaryKeys = new Set(quotedDictionaryKeys(siteLanguage));
  const providerLiterals = interfaceLiterals(providerSignup);
  const nonManualLiterals = new Set(
    otherAppSources.flatMap((text) => [...interfaceLiterals(text)]),
  );
  const manualOnlyKeys = [...dictionaryKeys]
    .filter((key) => providerLiterals.has(key) && !nonManualLiterals.has(key));

  // This is a known historical failure. Keeping it explicit proves the
  // extractor sees the provider verification copy instead of passing after a
  // JSX apostrophe desynchronizes a generic quote matcher.
  const sentinel = "Verify email and continue";
  assert.ok(providerLiterals.has(sentinel));
  assert.ok(!nonManualLiterals.has(sentinel));
  assert.ok(!dictionaryKeys.has(sentinel));
  assert.deepEqual(manualOnlyKeys, []);
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
