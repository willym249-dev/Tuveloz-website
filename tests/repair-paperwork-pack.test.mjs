import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  MANUFACTURER_SPECIAL_POLICY_NOTICE,
  MARYLAND_CUSTOMER_RIGHTS_HEADING,
  MARYLAND_CUSTOMER_RIGHTS_TEXT,
  MARYLAND_REPAIR_RECORDS_VERSION,
  PROVIDER_TEST_DRIVE_CERTIFICATION,
  REPAIR_FACILITY_RESPONSIBILITY_NOTICE,
  REPAIRS_NEEDED_AND_PERFORMED_STATEMENT,
} from "../lib/maryland-repair-records.ts";
import { REPAIR_PAPERWORK_PACK_FILES } from "../scripts/build-repair-paperwork-pack.mjs";

const packDirectory = new URL("../brand/repair-paperwork-pack/", import.meta.url);

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * The pack is handed to repair businesses that are not on Tuveloz and may never
 * be. Its statutory sentences therefore have to be the same sentences the
 * marketplace stores on its own records — a shop cannot be given one version of
 * the Customer's Rights notice while the software keeps another.
 *
 * Regenerate with `npm run pack:repair-docs` when this fails. A failure here
 * means either the committed forms are stale or someone retyped a statutory
 * sentence instead of importing it.
 */
test("committed pack matches what the generator produces", async () => {
  for (const [name, expected] of Object.entries(REPAIR_PAPERWORK_PACK_FILES)) {
    const committed = await readFile(new URL(name, packDirectory), "utf8");
    assert.equal(
      committed,
      expected,
      `brand/repair-paperwork-pack/${name} is out of date — run npm run pack:repair-docs`,
    );
  }
});

test("both forms carry the Customer's Rights notice verbatim", () => {
  for (const [name, html] of Object.entries(REPAIR_PAPERWORK_PACK_FILES)) {
    assert.ok(
      html.includes(escapeHtml(MARYLAND_CUSTOMER_RIGHTS_HEADING)),
      `${name} is missing the Customer's Rights heading`,
    );
    assert.ok(
      html.includes(escapeHtml(MARYLAND_CUSTOMER_RIGHTS_TEXT)),
      `${name} does not carry the Customer's Rights text as written in lib/maryland-repair-records.ts`,
    );
    assert.ok(
      html.includes(escapeHtml(REPAIR_FACILITY_RESPONSIBILITY_NOTICE)),
      `${name} is missing the repair-facility responsibility notice`,
    );
    assert.ok(
      html.includes(escapeHtml(MANUFACTURER_SPECIAL_POLICY_NOTICE.split("\n").slice(1).join(" "))),
      `${name} is missing the manufacturer special policy notice`,
    );
    assert.ok(
      html.includes(escapeHtml(MARYLAND_REPAIR_RECORDS_VERSION)),
      `${name} does not stamp the record version it was built from`,
    );
  }
});

test("the invoice carries the statements a completed repair has to certify", () => {
  const invoice = REPAIR_PAPERWORK_PACK_FILES["invoice.html"];
  assert.ok(invoice.includes(escapeHtml(REPAIRS_NEEDED_AND_PERFORMED_STATEMENT)));
  assert.ok(invoice.includes(escapeHtml(PROVIDER_TEST_DRIVE_CERTIFICATION)));
});

test("the estimate carries the consent line and the returned-parts election", () => {
  const estimate = REPAIR_PAPERWORK_PACK_FILES["estimate-authorization.html"];
  assert.match(estimate, /exceeds this authorized amount by more than 10%/);
  assert.match(estimate, /I want my replaced parts returned to me/);
  assert.match(estimate, /I decline the return of my replaced parts/);
});

/**
 * The pack is a blank form, not a credential. Nothing on it may read as Tuveloz
 * having reviewed, approved, or vouched for the business printing it — the
 * whole point of the compliance matrix is that approval means evidence passed
 * review, and a downloadable PDF is not evidence.
 */
test("the pack never implies Tuveloz vouches for the business using it", () => {
  for (const [name, html] of Object.entries(REPAIR_PAPERWORK_PACK_FILES)) {
    assert.doesNotMatch(
      html,
      /\b(verified|approved|certified|endorsed|licensed)\s+by\s+Tuveloz\b/i,
      `${name} claims a Tuveloz endorsement`,
    );
    assert.ok(
      html.includes("blank form, not legal advice"),
      `${name} is missing the disclaimer`,
    );
  }
});
