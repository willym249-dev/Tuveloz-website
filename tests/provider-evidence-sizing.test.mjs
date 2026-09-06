import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import { compileFunction } from "node:vm";
import { EVIDENCE_SIZE_ERROR, MAX_EVIDENCE_BYTES, MAX_SOURCE_PHOTO_BYTES } from "../lib/provider-evidence-limits.ts";
import { prepareProviderEvidence } from "../lib/prepare-provider-evidence.ts";

const source = stripTypeScriptTypes(await readFile(new URL("../lib/provider-evidence.ts", import.meta.url), "utf8"))
  .replace(/^import\s[^;]+;\s*/gm, "")
  .replace(/^export /gm, "");
const validate = compileFunction(`${source}\nreturn validateProviderEvidence;`, ["MAX_EVIDENCE_BYTES", "EVIDENCE_SIZE_ERROR"])(MAX_EVIDENCE_BYTES, EVIDENCE_SIZE_ERROR);

test("the server accepts exactly 3.5 decimal MB and rejects even one byte more before reading it", async () => {
  assert.equal(MAX_EVIDENCE_BYTES, 3_500_000);
  const file = new File(["%PDF-1.7\n", new Uint8Array(MAX_EVIDENCE_BYTES - 9)], "policy.pdf", { type: "application/pdf" });
  assert.equal((await validate(file)).size, 3_500_000);
  const oversize = new File([file, "x"], "policy.pdf", { type: "application/pdf" });
  oversize.arrayBuffer = () => { throw new Error("oversize file must not be read"); };
  await assert.rejects(validate(oversize), { message: EVIDENCE_SIZE_ERROR });
});

test("small documents retain their original bytes, including PDF signatures and all pages", async () => {
  for (const type of ["application/pdf", "image/jpeg", "image/png", "image/webp"]) {
    const original = new File(["synthetic unchanged file bytes"], "document", { type });
    const prepared = await prepareProviderEvidence(original);
    assert.equal(prepared.file, original);
    assert.equal(prepared.resized, false);
  }
});

test("an oversized PDF has a useful error and is never converted into a one-page photo", async () => {
  const original = new File([new Uint8Array(MAX_EVIDENCE_BYTES + 1)], "all-pages.pdf", { type: "application/pdf" });
  original.arrayBuffer = () => { throw new Error("PDF must not be decoded"); };
  await assert.rejects(prepareProviderEvidence(original), /over 3\.5 MB.*keeping every page.*hello@tuveloz.com/);
});

test("empty, unsupported and excessive source photos cannot start conversion", async () => {
  for (const file of [
    new File([], "empty.png", { type: "image/png" }),
    new File(["svg"], "vector.svg", { type: "image/svg+xml" }),
    new File(["heic"], "phone.heic", { type: "image/heic" }),
  ]) await assert.rejects(prepareProviderEvidence(file), /Choose a PDF, JPG, PNG, or WebP/);
  await assert.rejects(prepareProviderEvidence(new File([new Uint8Array(MAX_SOURCE_PHOTO_BYTES + 1)], "huge.jpg", { type: "image/jpeg" })), /over 20 MB/);
});

test("server content signatures and file-type checks still apply after the size change", async () => {
  await assert.rejects(validate(new File(["pretend image"], "photo.jpg", { type: "image/jpeg" })), /contents do not match/);
  await assert.rejects(validate(new File(["<svg>"], "photo.svg", { type: "image/svg+xml" })), /Upload a PDF, JPG, PNG, or WebP/);
  await assert.rejects(validate(new File([], "empty.pdf", { type: "application/pdf" })), /Choose a PDF, JPG, PNG, or WebP/);
});

test("the scanner rejects an oversized stored object before contacting the vendor or clearing quarantine", async () => {
  const records = [];
  let vendorCalls = 0;
  const scanner = stripTypeScriptTypes(await readFile(new URL("../lib/cloudmersive-evidence-scanner.ts", import.meta.url), "utf8"), { mode: "transform" })
    .replace(/^import\s[\s\S]*?from\s+"[^"]+";\s*/gm, "")
    .replace(/^export /gm, "");
  const bindings = {
    MAX_EVIDENCE_BYTES,
    getProviderEvidence: async () => ({ body: new Blob([new Uint8Array(MAX_EVIDENCE_BYTES + 1)]).stream() }),
    recordAuthenticatedEvidenceScanResult: async record => { records.push(record); return { status: 200 }; },
    fetch: () => { vendorCalls += 1; throw new Error("must not upload oversize evidence"); },
    CLOUDMERSIVE_PROVIDER: "cloudmersive",
    CLOUDMERSIVE_ENGINE_VERSION: "fixture",
  };
  const scan = compileFunction(`${scanner}\nreturn processOnePendingScan;`, Object.keys(bindings))(...Object.values(bindings));
  assert.equal(await scan({ scanRequestId: "fixture-scan", evidenceId: "fixture-document", fileHash: "f".repeat(64) }, "unused"), "error");
  assert.equal(vendorCalls, 0);
  assert.equal(records.length, 1);
  assert.equal(records[0].status, "error");
});
