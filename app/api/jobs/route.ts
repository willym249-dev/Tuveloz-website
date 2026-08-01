import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  customerRequests,
  providerApplications,
  providerJobRecords,
  providerPathwayProfiles,
  providerPersonnel,
  providerQuotes,
} from "../../../db/schema";
import {
  effectiveProviderServices,
  providerMatchesArea,
  providerMatchesJob,
  providerMatchesServiceLocation,
  parseProviderServices,
} from "../../../lib/service-matching";
import {
  PARTS_BILLING_TERMS_VERSION,
  allInclusivePartsAllowedForServiceCodes,
  composeQuoteMessage,
  isAllInclusivePartQuality,
  isPartsBillingModel,
  storedPartTypeFor,
} from "../../../lib/parts-billing";
import {
  deleteJobImage,
  ImageValidationError,
  storeJobImage,
  validateJobImage,
} from "../../../lib/job-images";
import { customerPriceFor } from "../../../lib/customer-fee";
import {
  getAccountSession,
  providerAccountFor,
  testProviderAccountFor,
} from "../../../lib/account-auth";
import { isSameOriginRequest } from "../../../lib/request-security";
import {
  marketplacePausedMessage,
  type MarketplaceAction,
} from "../../../lib/launch-status";
import { runtimeMarketplaceActionAllowed } from "../../../lib/runtime-marketplace-action";
import {
  activeJobOperationHoldReasons,
  assignedJobOperationContext,
  appendJobLifecycleEvent,
  evaluateAssignedJobStage,
  jobAuthorizationDecisionMatchesContext,
  parseExactServiceCodes,
} from "../../../lib/job-operations";
import {
  eligibilityErrorMessage,
  evaluateStageEligibility,
} from "../../../lib/provider-eligibility-engine";
import { isServiceCode } from "../../../lib/provider-policy";
import { CUSTOMER_REQUEST_SCOPE_VERSION } from "../../../lib/customer-job-scope";
import { policyAccepted } from "../../../lib/policies";
import {
  loadAuthorizedJobScopeFacts,
  loadCurrentAcceptedCustomerRequestScope,
} from "../../../lib/job-scope-records";

function marketplacePausedResponse(action: MarketplaceAction) {
  return Response.json(
    {
      error: marketplacePausedMessage(action),
      code: "MARKETPLACE_ONBOARDING_ONLY",
    },
    {
      status: 503,
      headers: { "cache-control": "no-store", "retry-after": "86400" },
    },
  );
}

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

async function quoteIdFor(requestId: string, providerEmail: string) {
  const input = new TextEncoder().encode(`${requestId}:${providerEmail}`);
  const digest = await crypto.subtle.digest("SHA-256", input);
  const hex = Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
  return `quote-${hex.slice(0, 32)}`;
}

async function jobRecordIdFor(requestId: string, providerEmail: string) {
  const input = new TextEncoder().encode(`job-record:${requestId}:${providerEmail}`);
  const digest = await crypto.subtle.digest("SHA-256", input);
  const hex = Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
  return `job-record-${hex.slice(0, 32)}`;
}

function providerAccessIsActive(provider: typeof providerApplications.$inferSelect) {
  return provider.isTestProvider === "yes" || (
    provider.verificationStatus === "verified"
  );
}

async function providerForSession(request: Request) {
  const session = await getAccountSession(request);
  if (!session || session.role !== "provider") return null;
  const provider = await providerAccountFor(session.email)
    || await testProviderAccountFor(session.email);
  return provider && providerAccessIsActive(provider) ? provider : null;
}

export async function GET(request: Request) {
  const provider = await providerForSession(request);
  if (!provider) {
    return Response.json(
      { error: "Sign in to your active provider workspace." },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  }
  if (!(await runtimeMarketplaceActionAllowed("discovery", {
    testOnly: provider.isTestProvider === "yes",
  }))) {
    return marketplacePausedResponse("discovery");
  }
  const approvedServiceSet = effectiveProviderServices(
    provider.service,
    provider.approvedServices,
    provider.isTestProvider,
  );
  const submittedQuotes = await getDb()
    .select({
      requestId: providerQuotes.requestId,
      vehicle: customerRequests.vehicle,
      service: customerRequests.service,
      zip: customerRequests.zip,
      launchArea: customerRequests.launchArea,
      municipality: customerRequests.municipality,
      requestStatus: customerRequests.status,
      priceCents: providerQuotes.priceCents,
      laborPriceCents: providerQuotes.laborPriceCents,
      partsPriceCents: providerQuotes.partsPriceCents,
      customerTotalCents: providerQuotes.customerTotalCents,
      partType: providerQuotes.partType,
      availability: providerQuotes.availability,
      message: providerQuotes.message,
      status: providerQuotes.status,
      isTestJob: customerRequests.isTestJob,
      createdAt: providerQuotes.createdAt,
    })
    .from(providerQuotes)
    .innerJoin(customerRequests, eq(providerQuotes.requestId, customerRequests.id))
    .where(and(
      eq(providerQuotes.providerEmail, provider.email),
      eq(customerRequests.isTestJob, provider.isTestProvider),
    ))
    .orderBy(desc(providerQuotes.createdAt));
  const quoteByRequestId = new Map(
    submittedQuotes.map((quote) => [quote.requestId, quote]),
  );
  const quotedRequestIds = new Set(quoteByRequestId.keys());

  const jobs = await getDb()
    .select({
      id: customerRequests.id,
      zip: customerRequests.zip,
      launchArea: customerRequests.launchArea,
      municipality: customerRequests.municipality,
      vehicle: customerRequests.vehicle,
      service: customerRequests.service,
      partsSource: customerRequests.partsSource,
      partsPreference: customerRequests.partsPreference,
      serviceLocations: customerRequests.serviceLocations,
      details: customerRequests.details,
      preferredProviderEmail: customerRequests.preferredProviderEmail,
      issueImageKey: customerRequests.issueImageKey,
      isTestJob: customerRequests.isTestJob,
      createdAt: customerRequests.createdAt,
    })
    .from(customerRequests)
    .where(and(
      eq(customerRequests.status, "approved"),
      eq(customerRequests.isTestJob, provider.isTestProvider),
    ))
    .orderBy(desc(customerRequests.createdAt))
    .limit(50);
  const assignedJobs = await getDb()
    .select({
      id: customerRequests.id,
      customerName: customerRequests.name,
      customerEmail: customerRequests.email,
      zip: customerRequests.zip,
      launchArea: customerRequests.launchArea,
      municipality: customerRequests.municipality,
      vehicle: customerRequests.vehicle,
      service: customerRequests.service,
      partsSource: customerRequests.partsSource,
      partsPreference: customerRequests.partsPreference,
      serviceLocations: customerRequests.serviceLocations,
      serviceAddress: customerRequests.serviceAddress,
      details: customerRequests.details,
      preferredProviderEmail: customerRequests.preferredProviderEmail,
      status: customerRequests.status,
      priceCents: providerQuotes.priceCents,
      laborPriceCents: providerQuotes.laborPriceCents,
      partsPriceCents: providerQuotes.partsPriceCents,
      partType: providerQuotes.partType,
      availability: providerQuotes.availability,
      issueImageKey: customerRequests.issueImageKey,
      completionImageKey: customerRequests.completionImageKey,
      isTestJob: customerRequests.isTestJob,
      createdAt: customerRequests.createdAt,
      workStatus: providerJobRecords.workStatus,
      timerStartedAt: providerJobRecords.timerStartedAt,
      trackedSeconds: providerJobRecords.trackedSeconds,
      billableMinutes: providerJobRecords.billableMinutes,
      workNotes: providerJobRecords.workNotes,
      partsNotes: providerJobRecords.partsNotes,
      jobStartDecisionId: providerJobRecords.jobStartDecisionId,
      completionDecisionId: providerJobRecords.completionDecisionId,
      scopeVersion: providerQuotes.scopeVersion,
    })
    .from(customerRequests)
    .innerJoin(providerQuotes, and(
      eq(providerQuotes.requestId, customerRequests.id),
      eq(providerQuotes.providerEmail, provider.email),
      eq(providerQuotes.status, "accepted"),
    ))
    .leftJoin(providerJobRecords, and(
      eq(providerJobRecords.requestId, customerRequests.id),
      eq(providerJobRecords.providerEmail, provider.email),
    ))
    .where(and(
      inArray(customerRequests.status, ["quote accepted", "on my way", "arrived", "completed"]),
      eq(customerRequests.isTestJob, provider.isTestProvider),
    ))
    .orderBy(desc(customerRequests.createdAt))
    .limit(50);
  const exposedAssignedJobs = await Promise.all(assignedJobs.filter(
    (job) => (provider.isTestProvider === "yes") === (job.isTestJob === "yes"),
  ).map(async (job) => {
    const jobFacts = await loadAuthorizedJobScopeFacts(job.id, job.scopeVersion);
    const usesLegacyTotal = Number(job.laborPriceCents) + Number(job.partsPriceCents) === 0
      && Number(job.priceCents) > 0;
    return {
      ...job,
      jobFacts,
      repeatCustomer: Boolean(job.preferredProviderEmail),
      preferredProviderEmail: undefined,
      laborPriceCents: usesLegacyTotal ? job.priceCents : job.laborPriceCents,
      workStatus: job.status === "completed" ? "completed" : (job.workStatus || "scheduled"),
      timerStartedAt: job.timerStartedAt || "",
      trackedSeconds: job.trackedSeconds || 0,
      billableMinutes: job.billableMinutes || 0,
      workNotes: job.workNotes || "",
      partsNotes: job.partsNotes || "",
      jobStartDecisionId: job.jobStartDecisionId || "",
      completionDecisionId: job.completionDecisionId || "",
      hasIssueImage: Boolean(job.issueImageKey),
      hasCompletionImage: Boolean(job.completionImageKey),
      issueImageKey: undefined,
      completionImageKey: undefined,
    };
  }));
  return Response.json({
    provider: {
      name: provider.name,
      service: approvedServiceSet,
      serviceArea: provider.serviceArea,
      workLocations: provider.workLocations,
      businessMunicipality: provider.businessMunicipality,
      businessServiceAddress: provider.businessServiceAddress,
      verified: provider.verificationStatus === "verified",
      testProvider: provider.isTestProvider === "yes",
    },
    myQuotes: submittedQuotes,
    assignedJobs: exposedAssignedJobs,
    jobs: jobs.filter((job) => (
      providerMatchesJob(approvedServiceSet, job.service)
      && providerMatchesArea(provider.serviceArea, job.launchArea || job.zip)
      && providerMatchesServiceLocation(provider.workLocations, job.serviceLocations)
      && (!job.preferredProviderEmail || job.preferredProviderEmail === provider.email)
      && (provider.isTestProvider === "yes") === (job.isTestJob === "yes")
    )).map((job) => ({
      ...job,
      repeatCustomer: Boolean(job.preferredProviderEmail),
      preferredProviderEmail: undefined,
      hasIssueImage: Boolean(job.issueImageKey),
      quoteSubmitted: quotedRequestIds.has(job.id),
      submittedQuote: quoteByRequestId.get(job.id) ?? null,
      issueImageKey: undefined,
    })),
  }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json(
      { error: "This provider action must come from Tuveloz." },
      { status: 403, headers: { "cache-control": "no-store" } },
    );
  }
  const provider = await providerForSession(request);
  if (!provider) {
    return Response.json(
      { error: "Sign in to your active provider workspace." },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  }

  const contentType = request.headers.get("content-type") ?? "";
  let body: Record<string, unknown>;
  let completionPhoto: unknown;
  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    body = Object.fromEntries(formData.entries());
    completionPhoto = formData.get("completion-photo");
  } else {
    body = (await request.json()) as Record<string, unknown>;
  }
  const requestId = clean(body.requestId, 80);
  if (!requestId) {
    return Response.json({ error: "Choose a valid job request." }, { status: 400 });
  }
  const db = getDb();

  if (body.action === "save-job-record" || body.action === "toggle-timer") {
    const [assignedJob] = await db.select({
      status: customerRequests.status,
      isTestJob: customerRequests.isTestJob,
    }).from(customerRequests)
      .innerJoin(providerQuotes, and(
        eq(providerQuotes.requestId, customerRequests.id),
        eq(providerQuotes.providerEmail, provider.email),
        eq(providerQuotes.status, "accepted"),
      ))
      .where(eq(customerRequests.id, requestId))
      .limit(1);
    if (!assignedJob) {
      return Response.json({ error: "Only the selected provider can manage this job." }, { status: 403 });
    }
    if ((provider.isTestProvider === "yes") !== (assignedJob.isTestJob === "yes")) {
      return Response.json({ error: "This provider cannot manage that job type." }, { status: 403 });
    }
    const recordAction: MarketplaceAction = "job_start";
    if (!(await runtimeMarketplaceActionAllowed(recordAction, {
      testOnly: provider.isTestProvider === "yes" && assignedJob.isTestJob === "yes",
    }))) {
      return marketplacePausedResponse(recordAction);
    }

    const [existingRecord] = await db.select().from(providerJobRecords)
      .where(and(
        eq(providerJobRecords.requestId, requestId),
        eq(providerJobRecords.providerEmail, provider.email),
      ))
      .limit(1);
    const now = new Date().toISOString();
    const recordId = existingRecord?.id || await jobRecordIdFor(requestId, provider.email);

    if (body.action === "toggle-timer") {
      if (assignedJob.status === "completed") {
        return Response.json({ error: "The timer cannot run after a job is completed." }, { status: 409 });
      }
      const timerMode = clean(body.timerMode, 10);
      if (timerMode === "start") {
        if (existingRecord?.timerStartedAt) {
          return Response.json({ error: "The timer is already running." }, { status: 409 });
        }
        const operationHolds = await activeJobOperationHoldReasons(requestId);
        if (operationHolds.length) {
          return Response.json({
            error: "Resolve the incident, cancellation, or pending customer change authorization before work resumes.",
            code: "JOB_OPERATION_HOLD",
            reasons: operationHolds,
          }, { status: 409, headers: { "cache-control": "no-store" } });
        }
        const stageDecision = await evaluateAssignedJobStage({
          requestId,
          providerEmail: provider.email,
          stage: "job_start",
          arrivalJobFacts: body.arrivalJobFacts,
          effectiveAt: now,
        });
        if (!stageDecision.allowed || !stageDecision.result?.decisionId) {
          return Response.json({
            error: stageDecision.error,
            code: "JOB_START_NOT_AUTHORIZED",
            reasons: stageDecision.result?.reasons ?? [],
          }, { status: stageDecision.status, headers: { "cache-control": "no-store" } });
        }
        await db.insert(providerJobRecords).values({
          id: recordId,
          requestId,
          providerEmail: provider.email,
          jobStartDecisionId: stageDecision.result.decisionId,
          workStatus: "in progress",
          timerStartedAt: now,
          updatedAt: now,
        }).onConflictDoUpdate({
          target: [providerJobRecords.requestId, providerJobRecords.providerEmail],
          set: {
            jobStartDecisionId: stageDecision.result.decisionId,
            workStatus: "in progress",
            timerStartedAt: now,
            updatedAt: now,
          },
        });
        await appendJobLifecycleEvent({
          requestId,
          quoteId: stageDecision.context?.quoteId,
          providerId: provider.id,
          actorRole: "provider",
          actorId: provider.email,
          eventType: "job_timer_started",
          fromStatus: existingRecord?.workStatus || "scheduled",
          toStatus: "in progress",
          scopeVersion: stageDecision.context?.scopeVersion,
          authorizationSnapshotId: stageDecision.result.decisionId,
        });
        return Response.json({
          ok: true,
          decisionId: stageDecision.result.decisionId,
          timerStartedAt: now,
          trackedSeconds: existingRecord?.trackedSeconds || 0,
        });
      }
      if (timerMode === "stop") {
        if (!existingRecord?.timerStartedAt) {
          return Response.json({ error: "The timer is not running." }, { status: 409 });
        }
        const startedAt = Date.parse(existingRecord.timerStartedAt);
        const elapsedSeconds = Number.isFinite(startedAt)
          ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000))
          : 0;
        const trackedSeconds = existingRecord.trackedSeconds + elapsedSeconds;
        await db.update(providerJobRecords).set({
          timerStartedAt: "",
          trackedSeconds,
          updatedAt: now,
        }).where(eq(providerJobRecords.id, existingRecord.id));
        await appendJobLifecycleEvent({
          requestId,
          providerId: provider.id,
          actorRole: "provider",
          actorId: provider.email,
          eventType: "job_timer_stopped",
          fromStatus: existingRecord.workStatus,
          toStatus: existingRecord.workStatus,
          details: { trackedSeconds },
        });
        return Response.json({ ok: true, timerStartedAt: "", trackedSeconds });
      }
      return Response.json({ error: "Choose whether to start or stop the timer." }, { status: 400 });
    }

    if (assignedJob.status === "completed") {
      return Response.json(
        { error: "Completed job records are immutable. Use the incident or refund workflow for later issues." },
        { status: 409 },
      );
    }

    const operationHolds = await activeJobOperationHoldReasons(requestId);
    if (operationHolds.length) {
      return Response.json({
        error: "This job record cannot advance while an incident, cancellation, or customer change authorization is unresolved.",
        code: "JOB_OPERATION_HOLD",
        reasons: operationHolds,
      }, { status: 409, headers: { "cache-control": "no-store" } });
    }

    const allowedWorkStatuses = ["scheduled", "in progress", "waiting for parts"];
    const requestedWorkStatus = clean(body.workStatus, 40).toLowerCase();
    const workStatus = assignedJob.status === "completed"
      ? "completed"
      : requestedWorkStatus;
    const actualMinutes = Number(body.actualMinutes);
    const billableMinutes = Number(body.billableMinutes);
    const workNotes = clean(body.workNotes, 2000);
    const partsNotes = clean(body.partsNotes, 1200);
    if (
      (workStatus !== "completed" && !allowedWorkStatuses.includes(workStatus))
      || !Number.isFinite(actualMinutes)
      || !Number.isFinite(billableMinutes)
      || actualMinutes < 0
      || billableMinutes < 0
      || actualMinutes > 100_000
      || billableMinutes > 100_000
    ) {
      return Response.json({ error: "Check the job status and time amounts." }, { status: 400 });
    }
    const operationContext = await assignedJobOperationContext(
      requestId,
      provider.email,
    );
    if (!operationContext) {
      return Response.json({ error: "The accepted assignment context is missing." }, { status: 409 });
    }
    let jobStartDecisionId = existingRecord?.jobStartDecisionId || "";
    if (workStatus === "in progress") {
      const existingStartIsCurrent = await jobAuthorizationDecisionMatchesContext(
        operationContext,
        jobStartDecisionId,
        "job_start",
      );
      if (!existingStartIsCurrent) {
        const startDecision = await evaluateAssignedJobStage({
          requestId,
          providerEmail: provider.email,
          stage: "job_start",
          arrivalJobFacts: body.arrivalJobFacts,
          effectiveAt: now,
        });
        if (!startDecision.allowed || !startDecision.result?.decisionId) {
          return Response.json({
            error: startDecision.error,
            code: "FRESH_ARRIVAL_JOB_FACTS_REQUIRED",
            reasons: startDecision.result?.reasons ?? [],
          }, { status: startDecision.status, headers: { "cache-control": "no-store" } });
        }
        jobStartDecisionId = startDecision.result.decisionId;
      }
    }
    const trackedSeconds = existingRecord?.timerStartedAt
      ? existingRecord.trackedSeconds
      : Math.round(actualMinutes * 60);
    await db.insert(providerJobRecords).values({
      id: recordId,
      requestId,
      providerEmail: provider.email,
      jobStartDecisionId,
      workStatus,
      trackedSeconds,
      billableMinutes: Math.round(billableMinutes),
      workNotes,
      partsNotes,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: [providerJobRecords.requestId, providerJobRecords.providerEmail],
      set: {
        jobStartDecisionId,
        workStatus,
        trackedSeconds,
        billableMinutes: Math.round(billableMinutes),
        workNotes,
        partsNotes,
        updatedAt: now,
      },
    });
    await appendJobLifecycleEvent({
      requestId,
      quoteId: operationContext.quoteId,
      providerId: provider.id,
      actorRole: "provider",
      actorId: provider.email,
      eventType: "job_record_saved",
      fromStatus: existingRecord?.workStatus || "scheduled",
      toStatus: workStatus,
      scopeVersion: operationContext.scopeVersion,
      authorizationSnapshotId: jobStartDecisionId,
      details: {
        trackedSeconds,
        billableMinutes: Math.round(billableMinutes),
      },
    });
    return Response.json({
      ok: true,
      record: {
        jobStartDecisionId,
        workStatus,
        timerStartedAt: existingRecord?.timerStartedAt || "",
        trackedSeconds,
        billableMinutes: Math.round(billableMinutes),
        workNotes,
        partsNotes,
      },
    });
  }

  if (body.action === "update-status") {
    const nextStatus = clean(body.status, 40);
    const [acceptedQuote] = await db.select({ id: providerQuotes.id }).from(providerQuotes)
      .where(and(
        eq(providerQuotes.requestId, requestId),
        eq(providerQuotes.providerEmail, provider.email),
        eq(providerQuotes.status, "accepted"),
      )).limit(1);
    if (!acceptedQuote) {
      return Response.json({ error: "Only the selected provider can update this job." }, { status: 403 });
    }

    const [assignedJob] = await db.select({
      status: customerRequests.status,
      isTestJob: customerRequests.isTestJob,
    }).from(customerRequests)
      .where(eq(customerRequests.id, requestId)).limit(1);
    if (!assignedJob) return Response.json({ error: "Job request not found." }, { status: 404 });
    if ((provider.isTestProvider === "yes") !== (assignedJob.isTestJob === "yes")) {
      return Response.json({ error: "This provider cannot update that job type." }, { status: 403 });
    }
    const statusAction: MarketplaceAction = nextStatus === "completed"
      ? "completion"
      : "job_start";
    if (!(await runtimeMarketplaceActionAllowed(statusAction, {
      testOnly: provider.isTestProvider === "yes" && assignedJob.isTestJob === "yes",
    }))) {
      return marketplacePausedResponse(statusAction);
    }
    const transitions: Record<string, string> = {
      "quote accepted": "on my way",
      "on my way": "arrived",
      "arrived": "completed",
    };
    if (transitions[assignedJob.status] !== nextStatus) {
      return Response.json({ error: "This job status cannot be changed that way." }, { status: 409 });
    }
    const operationHolds = await activeJobOperationHoldReasons(requestId);
    if (operationHolds.length) {
      return Response.json({
        error: "This job cannot advance while an incident, cancellation, or customer change authorization is unresolved.",
        code: "JOB_OPERATION_HOLD",
        reasons: operationHolds,
      }, { status: 409, headers: { "cache-control": "no-store" } });
    }
    const operationContext = await assignedJobOperationContext(requestId, provider.email);
    if (!operationContext) {
      return Response.json({ error: "The accepted assignment context is missing." }, { status: 409 });
    }
    let stageDecision: Awaited<ReturnType<typeof evaluateAssignedJobStage>> | null = null;
    if (nextStatus === "completed") {
      stageDecision = await evaluateAssignedJobStage({
        requestId,
        providerEmail: provider.email,
        stage: "completion",
        effectiveAt: new Date().toISOString(),
      });
      if (!stageDecision.allowed || !stageDecision.result?.decisionId) {
        return Response.json({
          error: stageDecision.error,
          code: "JOB_COMPLETION_NOT_AUTHORIZED",
          reasons: stageDecision.result?.reasons ?? [],
        }, { status: stageDecision.status, headers: { "cache-control": "no-store" } });
      }
      const [actualStart] = await db.select({
        decisionId: providerJobRecords.jobStartDecisionId,
      }).from(providerJobRecords).where(and(
        eq(providerJobRecords.requestId, requestId),
        eq(providerJobRecords.providerEmail, provider.email),
      )).limit(1);
      if (!await jobAuthorizationDecisionMatchesContext(
        operationContext,
        actualStart?.decisionId || "",
        "job_start",
      )) {
        return Response.json({
          error: "Completion requires a recorded actual work start authorized for the current scope, schedule, assignment, and exact job facts.",
          code: "CURRENT_ACTUAL_JOB_START_REQUIRED",
        }, { status: 409, headers: { "cache-control": "no-store" } });
      }
    }
    let completionImageKey = "";
    let completionImageType = "";
    if (nextStatus === "completed") {
      try {
        const image = await validateJobImage(completionPhoto, true);
        if (!image) throw new ImageValidationError("Upload a completion photo before finishing the job.");
        completionImageKey = await storeJobImage(requestId, "completion", image);
        completionImageType = image.contentType;
      } catch (error) {
        if (error instanceof ImageValidationError) {
          return Response.json({ error: error.message }, { status: 400 });
        }
        throw error;
      }
    }
    let updated: { id: string }[];
    try {
      updated = await db.update(customerRequests).set({
        status: nextStatus,
        ...(completionImageKey ? { completionImageKey, completionImageType } : {}),
      })
        .where(and(eq(customerRequests.id, requestId), eq(customerRequests.status, assignedJob.status)))
        .returning({ id: customerRequests.id });
    } catch (error) {
      if (completionImageKey) await deleteJobImage(completionImageKey);
      throw error;
    }
    if (updated.length === 0) {
      if (completionImageKey) await deleteJobImage(completionImageKey);
      return Response.json({ error: "This job status was already updated." }, { status: 409 });
    }
    let completedTrackedSeconds: number | undefined;
    if (nextStatus === "completed") {
      const completedAt = new Date().toISOString();
      const [jobRecord] = await db.select().from(providerJobRecords)
        .where(and(
          eq(providerJobRecords.requestId, requestId),
          eq(providerJobRecords.providerEmail, provider.email),
        ))
        .limit(1);
      const startedAt = jobRecord?.timerStartedAt
        ? Date.parse(jobRecord.timerStartedAt)
        : Number.NaN;
      const elapsedSeconds = Number.isFinite(startedAt)
        ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000))
        : 0;
      completedTrackedSeconds = (jobRecord?.trackedSeconds || 0) + elapsedSeconds;
      await db.insert(providerJobRecords).values({
        id: jobRecord?.id || await jobRecordIdFor(requestId, provider.email),
        requestId,
        providerEmail: provider.email,
        completionDecisionId: stageDecision?.result?.decisionId || "",
        workStatus: "completed",
        trackedSeconds: completedTrackedSeconds,
        updatedAt: completedAt,
      }).onConflictDoUpdate({
        target: [providerJobRecords.requestId, providerJobRecords.providerEmail],
        set: {
          completionDecisionId: stageDecision?.result?.decisionId || "",
          workStatus: "completed",
          timerStartedAt: "",
          trackedSeconds: completedTrackedSeconds,
          updatedAt: completedAt,
        },
      });

      // Completion alone never changes a financial record to releasable. The
      // owner payout gate separately verifies the final invoice, authorized
      // changes, incidents, claims, refunds, disputes, reserves, and a fresh
      // payout-stage eligibility decision before any transfer is attempted.
    }
    await appendJobLifecycleEvent({
      requestId,
      quoteId: operationContext.quoteId,
      providerId: provider.id,
      actorRole: "provider",
      actorId: provider.email,
      eventType: nextStatus === "completed"
        ? "job_completed"
        : "job_status_advanced",
      fromStatus: assignedJob.status,
      toStatus: nextStatus,
      scopeVersion: operationContext.scopeVersion,
      authorizationSnapshotId: stageDecision?.result?.decisionId || "",
    });
    return Response.json({
      ok: true,
      status: nextStatus,
      decisionId: stageDecision.result.decisionId,
      ...(completedTrackedSeconds === undefined ? {} : { trackedSeconds: completedTrackedSeconds }),
    });
  }

  const [job] = await db.select({
    id: customerRequests.id,
    status: customerRequests.status,
    service: customerRequests.service,
    serviceCodes: customerRequests.serviceCodes,
    jurisdiction: customerRequests.jurisdiction,
    scheduledFor: customerRequests.scheduledFor,
    partsSource: customerRequests.partsSource,
    partsPreference: customerRequests.partsPreference,
    zip: customerRequests.zip,
    launchArea: customerRequests.launchArea,
    serviceLocations: customerRequests.serviceLocations,
    serviceAddress: customerRequests.serviceAddress,
    isTestJob: customerRequests.isTestJob,
  }).from(customerRequests)
    .where(eq(customerRequests.id, requestId)).limit(1);
  if (!job) return Response.json({ error: "Job request not found." }, { status: 404 });
  if (!(await runtimeMarketplaceActionAllowed("quote", {
    testOnly: provider.isTestProvider === "yes" && job.isTestJob === "yes",
  }))) {
    return marketplacePausedResponse("quote");
  }

  const availability = clean(body.availability, 200);
  const providerMessage = clean(body.message, 800);
  const partsBillingModel = clean(body.partsBillingModel, 80);
  const requestedPartQuality = clean(body.partQuality, 40);
  const partsDescription = clean(body.partsDescription, 600);
  const servicePrice = Number(body.servicePrice ?? body.laborPrice ?? body.price);
  const submittedPartsPrice = Number(body.partsPrice ?? 0);
  const providerPartsTermsAccepted = policyAccepted(body.providerPartsTermsAccepted);
  const providerPartsTaxConfirmed = policyAccepted(body.providerPartsTaxConfirmed);
  if (
    !availability
    || !providerMessage
    || !Number.isFinite(servicePrice)
    || servicePrice <= 0
    || servicePrice > 1_000_000
    || !Number.isFinite(submittedPartsPrice)
    || submittedPartsPrice !== 0
  ) {
    return Response.json({
      error: "Enter one valid provider service price. Separate parts or materials amounts are disabled.",
    }, { status: 400 });
  }
  if (!isPartsBillingModel(partsBillingModel)) {
    return Response.json({ error: "Choose a valid parts arrangement." }, { status: 400 });
  }
  if (!providerPartsTermsAccepted) {
    return Response.json({
      error: "Confirm the selected parts arrangement and no-separate-goods-charge rule.",
    }, { status: 400 });
  }

  if (job.status !== "approved") {
    return Response.json({ error: "This job is no longer accepting quotes." }, { status: 409 });
  }
  if ((provider.isTestProvider === "yes") !== (job.isTestJob === "yes")) {
    return Response.json({ error: "Test providers can only quote test jobs." }, { status: 403 });
  }
  const serviceCodes = parseExactServiceCodes(job.serviceCodes);
  const approvedExactServices = new Set(
    parseProviderServices(provider.approvedServices).filter(isServiceCode),
  );
  if (
    serviceCodes.length !== 1
    || serviceCodes[0] === "general_auto_repair"
    || !approvedExactServices.has(serviceCodes[0])
  ) {
    return Response.json({
      error: "This quote is not bound to one exact service currently approved for this provider.",
      code: "EXACT_SERVICE_QUOTE_REQUIRED",
    }, { status: 403 });
  }
  if (!job.jurisdiction || !job.scheduledFor || !Number.isFinite(Date.parse(job.scheduledFor))) {
    return Response.json({
      error: "This request has no valid jurisdiction and scheduled work time.",
      code: "STRUCTURED_JOB_SCHEDULE_REQUIRED",
    }, { status: 409 });
  }
  const acceptedRequestScope = await loadCurrentAcceptedCustomerRequestScope(requestId);
  if (
    !acceptedRequestScope
    || acceptedRequestScope.serviceCodes.length !== 1
    || acceptedRequestScope.serviceCodes[0] !== serviceCodes[0]
    || acceptedRequestScope.jurisdiction !== job.jurisdiction
    || acceptedRequestScope.scheduledFor !== job.scheduledFor
    || acceptedRequestScope.serviceLocations !== job.serviceLocations
    || acceptedRequestScope.serviceAddress !== job.serviceAddress
  ) {
    return Response.json({
      error: "This request is not bound to current immutable operation, location, vehicle, and safety facts.",
      code: "IMMUTABLE_JOB_FACTS_REQUIRED",
    }, { status: 409, headers: { "cache-control": "no-store" } });
  }
  if (!providerMatchesArea(provider.serviceArea, job.launchArea || job.zip)) {
    return Response.json({ error: "This job is outside your approved service area." }, { status: 403 });
  }
  if (!providerMatchesServiceLocation(provider.workLocations, job.serviceLocations)) {
    return Response.json({
      error: "This job’s service-location choice does not match your provider settings.",
    }, { status: 403 });
  }
  let selectedPartQuality: "OEM" | "Aftermarket" | "" = "";
  if (partsBillingModel === "provider_all_inclusive") {
    if (job.partsSource === "I have the parts — labor only") {
      return Response.json({
        error: "This customer is supplying the parts. Provider-supplied parts cannot be added to this quote.",
      }, { status: 400 });
    }
    if (!allInclusivePartsAllowedForServiceCodes(serviceCodes)) {
      return Response.json({
        error: "The all-inclusive parts method is unavailable for this service because separate tire, fuel, towing, lockout, inspection, or other special rules may apply.",
        code: "SPECIAL_PARTS_FLOW_REQUIRED",
      }, { status: 409 });
    }
    if (!isAllInclusivePartQuality(requestedPartQuality)) {
      return Response.json({ error: "Choose OEM or aftermarket for provider-supplied parts." }, { status: 400 });
    }
    if (
      (job.partsPreference === "OEM" || job.partsPreference === "Aftermarket")
      && requestedPartQuality !== job.partsPreference
    ) {
      return Response.json({
        error: `This customer requested ${job.partsPreference} parts.`,
      }, { status: 400 });
    }
    if (!partsDescription) {
      return Response.json({
        error: "List the parts and materials included in the one service price without listing separate prices.",
      }, { status: 400 });
    }
    if (!providerPartsTaxConfirmed) {
      return Response.json({
        error: "Confirm your responsibility for applicable sales or use tax on parts and supplies used in this lump-sum repair.",
      }, { status: 400 });
    }
    selectedPartQuality = requestedPartQuality;
  } else if (partsBillingModel === "customer_supplied") {
    if (job.partsSource === "Provider supplies parts") {
      return Response.json({
        error: "The customer requested provider-supplied parts. Ask the customer to update the request before quoting customer-supplied parts.",
      }, { status: 400 });
    }
  }
  const partType = storedPartTypeFor(partsBillingModel, selectedPartQuality);
  const message = composeQuoteMessage({
    model: partsBillingModel,
    quality: selectedPartQuality,
    partsDescription,
    providerMessage,
  }).slice(0, 2200);
  const [existingQuote] = await db.select({ id: providerQuotes.id }).from(providerQuotes)
    .where(and(
      eq(providerQuotes.requestId, requestId),
      eq(providerQuotes.providerEmail, provider.email),
    )).limit(1);
  if (existingQuote) {
    return Response.json({ error: "You already submitted a quote for this job." }, { status: 409 });
  }

  const [pathway] = await db.select().from(providerPathwayProfiles)
    .where(and(
      eq(providerPathwayProfiles.providerId, provider.id),
      eq(providerPathwayProfiles.status, "active"),
    ))
    .orderBy(desc(providerPathwayProfiles.pathwayVersion))
    .limit(1);
  const performingPersonId = pathway?.providerPersonId || "";
  const [performer] = performingPersonId
    ? await db.select().from(providerPersonnel).where(and(
        eq(providerPersonnel.providerId, provider.id),
        eq(providerPersonnel.personId, performingPersonId),
        eq(providerPersonnel.status, "active"),
      )).limit(1)
    : [];
  if (!pathway || !performer || !performingPersonId) {
    return Response.json({
      error: "An active, verified performing person must be bound to this provider before quoting.",
      code: "PERFORMING_PERSON_REQUIRED",
    }, { status: 409 });
  }

  const quoteId = await quoteIdFor(requestId, provider.email);
  const scopeVersion = CUSTOMER_REQUEST_SCOPE_VERSION;
  const eligibility = await evaluateStageEligibility({
    stage: "quote",
    providerId: provider.id,
    personId: performingPersonId,
    supervisorPersonId: "",
    serviceCodes,
    jurisdiction: job.jurisdiction,
    scheduledFor: job.scheduledFor,
    requestId,
    quoteId,
    scopeVersion,
    assignmentVersion: 0,
    jobFacts: acceptedRequestScope.jobFacts,
    effectiveAt: new Date().toISOString(),
    testOnly: provider.isTestProvider === "yes" && job.isTestJob === "yes",
    persist: true,
  });
  if (!eligibility.allowed || !eligibility.decisionId) {
    return Response.json({
      error: eligibilityErrorMessage(eligibility),
      code: "QUOTE_ELIGIBILITY_DENIED",
      reasons: eligibility.reasons,
    }, { status: 409, headers: { "cache-control": "no-store" } });
  }

  const servicePriceCents = Math.round(servicePrice * 100);
  const customerPrice = customerPriceFor(servicePriceCents);
  try {
    await db.insert(providerQuotes).values({
      id: quoteId,
      requestId,
      serviceCodes: JSON.stringify(serviceCodes),
      providerName: provider.name,
      providerEmail: provider.email,
      performingPersonId,
      supervisorPersonId: "",
      priceCents: String(customerPrice.providerQuoteCents),
      laborPriceCents: String(customerPrice.providerQuoteCents),
      partsPriceCents: "0",
      customerFeeRateBps: customerPrice.customerFeeRateBps,
      customerFeeCents: String(customerPrice.customerFeeCents),
      customerTotalCents: String(customerPrice.customerTotalCents),
      partType,
      availability,
      scheduledFor: job.scheduledFor,
      message,
      scopeVersion,
      authorizationDecisionId: eligibility.decisionId,
    });
  } catch (error) {
    const [duplicateQuote] = await db.select({ id: providerQuotes.id }).from(providerQuotes)
      .where(and(
        eq(providerQuotes.requestId, requestId),
        eq(providerQuotes.providerEmail, provider.email),
      )).limit(1);
    if (duplicateQuote) {
      return Response.json({ error: "You already submitted a quote for this job." }, { status: 409 });
    }
    throw error;
  }
  await appendJobLifecycleEvent({
    requestId,
    quoteId,
    providerId: provider.id,
    actorRole: "provider",
    actorId: provider.email,
    eventType: "exact_service_quote_submitted",
    fromStatus: job.status,
    toStatus: job.status,
    scopeVersion,
    authorizationSnapshotId: eligibility.decisionId,
    details: {
      serviceCodes,
      scheduledFor: job.scheduledFor,
      performingPersonId,
      partsBillingModel,
      partType,
      partsDescription,
      partsBillingTermsVersion: PARTS_BILLING_TERMS_VERSION,
      noSeparateGoodsChargeConfirmed: providerPartsTermsAccepted,
      providerTaxResponsibilityConfirmed: providerPartsTaxConfirmed,
    },
  });
  return Response.json({ ok: true }, { status: 201 });
}
