import { env } from "cloudflare:workers";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../db";
import {
  launchGateDecisions,
  evidenceFileScans,
  providerAuditEvents,
  providerIdentityVerificationSessions,
  providerPersonnel,
} from "../db/schema";
import {
  LAUNCH_GATE_CATALOG,
  launchDecisionState,
  stageIsApproved,
  type LaunchReviewStage,
  type StoredLaunchGateDecision,
} from "./launch-readiness";
import { MARKETPLACE_MODE } from "./launch-status";
import {
  allPolicyDocumentReleases,
  policyDocumentReleaseIsActive,
} from "./policy-release-manifest";
import { currentPlatformServiceActivations } from "./platform-service-activation";
import { POLICY_STATUS, SERVICES } from "./provider-policy";
import {
  CLOUDMERSIVE_ENGINE_VERSION,
  CLOUDMERSIVE_PROVIDER,
  cloudmersiveScannerConfigured,
} from "./cloudmersive-scan-policy";
import {
  configuredExternalIdentityVerificationProviders,
  externalIdentityAgeVerificationIsCurrent,
} from "./provider-verification-evidence";
import {
  stripeIdentityConfigurationReady,
  stripeIdentityKeyIsLive,
  stripeLiveModeEnabled,
} from "./stripe";

const IDENTITY_CANARY_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;
const SCANNER_CANARY_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const SCANNER_AUDIT_MAX_DELAY_MS = 5 * 60 * 1000;

export type RuntimeLaunchReadiness = {
  providerOnboardingApproved: boolean;
  transactionPilotApproved: boolean;
  providerOnboarding: RuntimeLaunchStageState;
  transactionPilot: RuntimeLaunchStageState;
  serviceActivationDecisionIds: string[];
  identityCanaries: RuntimeIdentityCanaries;
  evidenceScannerCanary: RuntimeEvidenceScannerCanary;
  checkedAt: string;
  validThrough: string;
};

export type RuntimeIdentityCanary = {
  configurationReady: boolean;
  evidencePassed: boolean;
  evidenceId: string;
  verifiedAt: string;
  reason:
    | "configuration_missing"
    | "current_guarded_evidence_missing"
    | "passed";
};

export type RuntimeIdentityCanaries = {
  stripe: RuntimeIdentityCanary;
  manual: RuntimeIdentityCanary;
};

export type RuntimeEvidenceScannerCanary = RuntimeIdentityCanary;

export type RuntimeLaunchStageState = {
  approved: boolean;
  decisionIds: string[];
  failures: Array<{ gateKey: string; state: string }>;
};

type RuntimeInternalCheck = {
  key: string;
  stage: LaunchReviewStage;
  passed: boolean;
};

function runtimeText(runtime: Record<string, unknown>, key: string) {
  const value = runtime[key];
  return typeof value === "string" ? value.trim() : "";
}

function earliestValidThrough(values: string[]) {
  return values
    .filter(Boolean)
    .map((value) => ({
      value,
      time: Date.parse(value.includes("T") ? value : `${value}T23:59:59.999Z`),
    }))
    .filter((item) => Number.isFinite(item.time))
    .sort((left, right) => left.time - right.time)[0]?.value ?? "";
}

function exactIsoTime(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed)
    && new Date(parsed).toISOString() === value
    ? parsed
    : null;
}

function exactUtcDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = Date.parse(`${value}T23:59:59.999Z`);
  return Number.isFinite(parsed)
    && new Date(parsed).toISOString().slice(0, 10) === value
    ? parsed
    : null;
}

function auditMetadata(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function metadataText(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key];
  return typeof value === "string" ? value : "";
}

function auditReasonCodes(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) && parsed.every((item) => typeof item === "string")
      ? parsed as string[]
      : null;
  } catch {
    return null;
  }
}

async function sha256RuntimeText(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function emptyIdentityCanary(
  configurationReady: boolean,
): RuntimeIdentityCanary {
  return {
    configurationReady,
    evidencePassed: false,
    evidenceId: "",
    verifiedAt: "",
    reason: configurationReady
      ? "current_guarded_evidence_missing"
      : "configuration_missing",
  };
}

/**
 * Produces database-backed canary evidence for the two identity paths. Runtime
 * credential/provider strings only make a path eligible for evaluation; they
 * can never pass the path without a current record produced by its guarded
 * persistence workflow.
 */
async function runtimeIdentityCanaries(now: number): Promise<RuntimeIdentityCanaries> {
  const db = getDb();
  const configuredProviders = configuredExternalIdentityVerificationProviders();
  const manualProviders = configuredProviders.filter((provider) => (
    provider !== "stripe_identity"
  ));
  const stripeConfigurationReady = configuredProviders.includes("stripe_identity")
    && stripeIdentityConfigurationReady()
    && stripeIdentityKeyIsLive();
  const canaries: RuntimeIdentityCanaries = {
    stripe: emptyIdentityCanary(stripeConfigurationReady),
    manual: emptyIdentityCanary(manualProviders.length > 0),
  };

  if (stripeConfigurationReady) {
    const stripeRows = await db.select({
      id: providerIdentityVerificationSessions.id,
      providerId: providerIdentityVerificationSessions.providerId,
      personId: providerIdentityVerificationSessions.personId,
      certificationVersion: providerIdentityVerificationSessions.certificationVersion,
      sessionId: providerIdentityVerificationSessions.stripeVerificationSessionId,
      reportId: providerIdentityVerificationSessions.stripeVerificationReportId,
      eventId: providerIdentityVerificationSessions.lastStripeEventId,
      eventCreated: providerIdentityVerificationSessions.lastStripeEventCreated,
      checkedAt: providerIdentityVerificationSessions.checkedAt,
      verifiedAt: providerIdentityVerificationSessions.verifiedAt,
      personnelId: providerPersonnel.id,
      personnelStatus: providerPersonnel.status,
      identityVerifiedAt: providerPersonnel.identityVerifiedAt,
      ageVerifiedAt: providerPersonnel.ageVerifiedAt,
      identityProvider: providerPersonnel.identityVerificationProvider,
      identityReference: providerPersonnel.identityVerificationReference,
      identityCheckedAt: providerPersonnel.identityVerificationCheckedAt,
      identityValidThrough: providerPersonnel.identityVerificationValidThrough,
      ageProvider: providerPersonnel.ageVerificationProvider,
      ageReference: providerPersonnel.ageVerificationReference,
      ageCheckedAt: providerPersonnel.ageVerificationCheckedAt,
      ageValidThrough: providerPersonnel.ageVerificationValidThrough,
    }).from(providerIdentityVerificationSessions).innerJoin(
      providerPersonnel,
      and(
        eq(
          providerPersonnel.providerId,
          providerIdentityVerificationSessions.providerId,
        ),
        eq(
          providerPersonnel.personId,
          providerIdentityVerificationSessions.personId,
        ),
        eq(
          providerPersonnel.identityVerificationReference,
          providerIdentityVerificationSessions.stripeVerificationSessionId,
        ),
        eq(
          providerPersonnel.ageVerificationReference,
          providerIdentityVerificationSessions.stripeVerificationSessionId,
        ),
      ),
    ).where(and(
      eq(providerIdentityVerificationSessions.livemode, 1),
      eq(providerIdentityVerificationSessions.decisionStatus, "approved"),
      eq(providerIdentityVerificationSessions.stripeStatus, "verified"),
      eq(providerPersonnel.status, "active"),
      eq(providerPersonnel.identityVerificationProvider, "stripe_identity"),
      eq(providerPersonnel.ageVerificationProvider, "stripe_identity"),
      sql`${providerPersonnel.rosterVersion} = (
        SELECT max(latest_personnel.roster_version)
        FROM provider_personnel AS latest_personnel
        WHERE latest_personnel.provider_id = ${providerPersonnel.providerId}
          AND latest_personnel.person_id = ${providerPersonnel.personId}
      )`,
    )).orderBy(desc(providerIdentityVerificationSessions.verifiedAt)).limit(50);

    const stripeCanary = stripeRows.find((row) => {
      const verifiedAt = exactIsoTime(row.verifiedAt);
      const eventTime = Number.isSafeInteger(row.eventCreated) && row.eventCreated > 0
        ? row.eventCreated * 1000
        : null;
      const identityValidThrough = exactUtcDate(row.identityValidThrough);
      const ageValidThrough = exactUtcDate(row.ageValidThrough);
      return verifiedAt !== null
        && verifiedAt <= now
        && now - verifiedAt <= IDENTITY_CANARY_MAX_AGE_MS
        && eventTime === verifiedAt
        && row.checkedAt === row.verifiedAt
        && /^vs_[A-Za-z0-9]+$/.test(row.sessionId)
        && /^vr_[A-Za-z0-9]+$/.test(row.reportId)
        && /^evt_[A-Za-z0-9]+$/.test(row.eventId)
        && row.certificationVersion
          === "stripe-identity-owner-operator-consent-2026-08-01-v1"
        && row.personnelStatus === "active"
        && row.identityProvider === "stripe_identity"
        && row.ageProvider === "stripe_identity"
        && row.identityReference === row.sessionId
        && row.ageReference === row.sessionId
        && row.identityCheckedAt === row.checkedAt
        && row.ageCheckedAt === row.checkedAt
        && row.identityVerifiedAt === row.checkedAt
        && row.ageVerifiedAt === row.checkedAt
        && identityValidThrough !== null
        && ageValidThrough !== null
        && identityValidThrough >= now
        && ageValidThrough >= now
        && externalIdentityAgeVerificationIsCurrent({
          identityVerificationProvider: row.identityProvider,
          identityVerificationReference: row.identityReference,
          identityVerificationCheckedAt: row.identityCheckedAt,
          identityVerificationValidThrough: row.identityValidThrough,
          ageVerificationProvider: row.ageProvider,
          ageVerificationReference: row.ageReference,
          ageVerificationCheckedAt: row.ageCheckedAt,
          ageVerificationValidThrough: row.ageValidThrough,
        }, new Date(now), now);
    });
    if (stripeCanary) {
      canaries.stripe = {
        configurationReady: true,
        evidencePassed: true,
        evidenceId: stripeCanary.id,
        verifiedAt: stripeCanary.verifiedAt,
        reason: "passed",
      };
    }
  }

  return canaries;
}

/**
 * A scanner provider name, callback-shaped secret, and API key are only
 * configuration. Operational readiness additionally requires a recent
 * Cloudmersive terminal response that the shared recorder atomically bound to
 * its pending request and then wrote to the hash-chained provider audit log.
 */
async function runtimeCloudmersiveCanary(
  now: number,
): Promise<RuntimeEvidenceScannerCanary> {
  const runtime = env as unknown as Record<string, unknown>;
  const configurationReady = cloudmersiveScannerConfigured(runtime);
  const empty = emptyIdentityCanary(configurationReady);
  if (!configurationReady) return empty;

  const db = getDb();
  const terminalRows = (await db.select().from(evidenceFileScans).where(and(
    eq(evidenceFileScans.scanProvider, CLOUDMERSIVE_PROVIDER),
    eq(evidenceFileScans.scanEngineVersion, CLOUDMERSIVE_ENGINE_VERSION),
    inArray(evidenceFileScans.status, ["clean", "infected", "failed"]),
  )).orderBy(desc(evidenceFileScans.completedAt)).limit(50)).filter((row) => {
    const completedAt = exactIsoTime(row.completedAt);
    const recordedAt = exactIsoTime(row.requestedAt);
    return completedAt !== null
      && recordedAt !== null
      && completedAt <= now
      && now - completedAt <= SCANNER_CANARY_MAX_AGE_MS
      && recordedAt >= completedAt
      && recordedAt - completedAt <= SCANNER_AUDIT_MAX_DELAY_MS
      && row.reviewedBy === `authenticated_scanner:${CLOUDMERSIVE_PROVIDER}`
      && /^[0-9a-f]{64}$/.test(row.fileHash);
  });
  if (terminalRows.length === 0) return empty;

  const evidenceIds = [...new Set(terminalRows.map((row) => row.evidenceSubmissionId))];
  const auditRows = await db.select().from(providerAuditEvents).where(and(
    eq(providerAuditEvents.eventType, "authenticated_evidence_scan_result"),
    eq(providerAuditEvents.entityType, "provider_evidence_submission"),
    eq(providerAuditEvents.actorType, "authenticated_scanner"),
    eq(providerAuditEvents.actorId, CLOUDMERSIVE_PROVIDER),
    inArray(providerAuditEvents.outcome, ["clean", "infected", "failed"]),
    inArray(providerAuditEvents.entityId, evidenceIds),
  )).orderBy(desc(providerAuditEvents.occurredAt));
  const requestIds = [...new Set(auditRows.flatMap((audit) => {
    const metadata = auditMetadata(audit.metadata);
    const requestId = metadata ? metadataText(metadata, "scanRequestId") : "";
    return requestId ? [requestId] : [];
  }))];
  if (requestIds.length === 0) return empty;
  const requestRows = await db.select().from(evidenceFileScans).where(and(
    inArray(evidenceFileScans.id, requestIds),
    eq(evidenceFileScans.status, "result_received"),
  ));

  for (const terminal of terminalRows) {
    const completedAt = exactIsoTime(terminal.completedAt);
    if (completedAt === null) continue;
    for (const audit of auditRows) {
      if (
        audit.providerId !== terminal.providerId
        || audit.entityId !== terminal.evidenceSubmissionId
        || audit.outcome !== terminal.status
        || !/^[0-9a-f]{64}$/.test(audit.eventHash)
      ) continue;
      const occurredAt = exactIsoTime(audit.occurredAt);
      if (
        occurredAt === null
        || occurredAt < completedAt
        || occurredAt - completedAt > SCANNER_AUDIT_MAX_DELAY_MS
      ) continue;
      const metadata = auditMetadata(audit.metadata);
      if (!metadata || metadata.evidenceAutomaticallyAccepted !== false) continue;
      const reasonCodes = auditReasonCodes(audit.reasonCodes);
      if (
        !reasonCodes
        || reasonCodes.length !== 1
        || reasonCodes[0] !== `malware_scan_${terminal.status}`
        || audit.createdAt !== audit.occurredAt
        || (audit.previousEventHash
          && !/^[0-9a-f]{64}$/.test(audit.previousEventHash))
      ) continue;
      const expectedAuditHash = await sha256RuntimeText(JSON.stringify({
        id: audit.id,
        providerId: audit.providerId,
        personId: audit.personId,
        requestId: audit.requestId,
        serviceCode: audit.serviceCode,
        jurisdiction: audit.jurisdiction,
        eventType: audit.eventType,
        entityType: audit.entityType,
        entityId: audit.entityId,
        actorType: audit.actorType,
        actorId: audit.actorId,
        outcome: audit.outcome,
        reasonCodes,
        metadata,
        policyVersion: audit.policyVersion,
        previousEventHash: audit.previousEventHash,
        occurredAt: audit.occurredAt,
      }));
      if (expectedAuditHash !== audit.eventHash) continue;
      const resultId = metadataText(metadata, "scanResultId");
      const requestId = metadataText(metadata, "scanRequestId");
      const engineVersion = metadataText(metadata, "scanEngineVersion");
      const reportReference = metadataText(metadata, "reportReference");
      if (
        !/^cloudmersive:[0-9a-f]{64}$/.test(resultId)
        || engineVersion !== CLOUDMERSIVE_ENGINE_VERSION
        || !/^cloudmersive-(?:correlation|response-sha256):[A-Za-z0-9_-]+$/.test(
          reportReference,
        )
        || terminal.reviewNotes
          !== `External scanner result ${resultId}; restricted report ${reportReference}`
        || terminal.id
          !== await sha256RuntimeText(`scanner-result:${CLOUDMERSIVE_PROVIDER}:${resultId}`)
      ) continue;
      const request = requestRows.find((row) => row.id === requestId);
      if (
        !request
        || request.evidenceSubmissionId !== terminal.evidenceSubmissionId
        || request.providerId !== terminal.providerId
        || request.fileHash !== terminal.fileHash
        || exactIsoTime(request.requestedAt) === null
        || Date.parse(request.requestedAt) > completedAt
      ) continue;
      return {
        configurationReady: true,
        evidencePassed: true,
        evidenceId: terminal.id,
        verifiedAt: terminal.completedAt,
        reason: "passed",
      };
    }
  }
  return empty;
}

function runtimeStableInternalChecks(
  identityCanaries: RuntimeIdentityCanaries,
  evidenceScannerCanary: RuntimeEvidenceScannerCanary,
): RuntimeInternalCheck[] {
  const runtime = env as unknown as Record<string, unknown>;
  const evidenceScanProvider = runtimeText(runtime, "EVIDENCE_SCAN_PROVIDER");
  const identityProviders = configuredExternalIdentityVerificationProviders();
  return [
    {
      key: "owner_access",
      stage: "provider_onboarding",
      passed: Boolean(
        runtimeText(runtime, "OWNER_EMAIL")
        && runtimeText(runtime, "TEAM_DOMAIN")
        && (runtimeText(runtime, "OWNER_ACCESS_AUD") || runtimeText(runtime, "POLICY_AUD")),
      ),
    },
    {
      key: "account_auth",
      stage: "provider_onboarding",
      passed: runtimeText(runtime, "AUTH_CODE_SECRET").length >= 32,
    },
    {
      key: "email_delivery",
      stage: "provider_onboarding",
      passed: Boolean(
        runtimeText(runtime, "RESEND_API_KEY")
        && runtimeText(runtime, "RESEND_FROM_EMAIL"),
      ),
    },
    {
      key: "private_evidence_storage",
      stage: "provider_onboarding",
      passed: Boolean(runtime.BUCKET),
    },
    {
      key: "authenticated_evidence_scanner",
      stage: "provider_onboarding",
      passed: evidenceScanProvider === CLOUDMERSIVE_PROVIDER
        && evidenceScannerCanary.evidencePassed,
    },
    {
      key: "approved_identity_verification_provider",
      stage: "provider_onboarding",
      passed: identityProviders.length > 0,
    },
    {
      key: "stripe_identity_automation",
      stage: "provider_onboarding",
      passed: identityCanaries.stripe.evidencePassed,
    },
    {
      key: "manual_identity_alternative",
      stage: "provider_onboarding",
      // An owner-entered reference and its owner-authored audit event are not
      // independent vendor proof, so a manual canary alone can never pass.
      // Launch requires at least one vendor-proven identity path, not two:
      // while the guarded Stripe canary is current, a second non-Stripe
      // adapter is optional redundancy. Individual applicants may still be
      // manually verified per provider record; this gate only reports whether
      // an independently proven path is operational.
      passed: identityCanaries.stripe.evidencePassed
        || identityCanaries.manual.evidencePassed,
    },
    {
      key: "active_policy_catalog",
      stage: "transaction_pilot",
      passed: String(POLICY_STATUS) === "active"
        && SERVICES.some((service) => (
          service.launchState === "enabled" && service.customerVisible
        )),
    },
    ...allPolicyDocumentReleases().map((release) => ({
      key: `policy_release_${release.key}`,
      stage: "transaction_pilot" as const,
      passed: policyDocumentReleaseIsActive(release),
    })),
  ];
}

function runtimeLiveInternalChecks(activeServiceCount: number): RuntimeInternalCheck[] {
  const runtime = env as unknown as Record<string, unknown>;
  const stripeKey = runtimeText(runtime, "STRIPE_SECRET_KEY");
  return [
    {
      key: "live_release_switches",
      stage: "transaction_pilot",
      passed: String(MARKETPLACE_MODE) === "live",
    },
    {
      key: "current_written_service_activation",
      stage: "transaction_pilot",
      passed: activeServiceCount > 0,
    },
    {
      key: "stripe_live_configuration",
      stage: "transaction_pilot",
      passed: stripeKey.startsWith("sk_live_")
        && runtimeText(runtime, "STRIPE_ALLOW_LIVE_MODE") === "true"
        && stripeLiveModeEnabled(),
    },
  ];
}

/**
 * Reads the latest version of every launch gate directly from D1. There is no
 * process cache: a blocked, expired, or replaced record must take effect on
 * the next request. Missing or malformed records remain fail-closed through
 * stageIsApproved().
 */
export async function runtimeLaunchReadiness(
  options: { includeLiveChecks?: boolean } = {},
): Promise<RuntimeLaunchReadiness> {
  const db = getDb();
  const requiredGates = LAUNCH_GATE_CATALOG.filter((gate) => gate.required);
  const now = Date.now();
  const [
    decisionRows,
    activeServiceActivations,
    identityCanaries,
    evidenceScannerCanary,
  ] = await Promise.all([
    Promise.all(requiredGates.map(async (gate) => {
      const [row] = await db.select().from(launchGateDecisions)
        .where(eq(launchGateDecisions.gateKey, gate.key))
        .orderBy(
          desc(launchGateDecisions.gateVersion),
          desc(launchGateDecisions.createdAt),
        )
        .limit(1);
      return row;
    })),
    currentPlatformServiceActivations(),
    runtimeIdentityCanaries(now),
    runtimeCloudmersiveCanary(now),
  ]);
  const rows = decisionRows
    .filter((row): row is NonNullable<typeof row> => Boolean(row));
  const latest = new Map<string, StoredLaunchGateDecision>();
  for (const row of rows) {
    if (!latest.has(row.gateKey)) latest.set(row.gateKey, row);
  }
  const internalChecks = [
    ...runtimeStableInternalChecks(identityCanaries, evidenceScannerCanary),
    ...(options.includeLiveChecks === false
      ? []
      : runtimeLiveInternalChecks(activeServiceActivations.length)),
  ];
  const stageState = (stage: LaunchReviewStage): RuntimeLaunchStageState => {
    const gates = requiredGates.filter((gate) => gate.stage === stage);
    const externalFailures = gates.flatMap((gate) => {
      const state = launchDecisionState(gate, latest.get(gate.key), now);
      return state === "approved" ? [] : [{ gateKey: gate.key, state }];
    });
    const internalFailures = internalChecks
      .filter((check) => check.stage === stage && !check.passed)
      .map((check) => ({ gateKey: `internal:${check.key}`, state: "not_ready" }));
    return {
      approved: stageIsApproved(stage, latest, now)
        && internalFailures.length === 0,
      decisionIds: gates.flatMap((gate) => {
        const decision = latest.get(gate.key);
        return decision ? [decision.id] : [];
      }),
      failures: [...externalFailures, ...internalFailures],
    };
  };
  const providerOnboarding = stageState("provider_onboarding");
  const transactionPilot = stageState("transaction_pilot");
  const validThrough = earliestValidThrough([
    ...requiredGates.map((gate) => latest.get(gate.key)?.validThrough ?? ""),
    ...(options.includeLiveChecks === false
      ? []
      : activeServiceActivations.map((activation) => activation.validThrough)),
  ]);
  return {
    providerOnboardingApproved: providerOnboarding.approved,
    transactionPilotApproved: transactionPilot.approved,
    providerOnboarding,
    transactionPilot,
    serviceActivationDecisionIds: options.includeLiveChecks === false
      ? []
      : activeServiceActivations.map((activation) => activation.id).sort(),
    identityCanaries,
    evidenceScannerCanary,
    checkedAt: new Date(now).toISOString(),
    validThrough,
  };
}

export async function runtimeLaunchStageIsApproved(stage: LaunchReviewStage) {
  const readiness = await runtimeLaunchReadiness();
  return stage === "provider_onboarding"
    ? readiness.providerOnboardingApproved
    : readiness.transactionPilotApproved;
}

export async function runtimeRealMarketplaceReleaseIsApproved() {
  return (await runtimeRealMarketplaceReleaseDecision()).approved;
}

function releaseDecisionFromReadiness(readiness: RuntimeLaunchReadiness) {
  return {
    approved: readiness.providerOnboardingApproved
      && readiness.transactionPilotApproved,
    checkedAt: readiness.checkedAt,
    validThrough: readiness.validThrough,
    providerOnboardingDecisionIds: readiness.providerOnboarding.decisionIds,
    transactionPilotDecisionIds: readiness.transactionPilot.decisionIds,
    serviceActivationDecisionIds: readiness.serviceActivationDecisionIds,
    decisionIds: [
      ...readiness.providerOnboarding.decisionIds,
      ...readiness.transactionPilot.decisionIds,
      ...readiness.serviceActivationDecisionIds,
    ],
    failures: [
      ...readiness.providerOnboarding.failures,
      ...readiness.transactionPilot.failures,
    ],
  };
}

function unavailableRuntimeDecision() {
  return {
    approved: false,
    checkedAt: new Date().toISOString(),
    validThrough: "",
    providerOnboardingDecisionIds: [] as string[],
    transactionPilotDecisionIds: [] as string[],
    serviceActivationDecisionIds: [] as string[],
    decisionIds: [] as string[],
    failures: [{ gateKey: "runtime_database", state: "unavailable" }],
  };
}

export async function runtimeProviderActivationPrerequisitesDecision() {
  try {
    return releaseDecisionFromReadiness(await runtimeLaunchReadiness({
      includeLiveChecks: false,
    }));
  } catch (error) {
    console.error("Runtime provider-activation prerequisite lookup failed closed", error);
    return unavailableRuntimeDecision();
  }
}

export async function runtimeRealMarketplaceReleaseDecision() {
  try {
    return releaseDecisionFromReadiness(await runtimeLaunchReadiness());
  } catch (error) {
    console.error("Runtime launch-readiness lookup failed closed", error);
    return unavailableRuntimeDecision();
  }
}
