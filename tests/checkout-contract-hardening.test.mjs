import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("checkout status reads remain available while new quote readiness fails closed", async () => {
  const route = await source("app/api/stripe/checkout/route.ts");
  const getRoute = route.slice(route.indexOf("export async function GET"), route.indexOf("export async function POST"));
  const sessionRead = getRoute.indexOf("if (sessionId)");
  const runtimeGate = getRoute.indexOf('runtimeMarketplaceActionAllowed("checkout")');
  const quoteRead = getRoute.indexOf("acceptedQuoteForCustomer(request, quoteId, token)");

  assert.ok(sessionRead >= 0 && sessionRead < runtimeGate);
  assert.ok(runtimeGate < quoteRead);
  assert.ok(runtimeGate < getRoute.indexOf("getStripeClient()"));
});

test("checkout agreement displays and hashes exact parties, work, schedule, and itemized price", async () => {
  const [acceptance, component] = await Promise.all([
    source("lib/customer-checkout-acceptance.ts"),
    source("app/components/quote-payment-card.tsx"),
  ]);

  for (const phrase of [
    "Provider legal identity:",
    "Exact service codes:",
    "Scheduled time:",
    "Performing person ID:",
    "Supervisor person ID:",
    "Itemized price:",
  ]) assert.ok(acceptance.includes(phrase), phrase);
  assert.match(acceptance, /providerLegalIdentitySourceEvidenceId/);
  assert.match(acceptance, /serviceCodes: \[\.\.\.scope\.serviceCodes\]/);
  assert.match(acceptance, /checkout:2/);

  for (const label of [
    "Provider legal identity",
    "Exact service codes",
    "Scheduled time",
    "Performing person ID",
    "Supervisor person ID",
    "Other charges",
    "Customer total",
  ]) assert.ok(component.includes(label), label);
});

test("applicant-only names cannot satisfy the legal-identity contract gate", async () => {
  const [route, identity] = await Promise.all([
    source("app/api/stripe/checkout/route.ts"),
    source("lib/provider-legal-identity.ts"),
  ]);

  assert.doesNotMatch(route, /providerSelfAssessment/);
  assert.match(route, /verifiedProviderLegalIdentity/);
  assert.match(identity, /admin_reviewed_provider_evidence/);
  assert.match(identity, /row\.status !== "accepted"/);
  assert.match(identity, /row\.reviewDecisionId/);
  assert.match(identity, /evidenceAuthenticityIsCurrent\(row, through, now\)/);
  assert.match(identity, /normalizedNames\.size !== 1/);
});

test("owner evidence review creates and clears the exact legal identity binding", async () => {
  const [route, page, identity] = await Promise.all([
    source("app/api/admin/provider-compliance/route.ts"),
    source("app/admin/provider-compliance/page.tsx"),
    source("lib/provider-legal-identity.ts"),
  ]);

  assert.match(route, /isBusinessIdentityEvidenceRequirement\(requirementKey\)/);
  assert.match(route, /legalBusinessNameConfirmed/);
  assert.match(route, /evidenceScopeWithLegalBusinessIdentity\(evidence\.evidenceScope/);
  assert.match(route, /evidenceScopeWithoutLegalBusinessIdentity\(evidence\.evidenceScope\)/);
  assert.match(route, /evidenceScope,/);
  assert.match(page, /Exact legal business name on the verified source/);
  assert.match(page, /name="legalBusinessNameConfirmed" required/);
  assert.match(page, /it is not copied only from the application/);
  assert.match(identity, /verificationSource: "admin_reviewed_provider_evidence"/);
  assert.match(identity, /verifiedAt !== row\.reviewedAt/);
  assert.match(identity, /verifiedBy !== row\.reviewedBy/);
});
