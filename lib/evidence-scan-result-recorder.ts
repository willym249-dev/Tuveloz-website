import { and, eq, exists, sql } from "drizzle-orm";
import { getDb } from "../db";
import {
  evidenceFileScans,
  providerApplications,
  providerEvidenceSubmissions,
  providerServiceEligibility,
} from "../db/schema";
import { recordProviderAuditEvent } from "./provider-audit";
import { notifyProviderEvidenceScanBlocked } from "./provider-compliance-notifications";
import { sha256Text } from "./provider-policy-acceptance";
import { expireOpenCheckoutSessionsForLaunchShutdown } from "./stripe-payments";

export type AuthenticatedEvidenceScanResult = {
  resultId: string;
  scanRequestId: string;
  evidenceId: string;
  fileHash: string;
  status: "clean" | "infected" | "failed" | "error";
  scanProvider: string;
  scanEngineVersion: string;
  reportReference: string;
  scannedAt: string;
};

export type EvidenceScanResultRecording = {
  status: number;
  body: Record<string, unknown>;
};

const response = (status: number, body: Record<string, unknown>): EvidenceScanResultRecording => ({
  status,
  body,
});

/**
 * Records a scanner result after its transport has authenticated it. Both the
 * signed callback and TUVELOZ's scheduled scanner use this exact fail-closed
 * state transition so neither path can bypass the pending request/hash bind.
 */
export async function recordAuthenticatedEvidenceScanResult(
  input: AuthenticatedEvidenceScanResult,
): Promise<EvidenceScanResultRecording> {
  const {
    resultId,
    scanRequestId,
    evidenceId,
    fileHash,
    status,
    scanProvider: provider,
    scanEngineVersion: engineVersion,
    reportReference,
    scannedAt,
  } = input;
  const db = getDb();
  const scanId = await sha256Text(`scanner-result:${provider}:${resultId}`);
  const [existingResult] = await db.select({
    id: evidenceFileScans.id,
    evidenceSubmissionId: evidenceFileScans.evidenceSubmissionId,
    providerId: evidenceFileScans.providerId,
    scanProvider: evidenceFileScans.scanProvider,
    status: evidenceFileScans.status,
    fileHash: evidenceFileScans.fileHash,
  })
    .from(evidenceFileScans)
    .where(eq(evidenceFileScans.id, scanId))
    .limit(1);
  if (existingResult) {
    if (
      existingResult.evidenceSubmissionId !== evidenceId
      || existingResult.scanProvider !== provider
      || existingResult.status !== status
      || existingResult.fileHash.toLowerCase() !== fileHash
    ) {
      return response(409, {
        error: "This scanner result ID was already recorded with different result fields.",
      });
    }
    if (existingResult.status !== "clean") {
      const [existingEvidence] = await db.select()
        .from(providerEvidenceSubmissions)
        .where(eq(providerEvidenceSubmissions.id, existingResult.evidenceSubmissionId))
        .limit(1);
      if (
        !existingEvidence
        || existingEvidence.providerId !== existingResult.providerId
        || existingEvidence.documentHash.toLowerCase() !== existingResult.fileHash.toLowerCase()
      ) {
        return response(409, {
          error: "The recorded non-clean result no longer matches its evidence record.",
        });
      }

      // Replays reassert all fail-closed mutations in case a prior delivery
      // stopped after persisting the immutable result.
      await expireOpenCheckoutSessionsForLaunchShutdown();
      const replayedAt = new Date().toISOString();
      await db.update(providerEvidenceSubmissions).set({
        status: "needs_correction",
        reasonCodes: JSON.stringify([`malware_scan_${existingResult.status}`]),
        reviewNotes: "The authenticated scanner's latest result is not clean. This evidence remains blocked.",
        updatedAt: replayedAt,
      }).where(and(
        eq(providerEvidenceSubmissions.id, existingEvidence.id),
        eq(providerEvidenceSubmissions.status, "accepted"),
      ));
      await db.update(providerServiceEligibility).set({
        eligibilityState: "blocked",
        reasonCodes: JSON.stringify(["evidence_malware_scan_not_clean"]),
        validThrough: "",
        nextExpirationAt: "",
        calculatedAt: replayedAt,
        updatedAt: replayedAt,
      }).where(and(
        eq(providerServiceEligibility.providerId, existingEvidence.providerId),
        eq(providerServiceEligibility.serviceCode, existingEvidence.serviceCode),
        eq(providerServiceEligibility.jurisdiction, existingEvidence.jurisdiction),
      ));

      const [existingProvider] = await db.select({ email: providerApplications.email })
        .from(providerApplications)
        .where(eq(providerApplications.id, existingResult.providerId))
        .limit(1);
      if (!existingProvider?.email) {
        return response(409, {
          error: "The provider application for this recorded evidence result was not found.",
        });
      }
      await notifyProviderEvidenceScanBlocked({
        evidenceId: existingResult.evidenceSubmissionId,
        email: existingProvider.email,
        scanStatus: existingResult.status,
        notificationId: existingResult.id,
      });
    }
    return response(200, { ok: true, alreadyRecorded: true });
  }

  const [evidence] = await db.select().from(providerEvidenceSubmissions)
    .where(eq(providerEvidenceSubmissions.id, evidenceId))
    .limit(1);
  if (
    !evidence?.storageKey
    || !evidence.documentHash
    || evidence.documentHash.toLowerCase() !== fileHash
  ) {
    return response(409, {
      error: "The scanner result does not match a current stored evidence file and hash.",
    });
  }
  const [evidenceProvider] = await db.select({ email: providerApplications.email })
    .from(providerApplications)
    .where(eq(providerApplications.id, evidence.providerId))
    .limit(1);
  if (!evidenceProvider?.email) {
    return response(409, {
      error: "The provider application for this evidence was not found.",
    });
  }

  const [pendingScan] = await db.select().from(evidenceFileScans)
    .where(and(
      eq(evidenceFileScans.id, scanRequestId),
      eq(evidenceFileScans.evidenceSubmissionId, evidence.id),
      eq(evidenceFileScans.providerId, evidence.providerId),
      eq(evidenceFileScans.fileHash, evidence.documentHash),
      eq(evidenceFileScans.status, "pending"),
    ))
    .limit(1);
  if (
    !pendingScan
    || !Number.isFinite(Date.parse(pendingScan.requestedAt))
    || Date.parse(scannedAt) < Date.parse(pendingScan.requestedAt) - 300_000
  ) {
    return response(409, {
      error: "The result is not bound to the pending scan request for this exact file.",
    });
  }

  if (status !== "clean") {
    await expireOpenCheckoutSessionsForLaunchShutdown();
  }

  const now = new Date().toISOString();
  const pendingClaim = and(
    eq(evidenceFileScans.id, pendingScan.id),
    eq(evidenceFileScans.evidenceSubmissionId, evidence.id),
    eq(evidenceFileScans.providerId, evidence.providerId),
    eq(evidenceFileScans.fileHash, evidence.documentHash),
    eq(evidenceFileScans.status, "pending"),
  );
  const terminalInsert = db.insert(evidenceFileScans).select(
    db.select({
      id: sql<string>`${scanId}`,
      evidenceSubmissionId: evidenceFileScans.evidenceSubmissionId,
      providerId: evidenceFileScans.providerId,
      scanProvider: sql<string>`${provider}`,
      scanEngineVersion: sql<string>`${engineVersion}`,
      status: sql<string>`${status}`,
      threatName: sql<string>`${status === "infected" ? "See restricted external scan report" : ""}`,
      fileHash: evidenceFileScans.fileHash,
      requestedAt: sql<string>`${now}`,
      completedAt: sql<string>`${new Date(scannedAt).toISOString()}`,
      reviewedBy: sql<string>`${`authenticated_scanner:${provider}`}`,
      reviewNotes: sql<string>`${`External scanner result ${resultId}; restricted report ${reportReference}`}`,
      createdAt: sql<string>`${now}`,
      updatedAt: sql<string>`${now}`,
    }).from(evidenceFileScans).where(pendingClaim).limit(1),
  ).returning({ id: evidenceFileScans.id });
  const pendingUpdate = db.update(evidenceFileScans).set({
    status: "result_received",
    updatedAt: now,
  }).where(and(
    pendingClaim,
    exists(
      db.select({ id: evidenceFileScans.id }).from(evidenceFileScans).where(and(
        eq(evidenceFileScans.id, scanId),
        eq(evidenceFileScans.evidenceSubmissionId, evidence.id),
        eq(evidenceFileScans.providerId, evidence.providerId),
        eq(evidenceFileScans.fileHash, evidence.documentHash),
        eq(evidenceFileScans.scanProvider, provider),
        eq(evidenceFileScans.status, status),
      )),
    ),
  )).returning({ id: evidenceFileScans.id });

  // D1 batches are transactional. Inserting only from the still-pending row,
  // then claiming only when that exact terminal row exists, makes these two
  // writes one concurrency invariant: a crash rolls both back and a losing
  // concurrent recorder returns zero rows from both guarded statements.
  const [inserted, claimed] = await db.batch([terminalInsert, pendingUpdate] as const);
  if (!inserted.length && !claimed.length) {
    return response(409, {
      error: "This pending scan request already received a result. A rescan requires a new request.",
    });
  }
  if (inserted.length !== 1 || claimed.length !== 1) {
    throw new Error("Atomic evidence scan result invariant failed closed.");
  }

  if (status !== "clean") {
    await db.update(providerEvidenceSubmissions).set({
      status: "needs_correction",
      reasonCodes: JSON.stringify([`malware_scan_${status}`]),
      reviewNotes: "The authenticated scanner's latest result is not clean. This evidence remains blocked.",
      updatedAt: now,
    }).where(and(
      eq(providerEvidenceSubmissions.id, evidence.id),
      eq(providerEvidenceSubmissions.status, "accepted"),
    ));
    await db.update(providerServiceEligibility).set({
      eligibilityState: "blocked",
      reasonCodes: JSON.stringify(["evidence_malware_scan_not_clean"]),
      validThrough: "",
      nextExpirationAt: "",
      calculatedAt: now,
      updatedAt: now,
    }).where(and(
      eq(providerServiceEligibility.providerId, evidence.providerId),
      eq(providerServiceEligibility.serviceCode, evidence.serviceCode),
      eq(providerServiceEligibility.jurisdiction, evidence.jurisdiction),
    ));
  }

  await recordProviderAuditEvent({
    providerId: evidence.providerId,
    personId: evidence.personId,
    serviceCode: evidence.serviceCode,
    jurisdiction: evidence.jurisdiction,
    eventType: "authenticated_evidence_scan_result",
    entityType: "provider_evidence_submission",
    entityId: evidence.id,
    actorType: "authenticated_scanner",
    actorId: provider,
    outcome: status,
    reasonCodes: [`malware_scan_${status}`],
    metadata: {
      scanResultId: resultId,
      scanRequestId,
      scanEngineVersion: engineVersion,
      reportReference,
      evidenceAutomaticallyAccepted: false,
    },
  });

  if (status !== "clean") {
    await expireOpenCheckoutSessionsForLaunchShutdown();
    await notifyProviderEvidenceScanBlocked({
      evidenceId: evidence.id,
      email: evidenceProvider.email,
      scanStatus: status,
      notificationId: scanId,
    });
  }
  return response(200, {
    ok: true,
    status,
    message: status === "clean"
      ? "Authenticated clean result recorded. Evidence still requires a separate owner review."
      : "Authenticated non-clean result recorded. The evidence and dependent service records remain blocked.",
  });
}
