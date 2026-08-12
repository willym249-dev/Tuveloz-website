import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  DOCUMENT_READER_SYSTEM_PROMPT,
  documentIsReadable,
  documentNameCheck,
  documentReadPrompt,
  parseDocumentRead,
} from "../lib/evidence-document-reader.ts";
import { cacheKeyFor, DEFAULT_COUNCIL_MODELS } from "../lib/ai/council.ts";
import { attachmentMediaTypeSupported } from "../lib/ai/providers.ts";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

const EMPTY = {
  businessName: "",
  personName: "",
  documentNumber: "",
  issuer: "",
  issuedOn: "",
  expiresOn: "",
};

test("a well-formed reply is transcribed verbatim, not tidied", () => {
  const { fields, unreadable } = parseDocumentRead(JSON.stringify({
    businessName: "Willy's Auto Repair, L.L.C.",
    personName: "Guillermo Reyes",
    documentNumber: "MVR-100244",
    issuer: "Montgomery County OCP",
    issuedOn: "2026-01-15",
    expiresOn: "2027-01-14",
    unreadable: [],
  }));
  // Punctuation and entity form are preserved: the owner is comparing this to
  // a registry entry, and a "cleaned up" name hides the very mismatch that
  // matters.
  assert.equal(fields.businessName, "Willy's Auto Repair, L.L.C.");
  assert.equal(fields.documentNumber, "MVR-100244");
  assert.equal(fields.expiresOn, "2027-01-14");
  assert.deepEqual(unreadable, []);
});

test("a markdown-fenced reply is still the same reply", () => {
  const { fields } = parseDocumentRead(
    '```json\n{"businessName":"Sunrise Motors","personName":"","documentNumber":"","issuer":"","issuedOn":"","expiresOn":"","unreadable":[]}\n```',
  );
  assert.equal(fields.businessName, "Sunrise Motors");
});

test("an unusable reply yields nothing, never a partial guess", () => {
  for (const raw of ["", "I could not read this document.", "{ broken", "null", "[]"]) {
    const { fields, unreadable } = parseDocumentRead(raw);
    assert.deepEqual(fields, EMPTY, `"${raw}" produced fields`);
    assert.ok(unreadable.length > 0, `"${raw}" produced no explanation`);
  }
});

test("a date in the wrong format is dropped and reported, not reinterpreted", () => {
  // "03/04/2027" is March 4 or April 3 depending on where it was printed.
  // Guessing would put a wrong expiry into a compliance record.
  const { fields, unreadable } = parseDocumentRead(JSON.stringify({
    ...EMPTY,
    expiresOn: "03/04/2027",
    unreadable: [],
  }));
  assert.equal(fields.expiresOn, "");
  assert.ok(unreadable.some((note) => /expiration date was not readable/.test(note)));
});

test("the reader is instructed to transcribe and forbidden to judge", () => {
  assert.match(DOCUMENT_READER_SYSTEM_PROMPT, /You do not judge it/);
  assert.match(DOCUMENT_READER_SYSTEM_PROMPT, /Never guess a value/);
  assert.match(DOCUMENT_READER_SYSTEM_PROMPT, /Do NOT state whether the document is genuine/);
  // And it is told not to be steered by the name it was given.
  assert.match(
    documentReadPrompt({ requirementLabel: "COI", applicationBusinessName: "Willy's Auto" }),
    /Do not let that influence what you read/,
  );
});

test("only file types every provider can read are sent", () => {
  assert.equal(documentIsReadable({ mediaType: "application/pdf", byteLength: 1000 }).ok, true);
  assert.equal(documentIsReadable({ mediaType: "image/png", byteLength: 1000 }).ok, true);
  assert.equal(documentIsReadable({ mediaType: "text/html", byteLength: 1000 }).ok, false);
  assert.equal(documentIsReadable({ mediaType: "", byteLength: 1000 }).ok, false);
  assert.equal(documentIsReadable({ mediaType: "image/png", byteLength: 0 }).ok, false);
  assert.equal(
    documentIsReadable({ mediaType: "image/png", byteLength: 11 * 1024 * 1024 }).ok,
    false,
  );
  assert.equal(attachmentMediaTypeSupported("IMAGE/PNG"), true);
});

test("two different documents never share a cached answer", async () => {
  const base = { question: "Transcribe it.", system: "S", mode: "quick", maxTokens: 700 };
  const [a, b, none] = await Promise.all([
    cacheKeyFor({ ...base, attachments: [{ mediaType: "image/png", data: "AAAA" }] }, DEFAULT_COUNCIL_MODELS),
    cacheKeyFor({ ...base, attachments: [{ mediaType: "image/png", data: "BBBB" }] }, DEFAULT_COUNCIL_MODELS),
    cacheKeyFor(base, DEFAULT_COUNCIL_MODELS),
  ]);
  // Same prompt, different file. Colliding here would report one provider's
  // certificate as another provider's.
  assert.notEqual(a, b);
  assert.notEqual(a, none);
});

test("the reading step can never decide a review outcome", async () => {
  const route = await source("app/api/admin/provider-compliance/route.ts");
  const block = route.slice(
    route.indexOf('if (action === "read-evidence-document")'),
    route.indexOf('if (action === "initialize-provider-pathway")'),
  );
  assert.ok(block.length > 500);

  // It reads and returns. It never writes a review status, an acceptance, or
  // an eligibility change.
  assert.doesNotMatch(block, /providerEvidenceSubmissions\)\s*\.set|\.update\(providerEvidenceSubmissions/);
  assert.doesNotMatch(block, /status: "accepted"|status: "rejected"|status: "needs_correction"/);

  // A file whose scan is not clean is never opened, machine or not.
  assert.match(block, /scan\?\.status !== "clean"/);
  // The document leaving Tuveloz is recorded.
  assert.match(block, /evidence_document_read/);
  assert.match(block, /outcome: "read_only_no_decision"/);
});

test("the transcription is not stored as a second copy of the document", async () => {
  const route = await source("app/api/admin/provider-compliance/route.ts");
  const block = route.slice(
    route.indexOf('if (action === "read-evidence-document")'),
    route.indexOf('if (action === "initialize-provider-pathway")'),
  );
  // The audit row records that a read happened and by which model — not the
  // values read. Storing those would create an unreviewed copy of a private
  // document's contents outside the protections the original has.
  const metadata = block.slice(block.indexOf("metadata: {"), block.indexOf("});", block.indexOf("metadata: {")));
  for (const field of ["businessName", "documentNumber", "personName", "issuer"]) {
    assert.ok(!metadata.includes(field), `the audit row stored ${field}`);
  }
});

test("the owner is told a reading is not a verification", async () => {
  const page = await source("app/admin/provider-compliance/page.tsx");
  assert.match(page, /a forged document reads exactly like a real one/);
  assert.match(page, /It fills nothing in below/);
  assert.match(page, /section 5 of the Privacy Policy/);
});

test("nothing read off the document pre-fills the external-check fields", async () => {
  const page = await source("app/admin/provider-compliance/page.tsx");
  // Those fields record the check against the issuing authority. Seeding any
  // of them from the submitted document would record the document vouching
  // for itself.
  for (const field of [
    "authenticitySourceUrl",
    "authenticityVerificationReference",
    "verifiedLegalBusinessName",
  ]) {
    assert.doesNotMatch(
      page,
      new RegExp(`name="${field}"[\\s\\S]{0,300}read\\??\\.fields`),
      `${field} is seeded from the document reading`,
    );
    assert.doesNotMatch(page, new RegExp(`defaultValue=\\{read[\\s\\S]{0,80}${field}`));
  }
});

test("names on the document and the application are compared", () => {
  assert.equal(documentNameCheck("Willy's Auto Repair LLC", "Sunrise Motors").comparison, "different");
  assert.equal(documentNameCheck("Willys Auto Repair LLC", "Willy's Auto Repair, L.L.C.").comparison, "equivalent");
  // Nothing to compare is not a finding.
  assert.equal(documentNameCheck("", "Willy's Auto"), null);
  assert.equal(documentNameCheck("Willy's Auto", ""), null);
  assert.equal(documentNameCheck("Willy's Auto", "willy's auto"), null);
});
