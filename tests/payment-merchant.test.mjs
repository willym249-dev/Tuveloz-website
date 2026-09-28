import assert from "node:assert/strict";
import test from "node:test";
import { hostedPaymentDisclosure, paymentRecordStatusLabel } from "../lib/payment-merchant.ts";
import { englishPathFor, pathHasSpanish, spanishPagePaths } from "../lib/spanish-routes.ts";

test("hosted checkout uses one explicit merchant disclosure in the requested supported language", () => {
  for (const input of [undefined, null, "auto", "fr", "ES", {}, "es", "en"]) {
    const result = hostedPaymentDisclosure(input);
    assert.equal(result.locale, input === "es" ? "es" : "en");
    assert.match(result.custom_text.submit.message, /TUVELOZ LLC/);
    assert.match(result.custom_text.submit.message, input === "es" ? /proveedor independiente/ : /independent provider/);
    assert.ok(result.custom_text.submit.message.length < 1200);
    assert.deepEqual(Object.keys(result).sort(), ["custom_text", "locale"]);
  }
});

test("incomplete and unknown payment states never become a paid claim", () => {
  for (const status of ["checkout_open", "checkout_creating", "checkout_release_recheck", "checkout_expired", "payment_failed", "refund_pending", "refunded", "partially_refunded", "disputed", "checkout_expiration_unconfirmed", "new_unknown_state", "constructor", "__proto__"]) {
    for (const language of ["en", "es"]) {
      const label = paymentRecordStatusLabel(status, language);
      assert.equal(typeof label, "string");
      assert.doesNotMatch(label, /\bPaid\b|\bPagado\b/i, status);
      assert.doesNotMatch(label, /_/);
    }
  }
  assert.equal(paymentRecordStatusLabel("paid_pending_completion", "en"), "Paid; service completion pending");
  assert.equal(paymentRecordStatusLabel("paid_pending_completion", "es"), "Pagado; servicio pendiente de completar");
});

test("private payment results translate in place without gaining a public Spanish alias", () => {
  assert.equal(pathHasSpanish("/success"), true);
  assert.equal(englishPathFor("/es/success"), null);
  assert.equal(spanishPagePaths().includes("/es/success"), false);
});
