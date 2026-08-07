import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  CONTACT_ABOUT_SERVICES_HREF,
  onboardingProgress,
} from "../lib/provider-onboarding-progress.ts";

const requirement = (status, uploadAllowed = true, label = "Certificate") => ({
  label, status, uploadAllowed,
});

const build = (overrides = {}) => ({
  services: [{ label: "Tire repair or installation", requirements: [requirement("accepted")] }],
  allAgreementsAcknowledgedForApplicationReview: true,
  identityVerification: { complete: true },
  ...overrides,
});

/**
 * The onboarding page is eight cards deep and the only actionable one is
 * seventh. This picks the single next action, so the ordering is the whole
 * point: sending someone to upload a document while their agreements are
 * outstanding is a trip that cannot finish.
 */

test("agreements come before identity, and identity before documents", async () => {
  const nothingDone = onboardingProgress(build({
    allAgreementsAcknowledgedForApplicationReview: false,
    identityVerification: { complete: false },
    services: [{ label: "Tire repair", requirements: [requirement("missing")] }],
  }));
  assert.equal(nothingDone.next.href, "#policy-acknowledgments");

  const agreementsDone = onboardingProgress(build({
    identityVerification: { complete: false },
    services: [{ label: "Tire repair", requirements: [requirement("missing")] }],
  }));
  assert.equal(agreementsDone.next.href, "#identity-verification");

  const identityDone = onboardingProgress(build({
    services: [{ label: "Tire repair", requirements: [requirement("missing")] }],
  }));
  assert.equal(identityDone.next.href, "#selected-services");
});

test("the next action names the actual document and service", () => {
  const progress = onboardingProgress(build({
    services: [{
      label: "Mobile car wash",
      requirements: [requirement("accepted"), requirement("missing", true, "Wash-water disposal plan")],
    }],
  }));
  assert.equal(progress.next.title, "Upload Wash-water disposal plan");
  assert.match(progress.next.detail, /For Mobile car wash\./);
  // One outstanding item must not claim there are others.
  assert.doesNotMatch(progress.next.detail, /other document/);
});

test("outstanding documents beyond the first are counted, with correct plurals", () => {
  const two = onboardingProgress(build({
    services: [{ label: "S", requirements: [requirement("missing"), requirement("rejected")] }],
  }));
  assert.match(two.next.detail, /1 other document still needs you too\./);

  const three = onboardingProgress(build({
    services: [{
      label: "S",
      requirements: [requirement("missing"), requirement("rejected"), requirement("expired")],
    }],
  }));
  assert.match(three.next.detail, /2 other documents still need you too\./);
});

test("a document the provider cannot upload is never the next action", () => {
  // Uploads are blocked in some states; offering one anyway is a dead end.
  const progress = onboardingProgress(build({
    services: [{ label: "S", requirements: [requirement("missing", false)] }],
  }));
  assert.notEqual(progress.next.href, "#selected-services");
  assert.equal(progress.next.cta, "", "nothing to press when nothing can be uploaded");
});

test("waiting on review is stated plainly instead of offering a control", () => {
  const progress = onboardingProgress(build({
    services: [{ label: "S", requirements: [requirement("under_review"), requirement("under_review")] }],
  }));
  assert.match(progress.next.title, /Nothing to do/);
  assert.match(progress.next.detail, /2 items are with our team/);
  assert.equal(progress.next.href, "", "there is no button, because there is no action");
});

test("an application with no services points at the only route that works", () => {
  const progress = onboardingProgress(build({ services: [] }));
  assert.equal(progress.next.href, CONTACT_ABOUT_SERVICES_HREF);
  // Services cannot be changed from any provider-facing screen.
  assert.match(progress.next.href, /^mailto:/);
  assert.equal(progress.documents.total, 0);
  assert.equal(progress.checklist.at(-1).done, false, "zero of zero is not complete");
});

test("document counts drive the progress readout", () => {
  const progress = onboardingProgress(build({
    services: [
      { label: "A", requirements: [requirement("accepted"), requirement("missing")] },
      { label: "B", requirements: [requirement("accepted"), requirement("under_review")] },
    ],
  }));
  assert.deepEqual(progress.documents, { accepted: 2, total: 4 });
  assert.match(progress.checklist.at(-1).label, /Documents accepted \(2 of 4\)/);

  const finished = onboardingProgress(build({
    services: [{ label: "A", requirements: [requirement("accepted")] }],
  }));
  assert.equal(finished.checklist.at(-1).done, true);
  assert.match(finished.next.title, /Everything we asked for is in/);
});

test("the page leads with the card and its anchors exist", async () => {
  const page = await readFile(new URL("../app/provider-onboarding/page.tsx", import.meta.url), "utf8");

  // It has to be the first card; every other one is reference or status.
  const grid = page.indexOf('className="account-grid"');
  assert.ok(page.indexOf('className="account-card provider-next-step"') > grid);
  assert.ok(
    page.indexOf('className="account-card provider-next-step"')
      < page.indexOf("<h2>Launch protection is active</h2>"),
    "the next-step card must render before the launch notice",
  );

  // Every href the helper can return must land somewhere on this page.
  assert.match(page, /id="identity-verification"/);
  assert.match(page, /id="selected-services"/);
  assert.match(page, /id="policy-acknowledgments"/);

  // The bar is a real progressbar, not a decorative div.
  assert.match(page, /role="progressbar"/);
  assert.match(page, /aria-valuenow=\{progress\.documents\.accepted\}/);
});
