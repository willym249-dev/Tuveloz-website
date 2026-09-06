import { env } from "cloudflare:workers";
import { and, asc, eq, exists, sql } from "drizzle-orm";
import { getDb } from "../db";
import {
  evidenceFileScans,
  providerEvidenceSubmissions,
  providerServiceEligibility,
} from "../db/schema";
import {
  recordAuthenticatedEvidenceScanResult,
  type AuthenticatedEvidenceScanResult,
} from "./evidence-scan-result-recorder";
import { getProviderEvidence } from "./provider-evidence";
import { MAX_EVIDENCE_BYTES } from "./provider-evidence-limits";
import {
  CLOUDMERSIVE_PROVIDER,
  CLOUDMERSIVE_ENGINE_VERSION,
  classifyCloudmersiveAdvancedResult,
  cloudmersiveScannerConfigured,
} from "./cloudmersive-scan-policy";

const CLOUDMERSIVE_ADVANCED_SCAN_URL = "https://api.cloudmersive.com/virus/scan/file/advanced";
const ALLOWED_FILE_TYPES = ".pdf,.jpg,.jpeg,.png,.webp";
const MAX_RESPONSE_BYTES = 128 * 1024;
const SCAN_TIMEOUT_MS = 45_000;
const DEFAULT_BATCH_SIZE = 5;
const RETRY_STATE_KIND = "cloudmersive_retry_v1";
const RETRY_BASE_DELAY_MS = 60_000;
const RETRY_MAX_DELAY_MS = 6 * 60 * 60 * 1000;
const MAX_RETRY_ATTEMPTS = 16;

type PendingScan = {
  scanRequestId: string;
  evidenceId: string;
  providerId: string;
  serviceCode: string;
  jurisdiction: string;
  fileHash: string;
  storageKey: string;
  contentType: string;
  reviewNotes: string;
};

type RetryState = {
  kind: typeof RETRY_STATE_KIND;
  attempts: number;
  nextAttemptAt: string;
  lastFailureCode: string;
};

class RetryableCloudmersiveError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "RetryableCloudmersiveError";
  }
}

function runtimeText(runtime: Record<string, unknown>, key: string) {
  const value = runtime[key];
  return typeof value === "string" ? value.trim() : "";
}

function retryState(value: string): RetryState | null {
  try {
    const parsed = JSON.parse(value) as Partial<RetryState>;
    return parsed.kind === RETRY_STATE_KIND
      && Number.isInteger(parsed.attempts)
      && Number(parsed.attempts) >= 0
      && Number(parsed.attempts) < MAX_RETRY_ATTEMPTS
      && typeof parsed.nextAttemptAt === "string"
      && Number.isFinite(Date.parse(parsed.nextAttemptAt))
      && typeof parsed.lastFailureCode === "string"
      ? parsed as RetryState
      : null;
  } catch {
    return null;
  }
}

function retryFailureCode(error: unknown) {
  if (error instanceof RetryableCloudmersiveError) return error.code;
  if (error instanceof DOMException && error.name === "AbortError") {
    return "transport_timeout";
  }
  return "transport_or_recording_error";
}

function retryDelayMs(attempt: number) {
  return Math.min(
    RETRY_MAX_DELAY_MS,
    RETRY_BASE_DELAY_MS * (2 ** Math.max(0, attempt - 1)),
  );
}

async function sha256Hex(value: ArrayBuffer | string) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function readBoundedStream(
  stream: ReadableStream<Uint8Array>,
  maximumBytes: number,
) {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maximumBytes) {
        await reader.cancel("bounded stream limit exceeded").catch(() => undefined);
        throw new Error("Evidence scanner stream exceeded its allowed size.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const combined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return combined.buffer;
}

async function readBoundedResponse(response: Response) {
  if (!response.body) throw new Error("Cloudmersive returned an empty response body.");
  const bytes = await readBoundedStream(response.body, MAX_RESPONSE_BYTES);
  return new TextDecoder().decode(bytes);
}

function safeFileName(value: string) {
  return value
    .replace(/[^\u0020-\u007e]/g, "_")
    .replace(/[\\/]/g, "-")
    .trim()
    .slice(0, 160) || "provider-evidence";
}

function cloudmersiveHeaders(apiKey: string, fileName: string) {
  return {
    Apikey: apiKey,
    fileName,
    allowExecutables: "false",
    allowInvalidFiles: "false",
    allowScripts: "false",
    allowPasswordProtectedFiles: "false",
    allowMacros: "false",
    allowXmlExternalEntities: "false",
    allowInsecureDeserialization: "false",
    allowHtml: "false",
    allowUnsafeArchives: "false",
    allowOleEmbeddedObject: "false",
    allowUnwantedAction: "false",
    options: "blockOfficeXmlOleEmbeddedFile,blockInvalidUris",
    restrictFileTypes: ALLOWED_FILE_TYPES,
  };
}

async function recordTerminalResult(
  pending: PendingScan,
  status: AuthenticatedEvidenceScanResult["status"],
  resultSeed: string,
  reportReference: string,
) {
  const resultId = `cloudmersive:${await sha256Hex(`${pending.scanRequestId}:${resultSeed}`)}`;
  const recorded = await recordAuthenticatedEvidenceScanResult({
    resultId,
    scanRequestId: pending.scanRequestId,
    evidenceId: pending.evidenceId,
    fileHash: pending.fileHash.toLowerCase(),
    status,
    scanProvider: CLOUDMERSIVE_PROVIDER,
    scanEngineVersion: CLOUDMERSIVE_ENGINE_VERSION,
    reportReference,
    scannedAt: new Date().toISOString(),
  });
  if (recorded.status >= 400) {
    throw new Error(`Unable to record terminal evidence scan result (${recorded.status}).`);
  }
}

async function processOnePendingScan(pending: PendingScan, apiKey: string) {
  const stored = await getProviderEvidence(pending.storageKey);
  if (!stored) {
    await recordTerminalResult(
      pending,
      "error",
      "r2-object-missing",
      "tuveloz-integrity:r2-object-missing",
    );
    return "error" as const;
  }

  let bytes: ArrayBuffer;
  try {
    bytes = await readBoundedStream(stored.body, MAX_EVIDENCE_BYTES);
  } catch (error) {
    if (error instanceof Error && error.message.includes("exceeded its allowed size")) {
      await recordTerminalResult(
        pending,
        "error",
        "r2-object-oversize",
        "tuveloz-integrity:r2-object-oversize",
      );
      return "error" as const;
    }
    throw error;
  }

  const actualHash = await sha256Hex(bytes);
  if (actualHash !== pending.fileHash.toLowerCase()) {
    await recordTerminalResult(
      pending,
      "error",
      `sha256-mismatch:${actualHash}`,
      `tuveloz-integrity:sha256-mismatch:${actualHash}`,
    );
    return "error" as const;
  }

  // Use the randomized storage filename, not the provider-supplied original
  // name, to avoid sending unnecessary personal information to the scanner.
  const scannerFileName = safeFileName(
    pending.storageKey.split("/").at(-1)
      || "provider-evidence",
  );
  const contentType = pending.contentType || stored.httpMetadata?.contentType || "application/octet-stream";
  const formData = new FormData();
  formData.append("inputFile", new File([bytes], scannerFileName, { type: contentType }));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SCAN_TIMEOUT_MS);
  let response: Response;
  let rawResult: string;
  try {
    response = await fetch(CLOUDMERSIVE_ADVANCED_SCAN_URL, {
      method: "POST",
      headers: cloudmersiveHeaders(apiKey, scannerFileName),
      body: formData,
      signal: controller.signal,
    });
    if (!response.ok) {
      // Release the unread error body. Authentication, quota, rate-limit and
      // vendor failures leave the D1 row pending for a later cron retry.
      controller.abort();
      throw new RetryableCloudmersiveError(
        `cloudmersive_http_${response.status}`,
        `Cloudmersive scan returned HTTP ${response.status}.`,
      );
    }
    // Fetch resolves at the headers; keep the deadline through the body read.
    rawResult = await readBoundedResponse(response);
  } finally {
    clearTimeout(timeout);
  }

  let result: unknown;
  try {
    result = JSON.parse(rawResult);
  } catch {
    throw new RetryableCloudmersiveError(
      "cloudmersive_invalid_json",
      "Cloudmersive scan response was not valid JSON.",
    );
  }
  const classification = classifyCloudmersiveAdvancedResult(result);
  if (!classification.terminal) {
    throw new RetryableCloudmersiveError(
      `cloudmersive_ambiguous_${classification.reason}`,
      `Cloudmersive scan response was ambiguous (${classification.reason}).`,
    );
  }

  const responseDigest = await sha256Hex(rawResult);
  const vendorReference = response.headers.get("x-correlation-id")?.trim().slice(0, 200);
  await recordTerminalResult(
    pending,
    classification.status,
    `advanced-response:${responseDigest}`,
    vendorReference
      ? `cloudmersive-correlation:${vendorReference}`
      : `cloudmersive-response-sha256:${responseDigest}`,
  );
  return classification.status;
}

async function rotateRetryOrRecordTerminal(
  pending: PendingScan,
  error: unknown,
) {
  const previousAttempts = retryState(pending.reviewNotes)?.attempts ?? 0;
  const attempt = Math.min(MAX_RETRY_ATTEMPTS, previousAttempts + 1);
  const failureCode = retryFailureCode(error);
  if (attempt >= MAX_RETRY_ATTEMPTS) {
    await recordTerminalResult(
      pending,
      "error",
      `retry-exhausted:${failureCode}:${attempt}`,
      `tuveloz-scanner:retry-exhausted:${failureCode}`,
    );
    return "terminal" as const;
  }
  const attemptedAt = new Date();
  const state: RetryState = {
    kind: RETRY_STATE_KIND,
    attempts: attempt,
    nextAttemptAt: new Date(attemptedAt.getTime() + retryDelayMs(attempt)).toISOString(),
    lastFailureCode: failureCode,
  };
  const db = getDb();
  const pendingClaim = and(
    eq(evidenceFileScans.id, pending.scanRequestId),
    eq(evidenceFileScans.evidenceSubmissionId, pending.evidenceId),
    eq(evidenceFileScans.providerId, pending.providerId),
    eq(evidenceFileScans.fileHash, pending.fileHash),
    eq(evidenceFileScans.status, "pending"),
  );
  const rotated = db.update(evidenceFileScans).set({
    reviewNotes: JSON.stringify(state),
    updatedAt: attemptedAt.toISOString(),
  }).where(pendingClaim);
  const eligibilityScope = and(
    eq(providerServiceEligibility.providerId, pending.providerId),
    eq(providerServiceEligibility.jurisdiction, pending.jurisdiction),
    ...(pending.serviceCode
      ? [eq(providerServiceEligibility.serviceCode, pending.serviceCode)]
      : []),
  );
  const blocked = db.update(providerServiceEligibility).set({
    eligibilityState: "blocked",
    reasonCodes: JSON.stringify(["evidence_malware_scan_pending_retry"]),
    validThrough: "",
    nextExpirationAt: "",
    calculatedAt: attemptedAt.toISOString(),
    updatedAt: attemptedAt.toISOString(),
  }).where(and(
    eligibilityScope,
    exists(db.select({ id: evidenceFileScans.id }).from(evidenceFileScans).where(
      pendingClaim,
    )),
  ));
  // D1 batches are transactional, and the eligibility write is conditional on
  // the exact scan still being pending. A concurrent clean terminal result
  // therefore cannot be overwritten by a stale retry worker.
  await db.batch([rotated, blocked] as const);
  return "rotated" as const;
}

export async function processPendingCloudmersiveEvidenceScans(
  batchSize = DEFAULT_BATCH_SIZE,
) {
  const runtime = env as unknown as Record<string, unknown>;
  if (!cloudmersiveScannerConfigured(runtime)) {
    return {
      configured: false,
      loaded: 0,
      completed: 0,
      retryable: 0,
      terminalErrors: 0,
    };
  }
  const apiKey = runtimeText(runtime, "CLOUDMERSIVE_API_KEY");
  const loadedAt = new Date().toISOString();
  const pending = await getDb().select({
    scanRequestId: evidenceFileScans.id,
    evidenceId: evidenceFileScans.evidenceSubmissionId,
    providerId: evidenceFileScans.providerId,
    serviceCode: providerEvidenceSubmissions.serviceCode,
    jurisdiction: providerEvidenceSubmissions.jurisdiction,
    fileHash: evidenceFileScans.fileHash,
    storageKey: providerEvidenceSubmissions.storageKey,
    contentType: providerEvidenceSubmissions.contentType,
    reviewNotes: evidenceFileScans.reviewNotes,
  }).from(evidenceFileScans)
    .innerJoin(
      providerEvidenceSubmissions,
      and(
        eq(providerEvidenceSubmissions.id, evidenceFileScans.evidenceSubmissionId),
        eq(providerEvidenceSubmissions.providerId, evidenceFileScans.providerId),
      ),
    )
    .where(and(
      eq(evidenceFileScans.status, "pending"),
      sql`(
        ${evidenceFileScans.reviewNotes} = ''
        OR json_valid(${evidenceFileScans.reviewNotes}) = 0
        OR json_extract(${evidenceFileScans.reviewNotes}, '$.kind') <> ${RETRY_STATE_KIND}
        OR json_type(${evidenceFileScans.reviewNotes}, '$.attempts') <> 'integer'
        OR json_extract(${evidenceFileScans.reviewNotes}, '$.attempts') < 0
        OR json_extract(${evidenceFileScans.reviewNotes}, '$.attempts') >= ${MAX_RETRY_ATTEMPTS}
        OR datetime(json_extract(${evidenceFileScans.reviewNotes}, '$.nextAttemptAt')) IS NULL
        OR datetime(json_extract(${evidenceFileScans.reviewNotes}, '$.nextAttemptAt')) <= datetime(${loadedAt})
        OR datetime(json_extract(${evidenceFileScans.reviewNotes}, '$.nextAttemptAt')) > datetime(${loadedAt}, '+6 hours')
      )`,
    ))
    .orderBy(asc(evidenceFileScans.updatedAt), asc(evidenceFileScans.requestedAt))
    .limit(Math.max(1, Math.min(20, Math.trunc(batchSize))));

  let completed = 0;
  let retryable = 0;
  let terminalErrors = 0;
  for (const item of pending) {
    try {
      await processOnePendingScan(item, apiKey);
      completed += 1;
    } catch (error) {
      try {
        const disposition = await rotateRetryOrRecordTerminal(item, error);
        if (disposition === "terminal") {
          completed += 1;
          terminalErrors += 1;
        } else {
          retryable += 1;
        }
      } catch (recordingError) {
        retryable += 1;
        console.error(
          `Evidence scan ${item.scanRequestId} could not record its fail-closed retry state`,
          recordingError,
        );
      }
      console.error(
        `Evidence scan ${item.scanRequestId} did not produce a clean terminal result`,
        error,
      );
    }
  }
  return {
    configured: true,
    loaded: pending.length,
    completed,
    retryable,
    terminalErrors,
  };
}
