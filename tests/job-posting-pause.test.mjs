import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const launchStatus = await readFile(
  new URL("../lib/launch-status.ts", import.meta.url),
  "utf8",
);
const postJobPage = await readFile(
  new URL("../app/post-job/page.tsx", import.meta.url),
  "utf8",
);
const requestRoute = await readFile(
  new URL("../app/api/requests/route.ts", import.meta.url),
  "utf8",
);

test("customer signups stay open while new job requests and payments are paused", () => {
  assert.match(
    launchStatus,
    /not accepting new job requests or customer payments yet/,
  );
  assert.match(postJobPage, /New job requests are temporarily paused/);
  assert.match(postJobPage, /account\?role=customer&mode=create/);
  assert.match(postJobPage, /href="\/join"/);
});

test("the request API rejects every new submission before reading customer data", () => {
  assert.match(requestRoute, /CUSTOMER_JOB_POSTING_PAUSED/);
  assert.match(requestRoute, /status: 503/);
  assert.match(requestRoute, /cache-control/);
  assert.doesNotMatch(requestRoute, /request\.formData\(\)|request\.json\(\)/);
});
