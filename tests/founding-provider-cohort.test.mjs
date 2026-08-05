import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

const {
  FOUNDING_COHORT_SIZE,
  FOUNDING_SPOTLIGHT_LIMIT,
  isFoundingMember,
  isSpotlightEligible,
  foundingBadgeLabel,
  shouldAssignFoundingRank,
} = await import(new URL("lib/founding-cohort.ts", root).href);

test("founding cohort tiers are the two promised sizes", () => {
  assert.equal(FOUNDING_COHORT_SIZE, 20);
  assert.equal(FOUNDING_SPOTLIGHT_LIMIT, 10);

  assert.equal(isFoundingMember(1), true);
  assert.equal(isFoundingMember(20), true);
  assert.equal(isFoundingMember(21), false);
  // 0 is the "never assigned" sentinel and must never read as membership.
  assert.equal(isFoundingMember(0), false);
  assert.equal(isFoundingMember(-1), false);

  assert.equal(isSpotlightEligible(10), true);
  assert.equal(isSpotlightEligible(11), false);
  assert.equal(isSpotlightEligible(0), false);
});

test("rank is assigned only once, only to real providers, and only while the cohort has room", () => {
  assert.equal(shouldAssignFoundingRank({
    currentRank: 0, assignedCount: 0, isTestProvider: false,
  }), true);

  // The last seat is still a seat.
  assert.equal(shouldAssignFoundingRank({
    currentRank: 0, assignedCount: FOUNDING_COHORT_SIZE - 1, isTestProvider: false,
  }), true);

  // Full cohort. A closed founding account never frees its position.
  assert.equal(shouldAssignFoundingRank({
    currentRank: 0, assignedCount: FOUNDING_COHORT_SIZE, isTestProvider: false,
  }), false);

  // Already ranked — re-verification must not renumber an existing member.
  assert.equal(shouldAssignFoundingRank({
    currentRank: 3, assignedCount: 5, isTestProvider: false,
  }), false);

  assert.equal(shouldAssignFoundingRank({
    currentRank: 0, assignedCount: 0, isTestProvider: true,
  }), false);
});

test("the public badge states tenure, never quality", () => {
  const label = foundingBadgeLabel(1);
  assert.match(label, /joined before launch/i);
  assert.equal(foundingBadgeLabel(0), "");
  assert.equal(foundingBadgeLabel(FOUNDING_COHORT_SIZE + 1), "");

  // Acceptance is not an endorsement. The badge must never imply Tuveloz
  // vouches for the provider's work.
  for (const forbidden of [/verified/i, /trusted/i, /certified/i, /recommend/i, /best/i, /top/i, /approved/i]) {
    assert.doesNotMatch(label, forbidden, `badge must not claim ${forbidden}`);
  }
});

test("founding status never influences what a customer is shown", async () => {
  // Ranking preference, job-routing priority, and territory locks were
  // deliberately refused (brand/outreach/founding-provider-program.md). If a
  // future change adds one, it must not enter through this module. Comments
  // are stripped first: the source documents those refusals in prose, and it
  // is the executable code that must stay free of them.
  const cohortCode = (await read("lib/founding-cohort.ts"))
    .replaceAll(/\/\*[\s\S]*?\*\//g, "")
    .replaceAll(/\/\/.*$/gm, "");
  for (const forbidden of ["priority", "boost", "rankOrder", "sortWeight", "placement"]) {
    assert.equal(
      cohortCode.toLowerCase().includes(forbidden.toLowerCase()),
      false,
      `founding-cohort.ts must not express ${forbidden}`,
    );
  }

  const publicPage = await read("app/founding-providers/page.tsx");
  assert.match(publicPage, /no ranking preference/i);
  assert.match(publicPage, /not an endorsement/i);
  // The fee waiver must stay scoped to the provider membership fee so it can
  // never be read as touching the customer service fee.
  assert.match(publicPage, /provider membership fee only/i);
});

test("the founding program is published before it is promised in outreach", async () => {
  const outreach = await read("brand/outreach/provider-outreach-kit.md");
  // The kit still forbids promising unpublished perks. The public page is what
  // satisfies that rule; if the page is ever removed, this pairing should fail
  // loudly rather than leave outreach free to promise nothing-backed perks.
  assert.match(outreach, /never promise income, job volume, or "founding provider" perks/i);
  await read("app/founding-providers/page.tsx");
  await read("brand/outreach/founding-provider-program.md");
});
