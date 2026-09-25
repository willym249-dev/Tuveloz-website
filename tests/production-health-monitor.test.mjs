import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  checkProductionHealth,
  productionHealthErrors,
} from "../scripts/check-production-health.mjs";

const healthyPayload = (overrides = {}) => ({
  status: "ok",
  checkedAt: "2026-09-25T15:00:00.000Z",
  release: {
    commit: "cf9767874f085e7a5dac9270bdf07ce35ecacfe6",
    builtAt: "2026-09-12T20:00:00.000Z",
  },
  checks: {
    application: "ready",
    database: "ready",
    schema: "ready",
  },
  launch: {
    mode: "onboarding_only",
    customerAccounts: "open",
    providerApplications: "open",
    customerJobRequests: "closed",
    customerPayments: "closed",
  },
  missingTables: [],
  missingGuardedTriggers: [],
  ...overrides,
});

const response = (payload, status = 200) => new Response(JSON.stringify(payload), {
  status,
  headers: { "content-type": "application/json" },
});

test("the production monitor accepts a healthy onboarding-only release", () => {
  assert.deepEqual(productionHealthErrors(healthyPayload()), []);
});

test("the production monitor rejects unsafe transaction gates and schema drift", () => {
  const payload = healthyPayload({
    checks: { application: "ready", database: "ready", schema: "migration-required" },
    launch: {
      mode: "live",
      customerAccounts: "open",
      providerApplications: "open",
      customerJobRequests: "open",
      customerPayments: "open",
    },
    missingTables: ["provider_applications"],
    missingGuardedTriggers: ["provider_document_pending_guard"],
  });
  const errors = productionHealthErrors(payload);

  assert.ok(errors.some((error) => error.includes("checks.schema")));
  assert.ok(errors.some((error) => error.includes("launch.mode")));
  assert.ok(errors.some((error) => error.includes("launch.customerJobRequests")));
  assert.ok(errors.some((error) => error.includes("launch.customerPayments")));
  assert.ok(errors.some((error) => error.includes("missingTables")));
  assert.ok(errors.some((error) => error.includes("missingGuardedTriggers")));
});

test("the production monitor can require the exact deployed commit", () => {
  const errors = productionHealthErrors(
    healthyPayload(),
    "0000000000000000000000000000000000000000",
  );
  assert.equal(errors.length, 1);
  assert.match(errors[0], /does not match the expected commit/);
});

test("a transient failure retries only the read-only health request", async () => {
  let requests = 0;
  const result = await checkProductionHealth({
    attempts: 2,
    retryDelayMs: 0,
    fetchImpl: async () => {
      requests += 1;
      return requests === 1
        ? response({ status: "degraded" }, 503)
        : response(healthyPayload());
    },
  });

  assert.equal(requests, 2);
  assert.equal(result.commit, healthyPayload().release.commit);
});

test("scheduled monitoring uses no secrets and does not create public issues", async () => {
  const workflow = await readFile(
    new URL("../.github/workflows/monitor-production.yml", import.meta.url),
    "utf8",
  );

  assert.match(workflow, /schedule:/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /node scripts\/check-production-health\.mjs/);
  assert.match(workflow, /contents: read/);
  assert.doesNotMatch(workflow, /secrets\./);
  assert.doesNotMatch(workflow, /issues: write/);
});
