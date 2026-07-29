import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  customerRequests,
  providerApplications,
  providerJobRecords,
  providerQuotes,
  stripePayments,
} from "../../../db/schema";
import {
  effectiveProviderServices,
  providerMatchesArea,
  providerMatchesJob,
  providerMatchesServiceLocation,
  QUOTE_PART_TYPE_OPTIONS,
} from "../../../lib/service-matching";
import {
  deleteJobImage,
  ImageValidationError,
  storeJobImage,
  validateJobImage,
} from "../../../lib/job-images";
import { customerPriceFor } from "../../../lib/customer-fee";
import { getAccountSession, providerAccountFor } from "../../../lib/account-auth";

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
  const provider = await providerAccountFor(session.email);
  return provider && providerAccessIsActive(provider) ? provider : null;
}

export async function GET(request: Request) {
  const provider = await providerForSession(request);
  if (!provider) {
    return Response.json(
      { error: "Sign in to your verified provider workspace." },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
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
      createdAt: providerQuotes.createdAt,
    })
    .from(providerQuotes)
    .innerJoin(customerRequests, eq(providerQuotes.requestId, customerRequests.id))
    .where(eq(providerQuotes.providerEmail, provider.email))
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
    .where(eq(customerRequests.status, "approved"))
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
    .where(inArray(customerRequests.status, ["quote accepted", "on my way", "arrived", "completed"]))
    .orderBy(desc(customerRequests.createdAt))
    .limit(50);
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
    assignedJobs: assignedJobs.filter(
      (job) => (provider.isTestProvider === "yes") === (job.isTestJob === "yes"),
    ).map((job) => {
      const usesLegacyTotal = Number(job.laborPriceCents) + Number(job.partsPriceCents) === 0
        && Number(job.priceCents) > 0;
      return {
        ...job,
        repeatCustomer: Boolean(job.preferredProviderEmail),
        preferredProviderEmail: undefined,
        laborPriceCents: usesLegacyTotal ? job.priceCents : job.laborPriceCents,
        workStatus: job.status === "completed" ? "completed" : (job.workStatus || "scheduled"),
        timerStartedAt: job.timerStartedAt || "",
        trackedSeconds: job.trackedSeconds || 0,
        billableMinutes: job.billableMinutes || 0,
        workNotes: job.workNotes || "",
        partsNotes: job.partsNotes || "",
        hasIssueImage: Boolean(job.issueImageKey),
        hasCompletionImage: Boolean(job.completionImageKey),
        issueImageKey: undefined,
        completionImageKey: undefined,
      };
    }),
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
  const provider = await providerForSession(request);
  if (!provider) {
    return Response.json(
      { error: "Sign in to your verified provider workspace." },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
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
        await db.insert(providerJobRecords).values({
          id: recordId,
          requestId,
          providerEmail: provider.email,
          timerStartedAt: now,
          updatedAt: now,
        }).onConflictDoUpdate({
          target: [providerJobRecords.requestId, providerJobRecords.providerEmail],
          set: { timerStartedAt: now, updatedAt: now },
        });
        return Response.json({
          ok: true,
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
        return Response.json({ ok: true, timerStartedAt: "", trackedSeconds });
      }
      return Response.json({ error: "Choose whether to start or stop the timer." }, { status: 400 });
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
    const trackedSeconds = existingRecord?.timerStartedAt
      ? existingRecord.trackedSeconds
      : Math.round(actualMinutes * 60);
    await db.insert(providerJobRecords).values({
      id: recordId,
      requestId,
      providerEmail: provider.email,
      workStatus,
      trackedSeconds,
      billableMinutes: Math.round(billableMinutes),
      workNotes,
      partsNotes,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: [providerJobRecords.requestId, providerJobRecords.providerEmail],
      set: {
        workStatus,
        trackedSeconds,
        billableMinutes: Math.round(billableMinutes),
        workNotes,
        partsNotes,
        updatedAt: now,
      },
    });
    return Response.json({
      ok: true,
      record: {
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
    const transitions: Record<string, string> = {
      "quote accepted": "on my way",
      "on my way": "arrived",
      "arrived": "completed",
    };
    if (transitions[assignedJob.status] !== nextStatus) {
      return Response.json({ error: "This job status cannot be changed that way." }, { status: 409 });
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
        workStatus: "completed",
        trackedSeconds: completedTrackedSeconds,
        updatedAt: completedAt,
      }).onConflictDoUpdate({
        target: [providerJobRecords.requestId, providerJobRecords.providerEmail],
        set: {
          workStatus: "completed",
          timerStartedAt: "",
          trackedSeconds: completedTrackedSeconds,
          updatedAt: completedAt,
        },
      });

      // A paid quote uses separate charges and transfers. Completion makes the
      // provider amount eligible for the owner's explicit release; it does not
      // transfer funds from a provider-controlled status button.
      await db.update(stripePayments).set({
        status: "ready_for_release",
        updatedAt: completedAt,
      }).where(and(
        eq(stripePayments.requestId, requestId),
        eq(stripePayments.status, "paid_pending_completion"),
      ));
    }
    return Response.json({
      ok: true,
      status: nextStatus,
      ...(completedTrackedSeconds === undefined ? {} : { trackedSeconds: completedTrackedSeconds }),
    });
  }

  const availability = clean(body.availability, 200);
  const message = clean(body.message, 800);
  let partType = clean(body.partType, 40);
  const laborPrice = Number(body.laborPrice ?? body.price);
  const partsPrice = Number(body.partsPrice ?? 0);
  const price = laborPrice + partsPrice;
  if (
    !availability
    || !message
    || !Number.isFinite(laborPrice)
    || !Number.isFinite(partsPrice)
    || laborPrice < 0
    || partsPrice < 0
    || price <= 0
  ) {
    return Response.json({
      error: "Enter valid labor and parts amounts, with a total greater than $0.",
    }, { status: 400 });
  }

  const [job] = await db.select({
    id: customerRequests.id,
    status: customerRequests.status,
    service: customerRequests.service,
    partsSource: customerRequests.partsSource,
    partsPreference: customerRequests.partsPreference,
    zip: customerRequests.zip,
    launchArea: customerRequests.launchArea,
    serviceLocations: customerRequests.serviceLocations,
    isTestJob: customerRequests.isTestJob,
  }).from(customerRequests)
    .where(eq(customerRequests.id, requestId)).limit(1);
  if (!job) return Response.json({ error: "Job request not found." }, { status: 404 });
  if (job.status !== "approved") {
    return Response.json({ error: "This job is no longer accepting quotes." }, { status: 409 });
  }
  if ((provider.isTestProvider === "yes") !== (job.isTestJob === "yes")) {
    return Response.json({ error: "Test providers can only quote test jobs." }, { status: 403 });
  }
  if (!providerMatchesJob(
    effectiveProviderServices(provider.service, provider.approvedServices, provider.isTestProvider),
    job.service,
  )) {
    return Response.json({ error: "This job does not match your approved service." }, { status: 403 });
  }
  if (!providerMatchesArea(provider.serviceArea, job.launchArea || job.zip)) {
    return Response.json({ error: "This job is outside your approved service area." }, { status: 403 });
  }
  if (!providerMatchesServiceLocation(provider.workLocations, job.serviceLocations)) {
    return Response.json({
      error: "This job’s service-location choice does not match your provider settings.",
    }, { status: 403 });
  }
  if (job.partsSource === "I have the parts — labor only") {
    if (partsPrice > 0) {
      return Response.json({
        error: "This customer is supplying the parts, so the parts amount must be $0.",
      }, { status: 400 });
    }
    partType = "Customer supplied";
  } else {
    if (!QUOTE_PART_TYPE_OPTIONS.includes(
      partType as (typeof QUOTE_PART_TYPE_OPTIONS)[number],
    )) {
      return Response.json({ error: "Choose the part type included in this quote." }, { status: 400 });
    }
    if (
      (job.partsPreference === "OEM" || job.partsPreference === "Aftermarket")
      && partType !== job.partsPreference
      && partType !== "No parts needed"
    ) {
      return Response.json({
        error: `This customer requested ${job.partsPreference} parts.`,
      }, { status: 400 });
    }
    if (partType === "No parts needed" && partsPrice !== 0) {
      return Response.json({
        error: "Choose a $0 parts price when no parts are needed.",
      }, { status: 400 });
    }
    if (partType !== "No parts needed" && partsPrice <= 0) {
      return Response.json({
        error: "Enter the price for the selected part type.",
      }, { status: 400 });
    }
  }
  const [existingQuote] = await db.select({ id: providerQuotes.id }).from(providerQuotes)
    .where(and(
      eq(providerQuotes.requestId, requestId),
      eq(providerQuotes.providerEmail, provider.email),
    )).limit(1);
  if (existingQuote) {
    return Response.json({ error: "You already submitted a quote for this job." }, { status: 409 });
  }

  const customerPrice = customerPriceFor(Math.round(price * 100));
  try {
    await db.insert(providerQuotes).values({
      id: await quoteIdFor(requestId, provider.email),
      requestId,
      providerName: provider.name,
      providerEmail: provider.email,
      priceCents: String(customerPrice.providerQuoteCents),
      laborPriceCents: String(Math.round(laborPrice * 100)),
      partsPriceCents: String(Math.round(partsPrice * 100)),
      customerFeeRateBps: customerPrice.customerFeeRateBps,
      customerFeeCents: String(customerPrice.customerFeeCents),
      customerTotalCents: String(customerPrice.customerTotalCents),
      partType,
      availability,
      message,
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
  return Response.json({ ok: true }, { status: 201 });
}
