import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import { compileFunction } from "node:vm";
import { RequestBodyTooLargeError } from "../lib/limited-json.ts";
import { evidenceText } from "../lib/provider-evidence-copy.ts";
import { EVIDENCE_REQUEST_FORMAT_ERROR, EVIDENCE_REQUEST_SIZE_ERROR } from "../lib/provider-evidence-limits.ts";

const source = stripTypeScriptTypes(await readFile(new URL("../lib/limited-form-data.ts", import.meta.url), "utf8"))
  .replace(/^import\s[^;]+;\s*/gm, "").replace(/^export /gm, "");
const { readLimitedFormData, InvalidFormBodyError } = compileFunction(`${source}\nreturn {readLimitedFormData, InvalidFormBodyError};`, ["RequestBodyTooLargeError"])(RequestBodyTooLargeError);
const url = "https://upload-test.invalid";
const type = "multipart/form-data; boundary=fixture";
const wire = new TextEncoder().encode('--fixture\r\nContent-Disposition: form-data; name="issuer"\r\n\r\nSYNTHETIC\r\n--fixture--\r\n');

test("multipart size includes boundaries and accepts exactly the total limit", async () => {
  const make = () => new Request(url, { method: "POST", headers: { "content-type": type }, body: wire });
  assert.equal((await readLimitedFormData(make(), wire.length)).get("issuer"), "SYNTHETIC");
  await assert.rejects(readLimitedFormData(make(), wire.length - 1), RequestBodyTooLargeError);
});

test("oversized declared length is rejected without consuming the stream", async () => {
  let reads = 0, cancelled = false;
  const body = new ReadableStream({ pull() { reads++; }, cancel() { cancelled = true; } }, { highWaterMark: 0 });
  const request = new Request(url, { method: "POST", headers: { "content-type": type, "content-length": "101" }, body, duplex: "half" });
  await assert.rejects(readLimitedFormData(request, 100), RequestBodyTooLargeError);
  assert.equal(reads, 0);
  assert.equal(cancelled, true);
});

test("missing or understated length cannot bypass streamed limits; reading stops and cancels", async () => {
  for (const declaredLength of [null, "1"]) {
    let reads = 0, cancelled = false;
    const body = new ReadableStream({ pull(controller) { reads++; controller.enqueue(new Uint8Array(60)); }, cancel() { cancelled = true; } }, { highWaterMark: 0 });
    const headers = { "content-type": type };
    if (declaredLength !== null) headers["content-length"] = declaredLength;
    await assert.rejects(readLimitedFormData(new Request(url, { method: "POST", headers, body, duplex: "half" }), 100), RequestBodyTooLargeError);
    assert.equal(reads, 2);
    assert.equal(cancelled, true);
  }
});

test("an interrupted stream reports an invalid upload instead of a server exception", async () => {
  const body = new ReadableStream({ pull(controller) { controller.error(new Error("synthetic connection lost")); } });
  await assert.rejects(readLimitedFormData(new Request(url, { method: "POST", headers: { "content-type": type }, body, duplex: "half" }), 100), InvalidFormBodyError);
});

test("bad types, lengths, missing bodies and malformed multipart are rejected", async () => {
  for (const headers of [
    { "content-type": "application/json" },
    { "content-type": type, "content-length": "-1" },
    { "content-type": type, "content-length": "1.5" },
    { "content-type": type, "content-length": "unknown" },
    { "content-type": "multipart/form-data" },
  ]) await assert.rejects(readLimitedFormData(new Request(url, { method: "POST", headers, body: "invalid" }), 200), InvalidFormBodyError);
  await assert.rejects(readLimitedFormData(new Request(url, { method: "POST", headers: { "content-type": type } }), 200), InvalidFormBodyError);
  await assert.rejects(readLimitedFormData(new Request(url, { method: "POST", headers: { "content-type": type }, body: "invalid" }), 200), InvalidFormBodyError);
});

test("both new provider upload errors have Spanish messages", () => {
  for (const message of [EVIDENCE_REQUEST_FORMAT_ERROR, EVIDENCE_REQUEST_SIZE_ERROR]) {
    assert.equal(evidenceText(message, "en"), message);
    assert.notEqual(evidenceText(message, "es"), message);
  }
});
