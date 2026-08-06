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
  assert.ok(form.includes("records your interest only"));
  assert.ok(form.includes("does not create an account"));
  assert.ok(!form.includes("book now"));

  // The page must not claim customer requests are open.
  assert.ok(page.includes("not available yet"));
  assert.ok(page.includes("Provider applications are open"));
  assert.ok(page.includes('"@type": "FAQPage"'));
  assert.ok(page.includes("Providers keep 100% of what they quote"));
  // Fleets are never told a provider is a Tuveloz employee.
  assert.ok(page.includes("does not employ, train, assign, or supervise providers"));

  // Fleet contact stays email-only: there is no SMS consent record to rely on.
  assert.ok(!/\bphone\b/i.test(route));
  assert.ok(!/\bphone\b/i.test(form));
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
