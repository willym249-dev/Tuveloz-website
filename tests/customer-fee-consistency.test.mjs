import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

import {
  CUSTOMER_FEE_DISCLOSURE,
  CUSTOMER_FEE_WORKED_EXAMPLE,
  CUSTOMER_SERVICE_FEE_LABEL,
  CUSTOMER_SERVICE_FEE_NAME,
  CUSTOMER_SERVICE_FEE_PERCENT,
  CUSTOMER_SERVICE_FEE_RATE_BPS,
  customerPriceFor,
  PROVIDER_PAYOUT_DISCLOSURE,
} from "../lib/customer-fee.ts";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

/**
 * Legal pages that still carry the retired fee name because renaming it in them
 * means cutting a new policy release, which DEPLOYMENT.md reserves for the
 * owner. Remove an entry here in the same change that re-releases the document.
 */
const PENDING_LEGAL_RELEASE = [
  "app/terms/page.tsx",
  "app/payments/page.tsx",
];

async function* walk(dir) {
  for (const entry of await readdir(new URL(dir, root), { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const path = `${dir}${entry.name}`;
    if (entry.isDirectory()) yield* walk(`${path}/`);
    else if (/\.(ts|tsx|md)$/.test(entry.name)) yield path;
  }
}

/**
 * The substantive guarantee behind "keep 100% of your quoted price": the fee is
 * calculated ON the provider's price and added ON TOP of it. If this inverts,
 * the provider payout claim on the homepage and in Provider Agreement §11
 * becomes false, so it is asserted rather than assumed.
 */
test("the fee is added on top of the provider price, never taken out of it", () => {
  for (const quoteCents of [0, 1, 99, 100, 12_345, 250_00]) {
    const price = customerPriceFor(quoteCents);
    assert.equal(price.providerQuoteCents, quoteCents, "provider quote must be untouched");
    assert.equal(
      price.customerTotalCents,
      quoteCents + price.customerFeeCents,
      "customer total must be quote plus fee",
    );
    assert.ok(
      price.customerTotalCents >= price.providerQuoteCents,
      "the customer total can never be below the provider quote",
    );
    // What the provider is paid: total charged, minus the fee retained.
    const providerReceives = price.customerTotalCents - price.customerFeeCents;
    assert.equal(providerReceives, quoteCents, "provider must receive their full quote");
  }

  assert.equal(CUSTOMER_SERVICE_FEE_RATE_BPS, CUSTOMER_SERVICE_FEE_PERCENT * 100);
  assert.equal(customerPriceFor(100_00).customerFeeCents, 5_00);
});

/**
 * The locked model, as the reviewed worked example. A $100 provider quote
 * produces a $5 Customer Service Fee, a $105 customer total, and a $100
 * provider payout. This is the reference case: if it ever fails, the economics
 * have moved, not the wording.
 */
test("$100 provider quote produces $5 fee, $105 customer total, $100 payout", () => {
  const price = customerPriceFor(100_00);

  assert.equal(price.providerQuoteCents, 100_00, "provider quote must be $100.00");
  assert.equal(price.customerFeeCents, 5_00, "Customer Service Fee must be $5.00");
  assert.equal(price.customerTotalCents, 105_00, "customer total must be $105.00");
  assert.equal(price.customerFeeRateBps, 500, "fee rate must be 5%");

  // The payout: the platform retains the fee from the total and transfers the
  // remainder, so the provider is left with exactly the amount they quoted.
  assert.equal(
    price.customerTotalCents - price.customerFeeCents,
    100_00,
    "provider payout must be the full $100.00",
  );

  // The fee is calculated FROM the provider amount, not carved out of it.
  assert.equal(price.customerFeeCents, Math.round(price.providerQuoteCents * 0.05));
  assert.notEqual(price.customerTotalCents, price.providerQuoteCents);

  // The published example must state these same numbers.
  for (const figure of ["$100", "$5", "$105"]) {
    assert.ok(
      CUSTOMER_FEE_WORKED_EXAMPLE.includes(figure),
      `the published worked example omits ${figure}`,
    );
  }
});

test("the fee has one canonical name and one disclosure for each audience", () => {
  assert.equal(CUSTOMER_SERVICE_FEE_NAME, "Customer Service Fee");
  assert.equal(CUSTOMER_SERVICE_FEE_LABEL, "Customer Service Fee (5%)");

  assert.match(CUSTOMER_FEE_DISCLOSURE, /calculated from the provider's price and added to your total/);
  assert.match(CUSTOMER_FEE_DISCLOSURE, /before you accept anything/);

  assert.match(PROVIDER_PAYOUT_DISCLOSURE, /full quoted price/);
  assert.match(PROVIDER_PAYOUT_DISCLOSURE, /never deducted from your payout/);
  assert.match(PROVIDER_PAYOUT_DISCLOSURE, /charged to the customer on top of it/);
});

/**
 * The fee had five names across the site, the agreements, and the Stripe line
 * item on a customer's receipt. Nothing about the money differed, but a
 * provider or a regulator comparing two surfaces could not know that. This
 * fails the build if a second name reappears anywhere a person can read it.
 */
test("no surface uses a name for the fee other than the canonical one", async () => {
  const banned = [
    /tuveloz service fee/i,
    /tuveloz fee\b/i,
    /marketplace service fee/i,
    /platform fee/i,
  ];
  const allowed = new Set([
    // Documents the retired names in its own comment, which is where that
    // history belongs.
    "lib/customer-fee.ts",
    "tests/customer-fee-consistency.test.mjs",
    // Still carrying the retired name, deliberately. These three are bound by
    // SHA-256 to an active entry in config/policy-releases.json, and
    // DEPLOYMENT.md requires the owner to approve the exact page before a new
    // release goes active. Renaming the fee in them is a legal release, not an
    // edit. PENDING_LEGAL_RELEASE below asserts they are still waiting, so this
    // shows up as outstanding work instead of quietly becoming permanent.
    ...PENDING_LEGAL_RELEASE,
  ]);

  const offenders = [];
  for (const dir of ["app/", "lib/", "brand/", "docs/"]) {
    for await (const path of walk(dir)) {
      if (allowed.has(path)) continue;
      const text = await source(path);
      for (const pattern of banned) {
        // Identifiers such as CUSTOMER_SERVICE_FEE_RATE_BPS and customerServiceFeePercent
        // are internal names, not text anyone reads. Only prose counts.
        const prose = text.replace(/CUSTOMER_SERVICE_FEE\w*/g, "").replace(/customerServiceFee\w*/g, "");
        if (pattern.test(prose)) offenders.push(`${path} :: ${pattern}`);
      }
    }
  }
  assert.deepEqual(offenders, [], `non-canonical fee names found:\n${offenders.join("\n")}`);
});

test("the provider pitch does not claim there is no commission", async () => {
  const home = await source("app/page.tsx");
  // Nothing is deducted from the payout, but the fee IS sized by the provider's
  // price and the Customer Agreement says so. "No commission" was the one line
  // a provider could fairly call misleading once they read both.
  assert.doesNotMatch(home, /no commission carved out/i);
  assert.doesNotMatch(home, /no commission\b/i);
  assert.match(home, /nothing deducted from your payout/i);
  assert.match(home, /charged to the customer on top of it/i);
});

test("the agreements and the Stripe receipt describe the same fee", async () => {
  const [providerAgreement, customerAgreement, payments, checkout, authDoc] = await Promise.all([
    source("app/provider-agreement/page.tsx"),
    source("app/customer-agreement/page.tsx"),
    source("app/payments/page.tsx"),
    source("app/api/stripe/checkout/route.ts"),
    source("app/job-authorizations/documents/page.tsx"),
  ]);

  // Provider side: full quote, fee charged separately to the customer.
  assert.match(providerAgreement, /full quoted price/);
  assert.match(providerAgreement, /charged\s+separately to the customer/);

  // Customer side: 5% of the provider subtotal, shown before checkout. The
  // substance is what matters and it is unchanged; only the label is pending.
  assert.match(customerAgreement, /fee equal to 5% of the\s+provider subtotal/);
  assert.match(payments, /fee equal to 5% of the\s+provider/);

  // The line item a customer actually sees on the receipt and the authorization.
  assert.match(checkout, /name: "Customer Service Fee"/);
  assert.match(authDoc, /<td>Customer Service Fee<\/td>/);

  // The fee Stripe retains is the customer fee, charged on top of the total.
  assert.match(checkout, /application_fee_amount: applicationFeeCents/);
  assert.match(checkout, /applicationFeeCents = totals\.customerFeeCents/);
  assert.match(checkout, /applicationFeeCents = scopePrice\.customerFeeCents/);
});

test("the provider membership fee stays a separate, differently named thing", async () => {
  const [founding, cohort] = await Promise.all([
    source("app/founding-providers/page.tsx"),
    source("lib/founding-cohort.ts"),
  ]);
  // Founding providers are exempt from a hypothetical future membership fee,
  // never from the Tuveloz service fee the customer pays.
  assert.match(founding, /provider membership fee/);
  assert.match(founding, /does not change the Customer Service Fee that customers pay/);
  assert.match(cohort, /nothing to do with the Customer Service Fee/);
});

/**
 * A ratchet, not a permanent exemption. When the owner approves and re-releases
 * one of these documents with the canonical name, this test fails and forces
 * PENDING_LEGAL_RELEASE to shrink — so the exception cannot outlive the reason
 * for it.
 */
test("the gated legal pages are still awaiting a release with the canonical name", async () => {
  for (const path of PENDING_LEGAL_RELEASE) {
    const text = await source(path);
    assert.match(
      text,
      /platform fee|tuveloz fee/i,
      `${path} no longer carries the retired name — remove it from PENDING_LEGAL_RELEASE`,
    );
  }

  // Each one is genuinely gated, which is the whole reason for the exception.
  const manifest = JSON.parse(await source("config/policy-releases.json"));
  const gated = new Set(Object.values(manifest).map((entry) => entry.sourceFile));
  for (const path of PENDING_LEGAL_RELEASE) {
    assert.ok(gated.has(path), `${path} is not policy-gated and has no excuse`);
  }
});
