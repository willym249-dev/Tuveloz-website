import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import { compileFunction } from "node:vm";
import { MAX_EVIDENCE_BYTES } from "../lib/provider-evidence-limits.ts";

import {
  CLOUDMERSIVE_ENGINE_VERSION,
  CLOUDMERSIVE_PROVIDER,
  classifyCloudmersiveAdvancedResult,
} from "../lib/cloudmersive-scan-policy.ts";

const cleanResult = {
  CleanResult: true, FoundViruses: null, VerifiedFileFormat: ".png",
  ContainsExecutable: false, ContainsInvalidFile: false, ContainsScript: false,
  ContainsPasswordProtectedFile: false, ContainsRestrictedFileFormat: false,
  ContainsMacros: false, ContainsXmlExternalEntities: false,
  ContainsInsecureDeserialization: false, ContainsHtml: false,
  ContainsUnsafeArchive: false, ContainsOleEmbeddedObject: false,
  ContainsUnwantedAction: false,
};
const flush = () => new Promise(resolve => setImmediate(resolve));
const bytes = new TextEncoder().encode("synthetic scanner transport fixture");
const fileHash = Buffer.from(await crypto.subtle.digest("SHA-256", bytes)).toString("hex");

// Execute each real scanner function with only network, timer, storage and
// recording boundaries replaced. No live API, database or provider is used.
async function fixture(t, kind, { status = 200, waitingForHeaders = false } = {}) {
  const timers = new Map();
  const records = [];
  let signal;
  let streamController;
  let canceled = false;
  let reads = 0;
  let settled = false;
  let outcome;
  let requestStarted;
  const started = new Promise(resolve => { requestStarted = resolve; });
  const bindings = {
    MAX_EVIDENCE_BYTES,
    setTimeout(callback, delay) {
      assert.equal(delay, 45_000);
      const id = Symbol("scanner deadline");
      timers.set(id, callback);
      return id;
    },
    clearTimeout: id => timers.delete(id),
    fetch: async (_url, options) => {
      signal = options.signal;
      requestStarted();
      if (waitingForHeaders) {
        return new Promise((_, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true }));
      }
      const body = new ReadableStream({
        start(controller) {
          streamController = controller;
          signal.addEventListener("abort", () => controller.error(signal.reason), { once: true });
        },
        pull() { reads += 1; },
        cancel() { canceled = true; },
      });
      return new Response(body, { status, headers: { "x-correlation-id": "synthetic-scan" } });
    },
    getProviderEvidence: async () => ({ body: new Blob([bytes]).stream() }),
    recordAuthenticatedEvidenceScanResult: async result => { records.push(result); return { status: 200 }; },
    CLOUDMERSIVE_ENGINE_VERSION,
    CLOUDMERSIVE_PROVIDER,
    classifyCloudmersiveAdvancedResult,
  };
  const file = kind === "evidence" ? "cloudmersive-evidence-scanner" : "message-image-scanner";
  const source = stripTypeScriptTypes(await readFile(new URL(`../lib/${file}.ts`, import.meta.url), "utf8"), { mode: "transform" })
    .replace(/^import\s[\s\S]*?from\s+"[^"]+";\s*/gm, "")
    .replace(/^export /gm, "");
  const scan = compileFunction(`${source}\nreturn ${kind === "evidence" ? "processOnePendingScan" : "scanBytes"};`, Object.keys(bindings))(...Object.values(bindings));
  const pending = {
    scanRequestId: "synthetic-scan", evidenceId: "synthetic-evidence",
    providerId: "synthetic-provider", storageKey: "quarantine/random.png",
    fileHash, contentType: "image/png", reviewNotes: "", serviceCode: "", jurisdiction: "MD",
  };
  const operation = kind === "evidence"
    ? scan(pending, "synthetic-api-key")
    : scan("synthetic-api-key", bytes.buffer, "image/png");
  const observed = operation.then(
    value => { settled = true; outcome = { value }; },
    error => { settled = true; outcome = { error }; },
  );
  t.after(async () => {
    if (!settled) streamController?.error(new Error("fixture cleanup"));
    for (const callback of timers.values()) callback();
    await observed;
  });
  // Wait for crypto/stream work without altering the application deadline or
  // relying on a fixed number of event-loop turns on a busy CI runner.
  await started;
  await flush();
  return {
    records, timers,
    get signal() { return signal; },
    get canceled() { return canceled; },
    get reads() { return reads; },
    get outcome() { return outcome; },
    get settled() { return settled; },
    chunk(value) { streamController.enqueue(typeof value === "string" ? new TextEncoder().encode(value) : value); },
    close() { streamController.close(); },
    async deadline() {
      for (const [id, callback] of timers) { timers.delete(id); callback(); }
      await flush();
    },
    async finish() { await observed; return outcome; },
  };
}

for (const kind of ["evidence", "message image"]) {
  test(`${kind}: the deadline also stops a stalled response body without clearing the upload`, { timeout: 5000 }, async t => {
    const f = await fixture(t, kind);
    f.chunk('{"CleanResult":true,');
    await flush();
    assert.equal(f.settled, false);
    assert.ok(f.reads > 0);
    await f.deadline();
    assert.equal(f.signal.aborted, true, "deadline must remain active after response headers");
    assert.equal(f.settled, true, "stalled body must stop at the deadline");
    assert.equal(f.outcome.error.name, "AbortError");
    assert.equal(f.records.length, 0, "partial responses must never record a terminal verdict");
    assert.equal(f.timers.size, 0);
  });

  test(`${kind}: the same deadline stops a request waiting for headers`, { timeout: 5000 }, async t => {
    const f = await fixture(t, kind, { waitingForHeaders: true });
    await f.deadline();
    assert.equal(f.signal.aborted, true);
    assert.ok((await f.finish()).error);
    assert.equal(f.records.length, 0);
    assert.equal(f.timers.size, 0);
  });

  test(`${kind}: a complete streamed clean result records only after the body ends`, { timeout: 5000 }, async t => {
    const f = await fixture(t, kind);
    const json = JSON.stringify(cleanResult);
    f.chunk(json.slice(0, 25));
    await flush();
    assert.equal(f.records.length, 0);
    assert.equal(f.settled, false);
    f.chunk(json.slice(25));
    f.close();
    assert.deepEqual(await f.finish(), { value: "clean" });
    assert.equal(f.timers.size, 0);
    await f.deadline();
    assert.equal(f.signal.aborted, false, "successful requests leave no abort timer behind");
    if (kind === "evidence") {
      assert.equal(f.records.length, 1);
      assert.equal(f.records[0].status, "clean");
      assert.equal(f.records[0].fileHash, fileHash);
    }
  });

  test(`${kind}: HTTP errors release a hanging body and leave the upload pending`, { timeout: 5000 }, async t => {
    const f = await fixture(t, kind, { status: 429 });
    assert.match((await f.finish()).error.message, /429/);
    assert.equal(f.canceled || f.signal.aborted, true, "unused error bodies must be released");
    assert.equal(f.records.length, 0);
    assert.equal(f.timers.size, 0);
  });

  test(`${kind}: oversized responses are canceled and cannot clear the upload`, { timeout: 5000 }, async t => {
    const f = await fixture(t, kind);
    f.chunk(new Uint8Array(128 * 1024 + 1));
    assert.ok((await f.finish()).error);
    assert.equal(f.canceled, true);
    assert.equal(f.records.length, 0);
    assert.equal(f.timers.size, 0);
  });

  test(`${kind}: malformed or incomplete results remain retryable`, { timeout: 5000 }, async t => {
    for (const body of ['{"CleanResult":', '{"CleanResult":true}']) {
      const f = await fixture(t, kind);
      f.chunk(body);
      f.close();
      assert.ok((await f.finish()).error);
      assert.equal(f.records.length, 0);
      assert.equal(f.timers.size, 0);
    }
  });
}
