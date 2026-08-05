import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  acceptanceGuideFor,
  validateAcceptanceDraft,
  EVIDENCE_AUTHENTICITY_METHOD_VALUES,
} from "../lib/evidence-acceptance-guide.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const TODAY = "2026-08-05";

// A complete, valid acceptance for evidence that carries its own expiration.
const VALID = {
  method: "official_online_lookup",
  verifiedBy: "Owner compliance",
  reference: "MC-LOOKUP-20260805",
  sourceUrl: "https://www.montgomerycountymd.gov/ocp/lookup",
  verifiedAt: "2026-08-05",
  validThrough: "2026-12-31",
  evidenceExpiresAt: "2027-01-15",
  requiresBusinessIdentity: false,
  legalBusinessName: "",
  legalBusinessNameConfirmed: false,
  today: TODAY,
};

test("guidance recommends a method that is always one of the controlled methods", () => {
  const codes = [
    "ocp_vehicle_service_registration",
    "general_liability_coi",
    "provisional_service_competency",
    "epa_section_609_certificate",
    "some_unlisted_requirement",
  ];
  for (const code of codes) {
    const guide = acceptanceGuideFor(code);
    assert.ok(guide.authorityLabel.length > 0, code);
    assert.ok(guide.steps.length > 0, code);
    assert.ok(EVIDENCE_AUTHENTICITY_METHOD_VALUES.includes(guide.recommendedMethod), code);
  }
});

test("a complete, consistent acceptance passes", () => {
  const result = validateAcceptanceDraft(VALID);
  assert.equal(result.ok, true, result.errors.join(" | "));
  assert.equal(result.errors.length, 0);
});

test("an official online lookup must use a government https source", () => {
  const result = validateAcceptanceDraft({ ...VALID, sourceUrl: "https://example.com/lookup" });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((message) => message.includes(".gov")));
});

test("a non-official method still requires a secure https source", () => {
  const result = validateAcceptanceDraft({
    ...VALID,
    method: "insurer_or_broker_confirmation",
    sourceUrl: "http://insurer.example/confirm",
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((message) => message.toLowerCase().includes("https")));
});

test("a future checked date is rejected", () => {
  const result = validateAcceptanceDraft({ ...VALID, verifiedAt: "2026-08-06" });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((message) => message.includes("not in the future")));
});

test("an authenticity check cannot outlast the document's own expiration", () => {
  const result = validateAcceptanceDraft({
    ...VALID,
    validThrough: "2027-02-01",
    evidenceExpiresAt: "2027-01-15",
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((message) => message.includes("after the document")));
});

test("without a document expiration date the check must be within one year", () => {
  const beyond = validateAcceptanceDraft({
    ...VALID,
    method: "issuer_direct_confirmation",
    sourceUrl: "https://issuer.example/confirm",
    verifiedAt: "2026-08-05",
    validThrough: "2027-08-06",
    evidenceExpiresAt: "",
  });
  assert.equal(beyond.ok, false);
  assert.ok(beyond.errors.some((message) => message.includes("within")));

  const withinOneYear = validateAcceptanceDraft({
    ...VALID,
    method: "issuer_direct_confirmation",
    sourceUrl: "https://issuer.example/confirm",
    verifiedAt: "2026-08-05",
    validThrough: "2027-08-05",
    evidenceExpiresAt: "",
  });
  assert.equal(withinOneYear.ok, true, withinOneYear.errors.join(" | "));
});

test("business-identity evidence requires the confirmed legal business name", () => {
  const missing = validateAcceptanceDraft({ ...VALID, requiresBusinessIdentity: true });
  assert.equal(missing.ok, false);
  assert.ok(missing.errors.some((message) => message.includes("legal business name")));

  const confirmed = validateAcceptanceDraft({
    ...VALID,
    requiresBusinessIdentity: true,
    legalBusinessName: "Example Mobile Service LLC",
    legalBusinessNameConfirmed: true,
  });
  assert.equal(confirmed.ok, true, confirmed.errors.join(" | "));
});

test("a short verifier or reference is caught", () => {
  const result = validateAcceptanceDraft({ ...VALID, verifiedBy: "x", reference: "short" });
  assert.equal(result.ok, false);
  assert.ok(result.errors.length >= 2);
});

test("the acceptance form validates before submit and does not weaken the server", async () => {
  const page = await read("app/admin/provider-compliance/page.tsx");
  // Client-side pre-check runs only for acceptances and blocks a bad submit.
  assert.match(page, /if \(status === "accepted"\) \{[\s\S]*validateAcceptanceDraft\(/);
  assert.match(page, /if \(!check\.ok\) \{[\s\S]*setCheckError/);
  // The server action still receives the same authenticity fields for the real
  // decision — the client only guides, it does not replace the server guard.
  assert.match(page, /action: "review-evidence"/);
  assert.match(page, /authenticityVerificationMethod: values\.authenticityVerificationMethod/);
});
