// Reads what is printed on a provider's compliance document and compares it to
// what the application says. A transcription step, not a decision.
//
// The line this module does not cross
// ------------------------------------
// A forged certificate looks exactly like a real one — that is what forging
// is for. Nothing readable in a document can establish that the document is
// genuine; only the issuing authority, insurer, or approved vendor can. So
// this module extracts and compares, and the acceptance route still requires
// the six authenticity fields a person fills in after doing that external
// check. Nothing here can accept, reject, or limit anything.
//
// What that leaves is real work: reading the name, number, issuer, and dates
// off a scan so the owner is confirming a filled-in form instead of typing one,
// and saying plainly where the document and the application disagree.
//
// Privacy: this sends a private provider evidence file to a third-party model
// provider. That disclosure is section 5 of the Privacy Policy, and the file
// goes as bytes in the request body — never as a fetchable URL, which would
// mean making a private object public.

import { attachmentMediaTypeSupported } from "./ai/providers.ts";
import { compareBusinessNames, type BusinessNameCheck } from "./business-name-match.ts";

/** Above this, a scan is rejected rather than sent. Mirrors the upload limit. */
export const MAX_READABLE_DOCUMENT_BYTES = 10 * 1024 * 1024;

export type DocumentReadFields = {
  /** Exactly as printed, not normalized. "" when not visible on the document. */
  businessName: string;
  personName: string;
  documentNumber: string;
  issuer: string;
  /** yyyy-mm-dd, or "" when absent or unreadable. */
  issuedOn: string;
  expiresOn: string;
};

export type DocumentReadResult = {
  fields: DocumentReadFields;
  /** Anything the model could not read, in its own words, for the owner. */
  unreadable: readonly string[];
  /** Name comparison against the application, when both names exist. */
  nameCheck: BusinessNameCheck | null;
  /** Recorded so a stale reading is never mistaken for a fresh one. */
  model: string;
  readAt: string;
};

export const DOCUMENT_READER_SYSTEM_PROMPT = [
  "You transcribe what is printed on a business compliance document. You do not judge it.",
  "Return ONLY a JSON object with these exact keys and no prose around it:",
  '{"businessName":"","personName":"","documentNumber":"","issuer":"","issuedOn":"","expiresOn":"","unreadable":[]}',
  "Rules:",
  "- Copy values exactly as printed, including punctuation and entity form (LLC, Inc.). Do not tidy, expand, or correct them.",
  "- Dates must be yyyy-mm-dd. If a date is printed ambiguously, leave it empty and say so in unreadable.",
  "- Use an empty string for any field that is not present on the document. Never guess a value.",
  "- Never infer a value from context, from the file name, or from what a document of this type usually says.",
  "- Put a short plain-language note in unreadable for anything blurred, cut off, handwritten, or ambiguous.",
  "- Do NOT state whether the document is genuine, valid, sufficient, or acceptable. That is not your task and you cannot determine it.",
  "- If the file is not a compliance document at all, return empty fields and say what it appears to be in unreadable.",
].join("\n");

export function documentReadPrompt(input: {
  requirementLabel: string;
  applicationBusinessName: string;
}) {
  return [
    `This document was submitted as: ${input.requirementLabel}.`,
    input.applicationBusinessName
      ? `The applicant's business name on file is "${input.applicationBusinessName}". Do not let that influence what you read — transcribe the document, even if it disagrees.`
      : "No business name is on file for this applicant.",
    "Transcribe it now as the JSON object described.",
  ].join("\n");
}

/**
 * Parses the model's reply.
 *
 * Deliberately strict and non-recovering: a reply that is not the expected
 * shape yields empty fields plus a note, never a partial guess. A half-read
 * document silently presented as a full one is the failure that would put a
 * wrong number into a compliance record.
 */
export function parseDocumentRead(raw: string): {
  fields: DocumentReadFields;
  unreadable: string[];
} {
  const empty: DocumentReadFields = {
    businessName: "",
    personName: "",
    documentNumber: "",
    issuer: "",
    issuedOn: "",
    expiresOn: "",
  };
  // Models fence JSON in markdown often enough that stripping it is not
  // "recovering from a bad reply", it is reading the same reply.
  const text = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) {
    return { fields: empty, unreadable: ["The reader did not return a readable result."] };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return { fields: empty, unreadable: ["The reader did not return a readable result."] };
  }
  if (!parsed || typeof parsed !== "object") {
    return { fields: empty, unreadable: ["The reader did not return a readable result."] };
  }

  const record = parsed as Record<string, unknown>;
  const str = (key: string, max = 200) => (
    typeof record[key] === "string" ? record[key].trim().slice(0, max) : ""
  );
  const date = (key: string) => {
    const value = str(key, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
  };

  const unreadable = Array.isArray(record.unreadable)
    ? record.unreadable
      .filter((note): note is string => typeof note === "string" && note.trim().length > 0)
      .map((note) => note.trim().slice(0, 300))
      .slice(0, 10)
    : [];

  // A date the model wrote in some other format is not silently dropped —
  // the owner is told it was there and unusable.
  for (const key of ["issuedOn", "expiresOn"] as const) {
    if (str(key, 40) && !date(key)) {
      unreadable.push(`The ${key === "issuedOn" ? "issue" : "expiration"} date was not readable as a calendar date.`);
    }
  }

  return {
    fields: {
      businessName: str("businessName"),
      personName: str("personName"),
      documentNumber: str("documentNumber", 120),
      issuer: str("issuer"),
      issuedOn: date("issuedOn"),
      expiresOn: date("expiresOn"),
    },
    unreadable,
  };
}

/** Refuses anything the providers cannot read, before any bytes are sent. */
export function documentIsReadable(input: { mediaType: string; byteLength: number }) {
  if (!attachmentMediaTypeSupported(input.mediaType)) {
    return { ok: false as const, reason: "This file type cannot be read automatically." };
  }
  if (input.byteLength <= 0 || input.byteLength > MAX_READABLE_DOCUMENT_BYTES) {
    return { ok: false as const, reason: "This file is too large to read automatically." };
  }
  return { ok: true as const, reason: "" };
}

/** Compares the transcribed business name against the one on the application. */
export function documentNameCheck(
  documentBusinessName: string,
  applicationBusinessName: string,
): BusinessNameCheck | null {
  if (!documentBusinessName.trim() || !applicationBusinessName.trim()) return null;
  const check = compareBusinessNames(documentBusinessName, applicationBusinessName, {
    left: "The name printed on the document",
    right: "the name on the application",
  });
  return check.needsReview ? check : null;
}

export function toBase64(bytes: ArrayBuffer) {
  const view = new Uint8Array(bytes);
  let binary = "";
  // Chunked: spreading a multi-megabyte array into String.fromCharCode at once
  // overflows the call stack.
  const chunk = 0x8000;
  for (let index = 0; index < view.length; index += chunk) {
    binary += String.fromCharCode(...view.subarray(index, index + chunk));
  }
  return btoa(binary);
}
