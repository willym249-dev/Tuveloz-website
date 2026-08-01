import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  PROVIDER_ARRIVAL_CONFIRMATION_MAX_SKEW_MS,
  providerArrivalConfirmationIsFresh,
} from "../lib/provider-arrival-confirmation.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("arrival confirmation freshness rejects absent, stale, future, and mismatched times", () => {
  const now = Date.parse("2026-08-01T16:05:00.000Z");
  const confirmedAt = "2026-08-01T16:04:00.000Z";
  const decidedAt = "2026-08-01T16:04:01.000Z";

  assert.equal(
    providerArrivalConfirmationIsFresh(confirmedAt, confirmedAt, decidedAt, now),
    true,
  );
  assert.equal(
    providerArrivalConfirmationIsFresh(
      new Date(now - PROVIDER_ARRIVAL_CONFIRMATION_MAX_SKEW_MS - 1).toISOString(),
      confirmedAt,
      decidedAt,
      now,
    ),
    false,
  );
  assert.equal(
    providerArrivalConfirmationIsFresh(
      new Date(now + 1).toISOString(),
      new Date(now + 1).toISOString(),
      new Date(now + 2).toISOString(),
      now,
    ),
    false,
  );
  assert.equal(
    providerArrivalConfirmationIsFresh(
      confirmedAt,
      new Date(Date.parse(confirmedAt) + PROVIDER_ARRIVAL_CONFIRMATION_MAX_SKEW_MS + 1).toISOString(),
      decidedAt,
      now,
    ),
    false,
  );
  assert.equal(providerArrivalConfirmationIsFresh(undefined, confirmedAt, decidedAt, now), false);
});

test("job start requires and persists a provider- and person-bound confirmation", async () => {
  const [engine, operations] = await Promise.all([
    read("lib/provider-eligibility-engine.ts"),
    read("lib/job-operations.ts"),
  ]);

  assert.match(engine, /provider_arrival_confirmation_missing_or_stale/);
  assert.match(engine, /input\.jobFactsConfirmationVersion !== PROVIDER_ARRIVAL_CONFIRMATION_VERSION/);
  assert.match(engine, /providerArrivalConfirmationIsFresh\(/);
  for (const field of [
    "jobFactsConfirmationVersion",
    "jobFactsConfirmedAt",
    "jobFactsConfirmedByProviderId",
    "jobFactsConfirmedByPersonId",
  ]) {
    assert.match(engine, new RegExp(`${field}:`), field);
  }

  assert.match(operations, /input\.arrivalConfirmed === true/);
  assert.match(operations, /profile\.jobFactsConfirmationVersion !== PROVIDER_ARRIVAL_CONFIRMATION_VERSION/);
  assert.match(operations, /profile\.jobFactsConfirmedByProviderId !== context\.providerId/);
  assert.match(operations, /profile\.jobFactsConfirmedByPersonId !== context\.personId/);
  assert.match(operations, /Date\.parse\(snapshot\.decidedAt\)/);
  assert.match(operations, /testOnly: context\.isTestJob && context\.isTestProvider/);
});

test("the jobs API trusts only a fresh server-side confirmation action", async () => {
  const jobs = await read("app/api/jobs/route.ts");
  const confirmationBindings = jobs.match(/arrivalConfirmed: body\.arrivalConfirmed === true/g) ?? [];

  assert.equal(confirmationBindings.length, 2);
  assert.doesNotMatch(jobs, /body\.(?:jobFactsConfirmedAt|arrivalConfirmedAt|confirmedAt)/);
  assert.match(
    jobs,
    /existingRecord\?\.workStatus === "in progress"\s*&& await jobAuthorizationDecisionMatchesContext/,
  );
  assert.match(jobs, /arrivalJobFacts: body\.arrivalJobFacts/);
  assert.match(jobs, /runtimeMarketplaceActionAllowed\(recordAction, \{/);
  assert.match(jobs, /testOnly: provider\.isTestProvider === "yes" && assignedJob\.isTestJob === "yes"/);
});

test("provider arrival UI uses an unchecked required personal-confirmation control", async () => {
  const page = await read("app/provider-jobs/page.tsx");
  const input = page.match(/<input name="arrival-confirmed"[^>]*>/)?.[0] ?? "";

  assert.match(input, /required/);
  assert.match(input, /type="checkbox"/);
  assert.doesNotMatch(input, /defaultChecked|checked=/);
  assert.match(page, /values\.get\("arrival-confirmed"\) === "on"/);
  assert.match(page, /\{ arrivalJobFacts, arrivalConfirmed \}/);
  assert.match(page, /personally rechecked these actual operation/);
  assert.match(page, /stop work and request a newly authorized scope/);
});
