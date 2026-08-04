import {
  CUSTOMER_AGREEMENT_VERSION,
  CUSTOMER_POLICY_BUNDLE_VERSION,
  PAYMENT_POLICY_VERSION,
  PRIVACY_VERSION,
  TERMS_VERSION,
} from "./policies";
import {
  jobScopeFactsSnapshot,
  parseJobScopeFacts,
  type JobScopeFacts,
} from "./job-scope-facts";
import { isServiceCode, type ServiceCode } from "./provider-policy";
import { sha256Text } from "./provider-policy-acceptance";
import { customerPolicyReleaseEvidence } from "./customer-policy-acceptance";

export const CUSTOMER_REQUEST_SCOPE_VERSION = 1;
export const CUSTOMER_REQUEST_AGREEMENT_KEY = "customer_request_scope";
export const CUSTOMER_REQUEST_AGREEMENT_VERSION = [
  `terms:${TERMS_VERSION}`,
  `customer:${CUSTOMER_AGREEMENT_VERSION}`,
  "request-scope:3",
].join("|");
export const CUSTOMER_REQUEST_PRIVACY_AGREEMENT_KEY =
  "customer_request_privacy_acknowledgment";
export const CUSTOMER_REQUEST_PRIVACY_AGREEMENT_VERSION =
  `privacy:${PRIVACY_VERSION}|request-privacy:2`;
export const CUSTOMER_PROVIDER_SELECTION_AGREEMENT_KEY =
  "customer_provider_quote_selection";
export const CUSTOMER_PROVIDER_SELECTION_AGREEMENT_VERSION = [
  `terms:${TERMS_VERSION}`,
  `customer:${CUSTOMER_AGREEMENT_VERSION}`,
  `payments:${PAYMENT_POLICY_VERSION}`,
  "provider-quote-selection:3",
].join("|");

export const CUSTOMER_REQUEST_ACCEPTANCE_TEXT =
  "I am 18 or older and authorized to request service for this vehicle and location. I agree to the linked Terms of Use and Customer Agreement. I certify that the exact operation, excluded operations, address, property authority, vehicle condition, driveability, high-voltage status, and safety attestations above are accurate. I understand that every Tuveloz quote and payment is for labor only; OEM or aftermarket selections are communication preferences for parts I purchase separately, and no provider-supplied parts, parts reimbursement, or parts charge may be included. This acceptance authorizes TUVELOZ to store and route only that exact submitted scope; it does not authorize a repair, payment, added work, substitute part, price increase, or provider selection. TUVELOZ operates the marketplace and does not perform the vehicle service.";
export const CUSTOMER_REQUEST_PRIVACY_ACKNOWLEDGMENT_TEXT =
  "I separately acknowledge that I reviewed the Privacy Policy and understand how TUVELOZ handles the customer, vehicle, location, request, photo, communications, and service records submitted for this request.";

export type CustomerRequestScope = {
  requestId: string;
  scopeVersion: number;
  serviceCodes: readonly ServiceCode[];
  jurisdiction: string;
  municipality: string;
  scheduledFor: string;
  vehicle: string;
  zip: string;
  launchArea: string;
  serviceLocations: string;
  serviceAddress: string;
  partsSource: string;
  partsPreference: string;
  details: string;
  hasIssueImage: boolean;
  jobFacts: JobScopeFacts;
  routingActivationDecisionIds?: readonly string[];
  routingLaunchReadinessDecisionIds?: readonly string[];
  routingLaunchReadinessCheckedAt?: string;
};

export type CustomerQuoteSelectionScope = {
  request: CustomerRequestScope;
  quote: {
    quoteId: string;
    providerId: string;
    providerName: string;
    performingPersonId: string;
    performingPersonDisplay: string;
    supervisorPersonId: string;
    serviceCodes: readonly ServiceCode[];
    scheduledFor: string;
    scopeVersion: number;
    laborPriceCents: string;
    partsPriceCents: string;
    providerSubtotalCents: string;
    customerFeeRateBps: number;
    customerFeeCents: string;
    customerTotalCents: string;
    partType: string;
    availability: string;
    message: string;
    confirmedCredentialLabels: readonly string[];
    yearsExperience: string;
  };
};

export function parseExactServiceCodes(value: unknown): ServiceCode[] {
  let values: unknown[] = [];
  if (Array.isArray(value)) {
    values = value;
  } else if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      values = Array.isArray(parsed) ? parsed : [trimmed];
    } catch {
      values = [trimmed];
    }
  }

  const serviceCodes: ServiceCode[] = [];
  for (const value of values) {
    if (typeof value !== "string") return [];
    const normalized = value.trim();
    if (!isServiceCode(normalized) || normalized === "general_auto_repair") return [];
    if (!serviceCodes.includes(normalized)) serviceCodes.push(normalized);
  }
  return serviceCodes;
}

function wallClockParts(value: string) {
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/,
  );
  if (!match) return null;
  const parts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] ?? "0"),
  };
  const utc = new Date(Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  ));
  if (
    utc.getUTCFullYear() !== parts.year
    || utc.getUTCMonth() + 1 !== parts.month
    || utc.getUTCDate() !== parts.day
    || utc.getUTCHours() !== parts.hour
    || utc.getUTCMinutes() !== parts.minute
    || utc.getUTCSeconds() !== parts.second
  ) return null;
  return parts;
}

function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

function partsAsUtc(parts: ReturnType<typeof zonedParts>) {
  return Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
}

/**
 * Converts the intake's Maryland wall-clock value into one stored instant.
 * A nonexistent or ambiguous DST wall time is rejected instead of silently
 * shifted or assigned an offset the customer did not choose.
 */
export function normalizeScheduledFor(
  value: unknown,
  timeZone = "America/New_York",
) {
  if (typeof value !== "string") return "";
  const normalized = value.trim();
  if (!normalized) return "";
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(normalized)) {
    const parsed = new Date(normalized);
    return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : "";
  }

  const desired = wallClockParts(normalized);
  if (!desired) return "";
  const desiredAsUtc = partsAsUtc(desired);
  let candidate = desiredAsUtc;
  for (let index = 0; index < 3; index += 1) {
    const observed = zonedParts(new Date(candidate), timeZone);
    candidate += desiredAsUtc - partsAsUtc(observed);
  }
  const result = new Date(candidate);
  const observed = zonedParts(result, timeZone);
  if (partsAsUtc(observed) !== desiredAsUtc) return "";
  const oneHour = 60 * 60 * 1000;
  const ambiguous = [-oneHour, oneHour].some((offset) => (
    partsAsUtc(zonedParts(new Date(candidate + offset), timeZone)) === desiredAsUtc
  ));
  return ambiguous ? "" : result.toISOString();
}

export function customerRequestScopeSnapshot(scope: CustomerRequestScope) {
  const factsSnapshot = jobScopeFactsSnapshot(scope.jobFacts);
  if (!factsSnapshot) throw new Error("A valid structured job-fact snapshot is required.");
  return JSON.stringify({
    requestId: scope.requestId,
    scopeVersion: scope.scopeVersion,
    serviceCodes: [...scope.serviceCodes],
    jurisdiction: scope.jurisdiction,
    municipality: scope.municipality,
    scheduledFor: scope.scheduledFor,
    vehicle: scope.vehicle,
    zip: scope.zip,
    launchArea: scope.launchArea,
    serviceLocations: scope.serviceLocations,
    serviceAddress: scope.serviceAddress,
    partsSource: scope.partsSource,
    partsPreference: scope.partsPreference,
    details: scope.details,
    hasIssueImage: scope.hasIssueImage,
    jobFacts: JSON.parse(factsSnapshot) as unknown,
    routingActivationDecisionIds: [...(scope.routingActivationDecisionIds ?? [])],
    routingLaunchReadinessDecisionIds: [
      ...(scope.routingLaunchReadinessDecisionIds ?? []),
    ],
    routingLaunchReadinessCheckedAt: scope.routingLaunchReadinessCheckedAt ?? "",
  });
}

function scopeString(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function parseCustomerRequestScopeSnapshot(
  value: unknown,
): CustomerRequestScope | null {
  let parsed: unknown = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value) as unknown;
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const record = parsed as Record<string, unknown>;
  const serviceCodes = parseExactServiceCodes(record.serviceCodes);
  const jobFacts = parseJobScopeFacts(record.jobFacts);
  const requestId = scopeString(record.requestId, 100);
  const jurisdiction = scopeString(record.jurisdiction, 100);
  const municipality = scopeString(record.municipality, 100);
  const scheduledFor = scopeString(record.scheduledFor, 80);
  const vehicle = scopeString(record.vehicle, 320);
  const zip = scopeString(record.zip, 10);
  const launchArea = scopeString(record.launchArea, 100);
  const serviceLocations = scopeString(record.serviceLocations, 200);
  const serviceAddress = scopeString(record.serviceAddress, 240);
  const partsSource = scopeString(record.partsSource, 100);
  const partsPreference = scopeString(record.partsPreference, 100);
  const details = scopeString(record.details, 1500);
  const routingActivationDecisionIds = Array.isArray(record.routingActivationDecisionIds)
    ? record.routingActivationDecisionIds.filter((value): value is string => (
        typeof value === "string" && value.trim().length > 0
      )).map((value) => value.trim()).slice(0, 50)
    : [];
  const routingLaunchReadinessDecisionIds = Array.isArray(record.routingLaunchReadinessDecisionIds)
    ? record.routingLaunchReadinessDecisionIds.filter((value): value is string => (
        typeof value === "string" && value.trim().length > 0
      )).map((value) => value.trim()).slice(0, 50)
    : [];
  const routingLaunchReadinessCheckedAt = scopeString(
    record.routingLaunchReadinessCheckedAt,
    80,
  );
  if (
    record.scopeVersion !== CUSTOMER_REQUEST_SCOPE_VERSION
    || serviceCodes.length !== 1
    || !jobFacts
    || jobFacts.requestedOperations.length !== 1
    || jobFacts.requestedOperations[0].serviceCode !== serviceCodes[0]
    || jobFacts.location.address !== serviceAddress
    || jobFacts.location.municipality !== municipality
    || jobFacts.location.postalCode !== zip
    || jobFacts.location.jurisdiction !== jurisdiction
    || !requestId
    || !jurisdiction
    || !municipality
    || !scheduledFor
    || !Number.isFinite(Date.parse(scheduledFor))
    || !vehicle
    || !zip
    || !launchArea
    || !serviceLocations
    || !serviceAddress
    || !partsSource
    || !partsPreference
    || !details
    || typeof record.hasIssueImage !== "boolean"
  ) return null;
  return {
    requestId,
    scopeVersion: CUSTOMER_REQUEST_SCOPE_VERSION,
    serviceCodes,
    jurisdiction,
    municipality,
    scheduledFor,
    vehicle,
    zip,
    launchArea,
    serviceLocations,
    serviceAddress,
    partsSource,
    partsPreference,
    details,
    hasIssueImage: record.hasIssueImage,
    jobFacts,
    routingActivationDecisionIds,
    routingLaunchReadinessDecisionIds,
    routingLaunchReadinessCheckedAt,
  };
}

export function customerQuoteSelectionScopeSnapshot(
  scope: CustomerQuoteSelectionScope,
) {
  return JSON.stringify({
    request: JSON.parse(customerRequestScopeSnapshot(scope.request)) as unknown,
    quote: {
      quoteId: scope.quote.quoteId,
      providerId: scope.quote.providerId,
      providerName: scope.quote.providerName,
      performingPersonId: scope.quote.performingPersonId,
      performingPersonDisplay: scope.quote.performingPersonDisplay,
      supervisorPersonId: scope.quote.supervisorPersonId,
      serviceCodes: [...scope.quote.serviceCodes],
      scheduledFor: scope.quote.scheduledFor,
      scopeVersion: scope.quote.scopeVersion,
      laborPriceCents: scope.quote.laborPriceCents,
      partsPriceCents: scope.quote.partsPriceCents,
      providerSubtotalCents: scope.quote.providerSubtotalCents,
      customerFeeRateBps: scope.quote.customerFeeRateBps,
      customerFeeCents: scope.quote.customerFeeCents,
      customerTotalCents: scope.quote.customerTotalCents,
      partType: scope.quote.partType,
      availability: scope.quote.availability,
      message: scope.quote.message,
      confirmedCredentialLabels: [...scope.quote.confirmedCredentialLabels],
      yearsExperience: scope.quote.yearsExperience,
    },
  });
}

export function customerRequestAgreementEvidenceText(scopeSnapshot = "") {
  return JSON.stringify({
    agreementKey: CUSTOMER_REQUEST_AGREEMENT_KEY,
    agreementVersion: CUSTOMER_REQUEST_AGREEMENT_VERSION,
    termsVersion: TERMS_VERSION,
    customerAgreementVersion: CUSTOMER_AGREEMENT_VERSION,
    privacyVersion: PRIVACY_VERSION,
    acceptanceControl: "affirmative-customer-request-scope-checkbox",
    presentedText: CUSTOMER_REQUEST_ACCEPTANCE_TEXT,
    policyRelease: customerPolicyReleaseEvidence("request_scope"),
    ...(scopeSnapshot
      ? { scopeSnapshot: JSON.parse(scopeSnapshot) as unknown }
      : {}),
  });
}

export function customerRequestPrivacyAgreementEvidenceText(scopeSnapshot = "") {
  return JSON.stringify({
    agreementKey: CUSTOMER_REQUEST_PRIVACY_AGREEMENT_KEY,
    agreementVersion: CUSTOMER_REQUEST_PRIVACY_AGREEMENT_VERSION,
    privacyVersion: PRIVACY_VERSION,
    customerPolicyBundleVersion: CUSTOMER_POLICY_BUNDLE_VERSION,
    acceptanceControl: "affirmative-separate-customer-privacy-checkbox",
    presentedText: CUSTOMER_REQUEST_PRIVACY_ACKNOWLEDGMENT_TEXT,
    policyRelease: customerPolicyReleaseEvidence("request_scope"),
    ...(scopeSnapshot
      ? { scopeSnapshot: JSON.parse(scopeSnapshot) as unknown }
      : {}),
  });
}

/**
 * States plainly what is and isn't confirmed for this exact service — never
 * implying that missing optional info makes a provider less trustworthy.
 * Only the specific credential(s) actually required for the selected service
 * are described as "confirmed"; everything else is disclosed as
 * provider-supplied and explicitly optional.
 */
function providerDisclosureLine(scope: CustomerQuoteSelectionScope) {
  const { confirmedCredentialLabels, yearsExperience } = scope.quote;
  const confirmedText = confirmedCredentialLabels.length > 0
    ? `This provider has confirmed ${confirmedCredentialLabels.join(", ")} required for this service.`
    : "No license, registration, or insurance is legally required for this provider's selected service, so nothing is confirmed here.";
  const experienceText = yearsExperience
    ? `They have shared that they have ${yearsExperience} of experience — this is provider-supplied and not a legal requirement.`
    : "They have not provided their years of experience — this isn't legally required.";
  return `${confirmedText} ${experienceText} Compare their price, reviews, and completed jobs to decide if they're the right fit.`;
}

export function customerProviderSelectionAcceptanceText(
  scope: CustomerQuoteSelectionScope,
) {
  const serviceLabel = scope.quote.serviceCodes.join(", ");
  const amount = (Number(scope.quote.customerTotalCents) / 100).toFixed(2);
  const operationCodes = scope.request.jobFacts.requestedOperations
    .map((operation) => operation.operationCode)
    .join(", ");
  return [
    `I select ${scope.quote.providerName} and its disclosed performing person (${scope.quote.performingPersonDisplay}) for only the exact service code ${serviceLabel} and operation ${operationCodes}.`,
    `The authorized location is ${scope.request.jobFacts.location.address} (${scope.request.jobFacts.location.type}), with the stored property, vehicle-condition, excluded-operation, and safety attestations unchanged.`,
    providerDisclosureLine(scope),
    `I accept quote ${scope.quote.quoteId} for a displayed customer total of $${amount}, scheduled for ${scope.quote.scheduledFor}.`,
    "I confirm that the accepted provider amount is labor only. Any OEM or aftermarket preference concerns a part I purchase separately; no provider-supplied parts, parts reimbursement, parts tax, or other parts charge is included.",
    "I agree to the linked Terms of Use, Customer Agreement, and Payment, Cancellation and Refund Policy.",
    "Accepting this quote creates a direct service agreement with the selected provider business. TUVELOZ operates the marketplace and does not perform the vehicle service.",
    "No added work, substitute part, price increase, different performing person, or changed schedule is authorized by this acceptance; each material change requires a new recorded approval.",
  ].join(" ");
}

export function customerProviderSelectionAgreementEvidenceText(
  scope: CustomerQuoteSelectionScope,
) {
  return JSON.stringify({
    agreementKey: CUSTOMER_PROVIDER_SELECTION_AGREEMENT_KEY,
    agreementVersion: CUSTOMER_PROVIDER_SELECTION_AGREEMENT_VERSION,
    termsVersion: TERMS_VERSION,
    customerAgreementVersion: CUSTOMER_AGREEMENT_VERSION,
    paymentPolicyVersion: PAYMENT_POLICY_VERSION,
    acceptanceControl: "affirmative-provider-quote-selection-checkbox",
    presentedText: customerProviderSelectionAcceptanceText(scope),
    policyRelease: customerPolicyReleaseEvidence("provider_selection"),
    scopeSnapshot: JSON.parse(customerQuoteSelectionScopeSnapshot(scope)) as unknown,
  });
}

export async function customerRequestAgreementHash() {
  return sha256Text(customerRequestAgreementEvidenceText());
}

export async function customerRequestScopedAgreementHash(scopeSnapshot: string) {
  return sha256Text(customerRequestAgreementEvidenceText(scopeSnapshot));
}

export async function customerRequestPrivacyAgreementHash() {
  return sha256Text(customerRequestPrivacyAgreementEvidenceText());
}

export async function customerRequestScopedPrivacyAgreementHash(scopeSnapshot: string) {
  return sha256Text(customerRequestPrivacyAgreementEvidenceText(scopeSnapshot));
}

export async function customerProviderSelectionAgreementHash(
  scope: CustomerQuoteSelectionScope,
) {
  return sha256Text(customerProviderSelectionAgreementEvidenceText(scope));
}

export function requestIpAddress(request: Request) {
  const value = request.headers.get("cf-connecting-ip")
    || request.headers.get("x-forwarded-for")?.split(",")[0]
    || "";
  return value.trim().slice(0, 128);
}

export function customerAcceptanceDeviceContext(request: Request) {
  return JSON.stringify({
    userAgent: (request.headers.get("user-agent") ?? "").trim().slice(0, 600),
    language: (request.headers.get("accept-language") ?? "").trim().slice(0, 200),
    country: (request.headers.get("cf-ipcountry") ?? "").trim().slice(0, 20),
  });
}
