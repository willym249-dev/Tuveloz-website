// Loopback-only integration fixture. It has no live credentials or external
// object storage. The actual scan protocol runs against real in-memory SQLite.
import { createServer } from "node:http";
import { createInterface } from "node:readline";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { selfHostedScanHandler, scanHash } from "../../lib/self-hosted-scan-protocol.ts";

const input = createInterface({ input: process.stdin });
const fixtures = await new Promise(resolve => input.once("line", line => resolve(JSON.parse(line))));
input.close();
const sqlite = new DatabaseSync(":memory:");
sqlite.exec(`CREATE TABLE evidence_file_scans(id TEXT PRIMARY KEY, evidence_submission_id TEXT, provider_id TEXT, status TEXT, file_hash TEXT, requested_at TEXT);
 CREATE TABLE provider_evidence_submissions(id TEXT PRIMARY KEY, provider_id TEXT, storage_key TEXT, content_type TEXT, document_hash TEXT, status TEXT DEFAULT 'pending');
 CREATE TABLE job_messages(id TEXT PRIMARY KEY, image_key TEXT, image_type TEXT, scan_status TEXT, created_at TEXT, scan_attempted_at TEXT DEFAULT '', scan_attempt_count INTEGER DEFAULT 0);`);
sqlite.exec(await readFile(new URL("../../drizzle/0066_self_hosted_scan_jobs.sql", import.meta.url), "utf8"));
const objects = new Map();
const recordedEvidence = [];
for (const [index, fixture] of fixtures.files.entries()) {
  const buffer = Uint8Array.from(Buffer.from(fixture.base64, "base64")).buffer;
  objects.set(fixture.id, buffer);
  const hash = await scanHash(buffer);
  const queuedAt = new Date(Date.now() - (100 - index) * 1000).toISOString();
  if (fixture.kind === "evidence") {
    sqlite.prepare("INSERT INTO provider_evidence_submissions(id,provider_id,storage_key,content_type,document_hash) VALUES(?,'synthetic-provider',?,?,?)")
      .run(fixture.id, fixture.id, fixture.contentType, hash);
    sqlite.prepare("INSERT INTO evidence_file_scans VALUES(?,?,'synthetic-provider','pending',?,?)").run(`request-${fixture.id}`, fixture.id, hash, queuedAt);
  } else {
    sqlite.prepare("INSERT INTO job_messages(id,image_key,image_type,scan_status,created_at) VALUES(?,?,?,'pending',?)")
      .run(fixture.id, fixture.id, fixture.contentType, queuedAt);
  }
}
const db = {
  prepare(sql) {
    const statement = sqlite.prepare(sql);
    let values = [];
    return {
      bind(...parameters) { values = parameters; return this; },
      async first() { return statement.get(...values) ?? null; },
      async all() { return { results: statement.all(...values) }; },
      async run() { return statement.run(...values); },
    };
  },
  async batch(statements) {
    sqlite.exec("BEGIN");
    try {
      const result = [];
      for (const statement of statements) result.push(await statement.run());
      sqlite.exec("COMMIT");
      return result;
    } catch (error) { sqlite.exec("ROLLBACK"); throw error; }
  },
};
const handler = selfHostedScanHandler({ provider: "clamav", secret: fixtures.secret, db,
  bucket: { async get(key) { const bytes = objects.get(key); return bytes ? { size: bytes.byteLength, async arrayBuffer() { return bytes; } } : null; } },
  async recordEvidence(receipt) {
    const previous = recordedEvidence.find(item => item.resultId === receipt.resultId);
    if (previous) return { status: previous.status === receipt.status ? 200 : 409, body: { recorded: true } };
    const change = sqlite.prepare("UPDATE evidence_file_scans SET status='result_received' WHERE id=? AND evidence_submission_id=? AND file_hash=? AND status='pending'")
      .run(receipt.scanRequestId, receipt.evidenceId, receipt.fileHash).changes;
    if (!change) return { status: 409, body: { error: "not_pending" } };
    recordedEvidence.push(receipt);
    return { status: 200, body: { recorded: true } };
  },
});
const server = createServer(async (incoming, outgoing) => {
  if (incoming.method === "GET" && incoming.url === "/test-state") {
    outgoing.setHeader("Content-Type", "application/json");
    outgoing.end(JSON.stringify({
      evidence: recordedEvidence.map(({ evidenceId, status }) => ({ id: evidenceId, status })),
      messages: sqlite.prepare("SELECT id,scan_status AS status FROM job_messages").all(),
      providerEvidence: sqlite.prepare("SELECT id,status FROM provider_evidence_submissions").all(),
      jobs: sqlite.prepare("SELECT result_status AS status, report_json AS receipt FROM self_hosted_scan_jobs ORDER BY job_key").all(),
    }));
    return;
  }
  const pieces = [];
  let count = 0;
  for await (const piece of incoming) {
    count += piece.length;
    if (count > 12_000) { outgoing.writeHead(413).end(); return; }
    pieces.push(piece);
  }
  const request = new Request(`http://127.0.0.1${incoming.url}`, { method: incoming.method, headers: incoming.headers,
    ...(pieces.length ? { body: Buffer.concat(pieces) } : {}) });
  const response = await handler(request);
  outgoing.writeHead(response.status, Object.fromEntries(response.headers));
  outgoing.end(Buffer.from(await response.arrayBuffer()));
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
process.stdout.write(JSON.stringify({ origin: `http://127.0.0.1:${server.address().port}` }) + "\n");
