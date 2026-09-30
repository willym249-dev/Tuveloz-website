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

for (const warranty of ["", "SYNTHETIC garantía: Terms of Use & <test>"]) {
  test(`complete checkout evidence includes the labor-only statement and ${warranty ? "literal provider warranty" : "no-warranty disclosure"}`, async () => {
    const input = { ...scope, workmanshipWarranty: warranty };
    const before = JSON.stringify(input);
    const displayed = acceptance.customerCheckoutAcceptanceText(input);
    const saved = acceptance.customerCheckoutAgreementEvidenceText(input);
    const evidence = JSON.parse(saved);
    assert.ok(displayed.startsWith(`${laborStatement} I agree to`));
    assert.equal(displayed.split(laborStatement).length - 1, 1);
    assert.equal(evidence.presentedText, displayed);
    assert.ok(displayed.includes(input.providerLegalName));
    assert.ok(displayed.includes("Customer Service Fee $5.00; customer total $105.00."));
    assert.ok(displayed.includes(warranty || "The provider business offers no workmanship warranty for this job."));
    assert.equal(evidence.scopeSnapshot.workmanshipWarranty, warranty);
    assert.equal(await acceptance.customerCheckoutAgreementHash(input), hash(saved));
    assert.equal(evidence.language, "en");
    assert.match(evidence.agreementVersion, /\|checkout:5\|lang:en$/);
    assert.ok(evidence.agreementVersion.length <= 300);
    // New presentations use a distinct immutable-record key; an older record
    // is never relabeled as if it included the previously omitted statement.
    const legacy = JSON.stringify({ ...evidence,
      agreementVersion: evidence.agreementVersion.replace(/checkout:5\|lang:en$/, "checkout:3"),
      presentedText: displayed.slice(laborStatement.length + 1),
    });
    assert.notEqual(hash(legacy), hash(saved));
    const previous = { ...evidence,
      agreementVersion: evidence.agreementVersion.replace(/checkout:5\|lang:en$/, "checkout:4"),
    };
    delete previous.language;
    assert.notEqual(hash(JSON.stringify(previous)), hash(saved));
    assert.notEqual(hash(JSON.stringify({ ...evidence, language: "es" })), hash(saved));
    assert.equal(JSON.stringify(input), before);
  });
}

test("changed provider text or price cannot keep an earlier exact-record hash", async () => {
  const original = await acceptance.customerCheckoutAgreementHash(scope);
  for (const change of [
    { providerLegalName: "SYNTHETIC different provider" },
    { workmanshipWarranty: "SYNTHETIC different warranty" },
    { laborAmountCents: 20000, providerAmountCents: 20000, customerFeeCents: 1000, customerTotalCents: 21000 },
  ]) assert.notEqual(await acceptance.customerCheckoutAgreementHash({ ...scope, ...change }), original);
});
