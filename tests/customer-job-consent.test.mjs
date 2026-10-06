import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { checkoutModule } from "./helpers/checkout-evidence.mjs";
import { consentApi as api, scopeApi, syntheticRequestScope, syntheticSelectionScope, syntheticSelectionConsent } from "./helpers/customer-job-consent.mjs";

const hash = text => createHash("sha256").update(text).digest("hex");
const snapshot = scopeApi.customerRequestScopeSnapshot(syntheticRequestScope);
const { validCustomerConsent } = checkoutModule("./lib/customer-consent-response");
const accepted = presentation => ({ ...presentation, scopeSnapshot: snapshot, customerEmail: "customer@example.invalid", acceptedAt: "2026-10-01T00:00:00Z" });

for (const language of ["en", "es"]) {
  test(`${language} request, privacy and selection bind exact text, language, policies and scope`, async () => {
    const pair = await api.customerRequestConsentPresentation(language, snapshot);
    const selection = await syntheticSelectionConsent(language);
    for (const record of [pair.request, pair.privacy, selection]) {
      assert.equal(record.agreementHash, hash(record.agreementText));
      const saved = JSON.parse(record.agreementText);
      assert.equal(saved.presentedText, record.presentedText);
      assert.equal(saved.language, language);
      assert.ok(record.agreementVersion.endsWith(`|lang:${language}`));
      assert.equal(saved.policyRelease.schemaVersion, "2");
      assert.deepEqual(saved.policyRelease.documents, record.documents);
      assert.equal(validCustomerConsent(record, language), true);
      assert.equal(validCustomerConsent(record, language === "en" ? "es" : "en"), false);
      for (const document of record.documents) {
        assert.ok(document.href.startsWith(language === "es" ? "/es/" : "/"));
        assert.equal(Boolean(document.translation), language === "es");
      }
    }
    assert.deepEqual(JSON.parse(pair.request.agreementText).scopeSnapshot, JSON.parse(snapshot));
    assert.equal(await api.acceptedCustomerRequestConsent(Object.values(pair).map(accepted), snapshot), true);
    assert.equal(await api.acceptedCustomerRequestConsent(Object.values(pair).map(accepted), snapshot, "other@example.invalid"), false);
  });
}

test("historical English consent stays readable but cannot authorize under a new Terms release", async () => {
  const historical = JSON.parse(readFileSync(new URL("./fixtures/customer-request-legacy.json", import.meta.url), "utf8"));
  const before = JSON.stringify(historical);
  for (const record of Object.values(historical)) {
    assert.equal(hash(record.agreementText), record.agreementHash);
    const restored = await api.customerConsentPresentation(record.agreementText);
    assert.equal(restored.agreementVersion, record.agreementVersion);
    assert.equal(restored.language, undefined, "do not relabel an older record");
    assert.equal(restored.documents.find(document => document.key === "terms").version, "2026-09-30");
  }
  assert.notEqual(scopeApi.customerRequestAgreementEvidenceText(snapshot), historical.request.agreementText);
  assert.notEqual(scopeApi.customerRequestPrivacyAgreementEvidenceText(snapshot), historical.privacy.agreementText);
  assert.equal(await api.acceptedCustomerRequestConsent(Object.values(historical).map(accepted), snapshot), false);
  const current = await api.customerRequestConsentPresentation("en", snapshot);
  assert.notEqual(current.request.agreementVersion, historical.request.agreementVersion);
  assert.notEqual(current.privacy.agreementVersion, historical.privacy.agreementVersion);
  assert.equal(JSON.stringify(historical), before);
});

test("the legacy English format still validates when it references the current policies", async () => {
  const records = await Promise.all([
    scopeApi.customerRequestAgreementEvidenceText(snapshot),
    scopeApi.customerRequestPrivacyAgreementEvidenceText(snapshot),
  ].map(text => api.customerConsentPresentation(text)));
  assert.equal(await api.acceptedCustomerRequestConsent(records.map(accepted), snapshot), true);
});

test("mixed language, text, hashes, snapshots and identities cannot authorize requests", async () => {
  const en = await api.customerRequestConsentPresentation("en", snapshot);
  const es = await api.customerRequestConsentPresentation("es", snapshot);
  for (const [request, privacy] of [
    [accepted(en.request), accepted(es.privacy)],
    [{ ...accepted(en.request), agreementHash: es.request.agreementHash }, accepted(en.privacy)],
    [{ ...accepted(en.request), agreementText: es.request.agreementText }, accepted(en.privacy)],
    [accepted(en.request), { ...accepted(en.privacy), customerEmail: "other@example.invalid" }],
    [accepted(en.request), { ...accepted(en.privacy), acceptedAt: "" }],
    [accepted(en.request), { ...accepted(en.privacy), scopeSnapshot: "{}" }],
  ]) assert.equal(await api.acceptedCustomerRequestConsent([request, privacy], snapshot), false);
});

test("selection preserves literal names, identifiers, warranties, timestamps and prices in both languages", async () => {
  for (const language of ["en", "es"]) {
    const base = await syntheticSelectionConsent(language);
    assert.ok(base.presentedText.includes(syntheticSelectionScope.quote.providerName));
    assert.ok(base.presentedText.includes(syntheticRequestScope.scheduledFor));
    assert.ok(base.presentedText.includes("$105.00"));
    assert.doesNotMatch(base.presentedText, /No license, registration, or insurance is legally required/);
    for (const changed of [{ workmanshipWarranty: "SYNTHETIC garantía 30 días" }, { customerTotalCents: "21000" },
      { providerName: "Other provider" }, { performingPersonId: "other-person" }, { quoteId: "other-quote" },
      { scheduledFor: "2030-10-02T16:00:00.000Z" }, { confirmedCredentialLabels: ["SYNTHETIC issuer label"] }]) {
      const record = await syntheticSelectionConsent(language, changed);
      assert.notEqual(record.agreementHash, base.agreementHash);
      if (changed.workmanshipWarranty) assert.ok(record.presentedText.includes(changed.workmanshipWarranty));
    }
  }
});

test("malformed or mismatched consent cannot render actionable controls", async () => {
  const record = await syntheticSelectionConsent("es");
  for (const value of [null, {}, { ...record, agreementText: "{" }, { ...record, documents: {} },
    { ...record, presentedText: "tampered" }, { ...record, agreementHash: "bad" },
    { ...record, documents: [{ ...record.documents[0], href: "https://evil.example.invalid" }] }]) {
    assert.equal(validCustomerConsent(value, "es"), false);
  }
});
