import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// Line endings are normalised because the assertions below match multi-line
// source fragments. A Windows checkout hands back CRLF, those patterns never
// match, and the test reports missing behaviour that is actually present.
const read = async (path) =>
  (await readFile(new URL(`../${path}`, import.meta.url), "utf8"))
    .replace(/\r\n/g, "\n");

test("the promotions box on the request form now reaches the launch sequence", async () => {
  const [enrollment, route, subscribe] = await Promise.all([
    read("lib/launch-update-enrollment.ts"),
    read("app/api/requests/route.ts"),
    read("app/api/launch-updates/subscribe/route.ts"),
  ]);

  // The consent was captured and unused; it now enrols.
  assert.ok(route.includes("enrollLaunchUpdateSubscriber"));
  assert.match(route, /if \(marketingConsent\) \{[\s\S]*enrollLaunchUpdateSubscriber/);
  // Stored wording is the one shown on this form, not the subscribe form's.
  assert.ok(route.includes("consentText: MARKETING_CONSENT_TEXT"));
  assert.ok(route.includes("consentVersion: GUEST_CONSENT_VERSION"));
  assert.ok(!route.includes("LAUNCH_UPDATE_CONSENT_VERSION"));

  // An unsubscribe is never reversed by a box on an unrelated form. The
  // dedicated subscribe endpoint still resurrects; this path must not.
  assert.match(enrollment, /previously_unsubscribed/);
  assert.ok(!/update\(launchUpdateSubscribers\)/.test(enrollment));
  assert.match(subscribe, /existing\.unsubscribedAt[\s\S]*update\(launchUpdateSubscribers\)/);

  // An existing record is never overwritten, so the original wording survives.
  assert.match(enrollment, /if \(existing\) \{[\s\S]*return existing\.unsubscribedAt/);

  // Enrolling can never fail the request it came from.
  assert.match(enrollment, /catch \(error\)[\s\S]*return "skipped"/);
  // Nothing is stored without both the wording and its version.
  assert.match(enrollment, /!input\.consentText\.trim\(\) \|\| !input\.consentVersion\.trim\(\)/);
});
