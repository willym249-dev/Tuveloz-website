import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("job evidence stays readable while new real-job records fail closed", async () => {
  const route = await source("app/api/job-evidence/route.ts");
  const getRoute = route.slice(
    route.indexOf("export async function GET"),
    route.indexOf("export async function POST"),
  );
  const postRoute = route.slice(route.indexOf("export async function POST"));

  assert.doesNotMatch(getRoute, /runtimeMarketplaceActionAllowed|marketplacePausedResponse/);
  assert.match(postRoute, /runtimeMarketplaceActionAllowed\("job_start", \{[\s\S]*testOnly: job\.isTestJob === "yes"/);
  assert.match(route, /marketplacePausedMessage\("job_start"\)/);
  assert.match(route, /code: "MARKETPLACE_ONBOARDING_ONLY"/);
  assert.match(route, /status: 503/);
  assert.match(route, /"cache-control": "no-store"/);

  const participantRead = postRoute.indexOf("await participantJob(");
  const marketplaceGate = postRoute.indexOf('await runtimeMarketplaceActionAllowed("job_start"');
  const evidenceCountRead = postRoute.indexOf("SELECT count(*) AS total");
  const imageWrite = postRoute.indexOf("await storeJobEvidenceImage(");
  const databaseWrite = postRoute.indexOf("INSERT INTO job_evidence_items");
  const notification = postRoute.indexOf("await notifyMarketplaceAccount(");

  assert.ok(participantRead >= 0 && participantRead < marketplaceGate);
  for (const sideEffect of [evidenceCountRead, imageWrite, databaseWrite, notification]) {
    assert.ok(
      marketplaceGate < sideEffect,
      "the persisted job gate must run before reads or side effects used to create evidence",
    );
  }
  assert.doesNotMatch(postRoute, /testOnly:\s*(?:body|request|searchParams)/);
});
