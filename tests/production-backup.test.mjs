import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  beginD1Export,
  copySourceObject,
  enforceBackupRetention,
  finishD1Export,
  listSourceObjects,
  validateBackupSettings,
  writeBackupManifest,
} from "../lib/production-backup.ts";

class MemoryObject {
  constructor(key, bytes, options = {}, uploaded = new Date("2026-09-25T09:00:00.000Z")) {
    this.key = key;
    this.bytesValue = typeof bytes === "string" ? new TextEncoder().encode(bytes) : new Uint8Array(bytes);
    this.size = this.bytesValue.byteLength;
    this.etag = options.etag ?? `etag-${key}-${this.size}`;
    this.uploaded = uploaded;
    this.httpMetadata = options.httpMetadata;
    this.customMetadata = options.customMetadata;
  }
  async arrayBuffer() { return this.bytesValue.slice().buffer; }
  async text() { return new TextDecoder().decode(this.bytesValue); }
}

class MemoryBucket {
  objects = new Map();
  deleted = [];
  seed(key, bytes, options = {}, uploaded) {
    this.objects.set(key, new MemoryObject(key, bytes, options, uploaded));
  }
  async list({ prefix = "" } = {}) {
    return {
      objects: [...this.objects.values()].filter((object) => object.key.startsWith(prefix)),
      truncated: false,
    };
  }
  async get(key) { return this.objects.get(key) ?? null; }
  async head(key) { return this.objects.get(key) ?? null; }
  async put(key, value, options = {}) {
    let bytes = value;
    if (value instanceof ReadableStream) bytes = await new Response(value).arrayBuffer();
    const object = new MemoryObject(key, bytes, options);
    this.objects.set(key, object);
    return object;
  }
  async delete(keys) {
    for (const key of Array.isArray(keys) ? keys : [keys]) {
      this.deleted.push(key);
      this.objects.delete(key);
    }
  }
}

const settings = () => validateBackupSettings({
  accountId: "a275234035620ab61d84e96fa9e20567",
  databaseId: "76a19869-f771-42ce-9bc9-f88605ea6f29",
  apiToken: "fixture-token",
  retentionDays: "35",
});

test("backup settings require the exact account, database, secret, and bounded retention", () => {
  assert.equal(settings().retentionDays, 35);
  assert.throws(() => validateBackupSettings({
    accountId: "bad", databaseId: settings().databaseId, apiToken: "x", retentionDays: 35,
  }), /BACKUP_ACCOUNT_ID/);
  assert.throws(() => validateBackupSettings({
    accountId: settings().accountId, databaseId: settings().databaseId, apiToken: "", retentionDays: 35,
  }), /D1_BACKUP_API_TOKEN/);
  assert.throws(() => validateBackupSettings({
    accountId: settings().accountId, databaseId: settings().databaseId, apiToken: "x", retentionDays: 365,
  }), /BACKUP_RETENTION_DAYS/);
});

test("D1 export initiation sends the token only in its authorization header", async () => {
  let request;
  const bookmark = await beginD1Export(async (url, init) => {
    request = { url, init };
    return Response.json({ success: true, result: { at_bookmark: "bookmark-1" } });
  }, settings());
  assert.equal(bookmark, "bookmark-1");
  assert.match(request.url, /\/d1\/database\/76a19869-f771-42ce-9bc9-f88605ea6f29\/export$/);
  assert.equal(request.init.headers.authorization, "Bearer fixture-token");
  assert.doesNotMatch(request.init.body, /fixture-token/);
});

test("D1 export polling reads Cloudflare's nested result and stores a non-empty SQL file", async () => {
  const destination = new MemoryBucket();
  const requests = [];
  const database = await finishD1Export(async (url, init = {}) => {
    requests.push({ url: String(url), init });
    if (String(url).startsWith("https://download.example/")) {
      return new Response("CREATE TABLE fixture (id INTEGER);", { status: 200 });
    }
    return Response.json({
      success: true,
      result: {
        at_bookmark: "bookmark-1",
        status: "complete",
        success: true,
        type: "export",
        result: {
          filename: "tuveloz-export.sql",
          signed_url: "https://download.example/tuveloz-export.sql",
        },
      },
    });
  }, settings(), "bookmark-1", destination, new Date("2026-09-25T09:07:00.000Z"));

  assert.equal(database.backupKey, "d1/2026-09-25/tuveloz-export.sql");
  assert.ok(database.size > 0);
  assert.deepEqual(JSON.parse(requests[0].init.body), {
    output_format: "polling",
    current_bookmark: "bookmark-1",
  });
  assert.equal(requests[0].init.headers.authorization, "Bearer fixture-token");
  assert.equal(requests[1].init.headers["user-agent"], "Tuveloz-Production-Backup");
});

test("private objects are content-verified, deduplicated, and recorded in a manifest", async () => {
  const source = new MemoryBucket();
  const destination = new MemoryBucket();
  source.seed("provider-evidence/provider-1/document.pdf", new TextEncoder().encode("private evidence"), {
    etag: "source-etag",
    httpMetadata: { contentType: "application/pdf" },
    customMetadata: { access: "private" },
  });
  const [descriptor] = await listSourceObjects(source);
  const first = await copySourceObject(source, destination, descriptor);
  const countAfterFirst = destination.objects.size;
  const second = await copySourceObject(source, destination, descriptor);
  assert.equal(first.sha256, second.sha256);
  assert.equal(destination.objects.size, countAfterFirst, "same content is not copied twice");
  assert.equal(destination.objects.get(first.backupKey).customMetadata.sha256, first.sha256);

  const record = await writeBackupManifest(
    destination,
    "fixture-run",
    new Date("2026-09-25T09:07:00.000Z"),
    35,
    { bookmark: "bookmark-1", backupKey: "d1/2026-09-25/database.sql", size: 50, etag: "db-etag" },
    [first],
  );
  assert.equal(record.manifest.objects[0].key, descriptor.key);
  assert.ok(destination.objects.has(record.key));
});

test("retention keeps referenced files and removes only expired, unreferenced backup data", async () => {
  const bucket = new MemoryBucket();
  const retainedObject = "objects/current/hash";
  const orphanedObject = "objects/deleted/hash";
  bucket.seed(retainedObject, "kept");
  bucket.seed(orphanedObject, "old");
  bucket.seed("d1/2026-09-25/current.sql", "current database");
  bucket.seed("d1/2026-07-01/old.sql", "old database");
  const manifest = {
    version: 1,
    createdAt: "2026-09-25T09:07:00.000Z",
    retentionDays: 35,
    database: { bookmark: "b", backupKey: "d1/2026-09-25/current.sql", size: 1, etag: "e" },
    objects: [{ backupKey: retainedObject }],
  };
  bucket.seed("manifests/2026-09-25/current.json", JSON.stringify(manifest));
  bucket.seed("manifests/2026-07-01/old.json", JSON.stringify({ ...manifest, objects: [] }));

  const result = await enforceBackupRetention(bucket, new Date("2026-09-25T10:00:00.000Z"), 35);
  assert.ok(bucket.objects.has(retainedObject));
  assert.ok(!bucket.objects.has(orphanedObject));
  assert.ok(!bucket.objects.has("d1/2026-07-01/old.sql"));
  assert.ok(!bucket.objects.has("manifests/2026-07-01/old.json"));
  assert.equal(result.deleted, 3);
});

test("backup deployment is isolated, private, scheduled, and secret-free in source", async () => {
  const [config, worker] = await Promise.all([
    readFile(new URL("../backup-worker/wrangler.jsonc", import.meta.url), "utf8"),
    readFile(new URL("../backup-worker/src/index.ts", import.meta.url), "utf8"),
  ]);
  assert.match(config, /"name": "tuveloz-production-backup"/);
  assert.match(config, /"schedules": \["7 9 \* \* \*"\]/);
  assert.match(config, /"concurrency": \{\s*"limit": 1\s*\}/);
  assert.match(config, /"success_retention": "1 day"/);
  assert.match(config, /"error_retention": "3 days"/);
  assert.match(config, /"bucket_name": "tuveloz-backups"/);
  assert.doesNotMatch(config, /api[_-]?token/i);
  assert.match(worker, /D1_BACKUP_API_TOKEN/);
  assert.match(worker, /return new Response\("Not found", \{ status: 404 \}\)/);
});
