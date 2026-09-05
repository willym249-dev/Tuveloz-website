import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

// Execute the real binding function. Database/vendor operations are unavailable
// in this focused contract test, so an accidental call fails immediately.
const unavailable = "() => { throw new Error('Unexpected external operation'); }";
const stub = `data:text/javascript,${encodeURIComponent([
  ...["and", "asc", "desc", "eq", "lte", "ne", "getDb", "getStripeIdentityClient",
    "immutablePerformingPersonName", "verifiedDobIsAdult", "verifiedIdentityNameMatches",
    "stripeIdentityModeMatchesProvider", "supersededIdentityCleanupBatchLimit",
    "supersededIdentityCleanupScanLimit"].map(name => `export const ${name} = ${unavailable};`),
  ...["providerApplications", "providerApplicationSubmissionEvidence", "providerIdentityVerificationSessions",
    "providerPathwayProfiles", "providerPersonnel"].map(name => `export const ${name} = {};`),
  'export const getStripeIdentityVerificationFlowId = () => "vf_fixture";',
].join("\n"))}`;
const source = stripTypeScriptTypes(await readFile(new URL("../lib/stripe-identity-verification.ts", import.meta.url), "utf8"))
  .replace(/from "[^"]+"/g, `from ${JSON.stringify(stub)}`);
const { stripeIdentitySessionBindingMatches: matches } = await import(`data:text/javascript,${encodeURIComponent(source)}`);

const row = {
  id: "attempt_fixture", stripeVerificationSessionId: "vs_fixture", livemode: 0,
  providerId: "provider_fixture", personId: "person_fixture",
  applicationSubmissionEvidenceId: "evidence_fixture", personNameSourceType: "application_evidence",
  personNameSourceId: "evidence_fixture",
};
const session = () => ({
  id: row.stripeVerificationSessionId, livemode: false, type: "document", client_reference_id: row.id,
  // Shape observed from Stripe's test API on 2026-09-04. No personal outputs,
  // client secret, verification URL or real account/session IDs are fixtures.
  options: { document: {
    allowed_types: ["driving_license", "id_card", "passport"], require_id_number: false,
    require_live_capture: true, require_matching_selfie: true,
  } },
  metadata: {
    tuveloz_provider_id: row.providerId, tuveloz_person_id: row.personId,
    tuveloz_application_evidence_id: row.applicationSubmissionEvidenceId,
    tuveloz_person_name_source_type: row.personNameSourceType,
    tuveloz_person_name_source_id: row.personNameSourceId, tuveloz_binding_version: "3",
  },
});

test("explicit document sessions match the actual Stripe API contract", () => {
  assert.equal(matches(row, session()), true);
});

test("a reusable flow with absent options cannot prove the required checks", () => {
  assert.equal(matches(row, { ...session(), type: "verification_flow", verification_flow: "vf_fixture", options: null }), false);
  assert.equal(matches(row, { ...session(), type: "verification_flow", verification_flow: "vf_fixture" }), false);
  assert.equal(matches(row, { ...session(), verification_flow: "vf_fixture" }), false);
});

test("missing, weakened, or expanded checks fail closed", () => {
  for (const mutate of [
    s => { s.options = null; },
    s => { delete s.options.document; },
    s => { s.options.document.require_live_capture = false; },
    s => { delete s.options.document.require_matching_selfie; },
    s => { s.options.document.require_id_number = true; },
    s => { s.options.document.allowed_types.pop(); },
    s => { s.options.document.allowed_types.push("other"); },
    s => { s.options.id_number = {}; },
    s => { s.options.email = { require_verification: true }; },
    s => { s.options.phone = { require_verification: true }; },
  ]) {
    const candidate = session(); mutate(candidate);
    assert.equal(matches(row, candidate), false, String(mutate));
  }
});

test("every immutable session and applicant binding must match", () => {
  for (const key of ["id", "client_reference_id", "type"]) {
    assert.equal(matches(row, { ...session(), [key]: "different" }), false, key);
  }
  assert.equal(matches(row, { ...session(), livemode: true }), false);
  for (const key of Object.keys(session().metadata).filter(key => key !== "tuveloz_binding_version")) {
    const candidate = session(); candidate.metadata[key] = "different";
    assert.equal(matches(row, candidate), false, key);
    delete candidate.metadata[key];
    assert.equal(matches(row, candidate), false, `missing ${key}`);
  }
});
