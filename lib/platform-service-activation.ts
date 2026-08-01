import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../db";
import { serviceActivationDecisions } from "../db/schema";
import {
  annualComplianceReviewWindowIsValid,
  hasCompleteMandatoryLegalComplianceEvidence,
} from "./legal-compliance-evidence";
import { POLICY_VERSION, SERVICES } from "./provider-policy";

export const PLATFORM_SERVICE_ACTIVATION_PROVIDER_ID = "__tuveloz_platform__";
export const PLATFORM_SERVICE_ACTIVATION_STAGE = "configuration";
export const PLATFORM_SERVICE_ACTIVATION_RULES_VERSION = "0.11.0";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function parseObject(value: string) {
  try {
    return asRecord(JSON.parse(value) as unknown);
  } catch {
    return {};
  }
}

function nonblank(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function dateValue(value: string, endOfDate = false) {
  const normalized = endOfDate && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T23:59:59.999Z`
    : value;
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function activationInsurerEvidenceIsCurrent(
  context: Record<string, unknown>,
  through: number | Date = Date.now(),
  now = Date.now(),
) {
  const nested = asRecord(context.insurer);
  const approvedAt = nonblank(context.insurerApprovedAt) || nonblank(nested.approvedAt);
  const validThrough = nonblank(context.insurerValidThrough) || nonblank(nested.validThrough);
  const approvedBy = nonblank(context.insurerApprovedBy) || nonblank(nested.approvedBy);
  const reference = nonblank(context.insurerReference) || nonblank(nested.reference);
  return Boolean(
    annualComplianceReviewWindowIsValid(approvedAt, validThrough, through, now)
    && approvedBy
    && reference,
  );
}

export async function currentPlatformServiceActivations(now = Date.now()) {
  const rows = await getDb().select().from(serviceActivationDecisions)
    .where(and(
      eq(
        serviceActivationDecisions.providerId,
        PLATFORM_SERVICE_ACTIVATION_PROVIDER_ID,
      ),
      eq(serviceActivationDecisions.personId, ""),
      eq(
        serviceActivationDecisions.stage,
        PLATFORM_SERVICE_ACTIVATION_STAGE,
      ),
    ))
    .orderBy(
      desc(serviceActivationDecisions.decisionVersion),
      desc(serviceActivationDecisions.decidedAt),
    );
  const latest = new Map<string, typeof serviceActivationDecisions.$inferSelect>();
  for (const row of rows) {
    const key = `${row.serviceCode}|${row.jurisdiction}`;
    if (!latest.has(key)) latest.set(key, row);
  }
  const enabledCodes = new Set<string>(
    SERVICES.filter((service) => (
      service.launchState === "enabled" && service.customerVisible
    )).map((service) => service.code),
  );
  return [...latest.values()].filter((activation) => {
    const context = parseObject(activation.jobContext);
    const validThrough = dateValue(activation.validThrough, true);
    return activation.decision === "enabled_live"
      && activation.policyVersion === POLICY_VERSION
      && activation.rulesEngineVersion === PLATFORM_SERVICE_ACTIVATION_RULES_VERSION
      && enabledCodes.has(activation.serviceCode)
      && validThrough !== null
      && validThrough >= now
      && hasCompleteMandatoryLegalComplianceEvidence(context, {
        serviceCode: activation.serviceCode,
        jurisdiction: activation.jurisdiction,
      }, validThrough)
      && activationInsurerEvidenceIsCurrent(context, validThrough, now);
  });
}

export async function currentPlatformActiveServiceCodes(
  jurisdiction: string,
  now = Date.now(),
) {
  const activations = await currentPlatformServiceActivations(now);
  return new Set(activations
    .filter((activation) => activation.jurisdiction === jurisdiction)
    .map((activation) => activation.serviceCode));
}
