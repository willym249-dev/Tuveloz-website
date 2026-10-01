import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const root = new URL("../", import.meta.url);
const require = createRequire(import.meta.url);
const modules = new Map();
function load(path, parent = root) {
  if (!path.startsWith(".")) return require(path);
  let url = new URL(path, parent);
  if (url.pathname.endsWith(".json")) return JSON.parse(readFileSync(url, "utf8"));
  if (!url.pathname.endsWith(".ts")) url = new URL(`${url.href}.ts`);
  if (modules.has(url.href)) return modules.get(url.href);
  const exports = {};
  const compiled = ts.transpileModule(readFileSync(url, "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  modules.set(url.href, exports);
  new Function("exports", "require", compiled)(exports, name => load(name, url));
  return exports;
}
const acceptance = load("./lib/customer-checkout-acceptance");
const laborStatement = "I confirm this payment includes vehicle-service labor only and no provider-supplied parts, parts reimbursement, parts tax, or parts charge.";
const scope = {
  requestId: "synthetic-request", quoteId: "synthetic-quote", scopeVersion: 2,
  scopeAuthorizationDecisionId: "synthetic-scope-decision",
  providerApplicationId: "synthetic-provider", providerLegalName: "SYNTHETIC Álvarez & Sons <Test>",
  providerLegalIdentitySourceEvidenceId: "synthetic-identity-source",
  providerLegalIdentityReviewDecisionId: "synthetic-identity-decision",
  providerLegalIdentityVerifiedAt: "2026-09-29T12:00:00Z",
  performingPersonId: "synthetic-performer", supervisorPersonId: "",
  serviceCodes: ["SYNTHETIC-SERVICE"], scheduledFor: "2026-10-01T12:00:00Z",
  workmanshipWarranty: "", laborAmountCents: 10000, partsAmountCents: 0,
  taxAmountCents: 0, otherAmountCents: 0, providerAmountCents: 10000,
  customerFeeRateBps: 500, customerFeeCents: 500, customerTotalCents: 10500,
};
const hash = value => createHash("sha256").update(value).digest("hex");

for (const language of ["en", "es"]) for (const warranty of ["", "SYNTHETIC garantía: Terms of Use & <test>"]) {
  test(`${language} checkout evidence includes the labor-only statement and ${warranty ? "literal provider warranty" : "no-warranty disclosure"}`, async () => {
    const input = { ...scope, workmanshipWarranty: warranty };
    const before = JSON.stringify(input);
    const displayed = acceptance.customerCheckoutAcceptanceText(input, language);
    const saved = acceptance.customerCheckoutAgreementEvidenceText(input, language);
    const evidence = JSON.parse(saved);
    const statement = language === "en" ? laborStatement : "Confirmo que este pago incluye únicamente mano de obra para el servicio del vehículo.";
    assert.ok(displayed.startsWith(statement));
    assert.equal(displayed.split(statement).length - 1, 1);
    assert.equal(evidence.presentedText, displayed);
    assert.ok(displayed.includes(input.providerLegalName));
    assert.ok(displayed.includes(language === "en" ? "Customer Service Fee $5.00; customer total $105.00." : "Tarifa de Servicio al Cliente $5.00; total a pagar $105.00."));
    assert.ok(displayed.includes(language === "en" ? "I authorize payment of the displayed total to TUVELOZ LLC through Stripe at checkout." : "Autorizo el pago del total mostrado a TUVELOZ LLC a través de Stripe al finalizar el pago."));
    assert.ok(displayed.includes(warranty || (language === "en" ? "The provider business offers no workmanship warranty for this job." : "El negocio proveedor no ofrece garantía de mano de obra para este trabajo.")));
    assert.equal(evidence.scopeSnapshot.workmanshipWarranty, warranty);
    assert.equal(await acceptance.customerCheckoutAgreementHash(input, language), hash(saved));
    assert.equal(evidence.language, language);
    assert.ok(evidence.agreementVersion.endsWith(`|checkout:6|lang:${language}`));
    assert.ok(evidence.agreementVersion.length <= 300);
    // New presentations use a distinct immutable-record key; an older record
    // is never relabeled as if it included the previously omitted statement.
    const legacy = JSON.stringify({ ...evidence,
      agreementVersion: evidence.agreementVersion.replace(/checkout:6\|lang:..$/, "checkout:3"),
      presentedText: displayed.slice(laborStatement.length + 1),
    });
    assert.notEqual(hash(legacy), hash(saved));
    const previous = { ...evidence,
      agreementVersion: evidence.agreementVersion.replace(/checkout:6\|lang:..$/, "checkout:5|lang:en"),
    };
    delete previous.language;
    assert.notEqual(hash(JSON.stringify(previous)), hash(saved));
    assert.notEqual(hash(JSON.stringify({ ...evidence, language: language === "en" ? "es" : "en" })), hash(saved));
    assert.equal(evidence.policyRelease.language, language);
    assert.deepEqual(evidence.policyRelease.documents.map(doc => doc.href),
      ["/terms", "/customer-agreement", "/payments"].map(href => language === "es" ? `/es${href}` : href));
    for (const document of evidence.policyRelease.documents) {
      if (language === "en") assert.equal(document.translation, undefined);
      else {
        assert.equal(document.translation.englishBodyHash, document.canonicalBodyHash);
        assert.match(document.translation.translationBodyHash, /^[a-f0-9]{64}$/);
        assert.equal(document.translation.acceptanceTextHash, undefined);
      }
    }
    assert.equal(JSON.stringify(input), before);
  });
}

test("changed provider text or price cannot keep an earlier exact-record hash", async () => {
  const original = await acceptance.customerCheckoutAgreementHash(scope, "en");
  for (const change of [
    { providerLegalName: "SYNTHETIC different provider" },
    { workmanshipWarranty: "SYNTHETIC different warranty" },
    { serviceCodes: ["SYNTHETIC-OTHER-SERVICE"] },
    { scheduledFor: "2026-10-02T12:00:00Z" },
    { performingPersonId: "synthetic-other-performer" },
    { supervisorPersonId: "synthetic-supervisor" },
    { providerLegalIdentityReviewDecisionId: "synthetic-new-review" },
    { laborAmountCents: 20000, providerAmountCents: 20000, customerFeeCents: 1000, customerTotalCents: 21000 },
  ]) for (const language of ["en", "es"]) assert.notEqual(await acceptance.customerCheckoutAgreementHash({ ...scope, ...change }, language), original);
});

test("Spanish presentation rejects missing, malformed, stale and future translation releases", () => {
  const policy = load("./lib/customer-policy-acceptance");
  const releases = load("./config/policy-spanish-releases.json");
  for (const document of policy.customerAcceptanceDocumentsForPurpose("checkout")) {
    const current = releases[document.key];
    assert.equal(policy.customerPolicyTranslationIsCurrent(document, current), true);
    for (const invalid of [null, undefined, {}, { ...current, englishBodyHash: "0".repeat(64) },
      { ...current, translationBodyHash: "wrong" }, { ...current, releaseId: " " },
      { ...current, effectiveAt: "invalid" }, { ...current, effectiveAt: "2999-01-01T00:00:00Z" }]) {
      assert.equal(policy.customerPolicyTranslationIsCurrent(document, invalid), false);
    }
    assert.equal(policy.customerPolicyTranslationIsCurrent({ ...document, releaseStatus: "draft" }, current), false);
  }
  assert.throws(() => policy.customerPolicyPresentationEvidence("checkout", "fr"), /not current/);
  for (const purpose of ["request_scope", "provider_selection"]) {
    const legacy = policy.customerPolicyReleaseEvidence(purpose);
    assert.equal(legacy.schemaVersion, "1");
    assert.equal(legacy.language, undefined);
    assert.ok(legacy.documents.every(document => !document.href.startsWith("/es/")));
  }
});
