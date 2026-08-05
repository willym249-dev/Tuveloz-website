import { env } from "cloudflare:workers";
import { count, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "../../../../db";
import {
  complianceReminders,
  dataRightsRequests,
  evidenceFileScans,
  jobIncidents,
  launchGateDecisions,
  paymentAdjustments,
  providerAppeals,
  providerApplications,
  providerServiceEligibility,
} from "../../../../db/schema";
import {
  encodeLaunchAuthorityApprovals,
  encodeOwnerLegalReviewChoice,
  LAUNCH_GATE_CATALOG,
  launchAuthorityApprovals,
  launchDecisionState,
  launchGateByKey,
  OWNER_LEGAL_REVIEW_ACKNOWLEDGEMENT,
  OWNER_LEGAL_REVIEW_CHOICE_GATE_KEY,
  officialSourceReferenceIsAllowedForLaunchGate,
  parseOwnerLegalReviewChoice,
  type LaunchAuthorityApproval,
  type LaunchGateStatus,
  type OwnerLegalReviewChoice,
  type StoredLaunchGateDecision,
} from "../../../../lib/launch-readiness";
import {
  CUSTOMER_JOB_POSTING_PAUSED,
  MARKETPLACE_MODE,
} from "../../../../lib/launch-status";
import { verifyOwnerRequest } from "../../../../lib/owner-auth";
import { currentPlatformServiceActivations } from "../../../../lib/platform-service-activation";
import {
  allPolicyDocumentReleases,
  policyDocumentReleaseIsActive,
  type PolicyReleaseKey,
} from "../../../../lib/policy-release-manifest";
import {
  POLICY_STATUS,
  SERVICES,
} from "../../../../lib/provider-policy";
import { configuredExternalIdentityVerificationProviders } from "../../../../lib/provider-verification-evidence";
import { isSameOriginRequest } from "../../../../lib/request-security";
import { runtimeLaunchReadiness } from "../../../../lib/runtime-launch-readiness";
import {
  STRIPE_LIVE_MODE_ENABLED,
  stripeIdentityConfigurationReady,
  stripeIdentityKeyIsLive,
  stripeLiveModeEnabled,
} from "../../../../lib/stripe";
import { expireOpenCheckoutSessionsForLaunchShutdown } from "../../../../lib/stripe-payments";

const VALID_STATUSES = new Set<LaunchGateStatus>([
  "pending",
  "approved",
  "blocked",
  "not_applicable",
]);

type WorkplanBlocker = {
  key: string;
  stage: "provider_onboarding" | "transaction_pilot";
  state: string;
  title: string;
  reason: string;
  responsibleRole: string;
  nextAction: string;
  actionHref: string;
};

const POLICY_RELEASE_PRESENTATION: Record<PolicyReleaseKey, {
  title: string;
  href: string;
}> = {
  terms: { title: "Customer and provider Terms", href: "/terms" },
  customer_agreement: { title: "Customer Agreement", href: "/customer-agreement" },
  provider_agreement: { title: "Provider Agreement", href: "/provider-agreement" },
  privacy: { title: "Privacy and Cookie Notice", href: "/privacy" },
  payment_policy: { title: "Payment, cancellation, and refund policy", href: "/payments" },
  marketplace_conduct: { title: "Marketplace conduct and review policy", href: "/marketplace-conduct" },
  provisional_provider_policy: { title: "Provisional provider policy", href: "/provisional-provider-policy" },
};

function launchStateReason(state: string) {
  switch (state) {
    case "missing":
      return "No review record has been saved.";
    case "pending":
      return "The latest review record is still pending.";
    case "blocked":
      return "The latest review record is blocked.";
    case "expired":
      return "The latest approval has expired.";
    case "authority_evidence_missing":
      return "Evidence from one or more required authorities is missing.";
    case "incomplete_approval":
      return "The approval is missing an evidence reference, issuer, or review date.";
    case "invalid_official_source":
      return "The official-source evidence does not match the source approved for this gate.";
    case "future_approval":
      return "The approval date is in the future.";
    case "expiration_missing":
      return "A required valid-through date is missing.";
    case "expiration_invalid":
      return "The valid-through date is invalid.";
    case "legal_review_window_too_long":
      return "The official-law review window exceeds one year.";
    case "not_approved":
      return "This required gate cannot be marked not applicable.";
    default:
      return "This required readiness check has not passed.";
  }
}

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed)
    && new Date(parsed).toISOString().slice(0, 10) === value;
}

function numberFromCount(rows: Array<{ value: number }>) {
  return Number(rows[0]?.value ?? 0);
}

function runtimeText(runtime: Record<string, unknown>, key: string) {
  const value = runtime[key];
  return typeof value === "string" ? value.trim() : "";
}

async function ownerVerification(request: Request) {
  const verification = await verifyOwnerRequest(request);
  if (!verification.ok) {
    const status = verification.reason === "owner-config-missing" ? 503 : 403;
    return {
      response: Response.json(
        {
          error: status === 503
            ? "Owner access is not fully configured on this deployment."
            : "Signed owner verification is required for launch review.",
          reason: verification.reason,
        },
        { status, headers: { "cache-control": "no-store" } },
      ),
    } as const;
  }
  return { email: verification.email } as const;
}

async function readinessPayload() {
  const db = getDb();
  const [
    storedDecisions,
    providerRows,
    scanRows,
    openAppealRows,
    openRightsRows,
    pendingReminderRows,
    eligibleRows,
    activeServiceActivations,
    openIncidentRows,
    pendingAdjustmentRows,
    canonicalRuntimeReadiness,
  ] = await Promise.all([
    db.select().from(launchGateDecisions)
      .orderBy(desc(launchGateDecisions.gateVersion))
      .limit(500),
    db.select({ value: count() }).from(providerApplications),
    db.select().from(evidenceFileScans)
      .orderBy(desc(evidenceFileScans.requestedAt)),
    db.select({ value: count() }).from(providerAppeals)
      .where(inArray(providerAppeals.status, ["submitted", "under_review"])),
    db.select({ value: count() }).from(dataRightsRequests)
      .where(inArray(dataRightsRequests.status, [
        "submitted",
        "identity_verification",
        "in_review",
      ])),
    db.select({ value: count() }).from(complianceReminders)
      .where(eq(complianceReminders.status, "scheduled")),
    db.select({ value: count() }).from(providerServiceEligibility)
      .where(eq(providerServiceEligibility.eligibilityState, "eligible")),
    currentPlatformServiceActivations(),
    db.select({ value: count() }).from(jobIncidents)
      .where(inArray(jobIncidents.status, ["open", "under_review", "insurer_review"])),
    db.select({ value: count() }).from(paymentAdjustments)
      .where(inArray(paymentAdjustments.status, ["requested", "under_review", "active"])),
    runtimeLaunchReadiness(),
  ]);

  const latestDecisionMap = new Map<string, StoredLaunchGateDecision>();
  for (const decision of storedDecisions) {
    if (!latestDecisionMap.has(decision.gateKey)) {
      latestDecisionMap.set(decision.gateKey, decision);
    }
  }

  const now = Date.now();
  const latestScanMap = new Map<string, typeof evidenceFileScans.$inferSelect>();
  for (const scan of scanRows) {
    if (!latestScanMap.has(scan.evidenceSubmissionId)) {
      latestScanMap.set(scan.evidenceSubmissionId, scan);
    }
  }
  const quarantinedFileCount = [...latestScanMap.values()]
    .filter((scan) => scan.status !== "clean").length;
  const policyEnabledServices = SERVICES.filter((service) => (
    service.launchState === "enabled" && service.customerVisible
  ));
  const policyEnabledServiceCount = policyEnabledServices.length;
  const activatedServiceCount = activeServiceActivations.length;
  const gates = LAUNCH_GATE_CATALOG.map((gate) => {
    const decision = latestDecisionMap.get(gate.key);
    return {
      ...gate,
      decision: decision
        ? {
            ...decision,
            authorityApprovals: launchAuthorityApprovals(gate, decision),
          }
        : null,
      reviewState: launchDecisionState(gate, decision, now),
    };
  });
  const ownerChoiceDecision = latestDecisionMap.get(OWNER_LEGAL_REVIEW_CHOICE_GATE_KEY);
  const ownerChoice = parseOwnerLegalReviewChoice(ownerChoiceDecision);
  const canonicalFailures = [
    ...canonicalRuntimeReadiness.providerOnboarding.failures,
    ...canonicalRuntimeReadiness.transactionPilot.failures,
  ];
  const canonicalFailureKeys = new Set(
    canonicalFailures.map((failure) => failure.gateKey),
  );
  const policyReleases = allPolicyDocumentReleases();

  const runtime = env as unknown as Record<string, unknown>;
  const ownerAccessConfigured = Boolean(
    runtimeText(runtime, "OWNER_EMAIL")
    && runtimeText(runtime, "TEAM_DOMAIN")
    && (runtimeText(runtime, "OWNER_ACCESS_AUD") || runtimeText(runtime, "POLICY_AUD")),
  );
  const emailDeliveryConfigured = Boolean(
    runtimeText(runtime, "RESEND_API_KEY")
    && runtimeText(runtime, "RESEND_FROM_EMAIL"),
  );
  const accountAuthConfigured = runtimeText(runtime, "AUTH_CODE_SECRET").length >= 32;
  const privateEvidenceBucketBound = Boolean(runtime.BUCKET);
  const evidenceScanProvider = runtimeText(runtime, "EVIDENCE_SCAN_PROVIDER");
  const cloudmersiveApiKeyConfigured = Boolean(runtimeText(runtime, "CLOUDMERSIVE_API_KEY"));
  const authenticatedScannerConfigured = Boolean(
    evidenceScanProvider
    && evidenceScanProvider !== "unconfigured"
    && runtimeText(runtime, "EVIDENCE_SCAN_WEBHOOK_SECRET").length >= 32
    && (evidenceScanProvider !== "cloudmersive" || cloudmersiveApiKeyConfigured),
  );
  const evidenceScannerCanary = canonicalRuntimeReadiness.evidenceScannerCanary;
  const stripeKey = runtimeText(runtime, "STRIPE_SECRET_KEY");
  const stripeConfigured = Boolean(stripeKey);
  const stripeMode = stripeKey.startsWith("sk_live_")
    ? "live"
    : stripeKey.startsWith("sk_test_")
      ? "test"
      : "not_configured";
  const liveStripeRequested = runtimeText(runtime, "STRIPE_ALLOW_LIVE_MODE") === "true";
  const liveStripeAllowed = stripeLiveModeEnabled();
  const identityVerificationProviders = configuredExternalIdentityVerificationProviders();
  const stripeIdentityConfigurationPresent = identityVerificationProviders.includes("stripe_identity")
    && stripeIdentityConfigurationReady()
    && stripeIdentityKeyIsLive();
  const manualIdentityAlternativeConfigured = identityVerificationProviders.some((provider) => (
    provider !== "stripe_identity"
  ));
  const stripeIdentityCanary = canonicalRuntimeReadiness.identityCanaries.stripe;
  const runtimeCheckPassed = (key: string) => (
    !canonicalFailureKeys.has(`internal:${key}`)
  );
  const internalGates = [
    {
      key: "d1_integrated_schema",
      title: "Integrated D1 review tables are available",
      stage: "provider_onboarding",
      passed: true,
      detail: "This dashboard could read the new appeals, privacy, scanning, job-operations, payment-adjustment, and launch-decision tables.",
    },
    {
      key: "owner_access",
      title: "Owner access configuration is present",
      stage: "provider_onboarding",
      passed: runtimeCheckPassed("owner_access"),
      detail: ownerAccessConfigured
        ? "Cloudflare Access owner settings are present; this request also passed signed-token verification."
        : "OWNER_EMAIL, TEAM_DOMAIN, and OWNER_ACCESS_AUD must be configured.",
    },
    {
      key: "account_auth",
      title: "Account sign-in secret is configured",
      stage: "provider_onboarding",
      passed: runtimeCheckPassed("account_auth"),
      detail: accountAuthConfigured
        ? "The server reports a sufficiently long account authentication secret."
        : "AUTH_CODE_SECRET must be configured with at least 32 characters.",
    },
    {
      key: "email_delivery",
      title: "Transactional email is configured",
      stage: "provider_onboarding",
      passed: runtimeCheckPassed("email_delivery"),
      detail: emailDeliveryConfigured
        ? "The server reports an email API key and sender address. A real delivery test is still required."
        : "RESEND_API_KEY and RESEND_FROM_EMAIL must be configured.",
    },
    {
      key: "private_evidence_storage",
      title: "Private provider-evidence storage is bound",
      stage: "provider_onboarding",
      passed: runtimeCheckPassed("private_evidence_storage"),
      detail: privateEvidenceBucketBound
        ? "The private R2 binding is present. Bucket policy and deletion behavior still require review."
        : "The BUCKET R2 binding is unavailable.",
    },
    {
      key: "authenticated_evidence_scanner",
      title: "Cloudmersive scanner passed a guarded operational canary",
      stage: "provider_onboarding",
      passed: runtimeCheckPassed("authenticated_evidence_scanner"),
      detail: evidenceScannerCanary.evidencePassed
        ? `A recent Cloudmersive terminal response completed the guarded pending-request and audit path at ${evidenceScannerCanary.verifiedAt}; D1 canary record: ${evidenceScannerCanary.evidenceId}.`
        : authenticatedScannerConfigured && evidenceScanProvider === "cloudmersive"
          ? "Cloudmersive settings are present, but D1 has no recent vendor terminal result with its consumed pending request and exact authenticated-scanner audit event. Configuration alone does not pass this gate."
        : evidenceScanProvider === "cloudmersive" && !cloudmersiveApiKeyConfigured
          ? "Cloudmersive is selected, but CLOUDMERSIVE_API_KEY is missing. Files remain quarantined and pending."
          : evidenceScanProvider && evidenceScanProvider !== "unconfigured"
            ? `The ${evidenceScanProvider} provider setting has no supported guarded operational canary. Files remain quarantined and readiness remains blocked.`
            : "Configure Cloudmersive, its API key, and a 32+ character EVIDENCE_SCAN_WEBHOOK_SECRET. Owners cannot mark a file clean manually.",
    },
    {
      key: "approved_identity_verification_provider",
      title: "External identity-verification provider is configured",
      stage: "provider_onboarding",
      passed: runtimeCheckPassed("approved_identity_verification_provider"),
      detail: identityVerificationProviders.length > 0
        ? `${identityVerificationProviders.length} approved external identity-verification provider(s) are configured.`
        : "Configure at least one approved external identity-verification provider before provider activation.",
    },
    {
      key: "stripe_identity_automation",
      title: "Live Stripe Identity owner-operator flow passed an end-to-end canary",
      stage: "provider_onboarding",
      passed: runtimeCheckPassed("stripe_identity_automation"),
      detail: stripeIdentityCanary.evidencePassed
        ? `A current live-mode Stripe Identity verification completed through the guarded webhook path at ${stripeIdentityCanary.verifiedAt}; D1 canary record: ${stripeIdentityCanary.evidenceId}.`
        : stripeIdentityConfigurationPresent
          ? "The dedicated live key, webhook secret, and provider setting are configured, but D1 has no current approved live-mode session that still matches its guard-stamped active personnel record. Configuration alone does not pass this gate."
        : "Configure stripe_identity, a dedicated rk_live_ Identity key, and its dedicated whsec_ webhook secret before real owner-operator verification.",
    },
    {
      key: "manual_identity_alternative",
      title: "At least one identity path has independent vendor proof",
      stage: "provider_onboarding",
      passed: runtimeCheckPassed("manual_identity_alternative"),
      detail: runtimeCheckPassed("manual_identity_alternative")
        ? "The guarded Stripe Identity canary satisfies this gate. A second non-Stripe adapter is optional redundancy; owner-entered or manual references are not independent vendor proof and cannot pass this operational gate. No allowlisted non-Stripe vendor-proof adapter is implemented."
        : manualIdentityAlternativeConfigured
          ? "A non-Stripe provider name and owner-reviewed references may support an individual application, but they are not independent vendor proof and cannot pass this operational gate. No allowlisted non-Stripe vendor-proof adapter is implemented, so the Stripe Identity canary must pass."
          : "No identity path currently has independent vendor proof. Complete the live Stripe Identity canary, or integrate an allowlisted independently verifiable non-Stripe vendor-proof adapter. Owner-entered or manual references cannot pass this operational gate.",
    },
    {
      key: "transaction_safety_switches",
      title: "Real transactions remain locked during review",
      stage: "transaction_pilot",
      contextOnly: true,
      passed: CUSTOMER_JOB_POSTING_PAUSED
        && MARKETPLACE_MODE === "onboarding_only"
        && !liveStripeAllowed,
      detail: `Marketplace mode: ${MARKETPLACE_MODE}; customer requests paused: ${CUSTOMER_JOB_POSTING_PAUSED ? "yes" : "no"}; Stripe live-mode environment request: ${liveStripeRequested ? "on" : "off"}; code release gate: ${STRIPE_LIVE_MODE_ENABLED ? "on" : "off"}.`,
    },
    {
      key: "policy_catalog_services",
      title: "At least one exact service is approved in the code catalog",
      stage: "transaction_pilot",
      passed: policyEnabledServiceCount > 0,
      detail: `${policyEnabledServiceCount} customer-visible exact service code(s) are enabled in the policy catalog. Current policy status: ${POLICY_STATUS}.`,
    },
    {
      key: "active_policy_catalog",
      title: "Exact-service policy catalog is active",
      stage: "transaction_pilot",
      passed: runtimeCheckPassed("active_policy_catalog"),
      detail: runtimeCheckPassed("active_policy_catalog")
        ? `${policyEnabledServiceCount} customer-visible exact service code(s) are enabled under the active policy catalog.`
        : `The provider policy catalog status is ${POLICY_STATUS}; it must be active with at least one customer-visible exact service.`,
    },
    ...policyReleases.map((release) => {
      const presentation = POLICY_RELEASE_PRESENTATION[release.key];
      return {
        key: `policy_release_${release.key}`,
        title: `${presentation.title} is released`,
        stage: "transaction_pilot" as const,
        passed: runtimeCheckPassed(`policy_release_${release.key}`),
        detail: policyDocumentReleaseIsActive(release)
          ? `Active release ${release.releaseId} became effective ${release.effectiveAt}.`
          : `${presentation.title} is ${release.releaseStatus}. Publish an active, effective, versioned, source-hash-bound release before real jobs or payments.`,
      };
    }),
    {
      key: "current_written_service_activation",
      title: "At least one exact service has a current written activation record",
      stage: "transaction_pilot",
      passed: runtimeCheckPassed("current_written_service_activation"),
      detail: `${activatedServiceCount} exact service activation(s) are currently enabled under the latest mandatory legal-requirements record and insurer decision. Choosing to proceed without counsel does not satisfy this check.`,
    },
    {
      key: "stripe_sandbox_first",
      title: "Stripe is sandboxed until final approval",
      stage: "transaction_pilot",
      contextOnly: true,
      passed: stripeConfigured && stripeMode === "test" && !liveStripeAllowed,
      detail: stripeConfigured
        ? `Stripe mode reported by the server: ${stripeMode}; effective live permission: ${liveStripeAllowed ? "on" : "off"}.`
        : "Stripe is not configured. That is safe for onboarding review but must be resolved before a payment pilot.",
    },
    {
      key: "live_release_switches",
      title: "Marketplace live-release switch is enabled",
      stage: "transaction_pilot",
      passed: runtimeCheckPassed("live_release_switches"),
      detail: runtimeCheckPassed("live_release_switches")
        ? "The marketplace is in live mode."
        : `Marketplace mode remains ${MARKETPLACE_MODE}. Activation stays separate from evidence review.`,
    },
    {
      key: "stripe_live_configuration",
      title: "Stripe live configuration is enabled",
      stage: "transaction_pilot",
      passed: runtimeCheckPassed("stripe_live_configuration"),
      detail: runtimeCheckPassed("stripe_live_configuration")
        ? "Stripe live credentials and both live-release controls are enabled."
        : `Stripe mode is ${stripeMode}; environment live permission is ${liveStripeRequested ? "on" : "off"}; code live permission is ${STRIPE_LIVE_MODE_ENABLED ? "on" : "off"}.`,
    },
  ] as const;

  const internalGateByKey = new Map(
    internalGates.map((gate) => [gate.key, gate]),
  );
  const internalNextAction = (key: string) => {
    if (key === "approved_identity_verification_provider") {
      return {
        responsibleRole: "TUVELOZ owner + identity-verification provider",
        nextAction: "Select, contract with, configure, and test an approved external identity-verification provider.",
        actionHref: "/admin/provider-compliance",
      };
    }
    if (key === "stripe_identity_automation") {
      return {
        responsibleRole: "TUVELOZ owner + Stripe Identity deployment reviewer",
        nextAction: "Complete one authorized live owner-operator Identity canary and confirm that the signed webhook created a current approved D1 session and guard-stamped personnel record.",
        actionHref: "/provider-onboarding",
      };
    }
    if (key === "manual_identity_alternative") {
      return {
        responsibleRole: "TUVELOZ owner + identity-verification provider",
        nextAction: "Complete the live Stripe Identity canary (which satisfies this gate), or integrate an allowlisted independently verifiable non-Stripe vendor with guarded vendor proof and privacy and security approval.",
        actionHref: "/provider-onboarding",
      };
    }
    if (key === "active_policy_catalog" || key === "current_written_service_activation") {
      return {
        responsibleRole: "TUVELOZ owner + required legal or licensing source + insurance reviewer",
        nextAction: "Complete the exact-service compliance and insurance record, then activate only that service and jurisdiction.",
        actionHref: "/admin/provider-compliance",
      };
    }
    if (key.startsWith("policy_release_")) {
      const releaseKey = key.slice("policy_release_".length) as PolicyReleaseKey;
      const presentation = POLICY_RELEASE_PRESENTATION[releaseKey];
      return {
        responsibleRole: "TUVELOZ owner",
        nextAction: `Review and adopt the final ${presentation.title}, then publish its version, effective date, and source hash through the release process.`,
        actionHref: presentation.href,
      };
    }
    if (key === "live_release_switches") {
      return {
        responsibleRole: "TUVELOZ owner + deployment operator",
        nextAction: "Leave this switch off until every other mandatory blocker is cleared; enabling it is a separate reviewed deployment.",
        actionHref: "#next-steps",
      };
    }
    if (key === "stripe_live_configuration") {
      return {
        responsibleRole: "TUVELOZ owner + payment processor + deployment operator",
        nextAction: "After processor approval and all other blockers clear, configure the approved live Stripe account and perform a separate release.",
        actionHref: "#next-steps",
      };
    }
    const actionByKey: Record<string, string> = {
      owner_access: "Finish and verify the signed owner-access configuration.",
      account_auth: "Configure a production account-authentication secret of at least 32 characters.",
      email_delivery: "Configure transactional email and complete a real delivery and failure-handling test.",
      private_evidence_storage: "Bind and verify private evidence storage, access policy, backup, and deletion behavior.",
      authenticated_evidence_scanner: "Complete a real Cloudmersive scan and confirm its terminal D1 result, consumed pending request, and authenticated-scanner audit event.",
    };
    return {
      responsibleRole: "TUVELOZ owner + deployment or security reviewer",
      nextAction: actionByKey[key] ?? "Complete this production configuration check and record the result.",
      actionHref: `#technical-${key}`,
    };
  };
  const canonicalBlockers = canonicalFailures.map((failure): WorkplanBlocker => {
    if (failure.gateKey.startsWith("internal:")) {
      const key = failure.gateKey.slice("internal:".length);
      const gate = internalGateByKey.get(key);
      const action = internalNextAction(key);
      return {
        key: failure.gateKey,
        stage: gate?.stage ?? "transaction_pilot",
        state: failure.state,
        title: gate?.title ?? "Runtime readiness check is unavailable",
        reason: gate?.detail ?? "The production readiness check did not return a passing result.",
        ...action,
      };
    }
    const gate = gates.find((item) => item.key === failure.gateKey);
    return {
      key: failure.gateKey,
      stage: gate?.stage ?? "transaction_pilot",
      state: failure.state,
      title: gate?.title ?? "Mandatory launch evidence is incomplete",
      reason: [
        launchStateReason(failure.state),
        gate?.decision?.notes || "",
      ].filter(Boolean).join(" "),
      responsibleRole: gate?.authority.join(" + ") ?? "TUVELOZ owner",
      nextAction: gate
        ? `Collect current evidence from ${gate.authority.join(" + ")} and record a new review version.`
        : "Restore the readiness database and rerun this review.",
      actionHref: gate ? `#launch-gate-${gate.key}` : "#next-steps",
    };
  });
  const customerRequestPauseBlocker: WorkplanBlocker = {
    key: "customer_job_posting_paused",
    stage: "transaction_pilot",
    state: CUSTOMER_JOB_POSTING_PAUSED ? "locked" : "approved",
    title: "Customer job posting remains paused",
    reason: CUSTOMER_JOB_POSTING_PAUSED
      ? "The separate customer-job release switch is intentionally off."
      : "The customer-job release switch is on.",
    responsibleRole: "TUVELOZ owner + deployment operator",
    nextAction: "Keep this switch off until every mandatory readiness blocker is cleared; activation requires a separate reviewed deployment.",
    actionHref: "#next-steps",
  };
  const jobBlockers = [
    ...(CUSTOMER_JOB_POSTING_PAUSED ? [customerRequestPauseBlocker] : []),
    ...canonicalBlockers,
  ];
  const paymentBlockers = [
    ...(CUSTOMER_JOB_POSTING_PAUSED
      ? [{
          ...customerRequestPauseBlocker,
          key: "payments_waiting_for_job_release",
          title: "Payments remain locked while customer jobs are paused",
          reason: "TUVELOZ does not open live checkout or payouts before the customer-job release is approved.",
        }]
      : []),
    ...canonicalBlockers,
  ];
  const canonicalRuntimeApproved = canonicalRuntimeReadiness.providerOnboardingApproved
    && canonicalRuntimeReadiness.transactionPilotApproved;

  return {
    generatedAt: new Date(now).toISOString(),
    summary: {
      providerOnboardingReviewComplete:
        canonicalRuntimeReadiness.providerOnboardingApproved,
      transactionPilotReviewComplete:
        canonicalRuntimeApproved,
      realTransactionsEnabled:
        canonicalRuntimeApproved
        && !CUSTOMER_JOB_POSTING_PAUSED
        && String(MARKETPLACE_MODE) !== "onboarding_only"
        && liveStripeAllowed
        && stripeMode === "live",
      canonicalRuntimeApproved,
      automaticEnablement: false,
      marketplaceMode: MARKETPLACE_MODE,
      customerRequestsPaused: CUSTOMER_JOB_POSTING_PAUSED,
      stripeMode,
      liveStripeAllowed,
    },
    workload: {
      providers: numberFromCount(providerRows),
      evidenceScansPending: quarantinedFileCount,
      providerAppealsOpen: numberFromCount(openAppealRows),
      dataRightsRequestsOpen: numberFromCount(openRightsRows),
      complianceRemindersScheduled: numberFromCount(pendingReminderRows),
      eligibleProviderServices: numberFromCount(eligibleRows),
      platformServicesActivated: activatedServiceCount,
      openJobIncidents: numberFromCount(openIncidentRows),
      paymentAdjustmentsPending: numberFromCount(pendingAdjustmentRows),
    },
    internalGates,
    externalGates: gates,
    workplan: {
      jobBlockers,
      paymentBlockers,
    },
    ownerLegalReviewChoice: ownerChoice && ownerChoiceDecision
      ? {
          ...ownerChoice,
          gateVersion: ownerChoiceDecision.gateVersion,
          recordedAt: ownerChoiceDecision.createdAt,
        }
      : null,
    notice: "This screen records review evidence and an optional owner choice about counsel. Neither creates legal approval nor enables jobs, provider services, payouts, or Stripe live mode.",
  };
}

export async function GET(request: Request) {
  const verification = await ownerVerification(request);
  if ("response" in verification) return verification.response;
  try {
    return Response.json(await readinessPayload(), {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    console.error("Unable to load integrated launch review", error);
    return Response.json(
      {
        error: "Unable to load the integrated review. Confirm migration 0034 has been applied to this database.",
      },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
}

export async function POST(request: Request) {
  const verification = await ownerVerification(request);
  if ("response" in verification) return verification.response;
  if (!isSameOriginRequest(request)) {
    return Response.json(
      { error: "Cross-site launch decisions are not allowed." },
      { status: 403, headers: { "cache-control": "no-store" } },
    );
  }

  try {
    const body = await request.json() as Record<string, unknown>;
    const gateKey = clean(body.gateKey, 120);
    if (gateKey === OWNER_LEGAL_REVIEW_CHOICE_GATE_KEY) {
      if (clean(body.decision, 80) !== "proceeding_without_counsel") {
        return Response.json(
          { error: "Choose the recognized owner legal-review decision." },
          { status: 400 },
        );
      }
      const scope = clean(body.scope, 1500);
      if (scope.length < 20) {
        return Response.json(
          { error: "Describe the release, services, and jurisdictions covered by this owner decision." },
          { status: 400 },
        );
      }
      const acknowledgedNoLegalApproval = body.acknowledgedNoLegalApproval === true
        || body.acknowledgedNoLegalApproval === "yes";
      const acknowledgedMandatoryRequirementsRemain = body.acknowledgedMandatoryRequirementsRemain === true
        || body.acknowledgedMandatoryRequirementsRemain === "yes";
      if (!acknowledgedNoLegalApproval || !acknowledgedMandatoryRequirementsRemain) {
        return Response.json(
          { error: "Both acknowledgements are required. This choice is not legal approval and cannot satisfy mandatory requirements." },
          { status: 400 },
        );
      }

      const db = getDb();
      const previous = await db.select().from(launchGateDecisions)
        .where(eq(launchGateDecisions.gateKey, OWNER_LEGAL_REVIEW_CHOICE_GATE_KEY))
        .orderBy(desc(launchGateDecisions.gateVersion))
        .limit(1);
      const prior = previous[0];
      const now = new Date().toISOString();
      const choice: OwnerLegalReviewChoice = {
        format: "tuveloz_owner_legal_review_choice_v1",
        decision: "proceeding_without_counsel",
        scope,
        acknowledgedNoLegalApproval: true,
        acknowledgedMandatoryRequirementsRemain: true,
        acknowledgement: OWNER_LEGAL_REVIEW_ACKNOWLEDGEMENT,
        decidedAt: now,
        decidedBy: verification.email,
      };
      await db.insert(launchGateDecisions).values({
        id: crypto.randomUUID(),
        gateKey: OWNER_LEGAL_REVIEW_CHOICE_GATE_KEY,
        gateVersion: (prior?.gateVersion ?? 0) + 1,
        category: "owner_legal_review_choice",
        status: "recorded",
        required: "no",
        evidenceReference: encodeOwnerLegalReviewChoice(choice),
        approvedBy: "",
        approvedAt: "",
        validThrough: "",
        notes: "Owner choice only; not legal approval and not evidence for any mandatory launch gate.",
        decidedBy: verification.email,
        supersedesDecisionId: prior?.id ?? "",
        createdAt: now,
        updatedAt: now,
      });
      return Response.json(await readinessPayload(), {
        headers: { "cache-control": "no-store" },
      });
    }
    const gate = launchGateByKey(gateKey);
    if (!gate) {
      return Response.json({ error: "Choose a recognized launch-review gate." }, { status: 400 });
    }
    const status = clean(body.status, 32) as LaunchGateStatus;
    if (!VALID_STATUSES.has(status)) {
      return Response.json({ error: "Choose pending, approved, blocked, or not applicable." }, { status: 400 });
    }
    if (status === "not_applicable" && gate.required) {
      return Response.json(
        { error: "This gate is required and cannot be marked not applicable." },
        { status: 400 },
      );
    }

    const authorityApprovals: LaunchAuthorityApproval[] = gate.authority.map((authority, index) => ({
      authority,
      evidenceReference: clean(body[`authority_${index}_evidenceReference`], 500),
      approvedBy: clean(body[`authority_${index}_approvedBy`], 180),
      approvedAt: clean(body[`authority_${index}_approvedAt`], 10),
      validThrough: clean(body[`authority_${index}_validThrough`], 10),
    }));
    const notes = clean(body.notes, 3000);
    if (status === "approved") {
      const today = new Date().toISOString().slice(0, 10);
      for (const approval of authorityApprovals) {
        if (!approval.evidenceReference || !approval.approvedBy || !validDate(approval.approvedAt)) {
          return Response.json(
            { error: `${approval.authority} requires its own evidence reference, reviewer or issuing organization, and valid evidence date.` },
            { status: 400 },
          );
        }
        if (approval.approvedAt > today) {
          return Response.json(
            { error: `${approval.authority} evidence cannot be dated in the future.` },
            { status: 400 },
          );
        }
        if (
          approval.authority === "Official legal or licensing source"
          && !officialSourceReferenceIsAllowedForLaunchGate(
            gate,
            approval.evidenceReference,
          )
        ) {
          return Response.json(
            {
              error: "Use one of this gate's displayed official sources. An unrelated .gov page, general search result, private memo, or owner choice cannot satisfy the gate.",
              acceptedOfficialSourceReferences:
                gate.acceptedOfficialSourceReferences ?? [],
            },
            { status: 400 },
          );
        }
        if (gate.requiresValidThrough && !validDate(approval.validThrough)) {
          return Response.json(
            { error: `${approval.authority} requires a valid-through date so expiration can block readiness.` },
            { status: 400 },
          );
        }
        if (
          approval.validThrough
          && (!validDate(approval.validThrough) || approval.validThrough < approval.approvedAt)
        ) {
          return Response.json(
            { error: `${approval.authority} valid-through date cannot be before its approval date.` },
            { status: 400 },
          );
        }
        if (
          approval.authority === "Official legal or licensing source"
          && approval.validThrough
          && Date.parse(`${approval.validThrough}T23:59:59.999Z`)
            > Date.parse(`${approval.approvedAt}T00:00:00.000Z`)
              + (366 * 24 * 60 * 60 * 1000)
        ) {
          return Response.json(
            { error: "Official-law reviews must be rechecked at least annually. Choose a valid-through date no more than 366 days after the review date." },
            { status: 400 },
          );
        }
      }
      const uniqueReferences = new Set(
        authorityApprovals.map((approval) => approval.evidenceReference.toLocaleLowerCase()),
      );
      if (uniqueReferences.size !== authorityApprovals.length) {
        return Response.json(
          { error: "Each required authority must have a distinct evidence reference." },
          { status: 400 },
        );
      }
    }
    if ((status === "blocked" || status === "not_applicable") && !notes) {
      return Response.json(
        { error: "Explain why this gate is blocked or not applicable." },
        { status: 400 },
      );
    }

    const db = getDb();
    const previous = await db.select().from(launchGateDecisions)
      .where(eq(launchGateDecisions.gateKey, gate.key))
      .orderBy(desc(launchGateDecisions.gateVersion))
      .limit(1);
    const prior = previous[0];
    const now = new Date().toISOString();
    const approvalDates = authorityApprovals.map((item) => item.approvedAt).filter(Boolean).sort();
    const validThroughDates = authorityApprovals.map((item) => item.validThrough).filter(Boolean).sort();
    await db.insert(launchGateDecisions).values({
      id: crypto.randomUUID(),
      gateKey: gate.key,
      gateVersion: (prior?.gateVersion ?? 0) + 1,
      category: gate.category,
      status,
      required: gate.required ? "yes" : "no",
      evidenceReference: status === "approved"
        ? encodeLaunchAuthorityApprovals(authorityApprovals)
        : "",
      approvedBy: status === "approved"
        ? authorityApprovals.map((item) => `${item.authority}: ${item.approvedBy}`).join(" | ")
        : "",
      approvedAt: status === "approved" ? approvalDates.at(-1) ?? "" : "",
      validThrough: status === "approved" ? validThroughDates[0] ?? "" : "",
      notes,
      decidedBy: verification.email,
      supersedesDecisionId: prior?.id ?? "",
      createdAt: now,
      updatedAt: now,
    });

    // Any gate-version change invalidates payment links created under the
    // prior evidence set, even when the newly recorded state is approved.
    const checkoutShutdownCleanup = await expireOpenCheckoutSessionsForLaunchShutdown()
      .catch((error) => {
          console.error("Unable to complete launch-shutdown Checkout cleanup", error);
          return {
            examined: 0,
            expired: 0,
            alreadyFinal: 0,
            failed: 0,
            error: "cleanup_unavailable" as const,
          };
      });

    return Response.json({
      ...(await readinessPayload()),
      checkoutShutdownCleanup,
    }, {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    console.error("Unable to record launch-review decision", error);
    return Response.json(
      { error: "Unable to record this launch-review decision." },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
}
