import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { compareBusinessNames, normalizeBusinessName } from "../lib/business-name-match.ts";
import { prescreenEvidence } from "../lib/evidence-review-assistant.ts";

test("the same business written differently normalizes to one key", () => {
  const key = normalizeBusinessName("Willy's Auto Repair, L.L.C.");
  assert.equal(key, "willys auto repair");
  for (const variant of [
    "WILLYS AUTO REPAIR LLC",
    "Willys  Auto   Repair",
    "Willy's Auto Repair Inc.",
    "Willy's Auto Repair Co",
  ]) {
    assert.equal(normalizeBusinessName(variant), key, `${variant} did not normalize to ${key}`);
  }

  // Accents and ampersands are written more than one way and mean one thing.
  assert.equal(normalizeBusinessName("José's Garage"), normalizeBusinessName("Joses Garage"));
  assert.equal(normalizeBusinessName("B & B Motors"), normalizeBusinessName("B and B Motors"));
});

test("a name that is only an entity form does not normalize to nothing", () => {
  // Returning "" here would make every such name match every other one.
  assert.equal(normalizeBusinessName("LLC"), "llc");
  assert.notEqual(normalizeBusinessName("LLC"), normalizeBusinessName("Inc"));
});

test("comparison separates a typo from a different business", () => {
  assert.equal(
    compareBusinessNames("Willy's Auto Repair, L.L.C.", "WILLYS AUTO REPAIR LLC").comparison,
    "equivalent",
  );
  assert.equal(
    compareBusinessNames("Willy's Auto Repair LLC", "Willy's Auto").comparison,
    "contained",
  );
  assert.equal(
    compareBusinessNames("Willy's Auto", "Sunrise Motors").comparison,
    "different",
  );
  // "identical" means the same string apart from case and outer space. An
  // apostrophe difference is a real difference the owner should fix, so it is
  // "equivalent" and asks for review rather than passing silently.
  assert.equal(compareBusinessNames("Willy's Auto", "willy's auto").comparison, "identical");
  assert.equal(compareBusinessNames("Willy's Auto", "willys auto").comparison, "equivalent");
  assert.equal(compareBusinessNames("", "Willy's Auto").comparison, "incomparable");
});

test("only a genuine disagreement asks for review", () => {
  assert.equal(compareBusinessNames("Willy's Auto", "willy's auto").needsReview, false);
  assert.equal(compareBusinessNames("", "Willy's Auto").needsReview, false);
  for (const [left, right] of [
    ["Willy's Auto Repair, L.L.C.", "WILLYS AUTO REPAIR LLC"],
    ["Willy's Auto Repair LLC", "Willy's Auto"],
    ["Willy's Auto", "Sunrise Motors"],
  ]) {
    assert.equal(compareBusinessNames(left, right).needsReview, true);
  }
});

const CLEAN = {
  submissionStatus: "pending",
  matchesCurrentApplication: true,
  requiresExpiration: false,
  hasExpirationDate: true,
  isExpired: false,
  hasPrivateFile: true,
  scanStatus: "clean",
};

test("the name check is advisory: it never changes the recommendation", () => {
  const withMismatch = prescreenEvidence({
    ...CLEAN,
    profileBusinessName: "Willy's Auto",
    verifiedLegalBusinessName: "Sunrise Motors",
  });
  // Still ready for the owner's check — a name question is for a human to
  // resolve, not grounds for the machine to block or reject.
  assert.equal(withMismatch.recommendation, "ready_for_authenticity_check");
  assert.equal(withMismatch.readyForOwnerAuthenticityCheck, true);
  assert.equal(withMismatch.autoDispatch, null);
  assert.ok(withMismatch.nameCheck);
  assert.equal(withMismatch.nameCheck.comparison, "different");
});

test("matching names and missing names both produce no flag", () => {
  assert.equal(
    prescreenEvidence({
      ...CLEAN,
      profileBusinessName: "Willy's Auto",
      verifiedLegalBusinessName: "willy's auto",
    }).nameCheck,
    null,
  );
  // Most evidence types carry no business identity at all.
  assert.equal(prescreenEvidence(CLEAN).nameCheck, null);
  assert.equal(
    prescreenEvidence({ ...CLEAN, profileBusinessName: "Willy's Auto" }).nameCheck,
    null,
  );
});

test("authority links are shortcuts, never pre-filled as the verification source", async () => {
  const guide = await readFile(new URL("../lib/evidence-acceptance-guide.ts", import.meta.url), "utf8");
  const adminPage = await readFile(new URL("../app/admin/provider-compliance/page.tsx", import.meta.url), "utf8");

  // Every authority URL is https, and the official-lookup ones are .gov,
  // matching the rule the acceptance form enforces on the source URL.
  const urls = [...guide.matchAll(/authorityUrl: "([^"]+)"/g)].map((match) => match[1]);
  assert.ok(urls.length > 0);
  for (const url of urls) {
    assert.equal(new URL(url).protocol, "https:", `${url} is not https`);
    assert.ok(new URL(url).hostname.endsWith(".gov"), `${url} is not a .gov host`);
  }

  // The source-URL field records where a specific document was confirmed, so
  // it must never be defaulted to a program landing page.
  assert.doesNotMatch(adminPage, /name="authenticitySourceUrl"[\s\S]{0,200}guide\.authorityUrl/);
  assert.doesNotMatch(adminPage, /defaultValue=\{guide\.authorityUrl/);
  // The link is presented as a shortcut, not as a result.
  assert.match(adminPage, /not a result/);
});
