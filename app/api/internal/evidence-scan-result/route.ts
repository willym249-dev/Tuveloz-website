import { env } from "cloudflare:workers";
import {
  recordAuthenticatedEvidenceScanResult,
  type AuthenticatedEvidenceScanResult,
} from "../../../../lib/evidence-scan-result-recorder";

const NO_STORE = { "cache-control": "no-store" };
const MAX_BODY_CHARACTERS = 20_000;
const MAX_CLOCK_SKEW_SECONDS = 300;
const MAX_SCAN_RESULT_AGE_MS = 60 * 60 * 1000;
const RESULT_STATUSES = new Set<AuthenticatedEvidenceScanResult["status"]>([
  "clean",
  "infected",
  "failed",
  "error",
]);

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
      && provider !== "clamav"
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
    return Response.json(
      { error: "Scanner result must be valid JSON." },
      { status: 400, headers: NO_STORE },
    );
  }

  const resultId = clean(body.resultId, 200);
  const scanRequestId = clean(body.scanRequestId, 200);
  const evidenceId = clean(body.evidenceId, 120);
  const fileHash = clean(body.fileHash, 64).toLowerCase();
  const status = clean(body.status, 32) as AuthenticatedEvidenceScanResult["status"];
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

  const recorded = await recordAuthenticatedEvidenceScanResult({
    resultId,
    scanRequestId,
    evidenceId,
    fileHash,
    status,
    scanProvider: provider,
    scanEngineVersion: engineVersion,
    reportReference,
    scannedAt,
  });
  return Response.json(recorded.body, { status: recorded.status, headers: NO_STORE });
}
