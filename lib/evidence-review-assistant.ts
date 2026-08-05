// A conservative, deterministic pre-screen for the owner's private evidence
// queue. It reads only the structured facts TUVELOZ already stores about a
// submission (its review status, malware-scan result, dates, and whether it
// still matches the applicant's current exact service, pathway, assigned
// person, and jurisdiction) and returns a suggested next step.
//
// Deliberate safety boundaries — this assistant NEVER decides an acceptance.
// Accepting evidence is the owner's liability-bearing act: it legally requires
// a human external authenticity check against the issuing authority, insurer,
// or approved vendor, which reading stored fields cannot establish. So the only
// decision this assistant will auto-apply is a factual, reversible correction
// request for a provably expired or undated document. Everything else is only a
// recommendation a human confirms. No private file content or personal data is
// read or sent anywhere; this runs entirely on structured metadata.

export type EvidencePrescreenRecommendation =
  | "not_awaiting_review"
  | "reject_mismatch"
  | "needs_correction_expired"
  | "hold_scan_not_clean"
  | "ready_for_authenticity_check";

export type EvidenceAutoDispatch = {
  // Only ever a negative, provider-correctable outcome. Never "accepted".
  status: "needs_correction";
  reasonCode: "expired_or_invalid_date";
  note: string;
};

export type EvidencePrescreen = {
  recommendation: EvidencePrescreenRecommendation;
  headline: string;
  reasons: readonly string[];
  // Populated only when the outcome is factual, safe, and reversible enough to
  // apply in bulk without a human confirming each one. Null for everything a
  // human must weigh — including every acceptance.
  autoDispatch: EvidenceAutoDispatch | null;
  // True only when the automatic checks pass and the sole remaining step is the
  // owner's external authenticity verification before accepting. It never means
  // "accept this" — it means "a human may now do the check that could accept it".
  readyForOwnerAuthenticityCheck: boolean;
};

export type EvidencePrescreenFacts = {
  // The provider submission's current review status.
  submissionStatus: string;
  // Whether the submission still matches the applicant's current exact service,
  // pathway, assigned person (for person-bound evidence), and jurisdiction.
  matchesCurrentApplication: boolean;
  // Whether this evidence type must carry an expiration date.
  requiresExpiration: boolean;
  // Whether the submission carries any expiration date.
  hasExpirationDate: boolean;
  // Whether a supplied expiration date is already in the past.
  isExpired: boolean;
  // Whether a private file is attached (vs. a structured-only attestation).
  hasPrivateFile: boolean;
  // Latest malware-scan status for the attached file.
  scanStatus: string;
};

// This note is stored verbatim as the provider-facing reason and is not
// re-localized when displayed, so it is written bilingually (English + Spanish)
// to match TUVELOZ's English/Spanish audience.
const EXPIRED_NOTE =
  "This document is missing a valid expiration date or is not current through "
  + "today, so it cannot be accepted as-is. Please upload a current document "
  + "that has not expired and we will review it."
  + "\n\nEspañol: Este documento no tiene una fecha de vencimiento válida o no "
  + "está vigente hasta hoy, por lo que no se puede aceptar tal como está. Suba "
  + "un documento vigente que no haya vencido y lo revisaremos.";

export function prescreenEvidence(
  facts: EvidencePrescreenFacts,
): EvidencePrescreen {
  // Only a submission actually waiting for a decision is pre-screened.
  if (facts.submissionStatus !== "pending") {
    return {
      recommendation: "not_awaiting_review",
      headline: "No suggestion — this document is not awaiting a decision.",
      reasons: [],
      autoDispatch: null,
      readyForOwnerAuthenticityCheck: false,
    };
  }

  // A submission that no longer lines up with the applicant's current exact
  // service, pathway, assigned person, or jurisdiction should not be accepted.
  // This is flagged for a human rather than auto-sent, because a mismatch can
  // be the result of a recent owner change and deserves a look.
  if (!facts.matchesCurrentApplication) {
    return {
      recommendation: "reject_mismatch",
      headline: "Recommend reject — no longer matches the current application.",
      reasons: [
        "The exact service, pathway, assigned person, or jurisdiction on this "
        + "submission does not match the applicant's current requirement.",
      ],
      autoDispatch: null,
      readyForOwnerAuthenticityCheck: false,
    };
  }

  // A provably expired or undated document cannot be accepted under the review
  // rules. This single outcome is factual, reversible, and provider-friendly,
  // so it is the only one the bulk pre-screen will apply on its own.
  if ((facts.requiresExpiration && !facts.hasExpirationDate) || facts.isExpired) {
    return {
      recommendation: "needs_correction_expired",
      headline: "Recommend correction — expired or missing expiration date.",
      reasons: [
        facts.isExpired
          ? "The expiration date on this document is already in the past."
          : "This evidence type requires an expiration date and none was supplied.",
      ],
      autoDispatch: {
        status: "needs_correction",
        reasonCode: "expired_or_invalid_date",
        note: EXPIRED_NOTE,
      },
      readyForOwnerAuthenticityCheck: false,
    };
  }

  // An attached file whose latest malware scan is not clean can never be
  // accepted. It is surfaced but not auto-actioned: a non-clean result has its
  // own owner-recorded flow, and a still-pending scan may simply clear shortly.
  if (facts.hasPrivateFile && facts.scanStatus !== "clean") {
    const settled = facts.scanStatus === "failed"
      || facts.scanStatus === "infected"
      || facts.scanStatus === "error";
    return {
      recommendation: "hold_scan_not_clean",
      headline: settled
        ? "Blocked — the file's malware scan is not clean."
        : "Waiting — the file's malware scan is not clean yet.",
      reasons: [
        `The latest malware scan is "${facts.scanStatus || "missing"}". The file `
        + "cannot be opened or accepted until it reports clean.",
      ],
      autoDispatch: null,
      readyForOwnerAuthenticityCheck: false,
    };
  }

  // Every automatic check passed. The only remaining step before acceptance is
  // the owner's external authenticity verification, which a person must perform.
  return {
    recommendation: "ready_for_authenticity_check",
    headline: "Automatic checks pass — complete your external authenticity check to accept.",
    reasons: [
      facts.hasPrivateFile
        ? "The malware scan is clean."
        : "This is a structured attestation with no attached file.",
      "Any required dates are present and current.",
      "It matches the applicant's current exact service and requirement.",
    ],
    autoDispatch: null,
    readyForOwnerAuthenticityCheck: true,
  };
}
