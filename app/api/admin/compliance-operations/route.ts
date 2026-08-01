import { and, asc, count, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "../../../../db";
import {
  complianceReminders,
  dataRightsRequests,
  jobCancellations,
  jobChangeOrders,
  jobIncidents,
  paymentAdjustments,
  providerAppeals,
  providerApplications,
  providerInvoices,
} from "../../../../db/schema";
import { verifyOwnerRequest } from "../../../../lib/owner-auth";
import { recordProviderAuditEvent } from "../../../../lib/provider-audit";
import { isSameOriginRequest } from "../../../../lib/request-security";

const NO_STORE = { "cache-control": "no-store" };

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function affirmative(value: unknown) {
  return value === true || value === "yes" || value === "on";
}

function metadataRecord(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

async function verifiedOwner(request: Request) {
  const verification = await verifyOwnerRequest(request);
  if (!verification.ok) {
    return {
      response: Response.json(
        { error: "Signed owner verification is required.", reason: verification.reason },
        { status: verification.reason === "owner-config-missing" ? 503 : 403, headers: NO_STORE },
      ),
    } as const;
  }
  return { email: verification.email } as const;
}

export async function GET(request: Request) {
  const owner = await verifiedOwner(request);
  if ("response" in owner) return owner.response;
  try {
    const db = getDb();
    const [
      providers,
      appeals,
      rights,
      reminders,
      incidents,
      cancellations,
      changes,
      invoices,
      adjustments,
      appealCount,
      rightsCount,
      reminderCount,
    ] = await Promise.all([
      db.select({
        id: providerApplications.id,
        name: providerApplications.name,
        email: providerApplications.email,
      }).from(providerApplications).limit(1000),
      db.select().from(providerAppeals)
        .where(inArray(providerAppeals.status, ["submitted", "under_review"]))
        .orderBy(asc(providerAppeals.dueAt), asc(providerAppeals.submittedAt))
        .limit(250),
      db.select().from(dataRightsRequests)
        .where(inArray(dataRightsRequests.status, [
          "submitted",
          "identity_verification",
          "in_review",
        ]))
        .orderBy(asc(dataRightsRequests.dueAt), asc(dataRightsRequests.receivedAt))
        .limit(250),
      db.select().from(complianceReminders)
        .where(eq(complianceReminders.status, "scheduled"))
        .orderBy(asc(complianceReminders.dueAt)).limit(500),
      db.select({
        id: jobIncidents.id,
        requestId: jobIncidents.requestId,
        quoteId: jobIncidents.quoteId,
        providerId: jobIncidents.providerId,
        reporterRole: jobIncidents.reporterRole,
        incidentType: jobIncidents.incidentType,
        severity: jobIncidents.severity,
        summary: jobIncidents.summary,
        occurredAt: jobIncidents.occurredAt,
        injuryReported: jobIncidents.injuryReported,
        propertyDamageReported: jobIncidents.propertyDamageReported,
        emergencyServicesContacted: jobIncidents.emergencyServicesContacted,
        status: jobIncidents.status,
        holdPayments: jobIncidents.holdPayments,
        assignedTo: jobIncidents.assignedTo,
        resolution: jobIncidents.resolution,
        resolvedAt: jobIncidents.resolvedAt,
      }).from(jobIncidents).orderBy(desc(jobIncidents.createdAt)).limit(250),
      db.select().from(jobCancellations)
        .orderBy(desc(jobCancellations.createdAt)).limit(250),
      db.select().from(jobChangeOrders)
        .orderBy(desc(jobChangeOrders.createdAt)).limit(250),
      db.select().from(providerInvoices)
        .orderBy(desc(providerInvoices.createdAt)).limit(250),
      db.select({
        id: paymentAdjustments.id,
        requestId: paymentAdjustments.requestId,
        quoteId: paymentAdjustments.quoteId,
        adjustmentType: paymentAdjustments.adjustmentType,
        amountCents: paymentAdjustments.amountCents,
        currency: paymentAdjustments.currency,
        status: paymentAdjustments.status,
        reasonCode: paymentAdjustments.reasonCode,
        requestedByRole: paymentAdjustments.requestedByRole,
        requestedAt: paymentAdjustments.requestedAt,
        decidedBy: paymentAdjustments.decidedBy,
        decidedAt: paymentAdjustments.decidedAt,
        providerImpactCents: paymentAdjustments.providerImpactCents,
        customerImpactCents: paymentAdjustments.customerImpactCents,
      }).from(paymentAdjustments)
        .orderBy(desc(paymentAdjustments.createdAt)).limit(250),
      db.select({ total: count() }).from(providerAppeals)
        .where(inArray(providerAppeals.status, ["submitted", "under_review"])),
      db.select({ total: count() }).from(dataRightsRequests)
        .where(inArray(dataRightsRequests.status, [
          "submitted",
          "identity_verification",
          "in_review",
        ])),
      db.select({ total: count() }).from(complianceReminders)
        .where(eq(complianceReminders.status, "scheduled")),
    ]);
    const providerById = new Map(providers.map((item) => [item.id, item]));
    return Response.json({
      generatedAt: new Date().toISOString(),
      notice: "This queue records review decisions only. It does not delete private files, send an email, issue a refund, release a payout, activate a provider service, or restore job access.",
      queueSummary: {
        appeals: {
          totalOpen: appealCount[0]?.total ?? 0,
          loaded: appeals.length,
          hasMore: (appealCount[0]?.total ?? 0) > appeals.length,
        },
        dataRightsRequests: {
          totalOpen: rightsCount[0]?.total ?? 0,
          loaded: rights.length,
          hasMore: (rightsCount[0]?.total ?? 0) > rights.length,
        },
        scheduledReminders: {
          totalOpen: reminderCount[0]?.total ?? 0,
          loaded: reminders.length,
          hasMore: (reminderCount[0]?.total ?? 0) > reminders.length,
        },
      },
      appeals: appeals.map((item) => ({
        ...item,
        supportingEvidenceIds: (() => {
          try {
            const parsed = JSON.parse(item.supportingEvidenceIds) as unknown;
            return Array.isArray(parsed)
              ? parsed.filter((value): value is string => typeof value === "string").slice(0, 20)
              : [];
          } catch {
            return [];
          }
        })(),
        providerName: providerById.get(item.providerId)?.name ?? "",
        providerEmail: providerById.get(item.providerId)?.email ?? item.submittedByEmail,
      })),
      dataRightsRequests: rights,
      reminders: reminders.map((item) => ({
        id: item.id,
        providerId: item.providerId,
        providerName: providerById.get(item.providerId)?.name ?? "",
        evidenceSubmissionId: item.evidenceSubmissionId,
        serviceCode: item.serviceCode,
        reminderType: item.reminderType,
        dueAt: item.dueAt,
        channel: item.channel,
        recipientEmail: item.recipientEmail,
        status: item.status,
        scheduledAt: item.scheduledAt,
        sentAt: item.sentAt,
        lastAttemptAt: item.lastAttemptAt,
        attempts: item.attempts,
      })),
      jobOperations: {
        incidents,
        cancellations,
        changeOrders: changes,
        invoices,
        paymentAdjustments: adjustments,
      },
    }, { headers: NO_STORE });
  } catch (error) {
    console.error("Unable to load owner compliance operations", error);
    return Response.json(
      { error: "Unable to load the compliance operations queue. Confirm migration 0034 is applied." },
      { status: 500, headers: NO_STORE },
    );
  }
}

export async function POST(request: Request) {
  const owner = await verifiedOwner(request);
  if ("response" in owner) return owner.response;
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Cross-site owner actions are not allowed." }, { status: 403, headers: NO_STORE });
  }
  try {
    const body = await request.json() as Record<string, unknown>;
    const action = clean(body.action, 80);
    const id = clean(body.id, 120);
    if (!id) return Response.json({ error: "Choose a queue record." }, { status: 400, headers: NO_STORE });
    const db = getDb();
    const now = new Date().toISOString();

    if (action === "review-appeal") {
      const [appeal] = await db.select().from(providerAppeals)
        .where(eq(providerAppeals.id, id)).limit(1);
      if (!appeal) return Response.json({ error: "Appeal not found." }, { status: 404, headers: NO_STORE });
      if (!["submitted", "under_review"].includes(appeal.status)) {
        return Response.json(
          { error: "This appeal is already final. Create a new documented correction or appeal instead of overwriting its history." },
          { status: 409, headers: NO_STORE },
        );
      }
      const outcome = clean(body.outcome, 40);
      const allowed = new Set(["under_review", "granted", "denied", "correction_required"]);
      if (!allowed.has(outcome)) {
        return Response.json({ error: "Choose under review, granted, denied, or correction required." }, { status: 400, headers: NO_STORE });
      }
      const decisionReason = clean(body.decisionReason, 1000);
      const resolutionNotes = clean(body.resolutionNotes, 2000);
      if (outcome !== "under_review" && (decisionReason.length < 10 || resolutionNotes.length < 10)) {
        return Response.json({ error: "A final appeal decision requires a plain-language reason and response." }, { status: 400, headers: NO_STORE });
      }
      const final = outcome !== "under_review";
      const updated = await db.update(providerAppeals).set({
        status: final ? "resolved" : "under_review",
        reviewedBy: owner.email,
        reviewedAt: final ? now : "",
        decision: final ? outcome : "",
        decisionReason: final ? decisionReason : "",
        resolutionNotes: final ? resolutionNotes : "",
        updatedAt: now,
      }).where(and(
        eq(providerAppeals.id, appeal.id),
        eq(providerAppeals.updatedAt, appeal.updatedAt),
        inArray(providerAppeals.status, ["submitted", "under_review"]),
      )).returning({ id: providerAppeals.id });
      if (!updated.length) {
        return Response.json(
          { error: "This appeal changed while you were reviewing it. Refresh before recording a decision." },
          { status: 409, headers: NO_STORE },
        );
      }
      await recordProviderAuditEvent({
        providerId: appeal.providerId,
        serviceCode: appeal.serviceCode,
        eventType: final ? "provider_appeal_decided" : "provider_appeal_review_started",
        entityType: "provider_appeal",
        entityId: appeal.id,
        actorType: "verified_owner",
        actorId: owner.email,
        outcome,
        reasonCodes: final ? [outcome] : ["under_review"],
        metadata: {
          evidenceSubmissionId: appeal.evidenceSubmissionId,
          eligibilityAutomaticallyChanged: false,
        },
      });
      return Response.json({
        ok: true,
        message: final
          ? "Appeal decision recorded. It did not accept evidence or restore any service; use the separate evidence workflow for that."
          : "Appeal marked under review. Job access remains blocked.",
      }, { headers: NO_STORE });
    }

    if (action === "update-data-rights") {
      const [item] = await db.select().from(dataRightsRequests)
        .where(eq(dataRightsRequests.id, id)).limit(1);
      if (!item) return Response.json({ error: "Data-rights request not found." }, { status: 404, headers: NO_STORE });
      if (["fulfilled", "denied", "closed"].includes(item.status)) {
        return Response.json(
          { error: "This privacy request is already final. Record any correction as a new request rather than rewriting the closed record." },
          { status: 409, headers: NO_STORE },
        );
      }
      const status = clean(body.status, 40);
      const identityStatus = clean(body.identityVerificationStatus, 60);
      const legalHold = affirmative(body.legalHold) ? "yes" : "no";
      const responseSummary = clean(body.responseSummary, 3000);
      const identityVerificationReference = clean(body.identityVerificationReference, 1000);
      const legalHoldReleaseReference = clean(body.legalHoldReleaseReference, 1000);
      const deletionReference = clean(body.deletionReference, 1000);
      const allowedStatuses = new Set(["submitted", "identity_verification", "in_review", "fulfilled", "denied", "closed"]);
      const allowedIdentity = new Set(["pending", "account_session_verified", "additional_verification_required", "verified", "failed"]);
      if (!allowedStatuses.has(status) || !allowedIdentity.has(identityStatus)) {
        return Response.json({ error: "Choose controlled request and identity-verification statuses." }, { status: 400, headers: NO_STORE });
      }
      if (
        identityStatus === "verified"
        && item.identityVerificationStatus !== "verified"
        && (identityVerificationReference.length < 8 || !affirmative(body.explicitIdentityVerification))
      ) {
        return Response.json(
          { error: "Record the real identity-verification reference and explicitly confirm it before marking identity verified." },
          { status: 400, headers: NO_STORE },
        );
      }
      const final = ["fulfilled", "denied", "closed"].includes(status);
      if (final && responseSummary.length < 20) {
        return Response.json({ error: "A final privacy response requires a useful response summary." }, { status: 400, headers: NO_STORE });
      }
      if (["fulfilled", "closed"].includes(status) && identityStatus !== "verified") {
        return Response.json(
          { error: "A privacy request cannot be fulfilled or closed until identity is recorded as verified." },
          { status: 409, headers: NO_STORE },
        );
      }
      const deletionCompleted = affirmative(body.deletionCompleted);
      const deletionRequestClosing = (
        item.requestType === "deletion"
        && ["fulfilled", "closed"].includes(status)
      );
      if (deletionCompleted && item.requestType !== "deletion") {
        return Response.json(
          { error: "Deletion completion can be recorded only for a deletion request." },
          { status: 409, headers: NO_STORE },
        );
      }
      if (deletionRequestClosing && !deletionCompleted) {
        return Response.json(
          { error: "A deletion request cannot be fulfilled or closed until deletion completion and its reference are recorded." },
          { status: 409, headers: NO_STORE },
        );
      }
      if (deletionCompleted && (legalHold === "yes" || item.legalHold === "yes")) {
        return Response.json({ error: "Deletion cannot be marked complete while a legal hold is active." }, { status: 409, headers: NO_STORE });
      }
      if (deletionCompleted && !["fulfilled", "closed"].includes(status)) {
        return Response.json(
          { error: "Completed deletion can be recorded only with a verified, fulfilled or closed privacy request." },
          { status: 409, headers: NO_STORE },
        );
      }
      if (deletionCompleted && item.deletionCompletedAt) {
        return Response.json(
          { error: "Deletion completion is already recorded and cannot be overwritten." },
          { status: 409, headers: NO_STORE },
        );
      }
      if (deletionCompleted && !affirmative(body.explicitDeletionConfirmation)) {
        return Response.json({
          error: "Confirm that the separately approved deletion was actually completed. This queue does not delete data itself.",
        }, { status: 400, headers: NO_STORE });
      }
      if (deletionCompleted && deletionReference.length < 8) {
        return Response.json(
          { error: "Record the real deletion job, ticket, or completion reference." },
          { status: 400, headers: NO_STORE },
        );
      }
      if (item.legalHold === "yes" && legalHold === "no") {
        if (!affirmative(body.explicitLegalHoldRelease) || legalHoldReleaseReference.length < 8) {
          return Response.json(
            { error: "Release an existing legal hold only in a separate, explicitly confirmed step with the real court, agency, matter, or authorized release reference." },
            { status: 409, headers: NO_STORE },
          );
        }
      }
      const recordReferences = [
        identityStatus === "verified" && identityVerificationReference
          ? `Identity verification reference: ${identityVerificationReference}`
          : "",
        item.legalHold === "yes" && legalHold === "no"
          ? `Legal-hold release reference: ${legalHoldReleaseReference}`
          : "",
        deletionCompleted ? `Deletion completion reference: ${deletionReference}` : "",
      ].filter(Boolean);
      const storedResponseSummary = clean(
        [responseSummary, ...recordReferences].filter(Boolean).join("\n"),
        5000,
      );
      const updated = await db.update(dataRightsRequests).set({
        status,
        identityVerificationStatus: identityStatus,
        legalHold,
        responseSummary: storedResponseSummary,
        resolvedAt: final ? now : "",
        resolvedBy: final ? owner.email : "",
        deletionCompletedAt: deletionCompleted ? now : item.deletionCompletedAt,
        updatedAt: now,
      }).where(and(
        eq(dataRightsRequests.id, item.id),
        eq(dataRightsRequests.updatedAt, item.updatedAt),
        inArray(dataRightsRequests.status, ["submitted", "identity_verification", "in_review"]),
      )).returning({ id: dataRightsRequests.id });
      if (!updated.length) {
        return Response.json(
          { error: "This privacy request changed while you were reviewing it. Refresh before recording a decision." },
          { status: 409, headers: NO_STORE },
        );
      }
      if (item.providerId) {
        await recordProviderAuditEvent({
          providerId: item.providerId,
          eventType: "provider_data_rights_request_updated",
          entityType: "data_rights_request",
          entityId: item.id,
          actorType: "verified_owner",
          actorId: owner.email,
          outcome: status,
          reasonCodes: [item.requestType, `legal_hold_${legalHold}`],
          metadata: {
            identityVerificationStatus: identityStatus,
            identityVerificationReference,
            legalHoldReleaseReference,
            deletionReference,
            deletionRecordedComplete: deletionCompleted,
            automatedDeletionPerformed: false,
          },
        });
      }
      return Response.json({
        ok: true,
        message: deletionCompleted
          ? "The separately completed deletion was recorded. This action did not delete any file or database record."
          : "Privacy-request review status recorded. No files or account data were deleted by this action.",
      }, { headers: NO_STORE });
    }

    if (action === "record-reminder-result") {
      const [item] = await db.select().from(complianceReminders)
        .where(eq(complianceReminders.id, id)).limit(1);
      if (!item) return Response.json({ error: "Reminder not found." }, { status: 404, headers: NO_STORE });
      if (item.status !== "scheduled") {
        return Response.json(
          { error: "This reminder already has a final result and cannot be overwritten." },
          { status: 409, headers: NO_STORE },
        );
      }
      const result = clean(body.result, 40);
      const deliveryReference = clean(body.deliveryReference, 1000);
      if (!["sent", "failed", "cancelled"].includes(result) || deliveryReference.length < 8 || !affirmative(body.explicitConfirmation)) {
        return Response.json({
          error: "Choose sent, failed, or cancelled; add the real delivery/manual-contact reference; and confirm it. This screen does not send the reminder.",
        }, { status: 400, headers: NO_STORE });
      }
      const metadata = JSON.stringify({
        ...metadataRecord(item.metadata),
        deliveryResult: {
          result,
          deliveryReference,
          recordedBy: owner.email,
          recordedAt: now,
          automatedDeliveryPerformed: false,
        },
      });
      const updated = await db.update(complianceReminders).set({
        status: result,
        sentAt: result === "sent" ? now : "",
        lastAttemptAt: now,
        attempts: item.attempts + (result === "cancelled" ? 0 : 1),
        metadata,
        updatedAt: now,
      }).where(and(
        eq(complianceReminders.id, item.id),
        eq(complianceReminders.updatedAt, item.updatedAt),
        eq(complianceReminders.status, "scheduled"),
      )).returning({ id: complianceReminders.id });
      if (!updated.length) {
        return Response.json(
          { error: "This reminder changed while you were reviewing it. Refresh before recording a result." },
          { status: 409, headers: NO_STORE },
        );
      }
      await recordProviderAuditEvent({
        providerId: item.providerId,
        serviceCode: item.serviceCode,
        eventType: "compliance_reminder_result_recorded",
        entityType: "compliance_reminder",
        entityId: item.id,
        actorType: "verified_owner",
        actorId: owner.email,
        outcome: result,
        reasonCodes: [item.reminderType],
        metadata: { automatedDeliveryPerformed: false },
      });
      return Response.json({
        ok: true,
        message: "Reminder result recorded from the supplied evidence. No email was sent by this action.",
      }, { headers: NO_STORE });
    }

    return Response.json({ error: "Unsupported owner queue action." }, { status: 400, headers: NO_STORE });
  } catch (error) {
    console.error("Unable to update owner compliance operations", error);
    return Response.json({ error: "Unable to record this owner review action." }, { status: 500, headers: NO_STORE });
  }
}
