import assert from "node:assert/strict";
import test from "node:test";
import { countyRegistrationInput, countyRegistrationRequirement, lookupCountyRegistration } from "../lib/county-registration.ts";
import { insuranceRequirement, parseInsuranceConfirmation, insuranceConfirmationError } from "../lib/insurance-confirmation.ts";

const now = Date.parse("2026-09-08T22:00:00Z");
const input = { registrationNumber: "26-MT-123456", expectedLegalName: "EXAMPLE REPAIR LLC" };
const row = { registration_no: input.registrationNumber, corporation_name: input.expectedLegalName,
  trade_name: "Example Repair", issue_date: "2026-01-01T00:00:00", expire_date: "2027-01-01T00:00:00" };
const metadata = { id: "dngn-wp3e", rowsUpdatedAt: (now - 86400000) / 1000 };
function fake(rows = [row], meta = metadata, inspect = () => {}) {
  return async (url, options) => {
    inspect(new URL(url), options);
    return Response.json(String(url).includes("/api/views/") ? meta : rows);
  };
}
async function lookup(rows, meta, overrides = {}) {
  const result = await lookupCountyRegistration(input, { now, fetcher: fake(rows, meta), ...overrides });
  assert.equal(result.requiresIssuerConfirmation, true);
  assert.equal("approved" in result, false);
  return result;
}

test("county lookup sends only the allowlisted registration number to fixed official origins", async () => {
  const urls = [];
  const result = await lookup(undefined, undefined, { fetcher: fake(undefined, undefined, (url, options) => {
    urls.push(url);
    assert.equal(url.origin, "https://data.montgomerycountymd.gov");
    assert.equal(options.redirect, "error");
    assert.equal(options.cache, "no-store");
    assert.ok(options.signal);
    assert.ok(!url.toString().includes("EXAMPLE"));
  }) });
  assert.equal(urls.length, 2);
  assert.equal(urls[1].searchParams.get("$where"), "upper(registration_no)='26-MT-123456'");
  assert.equal(result.status, "record_match");
  assert.equal(result.records[0].legalName, input.expectedLegalName);
  assert.match(result.message, /standing.*services/);
});

test("query injection, URLs, controls and oversized inputs are rejected before fetching", async () => {
  for (const number of ["x' OR 1=1", "https://attacker.invalid", "A\nB", "x".repeat(41), ""]) {
    assert.equal(countyRegistrationInput(number, input.expectedLegalName), null);
    await assert.rejects(() => lookupCountyRegistration({ ...input, registrationNumber: number }, {
      fetcher: () => { assert.fail("must not fetch invalid input"); },
    }));
  }
  assert.equal(countyRegistrationInput(input.registrationNumber, "x".repeat(181)), null);
  assert.equal(countyRegistrationRequirement("general_liability_coi"), false);
});

for (const [name, rows, status] of [
  ["not found", [], "not_found"],
  ["expired record", [{ ...row, expire_date: "2026-09-07T00:00:00" }], "expired"],
  ["legal name mismatch", [{ ...row, corporation_name: "ANOTHER BUSINESS LLC" }], "name_mismatch"],
  ["trade name alone cannot match", [{ ...row, corporation_name: "OTHER LLC", trade_name: input.expectedLegalName }], "name_mismatch"],
  ["LLC suffix must not be dropped", [{ ...row, corporation_name: "EXAMPLE REPAIR INC" }], "name_mismatch"],
  ["duplicates require review", [row, row], "ambiguous"],
  ["wrong registration cannot match", [{ ...row, registration_no: "26-MT-999999" }], "unavailable"],
  ["missing expiration", [{ ...row, expire_date: undefined }], "unavailable"],
  ["invalid date", [{ ...row, expire_date: "2027-02-31T00:00:00" }], "unavailable"],
  ["future issue date", [{ ...row, issue_date: "2026-10-01T00:00:00" }], "unavailable"],
  ["unexpected schema", { results: [row] }, "unavailable"],
]) test(`county lookup: ${name}`, async () => assert.equal((await lookup(rows)).status, status));

test("an expiration remains current through the Maryland calendar day", async () => {
  const result = await lookup([{ ...row, expire_date: "2026-09-08T00:00:00" }], metadata, { now: Date.parse("2026-09-09T03:59:59Z") });
  assert.equal(result.status, "record_match");
  assert.equal((await lookup([{ ...row, expire_date: "2026-09-08T00:00:00" }], metadata, { now: Date.parse("2026-09-09T04:00:00Z") })).status, "expired");
});

test("missing, stale or future source timestamps never establish a current match", async () => {
  for (const rowsUpdatedAt of [undefined, "2026-09-08", (now + 1000) / 1000, (now - 15 * 86400000) / 1000]) {
    assert.equal((await lookup([row], { ...metadata, rowsUpdatedAt })).status, "stale_source");
  }
  assert.equal((await lookup([row], { ...metadata, id: "wrong-source" })).status, "unavailable");
});

test("network failure, throttling, HTML, oversized and broken JSON fail closed", async () => {
  for (const fetcher of [
    async () => { throw new Error("network down"); },
    async () => new Response("busy", { status: 429 }),
    async () => new Response("<html>sign in</html>", { headers: { "content-type": "text/html" } }),
    async () => new Response("{"),
    async () => Response.json({ oversized: "x".repeat(513000) }),
  ]) assert.equal((await lookup(undefined, undefined, { fetcher })).status, "unavailable");
});

const confirmation = { organization: "SYNTHETIC INSURER", contact: "https://insurer.example.invalid/contact",
  independentlySourced: true, insuredAndPolicyConfirmed: true, datesAndLimitsConfirmed: true, serviceAndLocationConfirmed: true };
test("insurance cannot use a registry or scan in place of insurer confirmation", () => {
  assert.equal(insuranceRequirement("general_liability_coi"), true);
  assert.equal(insuranceRequirement("ocp_vehicle_service_registration"), false);
  for (const method of ["official_online_lookup", "issuer_direct_confirmation", "approved_verification_vendor", ""]) {
    assert.match(insuranceConfirmationError(method, confirmation), /Insurance requires/);
  }
  assert.equal(insuranceConfirmationError("insurer_or_broker_confirmation", confirmation), "");
});
test("each insurance confirmation detail is required and string booleans do not count", () => {
  for (const key of Object.keys(confirmation)) {
    const missing = parseInsuranceConfirmation({ ...confirmation, [key]: typeof confirmation[key] === "boolean" ? "true" : "" });
    assert.match(insuranceConfirmationError("insurer_or_broker_confirmation", missing), /Record the insurer/);
  }
});
