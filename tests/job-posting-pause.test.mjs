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
const homepage = await readFile(
  new URL("../app/page.tsx", import.meta.url),
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
const saveMySpotButton = await readFile(
  new URL("../app/components/save-my-spot-button.tsx", import.meta.url),
  "utf8",
);

test("customer signups stay open while new job requests and payments are paused", () => {
  assert.match(launchStatus, /CUSTOMER_JOB_POSTING_PAUSED = true/);
  assert.match(
    launchStatus,
    /not accepting customer service requests or payments yet/,
  );
  assert.match(postJobPage, /Customer requests and quotes open at launch/);
  assert.match(
    postJobPage,
    /posting jobs opens once we've finished getting everything ready/,
  );
  assert.match(postJobPage, /account\?role=customer&mode=create/);
  assert.match(postJobPage, /href="\/join"/);
  assert.match(postJobPage, /Be first in line when we open\./);
  assert.match(postJobPage, /Nothing on this page submits a[\s\S]*request, contacts a provider, books service, or processes a payment/);
  assert.ok(
    postJobPage.indexOf("if (CUSTOMER_JOB_POSTING_PAUSED)")
      < postJobPage.indexOf("customerRequestAgreementHash()"),
  );
  assert.match(homepage, /CUSTOMER_JOB_POSTING_PAUSED \? \(/);
  assert.match(homepage, /Two minutes now\. First in line at launch\./);
  // The sign-up invitation now lives in SaveMySpotButton, which keeps this
  // wording for a visitor without a session and offers a signed-in one their
  // own workspace instead of telling them to create a second account.
  assert.match(homepage, /<SaveMySpotButton/);
  assert.match(saveMySpotButton, /Save my spot — free/);
  assert.match(homepage, /Apply as a provider/);
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

test("the pause notice is visible sitewide and the homepage uses an explicit launch branch", () => {
  assert.match(rootLayout, /className="antialiased"/);
  assert.match(rootLayout, /data-customer-job-posting-paused/);
  assert.match(rootLayout, /<JobPostingPauseNotice \/>/);
  assert.doesNotMatch(pauseNotice, /display: none !important/);
  // The banner offers exactly one action, and stands down entirely on pages
  // that already carry their own primary call to action in a sticky header —
  // two buttons for the same job is what made the provider page confusing.
  assert.match(pauseNotice, /Save my spot — free/);
  assert.doesNotMatch(pauseNotice, /Join as a provider/);
  assert.match(pauseNotice, /PAGES_WITH_THEIR_OWN_CTA/);
  assert.match(pauseNotice, /!pageHasItsOwnCta && \(/);
});
