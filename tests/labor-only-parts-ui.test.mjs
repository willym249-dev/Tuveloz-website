import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("customer and provider forms describe OEM and aftermarket as communication only", async () => {
  const [postJob, requestForm, providerJobs, profile] = await Promise.all([
    read("app/post-job/page.tsx"),
    read("app/components/customer-request-form.tsx"),
    read("app/provider-jobs/page.tsx"),
    read("app/components/provider-business-page.tsx"),
  ]);
  const customerIntake = `${postJob}\n${requestForm}`;
  assert.match(customerIntake, /Customer-supplied parts preference/);
  assert.match(customerIntake, /labor-only-parts-acknowledged/);
  assert.match(providerJobs, /laborOnlyConfirmed/);
  assert.match(providerJobs, /Parts charged through Tuveloz/);
  assert.match(profile, /CUSTOMER_SUPPLIED_PARTS_POLICY_OPTIONS/);
});

test("customer quote and payment screens show zero parts through Tuveloz", async () => {
  const [requestPage, paymentCard] = await Promise.all([
    read("app/my-request/page.tsx"),
    read("app/components/quote-payment-card.tsx"),
  ]);
  assert.match(requestPage, /Parts charged through Tuveloz<\/dt><dd>\$0\.00/);
  assert.match(paymentCard, /const laborOnlyQuote/);
  assert.match(paymentCard, /Checkout is blocked because this quote is not labor only/);
  assert.match(paymentCard, /provider-supplied parts, parts reimbursement, parts tax, or parts charge/);
});

test("obsolete parts-shopping component is gone", async () => {
  await assert.rejects(
    access(new URL("app/components/market-price-links.tsx", root)),
  );
  for (const path of ["app/page.tsx", "app/provider-jobs/page.tsx"]) {
    assert.doesNotMatch(await read(path), /MarketPriceLinks/);
  }
});
