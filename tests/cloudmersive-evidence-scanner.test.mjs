import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import {
  classifyCloudmersiveAdvancedResult,
  cloudmersiveScannerConfigured,
} from "../lib/cloudmersive-scan-policy.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const cleanAdvancedResult = {
  CleanResult: true,
  ContainsExecutable: false,
  ContainsInvalidFile: false,
  ContainsScript: false,
  ContainsPasswordProtectedFile: false,
  ContainsRestrictedFileFormat: false,
  ContainsMacros: false,
  ContainsXmlExternalEntities: false,
  ContainsInsecureDeserialization: false,
  ContainsHtml: false,
  ContainsUnsafeArchive: false,
  ContainsOleEmbeddedObject: false,
  ContainsUnwantedAction: false,
  VerifiedFileFormat: "PDF",
  FoundViruses: [],
};

test("Cloudmersive selection requires its key and the existing callback secret", () => {
  const configured = {
    EVIDENCE_SCAN_PROVIDER: "cloudmersive",
    CLOUDMERSIVE_API_KEY: "test-api-key",
    EVIDENCE_SCAN_WEBHOOK_SECRET: "s".repeat(32),
  };
  assert.equal(cloudmersiveScannerConfigured(configured), true);
  assert.equal(cloudmersiveScannerConfigured({ ...configured, CLOUDMERSIVE_API_KEY: "" }), false);
  assert.equal(cloudmersiveScannerConfigured({ ...configured, EVIDENCE_SCAN_WEBHOOK_SECRET: "short" }), false);
  assert.equal(cloudmersiveScannerConfigured({ ...configured, EVIDENCE_SCAN_PROVIDER: "other" }), false);
});

test("only an explicit, complete advanced clean response becomes clean", () => {
  assert.deepEqual(classifyCloudmersiveAdvancedResult(cleanAdvancedResult), {
    terminal: true,
    status: "clean",
  });
  assert.equal(classifyCloudmersiveAdvancedResult({
    ...cleanAdvancedResult,
    ContainsMacros: true,
  }).terminal, false);
  const incomplete = { ...cleanAdvancedResult };
  delete incomplete.ContainsUnsafeArchive;
  assert.equal(classifyCloudmersiveAdvancedResult(incomplete).terminal, false);
  assert.equal(classifyCloudmersiveAdvancedResult({
    ...cleanAdvancedResult,
    VerifiedFileFormat: "",
  }).terminal, false);
});

test("a real clean response can contain an explicit null virus list, but absent or malformed lists fail closed", () => {
  // Confirmed with a harmless PNG through the real advanced API. Cloudmersive
  // also documents FoundViruses:null for a successful scan with no viruses.
  assert.deepEqual(classifyCloudmersiveAdvancedResult({
    ...cleanAdvancedResult, VerifiedFileFormat: ".png", FoundViruses: null,
  }), { terminal: true, status: "clean" });
  for (const malformed of [undefined, false, 0, "", {}, [{ VirusName: "synthetic threat" }]]) {
    assert.equal(classifyCloudmersiveAdvancedResult({
      ...cleanAdvancedResult, FoundViruses: malformed,
    }).terminal, false);
  }
  for (const field of Object.keys(cleanAdvancedResult).filter(key => key.startsWith("Contains"))) {
    for (const invalid of [true, null, undefined, "false"]) {
      assert.equal(classifyCloudmersiveAdvancedResult({
        ...cleanAdvancedResult, FoundViruses: null, [field]: invalid,
      }).terminal, false, `${field}=${invalid}`);
    }
  }
  for (const invalid of [null, undefined, "", "  "]) {
    assert.equal(classifyCloudmersiveAdvancedResult({
      ...cleanAdvancedResult, FoundViruses: null, VerifiedFileFormat: invalid,
    }).terminal, false);
  }
});

test("explicit non-clean scans become terminal but malformed responses stay retryable", () => {
  assert.deepEqual(classifyCloudmersiveAdvancedResult({
    CleanResult: false,
    FoundViruses: [{ VirusName: "test" }],
  }), { terminal: true, status: "infected" });
  assert.deepEqual(classifyCloudmersiveAdvancedResult({
    CleanResult: false,
    FoundViruses: [],
    ContainsScript: true,
  }), { terminal: true, status: "failed" });
  assert.equal(classifyCloudmersiveAdvancedResult({ error: "quota" }).terminal, false);
  assert.equal(classifyCloudmersiveAdvancedResult(null).terminal, false);
});

test("scheduled scanner binds R2 bytes, hash, advanced policy, and shared result semantics", async () => {
  const [scanner, recorder, worker, runtime, environment] = await Promise.all([
    read("lib/cloudmersive-evidence-scanner.ts"),
    read("lib/evidence-scan-result-recorder.ts"),
    read("worker/index.ts"),
    read("lib/runtime-launch-readiness.ts"),
    read(".env.example"),
  ]);

  assert.match(scanner, /eq\(evidenceFileScans\.status, "pending"\)/);
  assert.match(scanner, /getProviderEvidence\(pending\.storageKey\)/);
  assert.match(scanner, /const actualHash = await sha256Hex\(bytes\)/);
  assert.match(scanner, /actualHash !== pending\.fileHash\.toLowerCase\(\)/);
  assert.ok(scanner.indexOf("actualHash !== pending.fileHash.toLowerCase()") < scanner.indexOf("await fetch("));
  assert.match(scanner, /virus\/scan\/file\/advanced/);
  for (const header of [
    "allowExecutables",
    "allowInvalidFiles",
    "allowScripts",
    "allowPasswordProtectedFiles",
    "allowMacros",
    "allowUnsafeArchives",
    "allowOleEmbeddedObject",
  ]) {
    assert.match(scanner, new RegExp(`${header}: "false"`));
  }
  assert.match(scanner, /restrictFileTypes: ALLOWED_FILE_TYPES/);
  assert.match(scanner, /\.pdf,\.jpg,\.jpeg,\.png,\.webp/);
  assert.match(scanner, /if \(!response\.ok\)[\s\S]*throw new RetryableCloudmersiveError/);
  assert.match(scanner, /recordAuthenticatedEvidenceScanResult/);
  assert.match(recorder, /evidenceAutomaticallyAccepted: false/);
  assert.match(recorder, /eq\(evidenceFileScans\.status, "pending"\)/);
  assert.match(recorder, /status: "result_received"/);
  assert.match(recorder, /db\.batch\(\[terminalInsert, pendingUpdate\]/);
  assert.match(recorder, /exists\([\s\S]*eq\(evidenceFileScans\.id, scanId\)/);
  assert.match(recorder, /inserted\.length !== 1 \|\| claimed\.length !== 1/);
  assert.match(worker, /processPendingCloudmersiveEvidenceScans/);
  assert.match(runtime, /cloudmersiveScannerConfigured/);
  assert.match(runtime, /runtimeCloudmersiveCanary/);
  assert.match(environment, /CLOUDMERSIVE_API_KEY=your_cloudmersive_api_key/);
  assert.doesNotMatch(scanner, /console\.[^(]+\([^\n]*(?:apiKey|CLOUDMERSIVE_API_KEY)/);
});

test("five retryable poison rows rotate with backoff so a sixth clean upload can progress", async () => {
  const scanner = await read("lib/cloudmersive-evidence-scanner.ts");
  assert.match(scanner, /RETRY_STATE_KIND = "cloudmersive_retry_v1"/);
  assert.match(scanner, /MAX_RETRY_ATTEMPTS = 16/);
  assert.match(scanner, /retryDelayMs\(attempt\)/);
  assert.match(scanner, /json_extract\([^;]*'\$\.nextAttemptAt'/s);
  assert.match(scanner, /orderBy\(asc\(evidenceFileScans\.updatedAt\), asc\(evidenceFileScans\.requestedAt\)\)/);
  assert.match(scanner, /rotateRetryOrRecordTerminal/);
  assert.match(scanner, /"error",[\s\S]*retry-exhausted/);
  assert.match(scanner, /evidence_malware_scan_pending_retry/);
  assert.match(scanner, /db\.batch\(\[rotated, blocked\]/);
  assert.match(scanner, /exists\(db\.select\(\{ id: evidenceFileScans\.id \}\)/);
  assert.match(scanner, /eq\(evidenceFileScans\.status, "pending"\)/);

  const database = new DatabaseSync(":memory:");
  database.exec(`
    CREATE TABLE evidence_file_scans (
      id TEXT PRIMARY KEY NOT NULL,
      status TEXT NOT NULL,
      review_notes TEXT NOT NULL,
      requested_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  const insert = database.prepare(`
    INSERT INTO evidence_file_scans
      (id, status, review_notes, requested_at, updated_at)
    VALUES (?, 'pending', '', ?, ?)
  `);
  for (let index = 1; index <= 5; index += 1) {
    const timestamp = `2026-08-01T00:00:0${index}.000Z`;
    insert.run(`poison-${index}`, timestamp, timestamp);
  }
  insert.run("valid-6", "2026-08-01T00:00:06.000Z", "2026-08-01T00:00:06.000Z");

  const selectEligible = database.prepare(`
    SELECT id FROM evidence_file_scans
    WHERE status = 'pending' AND (
      review_notes = ''
      OR json_valid(review_notes) = 0
      OR json_extract(review_notes, '$.kind') <> 'cloudmersive_retry_v1'
      OR datetime(json_extract(review_notes, '$.nextAttemptAt')) IS NULL
      OR datetime(json_extract(review_notes, '$.nextAttemptAt')) <= datetime(?)
    )
    ORDER BY updated_at ASC, requested_at ASC
    LIMIT 5
  `);
  const first = selectEligible.all("2026-08-01T00:01:00.000Z").map((row) => row.id);
  assert.deepEqual(first, ["poison-1", "poison-2", "poison-3", "poison-4", "poison-5"]);

  const rotate = database.prepare(`
    UPDATE evidence_file_scans
    SET review_notes = ?, updated_at = '2026-08-01T00:01:00.000Z'
    WHERE id = ? AND status = 'pending'
  `);
  for (const id of first) {
    rotate.run(JSON.stringify({
      kind: "cloudmersive_retry_v1",
      attempts: 1,
      nextAttemptAt: "2026-08-01T00:02:00.000Z",
      lastFailureCode: "cloudmersive_ambiguous_clean_result_missing",
    }), id);
  }
  const second = selectEligible.all("2026-08-01T00:01:01.000Z").map((row) => row.id);
  assert.deepEqual(second, ["valid-6"]);
  database.prepare("UPDATE evidence_file_scans SET status = 'result_received' WHERE id = 'valid-6'").run();
  assert.equal(
    database.prepare("SELECT count(*) AS count FROM evidence_file_scans WHERE id LIKE 'poison-%' AND status = 'pending'").get().count,
    5,
  );
  assert.equal(
    database.prepare("SELECT status FROM evidence_file_scans WHERE id = 'valid-6'").get().status,
    "result_received",
  );
});

test("Cloudmersive readiness needs recent guarded terminal D1 and audit proof", async () => {
  const [runtime, admin] = await Promise.all([
    read("lib/runtime-launch-readiness.ts"),
    read("app/api/admin/launch-readiness/route.ts"),
  ]);
  assert.match(runtime, /SCANNER_CANARY_MAX_AGE_MS = 30/);
  assert.match(runtime, /eq\(evidenceFileScans\.scanProvider, CLOUDMERSIVE_PROVIDER\)/);
  assert.match(runtime, /inArray\(evidenceFileScans\.status, \["clean", "infected", "failed"\]\)/);
  assert.match(runtime, /eq\(providerAuditEvents\.eventType, "authenticated_evidence_scan_result"\)/);
  assert.match(runtime, /eq\(evidenceFileScans\.status, "result_received"\)/);
  assert.match(runtime, /metadata\.evidenceAutomaticallyAccepted !== false/);
  assert.match(runtime, /expectedAuditHash !== audit\.eventHash/);
  assert.match(runtime, /reasonCodes\[0\] !== `malware_scan_\$\{terminal\.status\}`/);
  assert.match(runtime, /scanner-result:\$\{CLOUDMERSIVE_PROVIDER\}:\$\{resultId\}/);
  assert.match(
    runtime,
    /key: "authenticated_evidence_scanner",[\s\S]*?passed: evidenceScanProvider === CLOUDMERSIVE_PROVIDER[\s\S]*?evidenceScannerCanary\.evidencePassed/,
  );
  assert.match(admin, /Configuration alone does not pass this gate/);
  assert.match(admin, /consumed pending request and exact authenticated-scanner audit event/);
});

test("atomic terminal-result invariant rolls back failures and rejects a concurrent loser", () => {
  const database = new DatabaseSync(":memory:");
  database.exec(`
    CREATE TABLE evidence_file_scans (
      id TEXT PRIMARY KEY NOT NULL,
      evidence_submission_id TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      file_hash TEXT NOT NULL,
      scan_provider TEXT NOT NULL,
      status TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    INSERT INTO evidence_file_scans VALUES
      ('pending-1', 'evidence-1', 'provider-1', '${"a".repeat(64)}', 'external_scanner_required', 'pending', 'before');
  `);

  const record = (resultId, failAfterInsert = false) => {
    database.exec("BEGIN IMMEDIATE");
    try {
      const inserted = database.prepare(`
        INSERT INTO evidence_file_scans
          (id, evidence_submission_id, provider_id, file_hash, scan_provider, status, updated_at)
        SELECT ?, evidence_submission_id, provider_id, file_hash, 'cloudmersive', 'clean', 'now'
        FROM evidence_file_scans
        WHERE id = 'pending-1' AND status = 'pending'
      `).run(resultId).changes;
      if (failAfterInsert) throw new Error("simulated crash");
      const claimed = database.prepare(`
        UPDATE evidence_file_scans SET status = 'result_received', updated_at = 'now'
        WHERE id = 'pending-1' AND status = 'pending'
          AND EXISTS (
            SELECT 1 FROM evidence_file_scans
            WHERE id = ? AND evidence_submission_id = 'evidence-1'
              AND provider_id = 'provider-1' AND file_hash = ?
              AND scan_provider = 'cloudmersive' AND status = 'clean'
          )
      `).run(resultId, "a".repeat(64)).changes;
      if (inserted !== claimed) throw new Error("atomic invariant mismatch");
      database.exec("COMMIT");
      return { inserted, claimed };
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  };

  assert.throws(() => record("result-crash", true), /simulated crash/);
  assert.equal(database.prepare("SELECT status FROM evidence_file_scans WHERE id = 'pending-1'").get().status, "pending");
  assert.equal(database.prepare("SELECT count(*) AS count FROM evidence_file_scans WHERE id = 'result-crash'").get().count, 0);

  assert.deepEqual(record("result-winner"), { inserted: 1, claimed: 1 });
  assert.deepEqual(record("result-loser"), { inserted: 0, claimed: 0 });
  assert.equal(database.prepare("SELECT status FROM evidence_file_scans WHERE id = 'pending-1'").get().status, "result_received");
  assert.equal(database.prepare("SELECT count(*) AS count FROM evidence_file_scans WHERE scan_provider = 'cloudmersive'").get().count, 1);
});
