import { MAX_EVIDENCE_BYTES } from "./provider-evidence-limits.ts";

export const SELF_HOSTED_SCAN_PROVIDER = "clamav";
export const DOCUMENT_SCAN_POLICY = "tuveloz-static-documents-v1";
export const SELF_HOSTED_SCAN_PATH = "/api/internal/self-hosted-scans";
export const MESSAGE_SCAN_MAX_BYTES = 8 * 1024 * 1024;
export const SCAN_LEASE_MS = 10 * 60 * 1000;
export function selfHostedScannerConfigured(runtime: Record<string, unknown>) {
  return runtime.EVIDENCE_SCAN_PROVIDER === SELF_HOSTED_SCAN_PROVIDER
    && typeof runtime.SELF_HOSTED_SCAN_SECRET === "string" && runtime.SELF_HOSTED_SCAN_SECRET.length >= 32;
}
const HEADERS = { "cache-control": "no-store", "x-content-type-options": "nosniff" };
const SHA256 = /^[a-f0-9]{64}$/;
const TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

// Narrow interfaces allow the same protocol to be exercised against real local
// SQLite and an isolated object store, without granting the scanner DB access.
export interface ScanStatement {
  bind(...values: (string | number)[]): ScanStatement;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}
export interface ScanDatabase {
  prepare(sql: string): ScanStatement;
  batch(statements: ScanStatement[]): Promise<unknown[]>;
}
export interface ScanBucket {
  get(key: string): Promise<{ size: number; arrayBuffer(): Promise<ArrayBuffer> } | null>;
}
type Candidate = {
  kind: "evidence" | "message"; target_id: string; evidence_id: string; provider_id: string;
  storage_key: string; content_type: string; file_hash: string; queued_at: string;
};
type Job = Candidate & {
  id: string; job_key: string; byte_size: number; lease_until: string; created_at: string;
  result_status: string; result_digest: string;
};
export type ScanReceipt = {
  status: "clean" | "infected" | "failed" | "error"; fileHash: string;
  policyVersion: string; policyPassed: boolean; antivirusPassed: boolean;
  scannedAt: string; engineVersion: string; signatureDate: string; reason: string; reportHash: string;
};
type Context = {
  provider: string; secret: string; db: ScanDatabase; bucket: ScanBucket;
  recordEvidence(input: {
    resultId: string; scanRequestId: string; evidenceId: string; fileHash: string;
    status: ScanReceipt["status"]; scanProvider: string; scanEngineVersion: string;
    reportReference: string; scannedAt: string;
  }): Promise<{ status: number; body: Record<string, unknown> }>;
  now?: () => Date;
};

export const SCAN_CANDIDATES_SQL = `
  SELECT * FROM (
    SELECT 'evidence' AS kind, s.id AS target_id, p.id AS evidence_id,
      p.provider_id, p.storage_key, p.content_type, p.document_hash AS file_hash,
      s.requested_at AS queued_at
    FROM evidence_file_scans s JOIN provider_evidence_submissions p
      ON p.id = s.evidence_submission_id AND p.provider_id = s.provider_id
    WHERE s.status = 'pending' AND p.storage_key <> ''
      AND p.document_hash = s.file_hash
    UNION ALL
    SELECT 'message' AS kind, id AS target_id, '' AS evidence_id, '' AS provider_id,
      image_key AS storage_key, image_type AS content_type, '' AS file_hash, created_at AS queued_at
    FROM job_messages WHERE scan_status = 'pending' AND image_key <> ''
  ) candidate
  WHERE NOT EXISTS (SELECT 1 FROM self_hosted_scan_jobs j
    WHERE j.job_key = candidate.kind || ':' || candidate.target_id
      AND (j.result_status <> '' OR j.lease_until > ?))
  ORDER BY queued_at, kind, target_id LIMIT 5`;

const CLAIM_SQL = `INSERT INTO self_hosted_scan_jobs
  (job_key, id, kind, target_id, evidence_id, provider_id, storage_key, content_type,
   file_hash, byte_size, lease_until, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
  ON CONFLICT(job_key) DO UPDATE SET id=excluded.id, storage_key=excluded.storage_key,
    content_type=excluded.content_type, file_hash=excluded.file_hash, byte_size=0,
    lease_until=excluded.lease_until, created_at=excluded.created_at, last_error=''
  WHERE self_hosted_scan_jobs.result_status = '' AND self_hosted_scan_jobs.lease_until <= ?
  RETURNING *`;

const response = (body: unknown, status = 200) => Response.json(body, { status, headers: HEADERS });
const text = (value: unknown) => typeof value === "string" ? value : "";
export const scanMaximumBytes = (kind: string) => kind === "evidence" ? MAX_EVIDENCE_BYTES : MESSAGE_SCAN_MAX_BYTES;

export async function scanHash(bytes: BufferSource) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)))
    .map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
export async function signScanRequest(secret: string, timestamp: string, body: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key,
    new TextEncoder().encode(`v1.POST.${SELF_HOSTED_SCAN_PATH}.${timestamp}.${body}`));
  return Array.from(new Uint8Array(signature)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
function equalSignature(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index++) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}
async function boundedBody(request: Request) {
  if (!request.body) throw new Error("missing_body");
  const reader = request.body.getReader();
  let length = 0;
  let timedOut = false;
  const chunks: Uint8Array[] = [];
  const deadline = setTimeout(() => { timedOut = true; void reader.cancel("request deadline"); }, 10_000);
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 12_000) { await reader.cancel(); throw new Error("body_too_large"); }
      chunks.push(value);
    }
  } finally { clearTimeout(deadline); reader.releaseLock(); }
  if (timedOut) throw new Error("body_timeout");
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

async function currentTarget(context: Context, job: Job) {
  if (job.kind === "evidence") {
    return context.db.prepare(`SELECT s.id FROM evidence_file_scans s
      JOIN provider_evidence_submissions p ON p.id=s.evidence_submission_id AND p.provider_id=s.provider_id
      WHERE s.id=? AND s.status='pending' AND p.id=? AND p.storage_key=?
        AND p.content_type=? AND p.document_hash=? AND s.file_hash=?`).bind(
      job.target_id, job.evidence_id, job.storage_key, job.content_type, job.file_hash, job.file_hash,
    ).first();
  }
  return context.db.prepare(`SELECT id FROM job_messages WHERE id=? AND scan_status='pending'
    AND image_key=? AND image_type=?`).bind(job.target_id, job.storage_key, job.content_type).first();
}
async function objectBytes(context: Context, job: Job) {
  if (!TYPES.has(job.content_type) || (job.kind === "message" && job.content_type === "application/pdf")) {
    throw new Error("unsupported_type");
  }
  const object = await context.bucket.get(job.storage_key);
  const maximum = scanMaximumBytes(job.kind);
  if (!object || !Number.isSafeInteger(object.size) || object.size <= 0 || object.size > maximum) {
    throw new Error("object_unavailable_or_oversized");
  }
  const bytes = await object.arrayBuffer();
  if (bytes.byteLength !== object.size || bytes.byteLength > maximum) throw new Error("object_size_changed");
  const digest = await scanHash(bytes);
  if (job.file_hash && digest !== job.file_hash) throw new Error("object_hash_changed");
  if (job.byte_size && bytes.byteLength !== job.byte_size) throw new Error("object_size_changed");
  return { bytes, digest };
}

export async function validateScanReceipt(value: unknown, job: { file_hash: string; created_at: string }, now: Date) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const r = value as ScanReceipt;
  if (!["clean", "infected", "failed", "error"].includes(r.status)
      || r.fileHash !== job.file_hash || !SHA256.test(text(r.fileHash))
      || r.policyVersion !== DOCUMENT_SCAN_POLICY || typeof r.policyPassed !== "boolean"
      || typeof r.antivirusPassed !== "boolean" || !SHA256.test(text(r.reportHash))
      || typeof r.engineVersion !== "string" || r.engineVersion.length > 160
      || typeof r.signatureDate !== "string" || r.signatureDate.length > 40
      || !/^[a-z0-9_]{1,64}$/.test(text(r.reason))) return null;
  const scanned = Date.parse(text(r.scannedAt));
  const created = Date.parse(job.created_at);
  if (!Number.isFinite(scanned) || !Number.isFinite(created) || !Number.isFinite(now.getTime()) || scanned < created - 300_000
      || scanned > now.getTime() + 300_000 || scanned < now.getTime() - SCAN_LEASE_MS) return null;
  if (r.status !== "error") {
    const signatures = Date.parse(text(r.signatureDate));
    if (!/^ClamAV 1\.5\.4\/\d+$/.test(text(r.engineVersion)) || !Number.isFinite(signatures)
        || signatures > now.getTime() + 300_000 || signatures < now.getTime() - 72 * 3600_000) return null;
  }
  if (r.status === "clean" && (r.policyPassed !== true || r.antivirusPassed !== true || r.reason !== "checks_passed")) return null;
  if (r.status !== "clean" && r.policyPassed !== false) return null;
  if (r.status === "failed" && r.antivirusPassed !== true && r.reason !== "document_cannot_be_inspected") return null;
  const fields = { antivirusPassed: r.antivirusPassed, engineVersion: r.engineVersion,
    fileHash: r.fileHash, policyPassed: r.policyPassed, policyVersion: r.policyVersion,
    reason: r.reason, scannedAt: r.scannedAt, signatureDate: r.signatureDate, status: r.status };
  if (await scanHash(new TextEncoder().encode(JSON.stringify(fields))) !== r.reportHash) return null;
  return { ...fields, reportHash: r.reportHash } as ScanReceipt;
}

export async function validateSelfHostedScanProof(job: {
  id: string; kind: string; targetId: string; evidenceId: string; providerId: string;
  fileHash: string; resultStatus: string; resultDigest: string; reportJson: string; createdAt: string;
} | undefined, proof: {
  resultId: string; requestId: string; evidenceId: string; providerId: string; fileHash: string;
  status: string; engineVersion: string; reportReference: string; completedAt: string;
}) {
  if (!job || proof.resultId !== `self-hosted:${job.id}` || job.kind !== "evidence"
      || job.targetId !== proof.requestId || job.evidenceId !== proof.evidenceId
      || job.providerId !== proof.providerId || job.fileHash !== proof.fileHash
      || job.resultStatus !== proof.status || proof.status === "error"
      || proof.reportReference !== `self-hosted:${job.id}:${job.resultDigest}`) return false;
  try {
    const receipt = await validateScanReceipt(JSON.parse(job.reportJson), {
      file_hash: job.fileHash, created_at: job.createdAt,
    }, new Date(proof.completedAt));
    return Boolean(receipt && receipt.reportHash === job.resultDigest && receipt.status === proof.status
      && Date.parse(receipt.scannedAt) === Date.parse(proof.completedAt)
      && proof.engineVersion === `${receipt.engineVersion};${DOCUMENT_SCAN_POLICY}`);
  } catch { return false; }
}

export function selfHostedScanHandler(context: Context) {
  return async (request: Request): Promise<Response> => {
    if (context.provider !== SELF_HOSTED_SCAN_PROVIDER || context.secret.length < 32) {
      return response({ error: "Self-hosted scanning is not enabled." }, 503);
    }
    if (request.method !== "POST" || new URL(request.url).pathname !== SELF_HOSTED_SCAN_PATH) return response({ error: "Invalid request." }, 405);
    const now = (context.now ?? (() => new Date()))();
    const timestamp = request.headers.get("x-tuveloz-scan-timestamp") ?? "";
    const signature = request.headers.get("x-tuveloz-scan-signature") ?? "";
    if (!/^\d{10}$/.test(timestamp) || !SHA256.test(signature)
        || Math.abs(now.getTime() / 1000 - Number(timestamp)) > 180) return response({ error: "Scanner authentication required." }, 401);
    let raw: string;
    try { raw = await boundedBody(request); } catch { return response({ error: "Invalid scanner request body." }, 413); }
    if (!equalSignature(signature, await signScanRequest(context.secret, timestamp, raw))) return response({ error: "Scanner authentication failed." }, 401);
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(raw);
      if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    } catch { return response({ error: "Invalid scanner JSON." }, 400); }
    try {
      if (body.action === "claim") {
        const candidates = await context.db.prepare(SCAN_CANDIDATES_SQL).bind(now.toISOString()).all<Candidate>();
        for (const candidate of candidates.results) {
          const id = crypto.randomUUID();
          const until = new Date(now.getTime() + SCAN_LEASE_MS).toISOString();
          const job = await context.db.prepare(CLAIM_SQL).bind(
            `${candidate.kind}:${candidate.target_id}`, id, candidate.kind, candidate.target_id,
            candidate.evidence_id, candidate.provider_id, candidate.storage_key, candidate.content_type,
            candidate.file_hash, until, now.toISOString(), now.toISOString(),
          ).first<Job>();
          if (!job) continue;
          try {
            const { bytes, digest } = await objectBytes(context, job);
            await context.db.prepare(`UPDATE self_hosted_scan_jobs SET file_hash=?, byte_size=? WHERE id=? AND result_status=''`)
              .bind(digest, bytes.byteLength, id).run();
            return response({ job: { id, kind: job.kind, contentType: job.content_type, fileHash: digest,
              byteSize: bytes.byteLength, leaseUntil: until, policyVersion: DOCUMENT_SCAN_POLICY } });
          } catch {
            await context.db.prepare("UPDATE self_hosted_scan_jobs SET last_error='file_integrity' WHERE id=?").bind(id).run();
          }
        }
        return response({ job: null });
      }
      if (!["file", "result"].includes(text(body.action)) || !/^[a-f0-9-]{36}$/.test(text(body.id))) return response({ error: "Invalid scanner action." }, 400);
      const job = await context.db.prepare("SELECT * FROM self_hosted_scan_jobs WHERE id=?").bind(text(body.id)).first<Job>();
      if (!job) return response({ error: "Scan lease not found." }, 404);
      // A delivered result can be retried after the lease expires, but only an
      // identical receipt is acknowledged. It cannot create a new transition.
      if (body.action === "result" && job.result_status) {
        const receipt = body.receipt as ScanReceipt | undefined;
        if (receipt && receipt.reportHash === job.result_digest
            && await validateScanReceipt(receipt, job, new Date(receipt.scannedAt))) return response({ accepted: true, duplicate: true });
        return response({ error: "This lease already has a different result." }, 409);
      }
      if (job.result_status || Date.parse(job.lease_until) <= now.getTime() || job.byte_size <= 0) return response({ error: "Scan lease is not active." }, 409);
      // Evidence results use the existing idempotent recorder even if a prior
      // delivery committed its result but lost the lease acknowledgement.
      if (!await currentTarget(context, job) && (body.action === "file" || job.kind === "message")) return response({ error: "The pending file changed." }, 409);
      const { bytes } = await objectBytes(context, job);
      if (body.action === "file") return new Response(bytes, { headers: { ...HEADERS,
        "content-type": "application/octet-stream", "content-length": String(bytes.byteLength) } });
      const receipt = await validateScanReceipt(body.receipt, job, now);
      if (!receipt) return response({ error: "Incomplete or mismatched scanner result." }, 400);
      if (receipt.status === "error") {
        await context.db.prepare(`UPDATE self_hosted_scan_jobs SET lease_until=?, last_error='scanner_unavailable'
          WHERE id=? AND result_status=''`).bind(new Date(now.getTime() + SCAN_LEASE_MS).toISOString(), job.id).run();
        return response({ accepted: true, retry: true });
      }
      if (job.kind === "evidence") {
        const recorded = await context.recordEvidence({ resultId: `self-hosted:${job.id}`,
          scanRequestId: job.target_id, evidenceId: job.evidence_id, fileHash: job.file_hash,
          status: receipt.status, scanProvider: SELF_HOSTED_SCAN_PROVIDER,
          scanEngineVersion: `${receipt.engineVersion};${DOCUMENT_SCAN_POLICY}`,
          reportReference: `self-hosted:${job.id}:${receipt.reportHash}`, scannedAt: receipt.scannedAt });
        if (recorded.status !== 200) return response(recorded.body, recorded.status);
        await context.db.prepare(`UPDATE self_hosted_scan_jobs SET result_status=?, result_digest=?, report_json=?
          WHERE id=? AND (result_digest='' OR result_digest=?)`).bind(receipt.status, receipt.reportHash,
          JSON.stringify(receipt), job.id, receipt.reportHash).run();
      } else {
        const state = receipt.status === "clean" ? "clean" : "blocked";
        await context.db.batch([
          context.db.prepare(`UPDATE job_messages SET scan_status=?, scan_attempted_at=?, scan_attempt_count=scan_attempt_count+1
            WHERE id=? AND image_key=? AND scan_status='pending'
              AND EXISTS(SELECT 1 FROM self_hosted_scan_jobs WHERE id=? AND result_status='' AND lease_until>?)`)
            .bind(state, now.toISOString(), job.target_id, job.storage_key, job.id, now.toISOString()),
          context.db.prepare(`UPDATE self_hosted_scan_jobs SET result_status=?, result_digest=?, report_json=?
            WHERE id=? AND result_status='' AND EXISTS(SELECT 1 FROM job_messages WHERE id=? AND image_key=? AND scan_status=?)`)
            .bind(receipt.status, receipt.reportHash, JSON.stringify(receipt), job.id, job.target_id, job.storage_key, state),
        ]);
      }
      const final = await context.db.prepare("SELECT result_digest FROM self_hosted_scan_jobs WHERE id=?").bind(job.id).first<{ result_digest: string }>();
      return final?.result_digest === receipt.reportHash ? response({ accepted: true }) : response({ error: "Scan state changed." }, 409);
    } catch {
      // Do not return object keys, provider details, credentials or parser errors.
      return response({ error: "Scanning is temporarily unavailable. Files remain quarantined." }, 503);
    }
  };
}
