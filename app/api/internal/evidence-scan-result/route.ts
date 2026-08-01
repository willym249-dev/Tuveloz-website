import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import {
  evidenceFileScans,
  providerApplications,
  providerEvidenceSubmissions,
  providerServiceEligibility,
} from "../../../../db/schema";
import { recordProviderAuditEvent } from "../../../../lib/provider-audit";
import { notifyProviderEvidenceScanBlocked } from "../../../../lib/provider-compliance-notifications";
import { sha256Text } from "../../../../lib/provider-policy-acceptance";
import { expireOpenCheckoutSessionsForLaunchShutdown } from "../../../../lib/stripe-payments";

const NO_STORE = { "cache-control": "no-store" };
const MAX_BODY_CHARACTERS = 20_000;
const MAX_CLOCK_SKEW_SECONDS = 300;
const MAX_SCAN_RESULT_AGE_MS = 60 * 60 * 1000;
const RESULT_STATUSES = new Set(["clean", "infected", "failed", "error"]);

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function runtimeText(key: string) {
  const runtime = env as unknown as Record<string, unknown>;
  return clean(runtime[key], 1000);
}

function scannerConfiguration() {
  const provider = runtimeText("EVIDENCE_SCAN_PROVIDER");
  const secret = runtimeText("EVIDENCE_SCAN_WEBHOOK_SECRET");
  return {
    provider,
    secret,
    configured: Boolean(
      provider
      && provider !== "unconfigured"
      && secret.length >= 32,
    ),
  };
}

async function hmacHex(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

function validIsoDateTime(value: string) {
  if (!value || !Number.isFinite(Date.parse(value))) return false;
  const parsed = Date.parse(value);
  return parsed <= Date.now() + MAX_CLOCK_SKEW_SECONDS * 1000
    && parsed >= Date.now() - MAX_SCAN_RESULT_AGE_MS;
}

export async function POST(request: Request) {
  const scanner = scannerConfiguration();
  if (!scanner.configured) {
    return Response.json(
      { error: "The authenticated evidence-scanner callback is not configured." },
      { status: 503, headers: NO_STORE },
    );
  }

  const timestampHeader = clean(request.headers.get("x-tuveloz-scan-timestamp"), 20);
  const signature = clean(request.headers.get("x-tuveloz-scan-signature"), 128).toLowerCase();
  const timestamp = Number(timestampHeader);
  if (
    !Number.isInteger(timestamp)
    || Math.abs(Math.floor(Date.now() / 1000) - timestamp) > MAX_CLOCK_SKEW_SECONDS
    || !/^[a-f0-9]{64}$/.test(signature)
  ) {
    return Response.json(
      { error: "A current signed scanner result is required." },
      { status: 401, headers: NO_STORE },
    );
  }

  const rawBody = await request.text();
  if (!rawBody || rawBody.length > MAX_BODY_CHARACTERS) {
    return Response.json(
      { error: "Scanner result body is missing or too large." },
      { status: rawBody ? 413 : 400, headers: NO_STORE },
    );
  }
  const expectedSignature = await hmacHex(
    scanner.secret,
    `${timestampHeader}.${rawBody}`,
  );
  if (!constantTimeEqual(expectedSignature, signature)) {
    return Response.json(
      { error: "Scanner signature verification failed." },
      { status: 401, headers: NO_STORE },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Scanner result must be valid JSON." }, { status: 400, headers: NO_STORE });
  }

  const resultId = clean(body.resultId, 200);
  const scanRequestId = clean(body.scanRequestId, 200);
  const evidenceId = clean(body.evidenceId, 120);
  const fileHash = clean(body.fileHash, 64).toLowerCase();
  const status = clean(body.status, 32);
  const provider = clean(body.scanProvider, 160);
  const engineVersion = clean(body.scanEngineVersion, 160);
  const reportReference = clean(body.reportReference, 1000);
  const scannedAt = clean(body.scannedAt, 80);
  if (
    !/^[A-Za-z0-9._:-]{8,200}$/.test(resultId)
    || !scanRequestId
    || !evidenceId
    || !/^[a-f0-9]{64}$/.test(fileHash)
    || !RESULT_STATUSES.has(status)
    || provider !== scanner.provider
    || engineVersion.length < 2
    || reportReference.length < 8
    || !validIsoDateTime(scannedAt)
  ) {
    return Response.json(
      { error: "Scanner result fields are incomplete or do not match the configured scanner." },
      { status: 400, headers: NO_STORE },
    );
  }

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
      return Response.json(
        { error: "This scanner result ID was already recorded with different result fields." },
        { status: 409, headers: NO_STORE },
      );
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
        return Response.json(
          { error: "The recorded non-clean result no longer matches its evidence record." },
          { status: 409, headers: NO_STORE },
        );
      }

      // A prior attempt may have persisted the result immediately before a
      // later block or notification write failed. Reassert every fail-closed
      // mutation on replay before acknowledging the signed result.
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

      const [existingProvider] = await db.select({
        email: providerApplications.email,
      }).from(providerApplications)
        .where(eq(providerApplications.id, existingResult.providerId))
        .limit(1);
      if (!existingProvider?.email) {
        return Response.json(
          { error: "The provider application for this recorded evidence result was not found." },
          { status: 409, headers: NO_STORE },
        );
      }
      await notifyProviderEvidenceScanBlocked({
        evidenceId: existingResult.evidenceSubmissionId,
        email: existingProvider.email,
        scanStatus: existingResult.status,
        notificationId: existingResult.id,
      });
    }
    return Response.json(
      { ok: true, alreadyRecorded: true },
      { headers: NO_STORE },
    );
  }

  const [evidence] = await db.select().from(providerEvidenceSubmissions)
    .where(eq(providerEvidenceSubmissions.id, evidenceId))
    .limit(1);
  if (
    !evidence?.storageKey
    || !evidence.documentHash
    || evidence.documentHash.toLowerCase() !== fileHash
  ) {
    return Response.json(
      { error: "The scanner result does not match a current stored evidence file and hash." },
      { status: 409, headers: NO_STORE },
    );
  }
  const [evidenceProvider] = await db.select({
    email: providerApplications.email,
  }).from(providerApplications)
    .where(eq(providerApplications.id, evidence.providerId))
    .limit(1);
  if (!evidenceProvider?.email) {
    return Response.json(
      { error: "The provider application for this evidence was not found." },
      { status: 409, headers: NO_STORE },
    );
  }

  const [pendingScan] = await db.select().from(evidenceFileScans)
    .where(and(
      eq(evidenceFileScans.id, scanRequestId),
      eq(evidenceFileScans.evidenceSubmissionId, evidence.id),
      eq(evidenceFileScans.fileHash, evidence.documentHash),
      eq(evidenceFileScans.status, "pending"),
    ))
    .limit(1);
  if (
    !pendingScan
    || Date.parse(scannedAt) < Date.parse(pendingScan.requestedAt) - MAX_CLOCK_SKEW_SECONDS * 1000
  ) {
    return Response.json(
      { error: "The result is not bound to the pending scan request for this exact file." },
      { status: 409, headers: NO_STORE },
    );
  }

  if (status !== "clean") {
    // A non-clean result makes this exact evidence unusable. Quarantine all
    // locally open Checkout Sessions before persisting that revocation. The
    // helper records the quarantine before its best-effort Stripe call, and a
    // database failure here leaves the pending scan claim retryable.
    await expireOpenCheckoutSessionsForLaunchShutdown();
  }

  const now = new Date().toISOString();
  const claimed = await db.update(evidenceFileScans).set({
    status: "result_received",
    updatedAt: now,
  }).where(and(
    eq(evidenceFileScans.id, pendingScan.id),
    eq(evidenceFileScans.status, "pending"),
  )).returning({ id: evidenceFileScans.id });
  if (!claimed.length) {
    return Response.json(
      { error: "This pending scan request already received a result. A rescan requires a new request." },
      { status: 409, headers: NO_STORE },
    );
  }
  await db.insert(evidenceFileScans).values({
    id: scanId,
    evidenceSubmissionId: evidence.id,
    providerId: evidence.providerId,
    scanProvider: provider,
    scanEngineVersion: engineVersion,
    status,
    threatName: status === "infected" ? "See restricted external scan report" : "",
    fileHash,
    requestedAt: now,
    completedAt: new Date(scannedAt).toISOString(),
    reviewedBy: `authenticated_scanner:${provider}`,
    reviewNotes: `External scanner result ${resultId}; restricted report ${reportReference}`,
    createdAt: now,
    updatedAt: now,
  });

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
  return Response.json({
    ok: true,
    status,
    message: status === "clean"
      ? "Authenticated clean result recorded. Evidence still requires a separate owner review."
      : "Authenticated non-clean result recorded. The evidence and dependent service records remain blocked.",
  }, { headers: NO_STORE });
}
