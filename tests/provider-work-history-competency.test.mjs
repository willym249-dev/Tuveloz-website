import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  assessCompetency,
  COMPETENCY_ROUTES,
  competencyRoute,
  MINIMUM_VERIFIABLE_POINTS,
  REQUIRED_POINTS_BY_LEVEL,
  REQUIRED_YEARS_BY_LEVEL,
  workHistoryNeedsAudit,
} from "../lib/provider-competency-points.ts";
import {
  categoriesForService,
  entryMonths,
  WORK_HISTORY_SERVICE_CATEGORIES,
  normalizeWorkHistoryEntry,
  WORK_HISTORY_ATTESTATION_TEXT,
  WORK_HISTORY_ATTESTATION_TEXT_ES,
  WorkHistoryValidationError,
  yearsForService,
} from "../lib/provider-work-history.ts";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

const verified = (route) => ({ route, verified: true });

function assess(overrides = {}) {
  return assessCompetency({
    serviceCode: "battery_replacement",
    providerLevel: "standard_provider",
    claims: [],
    statedYearsForService: 5,
    workHistorySigned: true,
    ...overrides,
  });
}

test("a signed work history alone can never clear a real tier", () => {
  const result = assess({
    providerLevel: "provisional_independent",
    claims: [verified("work_history_attestation")],
  });
  assert.equal(result.totalPoints, 2);
  assert.equal(result.verifiablePoints, 0);
  assert.equal(result.acceptable, false);
  assert.equal(result.selfAttestedOnly, true);
  assert.ok(result.shortfalls.some((reason) => reason.includes("other than the applicant")));
});

test("self-attested-only never reaches the verifiable floor at any tier", () => {
  const selfAttested = COMPETENCY_ROUTES.filter((route) => route.selfAttested);
  const total = selfAttested.reduce((sum, route) => sum + route.points, 0);
  assert.ok(
    total < Math.max(...Object.values(REQUIRED_POINTS_BY_LEVEL)),
    "self-attested routes must not sum to any tier threshold",
  );
  const result = assess({
    claims: selfAttested.map((route) => verified(route.code)),
  });
  assert.ok(result.verifiablePoints < MINIMUM_VERIFIABLE_POINTS);
  assert.equal(result.acceptable, false);
});

test("work history plus a confirmed reference clears the entry tier", () => {
  const result = assess({
    providerLevel: "provisional_independent",
    statedYearsForService: 0,
    claims: [verified("work_history_attestation"), verified("customer_references")],
  });
  assert.equal(result.totalPoints, 5);
  assert.equal(result.verifiablePoints, 3);
  assert.equal(result.acceptable, true);
  assert.deepEqual(result.shortfalls, []);
});

test("unverified claims earn nothing until a reviewer confirms them", () => {
  const pending = assess({
    claims: [
      { route: "customer_references", verified: false },
      { route: "parts_house_commercial_account", verified: false },
    ],
  });
  assert.equal(pending.totalPoints, 0);
  assert.equal(pending.acceptable, false);
});

test("the same route claimed twice is only counted once", () => {
  const result = assess({
    claims: [verified("customer_references"), verified("customer_references")],
  });
  assert.equal(result.totalPoints, competencyRoute("customer_references").points);
});

test("unknown stored route codes are ignored, never thrown on", () => {
  const result = assess({
    claims: [verified("retired_route_from_an_old_release"), verified("customer_references")],
  });
  assert.equal(result.totalPoints, 3);
});

test("stated years gate the standard tier but not the provisional on-ramp", () => {
  assert.equal(REQUIRED_YEARS_BY_LEVEL.provisional_independent, 0);
  assert.ok(REQUIRED_YEARS_BY_LEVEL.standard_provider >= 2);

  const tooNew = assess({
    statedYearsForService: 1,
    claims: [verified("customer_references"), verified("parts_house_commercial_account")],
  });
  assert.equal(tooNew.acceptable, false);
  assert.ok(tooNew.shortfalls.some((reason) => reason.includes("year(s) of this kind of work")));

  const experienced = assess({
    statedYearsForService: 2,
    claims: [verified("customer_references"), verified("parts_house_commercial_account")],
  });
  assert.equal(experienced.acceptable, true);
});

test("competency cannot be accepted without a signed work history", () => {
  const result = assess({
    workHistorySigned: false,
    claims: [verified("customer_references"), verified("parts_house_commercial_account")],
  });
  assert.equal(result.acceptable, false);
  assert.ok(result.shortfalls.some((reason) => reason.includes("signed work history")));
});

test("audit selection is deterministic so nobody can reroll out of a spot-check", () => {
  const ids = Array.from({ length: 400 }, (_, index) => `provider-${index}`);
  const first = ids.map((id) => workHistoryNeedsAudit(id));
  const second = ids.map((id) => workHistoryNeedsAudit(id));
  assert.deepEqual(first, second);

  const selected = first.filter(Boolean).length;
  assert.ok(selected > 0 && selected < ids.length, "audit must select some but not all");
  assert.equal(workHistoryNeedsAudit("anyone", 0), false);
  assert.equal(workHistoryNeedsAudit("anyone", 1), true);
});

test("overlapping work history counts calendar time, not summed jobs", () => {
  const now = new Date("2026-08-15T00:00:00Z");
  const moonlighting = [
    {
      serviceCategory: "repair",
      startMonth: "2024-01",
      endMonth: "2024-12",
      stillWorkingHere: false,
    },
    {
      serviceCategory: "repair",
      startMonth: "2024-03",
      endMonth: "2024-10",
      stillWorkingHere: false,
    },
  ];
  assert.equal(yearsForService(moonlighting, "battery_replacement", now), 1);

  const backToBack = [
    {
      serviceCategory: "repair",
      startMonth: "2023-01",
      endMonth: "2023-12",
      stillWorkingHere: false,
    },
    {
      serviceCategory: "repair",
      startMonth: "2024-01",
      endMonth: "2024-12",
      stillWorkingHere: false,
    },
  ];
  assert.equal(yearsForService(backToBack, "battery_replacement", now), 2);
});

test("experience only counts toward services its category actually backs", () => {
  const now = new Date("2026-08-15T00:00:00Z");
  const roadsideOnly = [
    {
      serviceCategory: "roadside",
      startMonth: "2016-01",
      endMonth: "2026-01",
      stillWorkingHere: false,
    },
  ];
  assert.ok(yearsForService(roadsideOnly, "provisional_12v_jump_start", now) >= 10);
  assert.equal(yearsForService(roadsideOnly, "window_tint_installation", now), 0);
});

test("an open-ended entry counts through today and both ends are inclusive", () => {
  const now = new Date("2026-08-15T00:00:00Z");
  assert.equal(
    entryMonths({ startMonth: "2026-08", endMonth: "2026-08", stillWorkingHere: false }),
    1,
  );
  assert.equal(
    entryMonths({ startMonth: "2026-06", endMonth: "", stillWorkingHere: true }, now),
    3,
  );
});

test("every catalog service maps to at least one work-history category", async () => {
  // Read the catalog from the policy config rather than importing the policy
  // module, which pulls JSON through an import attribute node's test loader
  // does not supply.
  const matrix = JSON.parse(await read("config/provider-eligibility-matrix.json"));
  const serviceCodes = Object.keys(matrix.services);
  assert.ok(serviceCodes.length > 0);
  for (const code of serviceCodes) {
    assert.ok(
      WORK_HISTORY_SERVICE_CATEGORIES[code]?.length > 0,
      `${code} has no work-history category`,
    );
  }
  // And nothing lingers here that the catalog dropped.
  for (const code of Object.keys(WORK_HISTORY_SERVICE_CATEGORIES)) {
    assert.ok(serviceCodes.includes(code), `${code} is not a catalog service`);
    assert.deepEqual(
      categoriesForService(code),
      WORK_HISTORY_SERVICE_CATEGORIES[code],
      `${code} lookup disagrees with the map`,
    );
  }
});

test("work history rejects only what makes an entry unusable", () => {
  const now = new Date("2026-08-15T00:00:00Z");
  const valid = normalizeWorkHistoryEntry({
    employerName: "  Ruiz Mobile Repair  ",
    selfEmployed: false,
    startMonth: "2020-04",
    endMonth: "2024-06",
    stillWorkingHere: false,
    serviceCategory: "repair",
    workPerformed: "Brakes and batteries",
    referenceName: "Ana Ruiz",
    referencePhone: "(301) 555-0100",
    referenceContactConsent: true,
  }, now);
  assert.equal(valid.employerName, "Ruiz Mobile Repair");
  assert.equal(valid.referenceContactConsent, true);

  // Self-employed with no shop name is normal, not an error.
  const solo = normalizeWorkHistoryEntry({
    selfEmployed: true,
    startMonth: "2019-01",
    stillWorkingHere: true,
    serviceCategory: "roadside",
  }, now);
  assert.equal(solo.employerName, "Self-employed");
  assert.equal(solo.endMonth, "");

  // Consent with nobody to contact is meaningless and is dropped.
  const noReference = normalizeWorkHistoryEntry({
    selfEmployed: true,
    startMonth: "2019-01",
    stillWorkingHere: true,
    serviceCategory: "roadside",
    referenceContactConsent: true,
  }, now);
  assert.equal(noReference.referenceContactConsent, false);

  for (const bad of [
    { selfEmployed: true, startMonth: "2020-13", stillWorkingHere: true, serviceCategory: "repair" },
    { selfEmployed: true, startMonth: "2030-01", stillWorkingHere: true, serviceCategory: "repair" },
    { selfEmployed: true, startMonth: "2024-06", endMonth: "2024-01", stillWorkingHere: false, serviceCategory: "repair" },
    { selfEmployed: true, startMonth: "2020-01", stillWorkingHere: true, serviceCategory: "not_a_category" },
    { startMonth: "2020-01", stillWorkingHere: true, serviceCategory: "repair" },
  ]) {
    assert.throws(() => normalizeWorkHistoryEntry(bad, now), WorkHistoryValidationError);
  }
});

test("every work-history validation error carries Spanish", () => {
  try {
    normalizeWorkHistoryEntry({ selfEmployed: true, startMonth: "", serviceCategory: "repair" });
    assert.fail("expected a validation error");
  } catch (error) {
    assert.ok(error instanceof WorkHistoryValidationError);
    assert.ok(error.messageEs.length > 0);
    assert.notEqual(error.messageEs, error.message);
  }
});

test("the attestation names the consequence in both languages and stays plain", () => {
  assert.match(WORK_HISTORY_ATTESTATION_TEXT, /account is closed/);
  assert.match(WORK_HISTORY_ATTESTATION_TEXT_ES, /se cierra mi cuenta/);
  // Legal-weight phrasing belongs in the Provider Agreement, not on the form.
  assert.doesNotMatch(WORK_HISTORY_ATTESTATION_TEXT, /penalty of perjury|indemnif|warrant/i);
  assert.ok(WORK_HISTORY_ATTESTATION_TEXT.length < 260);
});

test("the feature is never called a resume, which would imply employment", async () => {
  for (const path of [
    "lib/provider-work-history.ts",
    "lib/provider-competency-points.ts",
    "db/schema.ts",
  ]) {
    const source = await read(path);
    // The word appears only where the modules explain why it is not used.
    const offending = source
      .split("\n")
      // Prose explaining why the word is avoided is fine; identifiers, column
      // names, and user-facing strings are not.
      .filter((line) => !/^\s*(\*|\/\/|\/\*)/.test(line))
      .filter((line) => /\bresum(e|es|é)\b|\bcurriculum vitae\b|\bCV\b/i.test(line));
    assert.deepEqual(offending, [], `resume wording leaked into ${path}`);
  }
});

test("the points model stays outside the eligibility engine", async () => {
  const engine = await read("lib/provider-eligibility-engine.ts");
  assert.doesNotMatch(
    engine,
    /provider-competency-points|provider-work-history/,
    "scoring must not be imported into the engine that authorizes jobs",
  );
  // The engine's own contract is untouched by this feature.
  assert.match(engine, /export const ELIGIBILITY_RULES_VERSION = "0\.14\.1"/);
});
