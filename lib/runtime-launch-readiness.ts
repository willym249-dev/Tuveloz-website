import { env } from "cloudflare:workers";
import { desc, eq } from "drizzle-orm";
import { getDb } from "../db";
import { launchGateDecisions } from "../db/schema";
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
import { configuredExternalIdentityVerificationProviders } from "./provider-verification-evidence";
import { stripeLiveModeEnabled } from "./stripe";

export type RuntimeLaunchReadiness = {
  providerOnboardingApproved: boolean;
  transactionPilotApproved: boolean;
  providerOnboarding: RuntimeLaunchStageState;
  transactionPilot: RuntimeLaunchStageState;
  serviceActivationDecisionIds: string[];
  checkedAt: string;
  validThrough: string;
};

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

function runtimeStableInternalChecks(): RuntimeInternalCheck[] {
  const runtime = env as unknown as Record<string, unknown>;
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
      passed: Boolean(
        runtimeText(runtime, "EVIDENCE_SCAN_PROVIDER")
        && runtimeText(runtime, "EVIDENCE_SCAN_PROVIDER") !== "unconfigured"
        && runtimeText(runtime, "EVIDENCE_SCAN_WEBHOOK_SECRET").length >= 32,
      ),
    },
    {
      key: "approved_identity_verification_provider",
      stage: "provider_onboarding",
      passed: configuredExternalIdentityVerificationProviders().length > 0,
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
  const [decisionRows, activeServiceActivations] = await Promise.all([
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
  ]);
  const rows = decisionRows
    .filter((row): row is NonNullable<typeof row> => Boolean(row));
  const latest = new Map<string, StoredLaunchGateDecision>();
  for (const row of rows) {
    if (!latest.has(row.gateKey)) latest.set(row.gateKey, row);
  }
  const now = Date.now();
  const internalChecks = [
    ...runtimeStableInternalChecks(),
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
