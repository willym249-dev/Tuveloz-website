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
const rootLayout = await readFile(
  new URL("../app/layout.tsx", import.meta.url),
  "utf8",
);
const pauseNotice = await readFile(
  new URL("../app/components/job-posting-pause-notice.tsx", import.meta.url),
  "utf8",
);

test("customer signups stay open while new job requests and payments are paused", () => {
  assert.match(launchStatus, /CUSTOMER_JOB_POSTING_PAUSED = true/);
  assert.match(
    launchStatus,
    /not accepting new job requests or customer payments yet/,
  );
  assert.match(postJobPage, /New job requests are temporarily paused/);
  assert.match(postJobPage, /account\?role=customer&mode=create/);
  assert.match(postJobPage, /href="\/join"/);
});

test("the request API rejects every new submission before reading customer data", () => {
  const pauseGateIndex = requestRoute.indexOf("if (CUSTOMER_JOB_POSTING_PAUSED)");
  const multipartReadIndex = requestRoute.indexOf("request.formData()");
  const jsonReadIndex = requestRoute.indexOf("request.json()");

  assert.ok(pauseGateIndex >= 0);
  assert.ok(multipartReadIndex > pauseGateIndex);
  assert.ok(jsonReadIndex > pauseGateIndex);
  assert.match(requestRoute, /return pausedCustomerRequestResponse\(\)/);
  assert.match(requestRoute, /status: 503/);
  assert.match(requestRoute, /cache-control/);
});

test("the pause notice is visible sitewide and hides the homepage request form", () => {
  assert.match(rootLayout, /customer-job-posting-paused/);
  assert.match(rootLayout, /<JobPostingPauseNotice \/>/);
  assert.match(pauseNotice, /\.public-site \.request-section/);
  assert.match(pauseNotice, /display: none !important/);
  assert.match(pauseNotice, /Create customer account/);
  assert.match(pauseNotice, /Join as a provider/);
});
