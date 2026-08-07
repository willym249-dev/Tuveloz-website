import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

/**
 * Customer transactions are paused marketplace-wide, so the provider journey —
 * apply, verify email, sign in, verify identity, upload evidence, get reviewed
 * — is the only live flow. These guard the places where it used to tell someone
 * to do something they cannot do, or left them on a screen with no way forward.
 */

test("the onboarding guide only asks for actions a provider can still take", async () => {
  const route = await read("app/api/provider-onboarding/route.ts");
  const guide = route.slice(route.indexOf("guide: ["), route.indexOf("]", route.indexOf("guide: [")));

  // Signup stopped offering a pathway choice and always creates an independent
  // owner-operator, so step one was an instruction with nowhere to perform it.
  assert.doesNotMatch(guide, /Choose the pathway/);
  assert.match(guide, /independent owner-operator/);

  // Services are fixed at application time; the guide must not imply otherwise.
  assert.doesNotMatch(guide, /Choose exact services/);
  assert.match(guide, /came from your application/);

  // Identity verification is a real gate on the same page and was missing.
  assert.match(guide, /Verify your identity and adult status/);
});

test("the guide's heading and count come from the guide itself", async () => {
  const page = await read("app/provider-onboarding/page.tsx");

  // Both were hard-coded to seven while the list was served from the API, so
  // editing the guide silently made the page contradict itself.
  assert.doesNotMatch(page, /<h2>Seven steps<\/h2>/);
  assert.doesNotMatch(page, /<span className="account-count">7<\/span>/);
  assert.match(page, /<h2>\{data\.guide\.length\} steps<\/h2>/);
  assert.match(page, /<span className="account-count">\{data\.guide\.length\}<\/span>/);
});

test("an application with no services offers a way out", async () => {
  const page = await read("app/provider-onboarding/page.tsx");

  const emptyState = page.slice(
    page.indexOf("data.services.length === 0"),
    page.indexOf("data.services.map"),
  );
  assert.ok(emptyState.length > 0, "the empty state must still exist");

  // The page's only other links are the logo and the account home, so a bare
  // sentence here was a dead end.
  assert.match(emptyState, /mailto:hello@tuveloz\.com/);
  assert.match(emptyState, /add or remove a service/);
});

test("signup does not promise a service edit that has no screen", async () => {
  const form = await read("app/components/provider-signup-form.tsx");
  const api = await read("app/api/providers/route.ts");

  // The claim being guarded: resubmitting keeps the original application, and
  // there is no provider-facing way to change its services. If a PATCH/PUT ever
  // lands on this route, this test should fail so the copy gets revisited.
  assert.match(api, /const existing = await activeApplicationForEmail\(application\.email\);/);
  assert.doesNotMatch(api, /export async function (PATCH|PUT)\b/);

  assert.doesNotMatch(form, /changes happen after you sign in/);
  assert.doesNotMatch(form, /you can update it after signing in/);
  assert.match(form, /To change your services, email hello@tuveloz\.com/);
  assert.match(form, /it stays as it is and you can email us to adjust it/);
});
