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
  stageIsApproved,
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
  POLICY_STATUS,
  SERVICES,
} from "../../../../lib/provider-policy";
import { isSameOriginRequest } from "../../../../lib/request-security";
import {
  STRIPE_LIVE_MODE_ENABLED,
  stripeLiveModeEnabled,
} from "../../../../lib/stripe";
import { expireOpenCheckoutSessionsForLaunchShutdown } from "../../../../lib/stripe-payments";

const VALID_STATUSES = new Set<LaunchGateStatus>([
  "pending",
  "approved",
  "blocked",
  "not_applicable",
]);

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
  const authenticatedScannerConfigured = Boolean(
    evidenceScanProvider
    && evidenceScanProvider !== "unconfigured"
    && runtimeText(runtime, "EVIDENCE_SCAN_WEBHOOK_SECRET").length >= 32,
  );
  const stripeKey = runtimeText(runtime, "STRIPE_SECRET_KEY");
  const stripeConfigured = Boolean(stripeKey);
  const stripeMode = stripeKey.startsWith("sk_live_")
    ? "live"
    : stripeKey.startsWith("sk_test_")
      ? "test"
      : "not_configured";
  const liveStripeRequested = runtimeText(runtime, "STRIPE_ALLOW_LIVE_MODE") === "true";
  const liveStripeAllowed = stripeLiveModeEnabled();
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
      passed: ownerAccessConfigured,
      detail: ownerAccessConfigured
        ? "Cloudflare Access owner settings are present; this request also passed signed-token verification."
        : "OWNER_EMAIL, TEAM_DOMAIN, and OWNER_ACCESS_AUD must be configured.",
    },
    {
      key: "account_auth",
      title: "Account sign-in secret is configured",
      stage: "provider_onboarding",
      passed: accountAuthConfigured,
      detail: accountAuthConfigured
        ? "The server reports a sufficiently long account authentication secret."
        : "AUTH_CODE_SECRET must be configured with at least 32 characters.",
    },
    {
      key: "email_delivery",
      title: "Transactional email is configured",
      stage: "provider_onboarding",
      passed: emailDeliveryConfigured,
      detail: emailDeliveryConfigured
        ? "The server reports an email API key and sender address. A real delivery test is still required."
        : "RESEND_API_KEY and RESEND_FROM_EMAIL must be configured.",
    },
    {
      key: "private_evidence_storage",
      title: "Private provider-evidence storage is bound",
      stage: "provider_onboarding",
      passed: privateEvidenceBucketBound,
      detail: privateEvidenceBucketBound
        ? "The private R2 binding is present. Bucket policy and deletion behavior still require review."
        : "The BUCKET R2 binding is unavailable.",
    },
    {
      key: "authenticated_evidence_scanner",
      title: "Authenticated evidence-scanner callback is configured",
      stage: "provider_onboarding",
      passed: authenticatedScannerConfigured,
      detail: authenticatedScannerConfigured
        ? `Signed scanner results are restricted to the configured ${evidenceScanProvider} provider. A real end-to-end file scan still must be tested.`
        : "Configure EVIDENCE_SCAN_PROVIDER and a 32+ character EVIDENCE_SCAN_WEBHOOK_SECRET. Owners cannot mark a file clean manually.",
    },
    {
      key: "transaction_safety_switches",
      title: "Real transactions remain locked during review",
      stage: "transaction_pilot",
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
      key: "written_service_activations",
      title: "At least one exact service has a current written activation record",
      stage: "transaction_pilot",
      passed: activatedServiceCount > 0,
      detail: `${activatedServiceCount} exact service activation(s) are currently enabled under the latest mandatory legal-requirements record and insurer decision. Choosing to proceed without counsel does not satisfy this check.`,
    },
    {
      key: "stripe_sandbox_first",
      title: "Stripe is sandboxed until final approval",
      stage: "transaction_pilot",
      passed: stripeConfigured && stripeMode === "test" && !liveStripeAllowed,
      detail: stripeConfigured
        ? `Stripe mode reported by the server: ${stripeMode}; effective live permission: ${liveStripeAllowed ? "on" : "off"}.`
        : "Stripe is not configured. That is safe for onboarding review but must be resolved before a payment pilot.",
    },
  ] as const;

  const onboardingInternalApproved = internalGates
    .filter((gate) => gate.stage === "provider_onboarding")
    .every((gate) => gate.passed);
  const pilotInternalApproved = internalGates
    .filter((gate) => gate.stage === "transaction_pilot")
    .every((gate) => gate.passed);
  const onboardingExternalApproved = stageIsApproved(
    "provider_onboarding",
    latestDecisionMap,
    now,
  );
  const pilotExternalApproved = stageIsApproved(
    "transaction_pilot",
    latestDecisionMap,
    now,
  );

  return {
    generatedAt: new Date(now).toISOString(),
    summary: {
      providerOnboardingReviewComplete:
        onboardingInternalApproved && onboardingExternalApproved,
      transactionPilotReviewComplete:
        onboardingInternalApproved
        && onboardingExternalApproved
        && pilotInternalApproved
        && pilotExternalApproved,
      realTransactionsEnabled:
        !CUSTOMER_JOB_POSTING_PAUSED
        && String(MARKETPLACE_MODE) !== "onboarding_only"
        && liveStripeAllowed
        && stripeMode === "live",
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
