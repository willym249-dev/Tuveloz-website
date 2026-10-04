import type { jobScopeVersions, providerInvoices, stripePayments } from "../db/schema";
import { isServiceCode, SERVICE_CODES } from "./provider-policy";

type Payment = typeof stripePayments.$inferSelect;
type Scope = typeof jobScopeVersions.$inferSelect;
type Invoice = typeof providerInvoices.$inferSelect;
type Evidence<T> = { state: "matched"; record: T; amountMatchesPayment: boolean }
  | { state: "missing" | "mismatched" | "malformed" | "unavailable"; record: null; amountMatchesPayment: null };
type Price = {
  laborAmountCents: number; partsAmountCents: number; taxAmountCents: number; otherAmountCents: number;
  totalAmountCents: number; customerFeeRateBps: number; customerFeeCents: number; customerTotalCents: number;
};
type ScopeRecord = {
  id: string; scopeVersion: number; authorizationDecisionId: string; serviceCodes: string[];
  customerAuthorizedAt: string; price: Price;
};
type InvoiceRecord = {
  id: string; invoiceNumber: string; scopeVersion: number; status: "draft" | "final"; serviceCodes: string[];
  laborAmountCents: number; partsAmountCents: number; taxAmountCents: number; otherAmountCents: number;
  totalAmountCents: number; issuedAt: string; workSummary: string;
};
export type RefundScopeEvidence = { scope: Evidence<ScopeRecord>; invoice: Evidence<InvoiceRecord> };

const priceKeys = ["laborAmountCents", "partsAmountCents", "taxAmountCents", "otherAmountCents", "totalAmountCents",
  "customerFeeRateBps", "customerFeeCents", "customerTotalCents"] as const;
const itemKeys = ["laborAmountCents", "partsAmountCents", "taxAmountCents", "otherAmountCents"] as const;
const absent = (state: "missing" | "mismatched" | "malformed" | "unavailable") =>
  ({ state, record: null, amountMatchesPayment: null });
const cents = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const text = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const date = (value: unknown): value is string => text(value) && Number.isFinite(Date.parse(value));

function serviceCodes(value: string): string[] | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed) || !parsed.length || parsed.length > SERVICE_CODES.length
      || !parsed.every(code => isServiceCode(code) && code !== "general_auto_repair")
      || new Set(parsed).size !== parsed.length) return null;
    return parsed;
  } catch { return null; }
}

// Read the existing checkout price shape, returning only known numeric fields.
// This is evidence validation, never new pricing, eligibility or refund policy.
function price(value: string): Price | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const fields = parsed as Record<string, unknown>;
    if (!priceKeys.every(key => cents(fields[key]))) return null;
    const result = Object.fromEntries(priceKeys.map(key => [key, fields[key]])) as Price;
    if (result.totalAmountCents <= 0
      || itemKeys.reduce((sum, key) => sum + BigInt(result[key]), BigInt(0)) !== BigInt(result.totalAmountCents)
      || BigInt(result.totalAmountCents) + BigInt(result.customerFeeCents) !== BigInt(result.customerTotalCents)) return null;
    const feeNumerator = BigInt(result.totalAmountCents) * BigInt(result.customerFeeRateBps);
    if ((feeNumerator + BigInt(5000)) / BigInt(10000) !== BigInt(result.customerFeeCents)) return null;
    return result;
  } catch { return null; }
}

/** Saved identity and amount comparison only; neither establishes completed work or a refund entitlement. */
export function refundScopeEvidence(payment: Payment | null, scopes: Scope[], invoices: Invoice[]): RefundScopeEvidence {
  if (!payment || !text(payment.requestId) || !text(payment.quoteId) || !text(payment.providerApplicationId)
    || !Number.isSafeInteger(payment.scopeVersion) || payment.scopeVersion <= 0 || !text(payment.scopeAuthorizationDecisionId)) {
    return { scope: absent("unavailable"), invoice: absent("unavailable") };
  }
  const paidPrice = price(payment.authorizedPriceSnapshot);
  const paidAmountsValid = cents(payment.providerAmountCents) && cents(payment.applicationFeeCents) && cents(payment.customerTotalCents);
  let scope: Evidence<ScopeRecord> = absent("missing");
  if (scopes.length > 1) scope = absent("mismatched");
  else if (scopes.length) {
    const row = scopes[0];
    if (row.requestId !== payment.requestId || row.quoteId !== payment.quoteId || row.version !== payment.scopeVersion
      || row.authorizationDecisionId !== payment.scopeAuthorizationDecisionId || row.createdByProviderId !== payment.providerApplicationId) {
      scope = absent("mismatched");
    } else {
      const codes = serviceCodes(row.serviceCodes), savedPrice = price(row.priceBreakdown);
      if (!text(row.id) || !date(row.customerAuthorizedAt) || !codes || !savedPrice || !paidPrice || !paidAmountsValid) scope = absent("malformed");
      else scope = { state: "matched", record: { id: row.id, scopeVersion: row.version,
        authorizationDecisionId: row.authorizationDecisionId, serviceCodes: codes, customerAuthorizedAt: row.customerAuthorizedAt, price: savedPrice },
      amountMatchesPayment: priceKeys.every(key => savedPrice[key] === paidPrice[key])
        && savedPrice.totalAmountCents === payment.providerAmountCents && savedPrice.customerFeeCents === payment.applicationFeeCents
        && savedPrice.customerTotalCents === payment.customerTotalCents };
    }
  }
  let invoice: Evidence<InvoiceRecord> = absent("missing");
  if (invoices.length > 1) invoice = absent("mismatched");
  else if (invoices.length) {
    const row = invoices[0];
    if (row.requestId !== payment.requestId || row.quoteId !== payment.quoteId || row.scopeVersion !== payment.scopeVersion
      || row.providerId !== payment.providerApplicationId) invoice = absent("mismatched");
    else {
      const codes = serviceCodes(row.serviceCodes);
      if (!text(row.id) || !text(row.invoiceNumber) || !codes || !paidPrice || !paidAmountsValid
        || !["draft", "final"].includes(row.status) || !text(row.workSummary) || row.workSummary.length > 2400
        || ![...itemKeys, "totalAmountCents" as const].every(key => cents(row[key]))
        || itemKeys.reduce((sum, key) => sum + BigInt(row[key]), BigInt(0)) !== BigInt(row.totalAmountCents)
        || (row.status === "final" ? !date(row.issuedAt) : row.issuedAt !== "")) invoice = absent("malformed");
      else invoice = { state: "matched", record: { id: row.id, invoiceNumber: row.invoiceNumber, scopeVersion: row.scopeVersion,
        status: row.status as "draft" | "final", serviceCodes: codes, laborAmountCents: row.laborAmountCents,
        partsAmountCents: row.partsAmountCents, taxAmountCents: row.taxAmountCents, otherAmountCents: row.otherAmountCents,
        totalAmountCents: row.totalAmountCents, issuedAt: row.issuedAt, workSummary: row.workSummary },
      amountMatchesPayment: itemKeys.every(key => row[key] === paidPrice[key]) && row.totalAmountCents === payment.providerAmountCents
        && paidPrice.totalAmountCents === payment.providerAmountCents && paidPrice.customerFeeCents === payment.applicationFeeCents
        && paidPrice.customerTotalCents === payment.customerTotalCents };
    }
  }
  return { scope, invoice };
}
