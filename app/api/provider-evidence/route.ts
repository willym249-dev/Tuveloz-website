import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  complianceReminders,
  evidenceFileScans,
  providerEvidenceSubmissions,
  providerPathwayProfiles,
} from "../../../db/schema";
import {
  getAccountSession,
  providerApplicationFor,
} from "../../../lib/account-auth";
import { recordProviderAuditEvent } from "../../../lib/provider-audit";
import { notifyProviderEvidenceReceived } from "../../../lib/provider-compliance-notifications";
import {
  deleteProviderEvidence,
  getProviderEvidence,
  ProviderEvidenceValidationError,
  storeProviderEvidence,
  validateProviderEvidence,
} from "../../../lib/provider-evidence";
import {
  getEvidenceRequirements,
  isProviderPathway,
  isServiceCode,
  POLICY_JURISDICTION,
  PROVIDER_POLICY_MATRIX,
  type EvidenceRequirementCode,
} from "../../../lib/provider-policy";
import { isSameOriginRequest } from "../../../lib/request-security";
import { parseProviderServices } from "../../../lib/service-matching";

const STRUCTURED_ONLY_REQUIREMENTS = new Set([
  "performing_person_service_eligibility_snapshot",
  "qualified_supervisor_assignment",
  "direct_supervision_checkpoint_record",
  "sponsored_personnel_roster",
  "sponsored_employment_attestation",
  "provider_personnel_roster",
  "provider_employee_record",
]);

const CORRECTABLE_EVIDENCE_STATUSES = new Set([
  "accepted",
  "expired",
  "needs_correction",
  "rejected",
]);
const EXPIRATION_REMINDER_DAYS = [60, 30, 14, 7, 1] as const;
const DAY_MS = 24 * 60 * 60 * 1000;

function clean(value: File | string | null | undefined, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function validDate(value: string) {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(timestamp)
    && new Date(timestamp).toISOString().slice(0, 10) === value;
}

function isEvidenceRequirementCode(value: string): value is EvidenceRequirementCode {
  return Object.hasOwn(PROVIDER_POLICY_MATRIX.evidence_types, value);
}

async function evidenceAccount(request: Request) {
  const session = await getAccountSession(request);
  if (!session || session.role !== "provider") return null;
  const provider = await providerApplicationFor(session.email);
  return provider ? { session, provider } : null;
}

async function sha256Buffer(value: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", value);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function expirationReminderSchedule(expiresAt: string, now: Date) {
  if (!expiresAt) return [];
  const expirationTime = Date.parse(`${expiresAt}T14:00:00.000Z`);
  if (!Number.isFinite(expirationTime) || expirationTime <= now.getTime()) return [];
  const schedule = EXPIRATION_REMINDER_DAYS
    .map((days): { reminderType: string; dueAt: string; days: number } => ({
      reminderType: `evidence_expiration_${days}_day`,
      dueAt: new Date(expirationTime - days * DAY_MS).toISOString(),
      days,
    }))
    .filter((item) => Date.parse(item.dueAt) > now.getTime());
  if ((expirationTime - now.getTime()) / DAY_MS <= 60) {
    schedule.unshift({
      reminderType: "evidence_expiration_window_entered",
      dueAt: now.toISOString(),
      days: 0,
    });
  }
  return schedule;
}

export async function GET(request: Request) {
  const account = await evidenceAccount(request);
  if (!account) {
    return Response.json({ error: "Sign in with your provider account." }, { status: 401 });
  }
  const evidenceId = clean(new URL(request.url).searchParams.get("id"), 100);
  if (!evidenceId) {
    const db = getDb();
    const [rows, scans] = await Promise.all([db.select({
      id: providerEvidenceSubmissions.id,
      personId: providerEvidenceSubmissions.personId,
      requirementKey: providerEvidenceSubmissions.requirementKey,
      serviceCode: providerEvidenceSubmissions.serviceCode,
      jurisdiction: providerEvidenceSubmissions.jurisdiction,
      issuer: providerEvidenceSubmissions.issuer,
      effectiveAt: providerEvidenceSubmissions.effectiveAt,
      expiresAt: providerEvidenceSubmissions.expiresAt,
      status: providerEvidenceSubmissions.status,
      submittedAt: providerEvidenceSubmissions.submittedAt,
      reviewedAt: providerEvidenceSubmissions.reviewedAt,
      reasonCodes: providerEvidenceSubmissions.reasonCodes,
      reviewNotes: providerEvidenceSubmissions.reviewNotes,
    }).from(providerEvidenceSubmissions)
      .where(eq(providerEvidenceSubmissions.providerId, account.provider.id))
      .orderBy(desc(providerEvidenceSubmissions.submittedAt)),
    db.select({
      evidenceSubmissionId: evidenceFileScans.evidenceSubmissionId,
      status: evidenceFileScans.status,
      requestedAt: evidenceFileScans.requestedAt,
      completedAt: evidenceFileScans.completedAt,
    }).from(evidenceFileScans)
      .where(eq(evidenceFileScans.providerId, account.provider.id))
      .orderBy(desc(evidenceFileScans.requestedAt))]);
    return Response.json({
      evidence: rows.map((row) => {
        const scan = scans.find((item) => item.evidenceSubmissionId === row.id);
        return {
          ...row,
          scanStatus: scan?.status ?? "missing",
          scanRequestedAt: scan?.requestedAt ?? "",
          scanCompletedAt: scan?.completedAt ?? "",
          downloadAllowed: scan?.status === "clean",
        };
      }),
    }, {
      headers: { "cache-control": "no-store" },
    });
  }
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Cross-origin evidence downloads are not allowed." }, { status: 403 });
  }
  const db = getDb();
  const rows = await db.select().from(providerEvidenceSubmissions)
    .where(and(
      eq(providerEvidenceSubmissions.id, evidenceId),
      eq(providerEvidenceSubmissions.providerId, account.provider.id),
    )).limit(1);
  const row = rows[0];
  if (!row?.storageKey) return Response.json({ error: "Evidence file not found." }, { status: 404 });
  const scans = await db.select({
    status: evidenceFileScans.status,
  }).from(evidenceFileScans).where(and(
    eq(evidenceFileScans.evidenceSubmissionId, row.id),
    eq(evidenceFileScans.providerId, account.provider.id),
  )).orderBy(desc(evidenceFileScans.requestedAt)).limit(1);
  if (scans[0]?.status !== "clean") {
    await recordProviderAuditEvent({
      providerId: account.provider.id,
      personId: row.personId,
      serviceCode: row.serviceCode,
      jurisdiction: row.jurisdiction,
      eventType: "provider_evidence_view_blocked",
      entityType: "provider_evidence_submission",
      entityId: row.id,
      actorType: "provider",
      actorId: account.session.email,
      outcome: "blocked_until_clean_scan",
      reasonCodes: [`malware_scan_${scans[0]?.status || "missing"}`],
    });
    return Response.json({
      error: "This private file remains quarantined until its malware scan reports clean.",
      scanStatus: scans[0]?.status ?? "missing",
    }, {
      status: 423,
      headers: { "cache-control": "private, no-store, max-age=0" },
    });
  }
  const object = await getProviderEvidence(row.storageKey);
  if (!object) return Response.json({ error: "Evidence file not found." }, { status: 404 });
  await recordProviderAuditEvent({
    providerId: account.provider.id,
    personId: row.personId,
    serviceCode: row.serviceCode,
    jurisdiction: row.jurisdiction,
    eventType: "provider_evidence_viewed",
    entityType: "provider_evidence_submission",
    entityId: row.id,
    actorType: "provider",
    actorId: account.session.email,
    outcome: "allowed",
  });
  return new Response(object.body, {
    headers: {
      "cache-control": "private, no-store, max-age=0",
      "content-disposition": `attachment; filename="provider-evidence-${row.id}.${row.contentType === "application/pdf" ? "pdf" : "image"}"`,
      "content-security-policy": "sandbox",
      "cross-origin-resource-policy": "same-origin",
      "content-type": object.httpMetadata?.contentType || row.contentType || "application/octet-stream",
      "referrer-policy": "no-referrer",
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY",
    },
  });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "This upload must come from TUVELOZ." }, { status: 403 });
  }
  const account = await evidenceAccount(request);
  if (!account) {
    return Response.json({ error: "Sign in with your provider account." }, { status: 401 });
  }
  let storageKey = "";
  try {
    const formData = await request.formData();
    const serviceCodeValue = clean(formData.get("serviceCode"), 100);
    const requirementKey = clean(formData.get("requirementKey"), 140);
    const issuer = clean(formData.get("issuer"), 180);
    const effectiveAt = clean(formData.get("effectiveAt"), 20);
    const expiresAt = clean(formData.get("expiresAt"), 20);
    const supersedesEvidenceId = clean(formData.get("supersedesEvidenceId"), 120);
    if (!isServiceCode(serviceCodeValue) || serviceCodeValue === "general_auto_repair") {
      return Response.json({ error: "Choose a recognized exact service." }, { status: 400 });
    }
    const requestedServices = parseProviderServices(account.provider.service).filter(isServiceCode);
    if (!requestedServices.includes(serviceCodeValue)) {
      return Response.json({ error: "That service is not on this application." }, { status: 400 });
    }
    const profiles = await getDb().select().from(providerPathwayProfiles)
      .where(eq(providerPathwayProfiles.providerId, account.provider.id))
      .orderBy(desc(providerPathwayProfiles.pathwayVersion)).limit(1);
    const profile = profiles[0];
    if (!profile || !isProviderPathway(profile.relationshipPath)) {
      return Response.json({
        error: "Applicant-only accounts receive no training or jobs and cannot submit job-eligibility documents until a real provider pathway is selected.",
      }, { status: 409 });
    }
    const requirements = getEvidenceRequirements(serviceCodeValue, profile.relationshipPath);
    if (!isEvidenceRequirementCode(requirementKey) || !requirements.includes(requirementKey)) {
      return Response.json({ error: "That evidence type is not required for this service and pathway." }, { status: 400 });
    }
    if (STRUCTURED_ONLY_REQUIREMENTS.has(requirementKey)) {
      return Response.json({
        error: "This requirement must be confirmed through the employer, supervisor, or TUVELOZ workflow. Do not upload work-authorization documents, SSNs, or I-9 records.",
      }, { status: 400 });
    }
    const db = getDb();
    const priorEvidence = await db.select({
      id: providerEvidenceSubmissions.id,
      status: providerEvidenceSubmissions.status,
    }).from(providerEvidenceSubmissions).where(and(
      eq(providerEvidenceSubmissions.providerId, account.provider.id),
      eq(providerEvidenceSubmissions.personId, profile.providerPersonId),
      eq(providerEvidenceSubmissions.requirementKey, requirementKey),
      eq(providerEvidenceSubmissions.serviceCode, serviceCodeValue),
      eq(providerEvidenceSubmissions.jurisdiction, POLICY_JURISDICTION),
    )).orderBy(desc(providerEvidenceSubmissions.submittedAt)).limit(1);
    if (!supersedesEvidenceId && priorEvidence[0]) {
      return Response.json({
        error: priorEvidence[0].status === "pending"
          ? "This evidence already has a submission under review."
          : "Upload the new document as a replacement from the existing evidence record so review history is preserved.",
      }, { status: 409 });
    }
    if (supersedesEvidenceId) {
      const targets = await db.select({
        id: providerEvidenceSubmissions.id,
        providerId: providerEvidenceSubmissions.providerId,
        personId: providerEvidenceSubmissions.personId,
        requirementKey: providerEvidenceSubmissions.requirementKey,
        serviceCode: providerEvidenceSubmissions.serviceCode,
        jurisdiction: providerEvidenceSubmissions.jurisdiction,
        status: providerEvidenceSubmissions.status,
      }).from(providerEvidenceSubmissions)
        .where(eq(providerEvidenceSubmissions.id, supersedesEvidenceId)).limit(1);
      const target = targets[0];
      if (
        !target
        || target.providerId !== account.provider.id
        || target.personId !== profile.providerPersonId
        || target.requirementKey !== requirementKey
        || target.serviceCode !== serviceCodeValue
        || target.jurisdiction !== POLICY_JURISDICTION
      ) {
        return Response.json({
          error: "The replacement must match your own prior evidence, exact service, person, and jurisdiction.",
        }, { status: 409 });
      }
      if (!CORRECTABLE_EVIDENCE_STATUSES.has(target.status)) {
        return Response.json({
          error: "Wait for the current submission review before uploading another replacement.",
        }, { status: 409 });
      }
      const existingReplacements = await db.select({
        id: providerEvidenceSubmissions.id,
        status: providerEvidenceSubmissions.status,
      }).from(providerEvidenceSubmissions)
        .where(eq(providerEvidenceSubmissions.supersedesEvidenceId, target.id));
      if (existingReplacements.some((item) => item.status === "pending")) {
        return Response.json({
          error: "A replacement for this evidence is already under review.",
        }, { status: 409 });
      }
    }
    const definition = PROVIDER_POLICY_MATRIX.evidence_types[requirementKey];
    if (!validDate(effectiveAt) || !validDate(expiresAt)) {
      return Response.json({ error: "Enter valid evidence details and dates." }, { status: 400 });
    }
    if (definition.requires_expiration === true && !expiresAt) {
      return Response.json({ error: "This evidence type requires an expiration date." }, { status: 400 });
    }
    if (effectiveAt && expiresAt && effectiveAt > expiresAt) {
      return Response.json({ error: "The expiration date must be after the effective date." }, { status: 400 });
    }
    if (expiresAt && Date.parse(`${expiresAt}T23:59:59.999Z`) < Date.now()) {
      return Response.json({ error: "Upload current evidence that has not already expired." }, { status: 400 });
    }
    const document = await validateProviderEvidence(formData.get("document"));
    const documentHash = await sha256Buffer(document.bytes);
    storageKey = await storeProviderEvidence(account.provider.id, requirementKey, document);
    const evidenceId = crypto.randomUUID();
    const nowValue = new Date();
    const now = nowValue.toISOString();
    await db.insert(providerEvidenceSubmissions).values({
      id: evidenceId,
      providerId: account.provider.id,
      personId: profile.providerPersonId,
      requirementKey,
      serviceCode: serviceCodeValue,
      jurisdiction: POLICY_JURISDICTION,
      evidenceType: requirementKey,
      evidenceScope: JSON.stringify({
        serviceCode: serviceCodeValue,
        pathway: profile.relationshipPath,
        providerLevel: profile.providerLevel,
        originalName: document.originalName,
        size: document.size,
      }),
      storageKey,
      contentType: document.contentType,
      documentHash,
      issuer,
      effectiveAt,
      expiresAt,
      status: "pending",
      submittedAt: now,
      supersedesEvidenceId,
      createdAt: now,
      updatedAt: now,
    });
    const scanId = crypto.randomUUID();
    await db.insert(evidenceFileScans).values({
      id: scanId,
      evidenceSubmissionId: evidenceId,
      providerId: account.provider.id,
      scanProvider: "external_scanner_required",
      scanEngineVersion: "",
      status: "pending",
      threatName: "",
      fileHash: documentHash,
      requestedAt: now,
      completedAt: "",
      reviewedBy: "",
      reviewNotes: "",
      createdAt: now,
      updatedAt: now,
    });
    for (const reminder of expirationReminderSchedule(expiresAt, nowValue)) {
      await db.insert(complianceReminders).values({
        id: crypto.randomUUID(),
        providerId: account.provider.id,
        evidenceSubmissionId: evidenceId,
        serviceCode: serviceCodeValue,
        reminderType: reminder.reminderType,
        dueAt: reminder.dueAt,
        channel: "email",
        recipientEmail: account.provider.email,
        status: "scheduled",
        scheduledAt: now,
        sentAt: "",
        lastAttemptAt: "",
        attempts: 0,
        eventKey: `provider-evidence-expiration:${evidenceId}:${reminder.reminderType}`,
        metadata: JSON.stringify({
          expiresAt,
          requirementKey,
          reminderDays: reminder.days,
        }),
        createdAt: now,
        updatedAt: now,
      }).onConflictDoNothing({ target: complianceReminders.eventKey });
    }
    await recordProviderAuditEvent({
      providerId: account.provider.id,
      personId: profile.providerPersonId,
      serviceCode: serviceCodeValue,
      jurisdiction: POLICY_JURISDICTION,
      eventType: "provider_evidence_submitted",
      entityType: "provider_evidence_submission",
      entityId: evidenceId,
      actorType: "provider",
      actorId: account.session.email,
      outcome: "quarantined_pending_clean_scan_and_review",
      reasonCodes: [requirementKey, "malware_scan_pending"],
      metadata: {
        contentType: document.contentType,
        size: document.size,
        scanId,
        supersedesEvidenceId,
        expirationRemindersScheduled: expirationReminderSchedule(expiresAt, nowValue).length,
      },
    });
    await notifyProviderEvidenceReceived({
      providerId: account.provider.id,
      evidenceId,
      email: account.provider.email,
    });
    return Response.json({
      ok: true,
      id: evidenceId,
      status: "pending",
      scanStatus: "pending",
      message: "Evidence uploaded to private quarantine. It cannot be opened, reviewed as acceptable, or create job eligibility until the malware scan reports clean and the evidence is separately accepted.",
    }, { status: 201 });
  } catch (error) {
    if (storageKey) await deleteProviderEvidence(storageKey).catch(() => undefined);
    if (error instanceof ProviderEvidenceValidationError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error("Unable to upload provider evidence", error);
    return Response.json({ error: "Unable to upload this evidence." }, { status: 500 });
  }
}
