import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  MAX_SAVED_VEHICLES,
  validateSavedVehicle,
  vehicleDescription,
  vehicleDisplayName,
} from "../lib/customer-vehicles.ts";
import { FLEET_SIZE_OPTIONS, isFleetSize } from "../lib/fleet-options.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("saved vehicle validation accepts real vehicles and rejects malformed input", () => {
  const ok = validateSavedVehicle({
    label: "  Van 3 ",
    year: "2019",
    make: " Ford ",
    model: "Transit  250",
    vin: "1ftye1c80lka12345",
    plate: "  1ab2345 ",
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.vehicle.label, "Van 3");
  assert.equal(ok.vehicle.make, "Ford");
  assert.equal(ok.vehicle.model, "Transit 250");
  assert.equal(ok.vehicle.vin, "1FTYE1C80LKA12345");
  assert.equal(ok.vehicle.plate, "1AB2345");

  assert.equal(validateSavedVehicle({ make: "Ford" }).ok, false);
  assert.equal(validateSavedVehicle({ model: "Transit" }).ok, false);
  assert.equal(validateSavedVehicle({}).ok, false);

  // Year is optional, but a stated year has to be a real four-digit year.
  assert.equal(validateSavedVehicle({ make: "a", model: "b", year: "19" }).ok, false);
  assert.equal(validateSavedVehicle({ make: "a", model: "b", year: "1899" }).ok, false);
  assert.equal(validateSavedVehicle({ make: "a", model: "b", year: "" }).ok, true);

  // A VIN never contains I, O, or Q, and is exactly 17 characters.
  assert.equal(validateSavedVehicle({ make: "a", model: "b", vin: "1FTYE1C80LKA1234" }).ok, false);
  assert.equal(validateSavedVehicle({ make: "a", model: "b", vin: "IFTYE1C80LKA12345" }).ok, false);
  assert.equal(validateSavedVehicle({ make: "a", model: "b", vin: "" }).ok, true);
});

test("vehicle display falls back through label, description, then a safe default", () => {
  assert.equal(
    vehicleDisplayName({ label: "Van 3", year: "2019", make: "Ford", model: "Transit", trim: "" }),
    "Van 3",
  );
  assert.equal(
    vehicleDisplayName({ label: "", year: "2019", make: "Ford", model: "Transit", trim: "XL" }),
    "2019 Ford Transit XL",
  );
  assert.equal(
    vehicleDisplayName({ label: "", year: "", make: "", model: "", trim: "" }),
    "Saved vehicle",
  );
  assert.equal(
    vehicleDescription({ year: "", make: "Ford", model: "Transit", trim: "" }),
    "Ford Transit",
  );
});

test("saved vehicles are owner-scoped, capped, and archived rather than deleted", async () => {
  const route = await read("app/api/customer-vehicles/route.ts");

  assert.ok(route.includes("getAccountSession"));
  assert.ok(route.includes('session.role === "customer"'));
  assert.ok(route.includes("isSameOriginRequest"));
  assert.ok(route.includes(`>= MAX_SAVED_VEHICLES`));
  assert.ok(MAX_SAVED_VEHICLES > 0);

  // Every write is scoped by the signed-in owner, so an id alone cannot reach
  // another account's vehicle: the count check, the update, and the archive.
  const ownerScopedWrites = route.match(
    /lower\(\$\{customerVehicles\.customerEmail\}\) = \$\{session\.email\.toLowerCase\(\)\}/g,
  );
  assert.ok(ownerScopedWrites && ownerScopedWrites.length >= 3);
  // Reads go through one helper that is scoped by its email argument, and that
  // argument is only ever the signed-in session's own address.
  assert.match(route, /listVehicles\(email: string\)[\s\S]*customerEmail\}\) = \$\{email\.toLowerCase\(\)\}/);
  assert.ok(!/listVehicles\((?!email|session\.email)/.test(route));

  // Removal archives, so a past job's vehicle record stays truthful.
  assert.match(route, /DELETE[\s\S]*archived: "yes"/);
  assert.ok(!route.includes("db.delete(customerVehicles)"));
});

test("saved vehicles are exported to the customer who owns them", async () => {
  const exportRoute = await read("app/api/privacy-center/export/route.ts");

  assert.ok(exportRoute.includes("FROM customer_vehicles"));
  assert.ok(exportRoute.includes("savedVehicles"));
  // Optional identifiers a customer entered must come back in their export.
  assert.match(exportRoute, /SELECT id, label, year, make, model, trim, color, plate, vin, notes/);
});

test("fleet interest records interest only and never implies a booking", async () => {
  const [route, form, page] = await Promise.all([
    read("app/api/fleet-inquiry/route.ts"),
    read("app/components/fleet-inquiry-form.tsx"),
    read("app/fleet/page.tsx"),
  ]);

  assert.ok(route.includes("isStrictSameOriginWriteRequest"));
  assert.ok(route.includes("consumeFixedWindow"));
  assert.ok(route.includes("isFleetSize"));
  // A resubmission updates details without resetting the owner's triage state.
  assert.match(route, /if \(existing\) \{[\s\S]*update\(fleetInquiries\)/);
  assert.ok(!route.match(/update\(fleetInquiries\)\.set\(\{[^}]*status:/));

  // The form states the limits on the form itself, not only after submitting.
  // Asserted by meaning, not phrasing, so the copy can stay human.
  assert.match(form, /no account, no booking,\s*\n?\s*no charge/);
  assert.match(form, /no promise that a service will be available/);
  assert.ok(!/\bbook now\b/i.test(form));

  // The page must not claim customer requests are open.
  assert.ok(page.includes("not available yet"));
  assert.ok(page.includes("Provider applications are open"));
  assert.ok(page.includes('"@type": "FAQPage"'));
  assert.ok(page.includes("Providers keep 100% of what they quote"));
  // Fleets are never told a provider is a Tuveloz employee.
  assert.ok(page.includes("does not employ, train, assign, or supervise providers"));

  // A phone number may be collected for contact about this request, but a
  // promotional text needs its own affirmative, unchecked opt-in.
  assert.ok(form.includes("PHONE_TRANSACTIONAL_PURPOSE_TEXT_EN"));
  assert.ok(form.includes("SMS_MARKETING_CONSENT_TEXT_EN"));
  assert.match(form, /type="checkbox"[\s\S]*checked=\{smsMarketingConsent\}/);
  // The box is never pre-ticked and never gates submission.
  assert.ok(form.includes("useState(false)"));
  assert.ok(!/required[\s\S]{0,120}smsMarketingConsent/.test(form));
  assert.ok(route.includes("resolvePhoneContactConsent"));
});

test("a phone number is transactional until an explicit opt-in says otherwise", async () => {
  const [consent, store, schema] = await Promise.all([
    read("lib/phone-consent-text.ts"),
    read("lib/phone-contact-consent.ts"),
    read("db/schema.ts"),
  ]);

  // Consent wording and its version are stored, so what someone agreed to is
  // provable later rather than asserted.
  assert.ok(consent.includes("PHONE_CONTACT_CONSENT_VERSION"));
  assert.ok(consent.includes("SMS_MARKETING_CONSENT_TEXT_EN"));
  // Federal express-written-consent wording: automated system, rates, STOP,
  // and that agreeing is not a condition of service.
  for (const required of ["automatic system", "data rates", "STOP", "not a condition"]) {
    assert.ok(
      consent.includes(required),
      `marketing consent text must state "${required}"`,
    );
  }
  // A checked box with no number consents to nothing; an unchecked box leaves
  // a real number transactional-only.
  assert.match(consent, /if \(!phone\) return NO_CONSENT/);
  assert.match(consent, /smsMarketingConsent !== true[\s\S]*NO_CONSENT, phone/);
  // Sending requires a current, unrevoked, recorded consent.
  assert.match(consent, /mayReceiveMarketingSms[\s\S]*!record\.smsMarketingRevokedAt/);

  // One central record answers "may we text this person a promotion?" for
  // every entry point, and recording it can never fail the submission it
  // came from.
  assert.ok(store.includes("recordPhoneContactConsent"));
  assert.match(store, /recordPhoneContactConsent[\s\S]*catch \(error\)[\s\S]*return null/);
  // Re-submitting without ticking the box never silently upgrades a record.
  assert.match(store, /optedInNow[\s\S]*\? \{[\s\S]*smsMarketingRevokedAt: "",[\s\S]*\}[\s\S]*: \{\}/);
  // Opting in again lifts an earlier revocation, because they just asked.
  assert.ok(store.includes("Asking again is a fresh opt-in"));
  // Revocation needs only the token — no sign-in — and keeps the number so
  // transactional contact about a live job still works.
  assert.ok(store.includes("revokeMarketingSmsConsent"));
  assert.ok(!/revokeMarketingSmsConsent[\s\S]{0,400}getAccountSession/.test(store));
  assert.ok(!/revokeMarketingSmsConsent[\s\S]{0,400}phone: ""/.test(store));

  // Every stored contact phone sits beside a consent basis and a revocation
  // field, so a number can never become a marketing list by existing.
  assert.equal(
    schema.includes('text("contact_phone")'),
    schema.includes('text("sms_marketing_consented_at")'),
  );
  assert.ok(schema.includes('text("sms_marketing_revoked_at")'));
});

test("fleet size choices are shared by the form and the server", () => {
  assert.ok(FLEET_SIZE_OPTIONS.length >= 3);
  for (const option of FLEET_SIZE_OPTIONS) {
    assert.equal(isFleetSize(option), true);
  }
  assert.equal(isFleetSize("one van"), false);
  assert.equal(isFleetSize(""), false);
});

test("the owner can see fleet interest without a new dashboard", async () => {
  const adminRoute = await read("app/api/admin/route.ts");
  assert.ok(adminRoute.includes("fleetInquiries"));
  assert.match(adminRoute, /\{ requests: safeRequests[\s\S]*fleet \}/);
});

test("every phone entry point records consent centrally and offers a way out", async () => {
  const [providerRoute, providerForm, fleetRoute, optOut] = await Promise.all([
    read("app/api/providers/route.ts"),
    read("app/components/provider-signup-form.tsx"),
    read("app/api/fleet-inquiry/route.ts"),
    read("app/api/sms-preferences/route.ts"),
  ]);

  // Provider applications already collected a phone number; now the
  // promotional permission for it is recorded rather than assumed.
  assert.ok(providerRoute.includes('role: "provider"'));
  assert.ok(providerRoute.includes("recordPhoneContactConsent"));
  // Consent is recorded after the application's atomic batch, so it can never
  // fail or alter a legal application record.
  assert.match(providerRoute, /await db\.batch\(\[[\s\S]*\] as const\);[\s\S]*recordPhoneContactConsent/);
  assert.ok(providerForm.includes('name="provider-sms-marketing-consent"'));
  assert.ok(providerForm.includes('type="checkbox"'));
  // Bilingual site: the applicant is shown the wording in their own language.
  assert.ok(providerForm.includes("SMS_MARKETING_CONSENT_TEXT_ES"));
  assert.ok(providerForm.includes("PHONE_TRANSACTIONAL_PURPOSE_TEXT_ES"));

  assert.ok(fleetRoute.includes('role: "fleet"'));
  assert.ok(fleetRoute.includes("recordPhoneContactConsent"));

  // Opting out takes no sign-in and answers the same either way, so it cannot
  // be used to test whether a token exists.
  assert.ok(!optOut.includes("getAccountSession"));
  assert.ok(optOut.includes("revokeMarketingSmsConsent"));
  assert.match(optOut, /await revokeMarketingSmsConsent\(token\);[\s\S]*return Response\.json\(\{ ok: true \}/);
});

test("a customer can be reached about their own job without opting into anything", async () => {
  const [form, route, exportRoute, consent] = await Promise.all([
    read("app/page.tsx"),
    read("app/api/requests/route.ts"),
    read("app/api/privacy-center/export/route.ts"),
    read("lib/phone-consent-text.ts"),
  ]);

  // The field is optional and never required to post a job.
  assert.ok(form.includes('name="contact-phone"'));
  assert.ok(!/name="contact-phone"[\s\S]{0,200}required/.test(form));
  // The opt-in appears only once a number is entered, and is never pre-ticked.
  assert.match(form, /contactPhoneEntered && \([\s\S]*name="sms-marketing-consent"/);
  assert.ok(form.includes("useState(false)"));

  // A customer's number reaches the provider they choose, so the notice says
  // so rather than claiming Tuveloz is the only caller.
  assert.ok(form.includes("PHONE_TRANSACTIONAL_PURPOSE_CUSTOMER_TEXT_EN"));
  assert.ok(consent.includes("the provider you choose use this number only"));

  assert.ok(route.includes("normalizeContactPhone(body.contactPhone)"));
  assert.ok(route.includes('role: "customer"'));
  // Consent is recorded only after the request and its agreement records are
  // stored, and cannot roll them back.
  assert.match(route, /throw error;\s*\}[\s\S]*recordPhoneContactConsent/);

  // The number is the customer's own data and comes back in their export.
  assert.ok(exportRoute.includes("contact_phone AS contactPhone"));
});

test("out-of-area interest is open to every state and promises no launch date", async () => {
  const [areas, route, page, form] = await Promise.all([
    read("lib/expansion-areas.ts"),
    read("app/api/expansion-interest/route.ts"),
    read("app/page.tsx"),
    read("app/components/provider-signup-form.tsx"),
  ]);

  // Every state plus DC, not just the two originally accepted.
  assert.ok(areas.includes('"Alaska"') && areas.includes('"Wyoming"'));
  assert.ok(areas.includes('"Washington, DC"'));
  assert.ok(route.includes("isExpansionState"));
  assert.ok(!route.includes("EXPANSION_AREAS"));

  // Montgomery County still routes to the real application instead.
  assert.ok(route.includes("isCurrentLaunchArea"));
  assert.ok(areas.includes("EXPANSION_ALREADY_SERVED_MESSAGE"));

  // No launch-date promise in copy anyone actually sees. "Soon" is a
  // commitment nobody can keep and the outreach rules ban it. Comments are
  // stripped first so the rule may be explained in the source without
  // tripping its own guard.
  const withoutComments = (source) => source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  for (const [name, source] of [["expansion-areas", areas], ["page", page], ["signup form", form]]) {
    assert.ok(
      !/open(ing)?\s+soon|launch(ing)?\s+soon|coming\s+soon\s+to\s+your\s+area/i
        .test(withoutComments(source)),
      `${name} copy must not promise a launch date`,
    );
  }

  // It must say plainly that this is not an application, that no work exists
  // there yet, and that contact is conditional on actually opening.
  assert.match(areas, /(is not|isn't) an\s*"?\s*\+?\s*"?application/);
  assert.match(areas, /cannot send you work yet/);
  assert.match(areas, /If Tuveloz opens where you are/);
  // JSX escapes the apostrophe, so accept either form.
  assert.match(page, /(is not|isn(&apos;|')t) an application/);

  // The signup form points an out-of-area applicant somewhere real rather than
  // leaving them at a dead end.
  assert.match(form, /Working outside Montgomery County, Maryland\?/);
  assert.match(form, /can&apos;t approve an application or send you work/);
  assert.ok(form.includes('href="/#expansion"'));
  // Bilingual site: the note appears in Spanish too.
  assert.match(form, /¿Trabaja fuera del Condado de Montgomery/);

  // Warmth is required, not optional: the copy acknowledges the person rather
  // than only reciting the limit.
  assert.match(areas, /would rather tell you that straight/);
  assert.match(form, /rather tell you now than leave you waiting/);
});

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
  assert.ok(!enrollment.includes('unsubscribedAt: ""') || !/update\(launchUpdateSubscribers\)/.test(enrollment));
  assert.ok(!/update\(launchUpdateSubscribers\)/.test(enrollment));
  assert.match(subscribe, /existing\.unsubscribedAt[\s\S]*update\(launchUpdateSubscribers\)/);

  // An existing record is never overwritten, so the original wording survives.
  assert.match(enrollment, /if \(existing\) \{[\s\S]*return existing\.unsubscribedAt/);

  // Enrolling can never fail the request it came from.
  assert.match(enrollment, /catch \(error\)[\s\S]*return "skipped"/);
  // Nothing is stored without both the wording and its version.
  assert.match(enrollment, /!input\.consentText\.trim\(\) \|\| !input\.consentVersion\.trim\(\)/);
});

test("the arbitration clause keeps every element that makes it hold up", async () => {
  const terms = await read("app/terms/page.tsx");

  // Conspicuous notice before the agreement, not buried at section 13.
  assert.match(terms, /policy-callout[\s\S]*Please read section 13 before you agree/);
  assert.match(terms, /policy-callout[\s\S]*30 days to opt out/);

  // Mutual, not one-sided.
  assert.match(terms, /binds Tuveloz exactly\s*\n?\s*as much as it binds you/);

  // A real opt-out: 30 days, free, no retaliation, and two stated methods
  // that count the same — a form and an email address.
  assert.match(terms, /Arbitration opt-out/);
  assert.match(terms, /<strong>30 days<\/strong>\{" "\}\s*\n?\s*of first accepting these Terms/);
  assert.match(terms, /\/arbitration-opt-out/);
  assert.match(terms, /hello@tuveloz\.com/);
  assert.match(terms, /costs nothing/);
  assert.match(terms, /won&apos;t treat you differently for it/);
  // An opt-out is scoped to the version accepted, and a new version restarts
  // the window rather than silently binding someone who already declined.
  assert.match(terms, /fresh 30 days to decline arbitration\s*\n?\s*under that one/);

  // Carve-outs that keep it from being unconscionable or unlawful.
  assert.match(terms, /small-claims court/);
  assert.match(terms, /Ending Forced Arbitration of Sexual Assault and Sexual\s*\n?\s*Harassment Act/);
  assert.match(terms, /<strong>you choose<\/strong>/);

  // Cost allocation — the consumer never pays more than court would cost.
  assert.match(terms, /Tuveloz pays the AAA/);
  assert.match(terms, /exceed what it would have\s*\n?\s*cost you to file the same claim in court/);
  // The fee promise reaches provider businesses too, not only "consumers".
  assert.match(terms, /whether you are\s*\n?\s*an individual or a provider business/);
  assert.match(terms, /never required to\s+pay Tuveloz&apos;s legal fees/);

  // Hearing in the user's county, not the company's.
  assert.match(terms, /county where you live/);

  // Class waiver with a blowup clause, so it never becomes class arbitration.
  assert.match(terms, /class-action waiver above is found unenforceable[\s\S]*goes to court instead/);
  assert.match(terms, /never\s*\n?\s*arbitrated as a class/);

  // Survives account closure.
  assert.match(terms, /survives after\s*\n?\s*your account closes/);
});
