import { and, asc, desc, eq, lte, ne } from "drizzle-orm";
import type Stripe from "stripe";
import { getDb } from "../db";
import {
  providerApplications,
  providerApplicationSubmissionEvidence,
  providerIdentityVerificationSessions,
  providerPathwayProfiles,
  providerPersonnel,
} from "../db/schema";
import {
  immutablePerformingPersonName,
  verifiedDobIsAdult,
  verifiedIdentityNameMatches,
} from "./identity-verification-policy";
import {
  getStripeIdentityClient,
  stripeIdentityModeMatchesProvider,
} from "./stripe";
import {
  supersededIdentityCleanupBatchLimit,
  supersededIdentityCleanupScanLimit,
} from "./stripe-identity-cleanup-policy";

const IDENTITY_PROVIDER = "stripe_identity";
const IDENTITY_VALIDITY_DAYS = 365;
const EVENT_FUTURE_SKEW_SECONDS = 5 * 60;

function text(value: unknown, maximum = 300) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function eventDate(eventCreated: number) {
  if (!Number.isSafeInteger(eventCreated) || eventCreated <= 0) return null;
  const date = new Date(eventCreated * 1000);
  if (!Number.isFinite(date.getTime())) return null;
  if (date.getTime() > Date.now() + EVENT_FUTURE_SKEW_SECONDS * 1000) return null;
  return date;
}

function validThroughDate(checkedAt: Date) {
  return new Date(
    checkedAt.getTime() + IDENTITY_VALIDITY_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString().slice(0, 10);
}

async function personnelBindingCanBeReplaced(
  person: typeof providerPersonnel.$inferSelect,
  row: typeof providerIdentityVerificationSessions.$inferSelect,
  newSessionId: string,
  newCheckedAt: Date,
) {
  const identityFieldsBlank = !person.identityVerificationProvider
    && !person.identityVerificationReference
    && !person.identityVerificationCheckedAt
    && !person.identityVerificationValidThrough
    && !person.ageVerificationProvider
    && !person.ageVerificationReference
    && !person.ageVerificationCheckedAt
    && !person.ageVerificationValidThrough;
  if (identityFieldsBlank) return true;
  if (
    person.identityVerificationProvider !== IDENTITY_PROVIDER
    || person.ageVerificationProvider !== IDENTITY_PROVIDER
    || person.identityVerificationReference !== person.ageVerificationReference
    || person.identityVerificationReference === newSessionId
    || person.identityVerificationCheckedAt !== person.ageVerificationCheckedAt
    || person.identityVerificationValidThrough !== person.ageVerificationValidThrough
  ) return false;
  const [prior] = await getDb().select().from(providerIdentityVerificationSessions)
    .where(and(
      eq(providerIdentityVerificationSessions.providerId, row.providerId),
      eq(providerIdentityVerificationSessions.personId, row.personId),
      eq(
        providerIdentityVerificationSessions.applicationSubmissionEvidenceId,
        row.applicationSubmissionEvidenceId,
      ),
      eq(providerIdentityVerificationSessions.stripeVerificationSessionId,
        person.identityVerificationReference),
      eq(providerIdentityVerificationSessions.decisionStatus, "approved"),
      eq(providerIdentityVerificationSessions.stripeStatus, "verified"),
    )).limit(1);
  if (!prior) return false;
  const priorCheckedAt = new Date(prior.checkedAt);
  return Number.isFinite(priorCheckedAt.getTime())
    && person.identityVerificationCheckedAt === prior.checkedAt
    && person.ageVerificationCheckedAt === prior.checkedAt
    && person.identityVerificationValidThrough === validThroughDate(priorCheckedAt)
    && person.ageVerificationValidThrough === validThroughDate(priorCheckedAt)
    && person.identityVerificationValidThrough < newCheckedAt.toISOString().slice(0, 10);
}

function reportId(session: Stripe.Identity.VerificationSession) {
  const report = session.last_verification_report;
  return typeof report === "string" ? report : text(report?.id, 255);
}

export function stripeIdentitySessionBindingMatches(
  row: typeof providerIdentityVerificationSessions.$inferSelect,
  session: Stripe.Identity.VerificationSession,
) {
  const metadata = session.metadata ?? {};
  const documentOptions = session.options?.document;
  const allowedDocumentTypes = documentOptions?.allowed_types ?? [];
  return session.id === row.stripeVerificationSessionId
    && session.livemode === Boolean(row.livemode)
    && session.client_reference_id === row.id
    // Reusable verification flows return options: null, which cannot prove
    // the checks below. Only explicit document sessions are accepted.
    && session.type === "document"
    && session.verification_flow === undefined
    && documentOptions?.require_live_capture === true
    && documentOptions.require_matching_selfie === true
    && documentOptions.require_id_number !== true
    && allowedDocumentTypes.length === 3
    && allowedDocumentTypes.includes("driving_license")
    && allowedDocumentTypes.includes("id_card")
    && allowedDocumentTypes.includes("passport")
    && session.options?.id_number === undefined
    && session.options?.email?.require_verification !== true
    && session.options?.phone?.require_verification !== true
    && text(metadata.tuveloz_provider_id, 120) === row.providerId
    && text(metadata.tuveloz_person_id, 120) === row.personId
    && text(metadata.tuveloz_application_evidence_id, 120)
      === row.applicationSubmissionEvidenceId
    && text(metadata.tuveloz_person_name_source_type, 40) === row.personNameSourceType
    && text(metadata.tuveloz_person_name_source_id, 120) === row.personNameSourceId;
}

/**
 * Best-effort privacy cleanup for obsolete hosted sessions. This routine never
 * changes a decision, retries an approval, or trusts a remote ID by itself.
 * It acts only after the complete immutable Stripe/TUVELOZ binding and the
 * provider's test/live mode have both been revalidated.
 */
export async function cleanupSupersededStripeIdentitySessions(limit = 5) {
  const boundedLimit = supersededIdentityCleanupBatchLimit(limit);
  const scanLimit = supersededIdentityCleanupScanLimit(boundedLimit);
  const db = getDb();
  const attempts = await db.select().from(providerIdentityVerificationSessions)
    .where(and(
      eq(providerIdentityVerificationSessions.decisionStatus, "closed"),
      eq(
        providerIdentityVerificationSessions.failureCode,
        "application_evidence_superseded",
      ),
      ne(providerIdentityVerificationSessions.stripeVerificationSessionId, ""),
      ne(providerIdentityVerificationSessions.stripeStatus, "canceled"),
    ))
    .orderBy(asc(providerIdentityVerificationSessions.updatedAt))
    .limit(scanLimit);

  const deferRow = async (
    row: typeof providerIdentityVerificationSessions.$inferSelect,
  ) => {
    try {
      await db.update(providerIdentityVerificationSessions).set({
        updatedAt: new Date().toISOString(),
      }).where(and(
        eq(providerIdentityVerificationSessions.id, row.id),
        eq(providerIdentityVerificationSessions.decisionStatus, "closed"),
        eq(
          providerIdentityVerificationSessions.failureCode,
          "application_evidence_superseded",
        ),
        eq(
          providerIdentityVerificationSessions.stripeVerificationSessionId,
          row.stripeVerificationSessionId,
        ),
        eq(providerIdentityVerificationSessions.stripeStatus, row.stripeStatus),
        eq(providerIdentityVerificationSessions.updatedAt, row.updatedAt),
      ));
    } catch {
      // Fail closed. A later scheduled run can retry this unchanged row.
    }
  };

  let canceled = 0;
  let skipped = 0;
  let failed = 0;
  for (const row of attempts) {
    try {
      const [application] = await db.select({
        isTestProvider: providerApplications.isTestProvider,
      }).from(providerApplications).where(eq(
        providerApplications.id,
        row.providerId,
      )).limit(1);
      if (
        !application
        || !stripeIdentityModeMatchesProvider(application.isTestProvider)
      ) {
        skipped += 1;
        await deferRow(row);
        continue;
      }

      const stripe = getStripeIdentityClient();
      const remote = await stripe.identity.verificationSessions.retrieve(
        row.stripeVerificationSessionId,
      );
      if (
        !stripeIdentitySessionBindingMatches(row, remote)
        || remote.livemode !== (application.isTestProvider !== "yes")
      ) {
        skipped += 1;
        await deferRow(row);
        continue;
      }

      let canceledSession = remote;
      if (remote.status === "requires_input") {
        canceledSession = await stripe.identity.verificationSessions.cancel(remote.id);
      } else if (remote.status !== "canceled") {
        skipped += 1;
        await deferRow(row);
        continue;
      }
      if (
        canceledSession.status !== "canceled"
        || !stripeIdentitySessionBindingMatches(row, canceledSession)
        || canceledSession.livemode !== (application.isTestProvider !== "yes")
      ) {
        skipped += 1;
        await deferRow(row);
        continue;
      }

      const [updated] = await db.update(providerIdentityVerificationSessions).set({
        stripeStatus: "canceled",
        updatedAt: new Date().toISOString(),
      }).where(and(
        eq(providerIdentityVerificationSessions.id, row.id),
        eq(providerIdentityVerificationSessions.decisionStatus, "closed"),
        eq(
          providerIdentityVerificationSessions.failureCode,
          "application_evidence_superseded",
        ),
        eq(
          providerIdentityVerificationSessions.stripeVerificationSessionId,
          row.stripeVerificationSessionId,
        ),
        eq(providerIdentityVerificationSessions.stripeStatus, row.stripeStatus),
      )).returning({ id: providerIdentityVerificationSessions.id });
      if (updated) canceled += 1;
      else {
        skipped += 1;
        await deferRow(row);
      }
      if (canceled >= boundedLimit) break;
    } catch (error) {
      failed += 1;
      await deferRow(row);
      // Stripe errors can contain request or account details. Log only the
      // stable error class, never a key, payload, URL, session, or raw message.
      const errorName = error instanceof Error ? error.name : "UnknownError";
      console.error("Unable to clean up a superseded Stripe Identity session", errorName);
    }
  }
  return { examined: attempts.length, canceled, skipped, failed };
}

async function providerModeMatches(
  row: typeof providerIdentityVerificationSessions.$inferSelect,
  livemode: boolean,
) {
  const [application] = await getDb().select({
    isTestProvider: providerApplications.isTestProvider,
  }).from(providerApplications).where(eq(providerApplications.id, row.providerId)).limit(1);
  return Boolean(application)
    && livemode === (application?.isTestProvider !== "yes");
}

async function blockSession(
  rowId: string,
  eventId: string,
  eventCreated: number,
  status: string,
  failureCode: string,
  checkedAt: string,
  verificationReportId = "",
) {
  const blocked = await getDb().update(providerIdentityVerificationSessions).set({
    stripeStatus: status,
    decisionStatus: "blocked",
    failureCode,
    checkedAt,
    stripeVerificationReportId: verificationReportId,
    lastStripeEventId: eventId,
    lastStripeEventCreated: eventCreated,
    updatedAt: new Date().toISOString(),
  }).where(and(
    eq(providerIdentityVerificationSessions.id, rowId),
    eq(providerIdentityVerificationSessions.decisionStatus, "pending"),
    lte(providerIdentityVerificationSessions.lastStripeEventCreated, eventCreated),
  )).returning({ id: providerIdentityVerificationSessions.id });
  return Boolean(blocked[0]);
}

/**
 * Redaction is a privacy lifecycle event, not an adverse identity decision.
 * A previously approved verification remains valid through its recorded term;
 * pending sessions close and can never be used to approve a person.
 */
export async function recordStripeIdentityRedactionEvent(
  eventId: string,
  eventCreated: number,
  sessionId: string,
  livemode: boolean,
) {
  const db = getDb();
  const [row] = await db.select().from(providerIdentityVerificationSessions)
    .where(eq(providerIdentityVerificationSessions.stripeVerificationSessionId, sessionId))
    .limit(1);
  if (!row) return false;
  const occurredAt = eventDate(eventCreated);
  if (!occurredAt || Boolean(row.livemode) !== livemode) {
    throw new Error("Stripe Identity redaction event binding is invalid.");
  }
  if (row.redactedAt) return true;
  const occurredAtIso = occurredAt.toISOString();
  if (row.decisionStatus === "approved") {
    await db.update(providerIdentityVerificationSessions).set({
      redactedAt: occurredAtIso,
      lastStripeEventId: eventId,
      lastStripeEventCreated: eventCreated,
      updatedAt: new Date().toISOString(),
    }).where(and(
      eq(providerIdentityVerificationSessions.id, row.id),
      eq(providerIdentityVerificationSessions.decisionStatus, "approved"),
      lte(providerIdentityVerificationSessions.lastStripeEventCreated, eventCreated),
    ));
    return true;
  }
  if (row.decisionStatus === "blocked" || row.decisionStatus === "closed") {
    await db.update(providerIdentityVerificationSessions).set({
      redactedAt: occurredAtIso,
      lastStripeEventId: eventId,
      lastStripeEventCreated: eventCreated,
      updatedAt: new Date().toISOString(),
    }).where(and(
      eq(providerIdentityVerificationSessions.id, row.id),
      lte(providerIdentityVerificationSessions.lastStripeEventCreated, eventCreated),
    ));
    return true;
  }
  await db.update(providerIdentityVerificationSessions).set({
    stripeStatus: "redacted",
    decisionStatus: "closed",
    failureCode: "session_redacted",
    redactedAt: occurredAtIso,
    lastStripeEventId: eventId,
    lastStripeEventCreated: eventCreated,
    updatedAt: new Date().toISOString(),
  }).where(and(
    eq(providerIdentityVerificationSessions.id, row.id),
    eq(providerIdentityVerificationSessions.decisionStatus, "pending"),
    lte(providerIdentityVerificationSessions.lastStripeEventCreated, eventCreated),
  ));
  return true;
}

export async function recordStripeIdentityStatusEvent(
  eventId: string,
  eventCreated: number,
  session: Stripe.Identity.VerificationSession,
) {
  const db = getDb();
  const [row] = await db.select().from(providerIdentityVerificationSessions)
    .where(eq(providerIdentityVerificationSessions.stripeVerificationSessionId, session.id))
    .limit(1);
  if (!row) return false;
  if (["approved", "blocked", "closed"].includes(row.decisionStatus)) return true;
  const occurredAt = eventDate(eventCreated);
  const checkedAt = occurredAt?.toISOString() ?? new Date().toISOString();
  if (
    !occurredAt
    || !stripeIdentitySessionBindingMatches(row, session)
    || !await providerModeMatches(row, session.livemode)
  ) {
    await blockSession(
      row.id,
      eventId,
      eventCreated,
      session.status,
      !occurredAt ? "event_timestamp_invalid" : "binding_or_mode_mismatch",
      checkedAt,
    );
    return true;
  }
  const sessionCanceled = session.status === "canceled";
  await db.update(providerIdentityVerificationSessions).set({
    stripeStatus: session.status,
    decisionStatus: sessionCanceled ? "closed" : "pending",
    failureCode: text(session.last_error?.code, 80)
      || (sessionCanceled ? "session_canceled" : ""),
    lastStripeEventId: eventId,
    lastStripeEventCreated: eventCreated,
    updatedAt: new Date().toISOString(),
  }).where(and(
    eq(providerIdentityVerificationSessions.id, row.id),
    eq(providerIdentityVerificationSessions.decisionStatus, "pending"),
    lte(providerIdentityVerificationSessions.lastStripeEventCreated, eventCreated),
  ));
  return true;
}

export async function recordVerifiedStripeIdentitySession(
  eventId: string,
  eventCreated: number,
  session: Stripe.Identity.VerificationSession,
) {
  const db = getDb();
  const [row] = await db.select().from(providerIdentityVerificationSessions)
    .where(eq(providerIdentityVerificationSessions.stripeVerificationSessionId, session.id))
    .limit(1);
  if (!row) return false;
  if (["approved", "blocked", "closed"].includes(row.decisionStatus)) return true;

  const checkedAt = eventDate(eventCreated);
  const processingNow = new Date();
  const checkedAtIso = checkedAt?.toISOString() ?? processingNow.toISOString();
  const verificationReportId = reportId(session);
  if (!checkedAt) {
    await blockSession(row.id, eventId, eventCreated, session.status,
      "event_timestamp_invalid", checkedAtIso, verificationReportId);
    return true;
  }
  const validityDate = validThroughDate(checkedAt);
  if (validityDate < processingNow.toISOString().slice(0, 10)) {
    await blockSession(row.id, eventId, eventCreated, session.status,
      "verification_event_expired", checkedAtIso, verificationReportId);
    return true;
  }
  if (
    !stripeIdentitySessionBindingMatches(row, session)
    || session.status !== "verified"
    || !await providerModeMatches(row, session.livemode)
  ) {
    await blockSession(row.id, eventId, eventCreated, session.status,
      "binding_status_or_mode_mismatch", checkedAtIso, verificationReportId);
    return true;
  }

  const [[evidence], [profile], [person]] = await Promise.all([
    db.select({
      id: providerApplicationSubmissionEvidence.id,
      normalizedSnapshot: providerApplicationSubmissionEvidence.normalizedSnapshot,
    }).from(providerApplicationSubmissionEvidence).where(eq(
      providerApplicationSubmissionEvidence.providerId,
      row.providerId,
    )).orderBy(
      desc(providerApplicationSubmissionEvidence.createdAt),
      desc(providerApplicationSubmissionEvidence.id),
    ).limit(1),
    db.select().from(providerPathwayProfiles).where(eq(
      providerPathwayProfiles.providerId,
      row.providerId,
    )).orderBy(desc(providerPathwayProfiles.pathwayVersion)).limit(1),
    db.select().from(providerPersonnel).where(and(
      eq(providerPersonnel.providerId, row.providerId),
      eq(providerPersonnel.personId, row.personId),
    )).orderBy(desc(providerPersonnel.rosterVersion)).limit(1),
  ]);
  if (
    !evidence
    || evidence.id !== row.applicationSubmissionEvidenceId
    || row.personNameSourceType !== "application_evidence"
    || row.personNameSourceId !== evidence.id
    || !profile
    || profile.relationshipPath !== "independent_startup"
    || profile.providerPersonId !== row.personId
    || (profile.registrationHolderId && profile.registrationHolderId !== row.providerId)
    || !person
  ) {
    await blockSession(row.id, eventId, eventCreated, session.status,
      "evidence_pathway_or_personnel_binding_invalid", checkedAtIso, verificationReportId);
    return true;
  }

  const performingPersonName = immutablePerformingPersonName(evidence.normalizedSnapshot);
  const outputs = session.verified_outputs;
  if (!performingPersonName || !outputs?.first_name || !outputs.last_name || !outputs.dob) {
    await blockSession(row.id, eventId, eventCreated, session.status,
      "missing_verified_outputs", checkedAtIso, verificationReportId);
    return true;
  }
  if (!verifiedDobIsAdult(outputs.dob, checkedAt)) {
    await blockSession(row.id, eventId, eventCreated, session.status,
      "underage_or_invalid_dob", checkedAtIso, verificationReportId);
    return true;
  }
  if (!verifiedIdentityNameMatches(
    performingPersonName.firstName,
    performingPersonName.lastName,
    outputs.first_name,
    outputs.last_name,
  )) {
    await blockSession(row.id, eventId, eventCreated, session.status,
      "name_mismatch", checkedAtIso, verificationReportId);
    return true;
  }
  if (!await personnelBindingCanBeReplaced(person, row, session.id, checkedAt)) {
    await blockSession(row.id, eventId, eventCreated, session.status,
      "personnel_binding_conflict", checkedAtIso, verificationReportId);
    return true;
  }

  const updatedAt = processingNow.toISOString();
  const sessionClaim = db.update(providerIdentityVerificationSessions).set({
    stripeVerificationReportId: verificationReportId,
    stripeStatus: "verified",
    decisionStatus: "approved",
    failureCode: "",
    checkedAt: checkedAtIso,
    verifiedAt: checkedAtIso,
    lastStripeEventId: eventId,
    lastStripeEventCreated: eventCreated,
    updatedAt,
  }).where(and(
    eq(providerIdentityVerificationSessions.id, row.id),
    eq(providerIdentityVerificationSessions.decisionStatus, "pending"),
    lte(providerIdentityVerificationSessions.lastStripeEventCreated, eventCreated),
  )).returning({ id: providerIdentityVerificationSessions.id });
  try {
    // Migration 0047 turns this one pending -> approved CAS into the entire
    // atomic transition: its AFTER trigger stamps the exact personnel row,
    // binds the independent profile, and checks each affected-row count.
    // Any missing binding raises inside SQLite and rolls back this statement.
    const claimed = await sessionClaim;
    if (claimed.length !== 1) {
      throw new Error("Atomic Stripe Identity approval invariant failed closed.");
    }
  } catch (error) {
    const [current] = await db.select({
      decisionStatus: providerIdentityVerificationSessions.decisionStatus,
    }).from(providerIdentityVerificationSessions).where(eq(
      providerIdentityVerificationSessions.id,
      row.id,
    )).limit(1);
    if (current && ["approved", "blocked", "closed"].includes(current.decisionStatus)) {
      return true;
    }
    throw error;
  }
  return true;
}
