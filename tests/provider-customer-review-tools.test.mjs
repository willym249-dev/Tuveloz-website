import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("provider quote templates stay provider-controlled and device-local", async () => {
  const source = await read("app/provider-jobs/toolkit/page.tsx");

  assert.match(source, /tuveloz-provider-quote-templates-v1/);
  assert.match(source, /Prices are\s+never saved in these templates/);
  assert.match(source, /Any added work or price change requires a separate written customer authorization/);
  assert.match(source, /Do not place customer\s+names, addresses, payment information/);
  assert.doesNotMatch(source, /laborPriceCents|partsPriceCents|customerTotalCents/);
});

test("job documents exclude unaccepted records and distinguish invoices from receipts", async () => {
  const source = await read("app/job-authorizations/documents/page.tsx");

  assert.match(source, /authorization\.status === "accepted"/);
  assert.match(source, /Independent provider invoice \/ work summary/);
  assert.match(source, /Tuveloz payment receipt/);
  assert.match(source, /Payment is not proven by this invoice/);
  assert.match(source, /does not replace the\s+independent provider's itemized invoice/);
  assert.match(source, /RECEIPT_STATUSES/);
  assert.doesNotMatch(source, /checkout_created|checkout_creating|payment_failed/);
});

test("owner entry stays separate while role tools remain inside their workspaces", async () => {
  const source = await read("app/components/account-tools-dock.tsx");

  assert.doesNotMatch(source, /href="\/provider-jobs\/toolkit"/);
  assert.doesNotMatch(source, /href="\/job-authorizations\/documents"/);
  assert.match(source, /if \(!isOwner\) return null;/);
  assert.doesNotMatch(source, /usePathname/);
  assert.match(source, /href="\/admin"/);
  assert.match(source, /href="\/admin\/marketplace-tools"/);
});
