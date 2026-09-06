import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { MAX_EVIDENCE_BYTES } from "../lib/provider-evidence-limits.ts";
import { selfHostedScanHandler, signScanRequest, scanHash, validateSelfHostedScanProof, DOCUMENT_SCAN_POLICY, SELF_HOSTED_SCAN_PATH } from "../lib/self-hosted-scan-protocol.ts";
const migration = await readFile(new URL("../drizzle/0066_self_hosted_scan_jobs.sql", import.meta.url), "utf8");
const SECRET = "synthetic-scanner-secret-".repeat(3);
const bytes = value => new TextEncoder().encode(value).buffer;

async function fixture({ kind = "evidence", content = bytes("synthetic document"), provider = "clamav" } = {}) {
  const raw = new DatabaseSync(":memory:");
  raw.exec(`CREATE TABLE evidence_file_scans(id TEXT PRIMARY KEY, evidence_submission_id TEXT, provider_id TEXT, status TEXT, file_hash TEXT, requested_at TEXT);
    CREATE TABLE provider_evidence_submissions(id TEXT PRIMARY KEY, provider_id TEXT, storage_key TEXT, content_type TEXT, document_hash TEXT, status TEXT DEFAULT 'pending');
    CREATE TABLE job_messages(id TEXT PRIMARY KEY, image_key TEXT, image_type TEXT, scan_status TEXT, created_at TEXT, scan_attempted_at TEXT DEFAULT '', scan_attempt_count INTEGER DEFAULT 0);`);
  raw.exec(migration);
  let now = new Date("2026-09-06T12:00:00.000Z");
  const hash = await scanHash(content);
  const objects = new Map([["private/test-file", content]]);
  const readKeys = [];
  const recorded = [];
  if (kind === "evidence") {
    raw.prepare("INSERT INTO provider_evidence_submissions(id,provider_id,storage_key,content_type,document_hash) VALUES('evidence-one','provider-one','private/test-file','application/pdf',?)").run(hash);
    raw.prepare("INSERT INTO evidence_file_scans VALUES('scan-one','evidence-one','provider-one','pending',?,?)").run(hash, now.toISOString());
  } else {
    raw.prepare("INSERT INTO job_messages(id,image_key,image_type,scan_status,created_at) VALUES('message-one','private/test-file','image/png','pending',?)").run(now.toISOString());
  }
  const db = {
    prepare(sql) {
      const statement = raw.prepare(sql);
      let parameters = [];
      return {
        bind(...values) { parameters = values; return this; },
        async first() { return statement.get(...parameters) ?? null; },
        async all() { return { results: statement.all(...parameters) }; },
        async run() { return statement.run(...parameters); },
      };
    },
    async batch(statements) {
      raw.exec("BEGIN");
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        raw.exec("COMMIT");
        return results;
      } catch (error) { raw.exec("ROLLBACK"); throw error; }
    },
  };
  const handler = selfHostedScanHandler({ provider, secret: SECRET, db, now: () => now,
    bucket: { async get(key) {
      const data = objects.get(key);
      return data ? { size: data.byteLength, async arrayBuffer() { readKeys.push(key); return data; } } : null;
    } },
    async recordEvidence(input) {
      const previous = recorded.find(result => result.resultId === input.resultId);
      if (previous) return { status: previous.status === input.status ? 200 : 409, body: { recorded: true } };
      const changed = raw.prepare("UPDATE evidence_file_scans SET status='result_received' WHERE id=? AND file_hash=? AND status='pending'")
        .run(input.scanRequestId, input.fileHash).changes;
      if (!changed) return { status: 409, body: { error: "not_pending" } };
      recorded.push(input);
      return { status: 200, body: { recorded: true } };
    },
  });
  async function request(body, options = {}) {
    const serialized = JSON.stringify(body);
    const timestamp = String(Math.floor(now.getTime() / 1000) + (options.clockOffset ?? 0));
    const signature = await signScanRequest(options.secret ?? SECRET, timestamp, serialized);
    return handler(new Request(`https://tuveloz.test${SELF_HOSTED_SCAN_PATH}`, {
      method: "POST", headers: { "x-tuveloz-scan-timestamp": timestamp, "x-tuveloz-scan-signature": signature },
      body: options.raw ?? serialized,
    }));
  }
  async function claim() { return (await (await request({ action: "claim" })).json()).job; }
  async function receipt(job, changes = {}) {
    const value = { antivirusPassed: true, engineVersion: "ClamAV 1.5.4/28114", fileHash: job.fileHash,
      policyPassed: true, policyVersion: DOCUMENT_SCAN_POLICY, reason: "checks_passed",
      scannedAt: now.toISOString(), signatureDate: now.toISOString(), status: "clean", ...changes };
    const canonical = Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)));
    return { ...value, reportHash: await scanHash(bytes(JSON.stringify(canonical))) };
  }
  return { raw, objects, readKeys, recorded, request, claim, receipt, advance(ms) { now = new Date(now.getTime() + ms); } };
}

test("self-hosted scanner is dormant by default and rejects bad authentication before file access", async () => {
  const off = await fixture({ provider: "unconfigured" });
  assert.equal((await off.request({ action: "claim" })).status, 503);
  assert.equal(off.readKeys.length, 0);
  const f = await fixture();
  for (const options of [{ secret: "wrong" }, { clockOffset: -181 }, { raw: '{"action":"claim","extra":true}' }]) {
    assert.equal((await f.request({ action: "claim" }, options)).status, 401);
  }
  assert.equal(f.readKeys.length, 0);
});

test("claimed files are private, bounded and hash-bound without exposing storage or provider identifiers", async () => {
  const f = await fixture();
  const job = await f.claim();
  assert.deepEqual(Object.keys(job).sort(), ["byteSize", "contentType", "fileHash", "id", "kind", "leaseUntil", "policyVersion"]);
  const file = await f.request({ action: "file", id: job.id });
  assert.equal(file.status, 200);
  assert.equal(file.headers.get("cache-control"), "no-store");
  assert.equal(await scanHash(await file.arrayBuffer()), job.fileHash);
  assert.equal(await f.claim(), null);
});

test("concurrent claims cannot lease the same file twice", async () => {
  const f = await fixture();
  const jobs = await Promise.all([f.claim(), f.claim()]);
  assert.equal(jobs.filter(Boolean).length, 1);
  assert.equal(f.raw.prepare("SELECT count(*) AS total FROM self_hosted_scan_jobs").get().total, 1);
});

test("offline/expired leases are safely reclaimed and old IDs cannot submit a result", async () => {
  const f = await fixture();
  const first = await f.claim();
  f.advance(11 * 60_000);
  const second = await f.claim();
  assert.notEqual(first.id, second.id);
  assert.equal((await f.request({ action: "result", id: first.id, receipt: await f.receipt(first) })).status, 404);
  assert.equal(f.recorded.length, 0);
});

test("both successful checks are required and clean scans never accept provider evidence", async () => {
  const f = await fixture();
  const job = await f.claim();
  for (const changes of [{ policyPassed: false }, { antivirusPassed: false }, { policyVersion: "unknown" },
    { engineVersion: "ClamAV 1.4.0/28114" }, { signatureDate: "2026-09-01T00:00:00Z" }, { fileHash: "0".repeat(64) }]) {
    const rejected = await f.request({ action: "result", id: job.id, receipt: await f.receipt(job, changes) });
    assert.equal(rejected.status, 400, JSON.stringify(changes));
  }
  assert.equal(f.recorded.length, 0);
  const receipt = await f.receipt(job);
  assert.equal((await f.request({ action: "result", id: job.id, receipt })).status, 200);
  assert.equal(f.recorded[0].scanRequestId, "scan-one");
  assert.equal(f.recorded[0].fileHash, job.fileHash);
  assert.equal(f.raw.prepare("SELECT status FROM provider_evidence_submissions").get().status, "pending");
  f.advance(30 * 60_000);
  assert.deepEqual(await (await f.request({ action: "result", id: job.id, receipt })).json(), { accepted: true, duplicate: true });
  assert.equal(f.recorded.length, 1);
  const changed = { ...receipt, reason: "changed" };
  assert.equal((await f.request({ action: "result", id: job.id, receipt: changed })).status, 409);
});

test("overwritten objects cannot reuse a clean scan result", async () => {
  const f = await fixture();
  const job = await f.claim();
  f.objects.set("private/test-file", bytes("changed after lease"));
  assert.equal((await f.request({ action: "file", id: job.id })).status, 503);
  assert.equal((await f.request({ action: "result", id: job.id, receipt: await f.receipt(job) })).status, 503);
  assert.equal(f.recorded.length, 0);
});

test("unavailable scanner results stay quarantined and become retryable", async () => {
  const f = await fixture();
  const job = await f.claim();
  const receipt = await f.receipt(job, { status: "error", engineVersion: "", signatureDate: "", reason: "scan_unavailable", antivirusPassed: false, policyPassed: false });
  assert.deepEqual(await (await f.request({ action: "result", id: job.id, receipt })).json(), { accepted: true, retry: true });
  assert.equal(f.recorded.length, 0);
  assert.equal(f.raw.prepare("SELECT status FROM evidence_file_scans").get().status, "pending");
  assert.equal(await f.claim(), null);
  f.advance(11 * 60_000);
  assert.notEqual((await f.claim()).id, job.id);
});

test("message images use their existing 8 MiB allowance and require both checks", async () => {
  const f = await fixture({ kind: "message", content: new Uint8Array(8 * 1024 * 1024).buffer });
  const job = await f.claim();
  assert.equal(job.byteSize, 8 * 1024 * 1024);
  assert.equal((await f.request({ action: "result", id: job.id, receipt: await f.receipt(job, { policyPassed: false }) })).status, 400);
  assert.equal(f.raw.prepare("SELECT scan_status FROM job_messages").get().scan_status, "pending");
  assert.equal((await f.request({ action: "result", id: job.id, receipt: await f.receipt(job) })).status, 200);
  assert.equal(f.raw.prepare("SELECT scan_status FROM job_messages").get().scan_status, "clean");
  assert.equal(f.recorded.length, 0);
});

test("non-clean message images are blocked and changed targets cannot be cleared", async () => {
  const f = await fixture({ kind: "message" });
  const job = await f.claim();
  const receipt = await f.receipt(job, { status: "failed", policyPassed: false, reason: "invalid_document" });
  assert.equal((await f.request({ action: "result", id: job.id, receipt })).status, 200);
  assert.equal(f.raw.prepare("SELECT scan_status FROM job_messages").get().scan_status, "blocked");
  const changed = await fixture({ kind: "message" });
  const lease = await changed.claim();
  changed.raw.exec("UPDATE job_messages SET image_key='private/replaced'");
  assert.equal((await changed.request({ action: "result", id: lease.id, receipt: await changed.receipt(lease) })).status, 409);
});

test("oversized objects are rejected before downloading and cannot starve the next file", async () => {
  const f = await fixture({ content: new Uint8Array(MAX_EVIDENCE_BYTES + 1).buffer });
  assert.equal(await f.claim(), null);
  assert.equal(f.readKeys.length, 0);
  const data = bytes("second valid object");
  f.objects.set("private/second", data);
  f.raw.prepare("INSERT INTO job_messages(id,image_key,image_type,scan_status,created_at) VALUES('second','private/second','image/png','pending','2026-09-06T12:01:00Z')").run();
  assert.equal((await f.claim()).kind, "message");
});

test("oversized signed requests and unknown jobs are rejected without exposing files", async () => {
  const f = await fixture();
  assert.equal((await f.request({ action: "claim", padding: "x".repeat(12_000) })).status, 413);
  assert.equal((await f.request({ action: "file", id: "a".repeat(36) })).status, 404);
  assert.equal(f.readKeys.length, 0);
});

test("ClamAV cannot submit through the older callback without the document-policy checks", async () => {
  const legacy = await readFile(new URL("../app/api/internal/evidence-scan-result/route.ts", import.meta.url), "utf8");
  assert.match(legacy, /provider !== "clamav"/);
});

test("password-protected documents are blocked without claiming a virus detection", async () => {
  const f = await fixture();
  const job = await f.claim();
  const receipt = await f.receipt(job, { status: "failed", antivirusPassed: false,
    policyPassed: false, reason: "document_cannot_be_inspected" });
  assert.equal((await f.request({ action: "result", id: job.id, receipt })).status, 200);
  assert.equal(f.recorded[0].status, "failed");
  assert.equal(f.raw.prepare("SELECT status FROM provider_evidence_submissions").get().status, "pending");
});

test("readiness proof requires a matching policy receipt, terminal scan and original lease", async () => {
  const f = await fixture();
  const lease = await f.claim();
  const receipt = await f.receipt(lease);
  assert.equal((await f.request({ action: "result", id: lease.id, receipt })).status, 200);
  const stored = f.raw.prepare("SELECT * FROM self_hosted_scan_jobs").get();
  const job = { id: stored.id, kind: stored.kind, targetId: stored.target_id,
    evidenceId: stored.evidence_id, providerId: stored.provider_id, fileHash: stored.file_hash,
    resultStatus: stored.result_status, resultDigest: stored.result_digest,
    reportJson: stored.report_json, createdAt: stored.created_at };
  const result = f.recorded[0];
  const proof = { resultId: result.resultId, requestId: result.scanRequestId,
    evidenceId: result.evidenceId, providerId: "provider-one", fileHash: result.fileHash,
    status: result.status, engineVersion: result.scanEngineVersion,
    reportReference: result.reportReference, completedAt: result.scannedAt };
  assert.equal(await validateSelfHostedScanProof(job, proof), true);
  assert.equal(await validateSelfHostedScanProof(undefined, proof), false);
  for (const changed of [{ kind: "message" }, { targetId: "another-request" }, { providerId: "another-provider" },
    { evidenceId: "another-file" }, { fileHash: "0".repeat(64) }, { resultStatus: "error" },
    { resultDigest: "0".repeat(64) }, { reportJson: "{" },
    { reportJson: JSON.stringify({ ...receipt, policyPassed: false }) },
    { createdAt: "2026-09-07T12:00:00Z" }]) {
    assert.equal(await validateSelfHostedScanProof({ ...job, ...changed }, proof), false, JSON.stringify(changed));
  }
  for (const changed of [{ resultId: "self-hosted:another" }, { engineVersion: "ClamAV" },
    { reportReference: "self-hosted:wrong" }, { completedAt: "2026-09-06T12:00:01Z" }]) {
    assert.equal(await validateSelfHostedScanProof(job, { ...proof, ...changed }), false, JSON.stringify(changed));
  }
});
