import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("the customer dashboard offers a real opt-in instead of promising email", async () => {
  const page = await source("app/customer/page.tsx");

  // The old copy asserted an email would arrive, but creating an account never
  // subscribed anyone, so nothing would have been sent.
  assert.doesNotMatch(page, /We&rsquo;ll email you the moment service requests go live/);

  // The promise is now an explicit, consented sign-up on the same surface.
  assert.match(page, /LaunchUpdatesForm/);
  assert.match(page, /source="customer-dashboard"/);
  assert.match(page, /Want an email the moment service requests open\?/);
  // The account itself is clearly not a subscription.
  assert.match(page, /Creating an account does not sign you up on its own/);
  // The account-is-safe reassurance is preserved.
  assert.match(page, /did not submit a\s+request, contact a provider, book service, or charge you/);
});

test("launch-update consent stays an affirmative act", async () => {
  const [form, route] = await Promise.all([
    source("app/components/launch-updates-form.tsx"),
    source("app/api/launch-updates/subscribe/route.ts"),
  ]);

  // Nothing about surfacing the form on the dashboard may pre-check consent or
  // let a request subscribe without it.
  assert.match(form, /checked=\{consent\}/);
  assert.match(form, /disabled=\{busy \|\| !consent\}/);
  assert.doesNotMatch(form, /useState\(true\)/);
  assert.match(route, /body\.consent === true/);
  assert.match(route, /Please check the box to confirm you want launch updates/);
});

test("a missing launch-update postal address is a visible owner blocker", async () => {
  const route = await source("app/api/admin/launch-readiness/route.ts");

  assert.match(route, /launch_update_postal_address_missing/);
  assert.match(route, /LAUNCH_UPDATES_POSTAL_ADDRESS/);
  assert.match(route, /launchUpdatePostalAddressSet \? \[\] : \[launchUpdateAddressBlocker\]/);
  // It reports as cleared once the address is configured.
  assert.match(route, /state: launchUpdatePostalAddressSet \? "approved" : "locked"/);
});

test("launch-update delivery still refuses to send without a postal address", async () => {
  const delivery = await source("lib/launch-update-delivery.ts");
  // The blocker is a warning surface, not a replacement for the send-side guard.
  assert.match(delivery, /LAUNCH_UPDATES_POSTAL_ADDRESS/);
  assert.match(delivery, /postalAddress/);
});
