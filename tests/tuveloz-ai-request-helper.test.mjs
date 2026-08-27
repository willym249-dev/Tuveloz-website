import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  containsRestrictedPersonalData,
  parseRequestDraft,
} from "../lib/ai/request-draft-contract.ts";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const VALID_DRAFT = {
  plainLanguageSummary: "The steering wheel shakes during highway braking.",
  suggestedServiceCategory: "Brake inspection",
  suggestedRequestScope: "Have a professional inspect the front brakes; rotors may need attention.",
  clarifyingQuestions: ["Does the shake happen at low speeds too?"],
  safetyLevel: "do_not_drive_until_inspected",
  safetyMessage: "Braking symptoms deserve an inspection before more highway driving.",
  partsReminder: "Tuveloz does not sell parts; note OEM or aftermarket only as a preference.",
  limitations: [
    "This draft is not a diagnosis.",
    "The customer must review and confirm every field.",
  ],
};

test("the personal-data screen refuses emails, card runs, SSNs, and VINs", () => {
  assert.equal(containsRestrictedPersonalData("brakes shake at highway speed"), false);
  assert.equal(containsRestrictedPersonalData("reach me at sam@example.com"), true);
  assert.equal(containsRestrictedPersonalData("card 4242 4242 4242 4242"), true);
  assert.equal(containsRestrictedPersonalData("ssn 123-45-6789"), true);
  assert.equal(containsRestrictedPersonalData("vin 1FTYE1C80LKA12345"), true);
});

test("draft parsing enforces the declared shape and nothing else survives", () => {
  const parsed = parseRequestDraft(JSON.stringify({ ...VALID_DRAFT, extraField: "dropped" }));
  assert.ok(parsed);
  assert.equal(parsed.safetyLevel, "do_not_drive_until_inspected");
  assert.equal("extraField" in parsed, false);

  // A fenced answer still parses — the contract is enforced here, not trusted.
  assert.ok(parseRequestDraft("```json\n" + JSON.stringify(VALID_DRAFT) + "\n```"));

  // Missing fields, a bad safety level, or too few limitations are rejected.
  assert.equal(parseRequestDraft(JSON.stringify({ ...VALID_DRAFT, safetyLevel: "all_clear" })), null);
  assert.equal(parseRequestDraft(JSON.stringify({ ...VALID_DRAFT, limitations: ["only one"] })), null);
  assert.equal(parseRequestDraft(JSON.stringify({ ...VALID_DRAFT, plainLanguageSummary: "" })), null);
  assert.equal(parseRequestDraft("not json at all"), null);
});

test("the draft engine is non-diagnostic and rides the shared council", async () => {
  const engine = await source("lib/ai/request-draft.ts");
  const contract = await source("lib/ai/request-draft-contract.ts");

  // One AI stack: the helper reuses the council runtime, so there is no
  // second, bespoke provider client to key, cache, or audit.
  assert.match(engine, /from "\.\.\/ai-council-runtime"/);
  assert.match(engine, /askCouncil\(/);
  assert.match(engine, /councilConfigured\(\)/);
  assert.doesNotMatch(engine, /api\.openai\.com/);
  assert.doesNotMatch(contract, /api\.openai\.com/);

  assert.match(contract, /Do not diagnose the vehicle/);
  assert.match(contract, /Do not add a provider-supplied parts charge/);
  assert.match(contract, /The customer must review and confirm every field/);
  assert.doesNotMatch(engine + contract, /sk-[A-Za-z0-9_-]{10,}/);
});

test("the owner route cannot perform marketplace actions", async () => {
  const [route, page] = await Promise.all([
    source("app/api/admin/test-lab/ai-request-draft/route.ts"),
    source("app/admin/test-lab/ai/page.tsx"),
  ]);

  assert.match(route, /isVerifiedOwnerRequest/);
  assert.match(route, /isSameOriginRequest/);
  assert.match(route, /containsRestrictedPersonalData/);
  assert.match(route, /databaseWrites: false/);
  assert.match(route, /jobSubmission: false/);
  assert.match(route, /providerContact: false/);
  assert.match(route, /payments: false/);
  assert.match(route, /repairDiagnosis: false/);
  assert.match(route, /ownerReviewRequired: true/);
  assert.match(route, /submittedAnywhere: false/);
  assert.doesNotMatch(route, /getDb\(/);
  assert.doesNotMatch(route, /stripe/i);

  assert.match(page, /OWNER-ONLY AI TESTING/);
  assert.match(page, /cannot diagnose the vehicle/);
  assert.match(page, /AI-GENERATED DRAFT — OWNER REVIEW REQUIRED/);
  assert.match(page, /No result is saved or submitted to the marketplace/);
  assert.doesNotMatch(page, /api\/requests/);
  assert.doesNotMatch(page, /api\/stripe/);
});

test("the helper is reachable from the Test Lab and gated on provider keys, not a new flag", async () => {
  const lab = await source("app/admin/test-lab/page.tsx");
  assert.match(lab, /href="\/admin\/test-lab\/ai"/);
  assert.match(lab, /Tuveloz AI Test/);

  // Fail-closed follows the live assistant's convention: with no provider key
  // stored, requestDraftingEnabled() is false and the route answers 503.
  const engine = await source("lib/ai/request-draft.ts");
  assert.match(engine, /RequestDraftConfigurationError/);
  const route = await source("app/api/admin/test-lab/ai-request-draft/route.ts");
  assert.match(route, /AI_NOT_CONFIGURED/);
});
