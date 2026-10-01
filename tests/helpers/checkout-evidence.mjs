import { readFileSync } from "node:fs";
import ts from "typescript";

const root = new URL("../../", import.meta.url);
const modules = new Map();
export function checkoutModule(path, parent = root) {
  let url = new URL(path, parent);
  if (url.pathname.endsWith(".json")) return JSON.parse(readFileSync(url, "utf8"));
  if (!url.pathname.endsWith(".ts")) url = new URL(`${url.href}.ts`);
  if (modules.has(url.href)) return modules.get(url.href);
  const exports = {};
  modules.set(url.href, exports);
  const compiled = ts.transpileModule(readFileSync(url, "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  new Function("exports", "require", compiled)(exports, name => {
    if (!name.startsWith(".")) throw new Error("Only local checkout evidence modules may be loaded");
    return checkoutModule(name, url);
  });
  return exports;
}

export const syntheticCheckoutScope = {
  requestId: "synthetic-request", quoteId: "synthetic-quote", scopeVersion: 1,
  scopeAuthorizationDecisionId: "synthetic-decision",
  providerApplicationId: "synthetic-provider", providerLegalName: "SYNTHETIC Álvarez & Sons <Test>",
  providerLegalIdentitySourceEvidenceId: "synthetic-source",
  providerLegalIdentityReviewDecisionId: "synthetic-review",
  providerLegalIdentityVerifiedAt: "2026-09-30T00:00:00Z",
  performingPersonId: "synthetic-performer", supervisorPersonId: "none",
  serviceCodes: ["SYNTHETIC-SERVICE"], scheduledFor: "2026-10-01T12:00:00Z",
  workmanshipWarranty: "", laborAmountCents: 10000, partsAmountCents: 0,
  taxAmountCents: 0, otherAmountCents: 0, providerAmountCents: 10000,
  customerFeeRateBps: 500, customerFeeCents: 500, customerTotalCents: 10500,
};

export async function syntheticCheckoutAcceptance(language, overrides = {}) {
  const scope = { ...syntheticCheckoutScope, ...overrides };
  const acceptance = checkoutModule("./lib/customer-checkout-acceptance");
  const agreementText = acceptance.customerCheckoutAgreementEvidenceText(scope, language);
  const evidence = JSON.parse(agreementText);
  return {
    language, agreementKey: evidence.agreementKey, agreementVersion: evidence.agreementVersion,
    agreementHash: await acceptance.customerCheckoutAgreementHash(scope, language),
    agreementText, policyRelease: evidence.policyRelease, presentedText: evidence.presentedText,
    cancellationRefundSummary: evidence.scopeSnapshot.cancellationRefundSummary, scope,
  };
}
