import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";

// Storefront (product) payments have no accepted providerQuotes row and no
// mutable job scope. The checkout "open" reauthorization was quote-shaped:
// it required an accepted quote to exist, so it matched zero rows for a
// product payment and the caller then expired the Stripe Session as a false
// scope change. The fix applies the quote-only conditions only when
// paymentType === "quote"; product payments open on id + status alone.
//
// These tests execute real SQLite to pin both halves of that behavior.

function seed() {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE stripe_payments (
      id TEXT PRIMARY KEY, status TEXT, request_id TEXT, quote_id TEXT
    );
    CREATE TABLE provider_quotes (id TEXT PRIMARY KEY, status TEXT);
    -- a product payment: no request/quote, in the pre-open recheck state
    INSERT INTO stripe_payments VALUES ('pay_product', 'checkout_release_recheck', NULL, NULL);
    -- a quote payment plus its accepted quote
    INSERT INTO stripe_payments VALUES ('pay_quote', 'checkout_release_recheck', 'req1', 'q1');
    INSERT INTO provider_quotes VALUES ('q1', 'accepted');
  `);
  return db;
}

test("the old quote-shaped open reauthorization cannot open a product payment", () => {
  const db = seed();
  // Mirrors the pre-fix WHERE: id + status + quote binding + EXISTS(accepted quote).
  const info = db.prepare(`
    UPDATE stripe_payments SET status = 'checkout_open'
    WHERE id = ? AND status = 'checkout_release_recheck'
      AND request_id = ? AND quote_id = ?
      AND EXISTS (SELECT 1 FROM provider_quotes WHERE id = ? AND status = 'accepted')
  `).run("pay_product", null, null, "");
  assert.equal(info.changes, 0, "product payment matches nothing under quote-only reauth");
  const row = db.prepare("SELECT status FROM stripe_payments WHERE id = 'pay_product'").get();
  assert.equal(row.status, "checkout_release_recheck", "left stuck, would be expired as a false scope change");
  db.close();
});

test("the branched reauthorization opens a product payment on id + status", () => {
  const db = seed();
  const info = db.prepare(`
    UPDATE stripe_payments SET status = 'checkout_open'
    WHERE id = ? AND status = 'checkout_release_recheck'
  `).run("pay_product");
  assert.equal(info.changes, 1);
  const row = db.prepare("SELECT status FROM stripe_payments WHERE id = 'pay_product'").get();
  assert.equal(row.status, "checkout_open");
  db.close();
});

test("quote payments still require the accepted-quote binding to open", () => {
  const db = seed();
  const opened = db.prepare(`
    UPDATE stripe_payments SET status = 'checkout_open'
    WHERE id = ? AND status = 'checkout_release_recheck'
      AND request_id = ? AND quote_id = ?
      AND EXISTS (SELECT 1 FROM provider_quotes WHERE id = ? AND status = 'accepted')
  `).run("pay_quote", "req1", "q1", "q1");
  assert.equal(opened.changes, 1, "valid quote payment opens");

  // If the accepted quote is gone (scope/price changed), the quote payment must NOT open.
  db.exec("UPDATE provider_quotes SET status = 'superseded' WHERE id = 'q1'");
  db.exec("UPDATE stripe_payments SET status = 'checkout_release_recheck' WHERE id = 'pay_quote'");
  const blocked = db.prepare(`
    UPDATE stripe_payments SET status = 'checkout_open'
    WHERE id = ? AND status = 'checkout_release_recheck'
      AND request_id = ? AND quote_id = ?
      AND EXISTS (SELECT 1 FROM provider_quotes WHERE id = ? AND status = 'accepted')
  `).run("pay_quote", "req1", "q1", "q1");
  assert.equal(blocked.changes, 0, "a quote whose acceptance changed must not open");
  db.close();
});
