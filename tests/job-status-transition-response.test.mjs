import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  isJobStatusTransitionTarget,
  jobStatusTransitionSuccessPayload,
} from "../lib/job-status-transition.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("quote accepted to on my way returns its immutable lifecycle event without a fake authorization", () => {
  assert.equal(isJobStatusTransitionTarget("on my way"), true);
  assert.deepEqual(jobStatusTransitionSuccessPayload({
    status: "on my way",
    lifecycleEventId: "event-travel",
  }), {
    ok: true,
    status: "on my way",
    lifecycleEventId: "event-travel",
  });
});

test("on my way to arrived returns its immutable lifecycle event without a fake authorization", () => {
  assert.equal(isJobStatusTransitionTarget("arrived"), true);
  assert.deepEqual(jobStatusTransitionSuccessPayload({
    status: "arrived",
    lifecycleEventId: "event-arrival",
  }), {
    ok: true,
    status: "arrived",
    lifecycleEventId: "event-arrival",
  });
});

test("completion returns the exact persisted completion authorization and audit event", () => {
  assert.deepEqual(jobStatusTransitionSuccessPayload({
    status: "completed",
    lifecycleEventId: "event-completion",
    authorizationDecisionId: "completion-decision",
    trackedSeconds: 3600,
  }), {
    ok: true,
    status: "completed",
    lifecycleEventId: "event-completion",
    authorizationDecisionId: "completion-decision",
    decisionId: "completion-decision",
    trackedSeconds: 3600,
  });
});

test("the jobs route captures authorization before mutation and never dereferences a nullable decision", async () => {
  const jobs = await read("app/api/jobs/route.ts");
  const transitionRoute = jobs.slice(jobs.indexOf('if (body.action === "update-status")'));

  assert.match(transitionRoute, /completionAuthorizationDecisionId = stageDecision\.result\.decisionId/);
  assert.match(transitionRoute, /const lifecycleEvent = await appendJobLifecycleEvent/);
  assert.match(transitionRoute, /lifecycleEventId: lifecycleEvent\.eventId/);
  assert.doesNotMatch(transitionRoute, /decisionId: stageDecision\.result\.decisionId/);
});
