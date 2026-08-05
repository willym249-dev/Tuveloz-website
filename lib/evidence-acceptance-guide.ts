// Guidance and pre-submit validation for the owner's evidence-acceptance step.
//
// Accepting evidence is the owner's liability-bearing act: it requires a real
// external authenticity check against the issuing authority, insurer, or an
// approved vendor. This module does not perform or replace that check. It only
// (1) tells the owner which authority to verify against and which method fits,
// and (2) mirrors the server's acceptance rules so an incomplete or inconsistent
// entry is caught with a plain-language message before it is submitted, instead
// of coming back as a raw server error. The server remains the source of truth.

export const EVIDENCE_AUTHENTICITY_METHOD_VALUES = [
  "official_online_lookup",
  "issuer_direct_confirmation",
  "insurer_or_broker_confirmation",
  "approved_verification_vendor",
] as const;

export type AcceptanceMethod = (typeof EVIDENCE_AUTHENTICITY_METHOD_VALUES)[number];

export type AcceptanceGuide = {
  authorityLabel: string;
  recommendedMethod: AcceptanceMethod;
  steps: readonly string[];
};

const INSURER_METHOD: AcceptanceMethod = "insurer_or_broker_confirmation";
const OFFICIAL_METHOD: AcceptanceMethod = "official_online_lookup";
const ISSUER_METHOD: AcceptanceMethod = "issuer_direct_confirmation";
const VENDOR_METHOD: AcceptanceMethod = "approved_verification_vendor";

// Per-requirement guidance. Keys are evidence requirement codes; anything not
// listed falls back to a safe issuer-confirmation default.
const GUIDE_BY_REQUIREMENT: Record<string, AcceptanceGuide> = {
  ocp_vehicle_service_registration: {
    authorityLabel: "Montgomery County Office of Consumer Protection",
    recommendedMethod: OFFICIAL_METHOD,
    steps: [
      "Look up the certificate on the county's official government (.gov) system.",
      "Confirm the exact legal business name and that the certificate is active and unexpired.",
    ],
  },
  md_locksmith_business_license: {
    authorityLabel: "Maryland locksmith licensing authority",
    recommendedMethod: OFFICIAL_METHOD,
    steps: [
      "Verify the license on the state's official government (.gov) lookup.",
      "Confirm the exact legal business name and active status.",
    ],
  },
  md_locksmith_technician_registration: {
    authorityLabel: "Maryland locksmith licensing authority",
    recommendedMethod: OFFICIAL_METHOD,
    steps: [
      "Verify the technician/employee registration on the official government (.gov) lookup.",
      "Confirm the registration is tied to this exact person and is current.",
    ],
  },
  mva_inspection_station_license: {
    authorityLabel: "Maryland State Police / MVA inspection program",
    recommendedMethod: OFFICIAL_METHOD,
    steps: ["Verify the station license on the official government (.gov) source and confirm it is active."],
  },
  mva_inspection_mechanic_license: {
    authorityLabel: "Maryland State Police / MVA inspection program",
    recommendedMethod: OFFICIAL_METHOD,
    steps: ["Verify the inspection mechanic license on the official government (.gov) source for this exact person."],
  },
  ocp_towing_registration: {
    authorityLabel: "Montgomery County Office of Consumer Protection",
    recommendedMethod: OFFICIAL_METHOD,
    steps: ["Verify the towing registration on the county's official government (.gov) system."],
  },
  motor_fuel_registration: {
    authorityLabel: "Maryland motor-fuel registration authority",
    recommendedMethod: OFFICIAL_METHOD,
    steps: ["Verify the registration on the official government (.gov) source and confirm it is current."],
  },
  general_liability_coi: {
    authorityLabel: "The issuing insurer or licensed broker",
    recommendedMethod: INSURER_METHOD,
    steps: [
      "Confirm the certificate directly with the insurer or broker, not from the PDF alone.",
      "Check the named insured, coverage, limits, and that the policy is in force for the dates.",
    ],
  },
  business_auto_coverage: {
    authorityLabel: "The issuing insurer or licensed broker",
    recommendedMethod: INSURER_METHOD,
    steps: ["Confirm commercial/business-use auto coverage directly with the insurer or broker."],
  },
  broker_coverage_determination: {
    authorityLabel: "The licensed broker of record",
    recommendedMethod: INSURER_METHOD,
    steps: ["Confirm the broker's coverage determination for the exact operation directly with the broker."],
  },
  workers_comp_coverage: {
    authorityLabel: "The workers' compensation insurer or broker",
    recommendedMethod: INSURER_METHOD,
    steps: ["Confirm active workers' compensation coverage directly with the insurer or broker."],
  },
  towing_custody_coverage: {
    authorityLabel: "The issuing insurer or licensed broker",
    recommendedMethod: INSURER_METHOD,
    steps: ["Confirm on-hook, custody, and garagekeepers coverage directly with the insurer or broker."],
  },
  epa_section_609_certificate: {
    authorityLabel: "The EPA-approved Section 609 certifying program",
    recommendedMethod: ISSUER_METHOD,
    steps: ["Confirm the certificate directly with the approved certifying program for this exact person."],
  },
  provisional_service_competency: {
    authorityLabel: "The approved competency verification vendor or issuing program",
    recommendedMethod: VENDOR_METHOD,
    steps: [
      "Confirm the service-specific competency evidence with the approved vendor or issuing program.",
      "Confirm it covers this exact service and this exact person.",
    ],
  },
  window_tint_compliance_controls: {
    authorityLabel: "The approved compliance/meter-control vendor or issuer",
    recommendedMethod: VENDOR_METHOD,
    steps: ["Confirm the tint compliance and meter controls with the approved vendor or issuer."],
  },
  ev_high_voltage_package: {
    authorityLabel: "The approved EV high-voltage training/equipment provider",
    recommendedMethod: VENDOR_METHOD,
    steps: ["Confirm the high-voltage training, PPE, tools, and facility package with the approved provider."],
  },
};

const DEFAULT_GUIDE: AcceptanceGuide = {
  authorityLabel: "The document's issuing authority or organization",
  recommendedMethod: ISSUER_METHOD,
  steps: [
    "Confirm the document directly with the issuing authority or organization — not from its appearance.",
    "Confirm it covers this exact service and is current for the job dates.",
  ],
};

export function acceptanceGuideFor(requirementKey: string): AcceptanceGuide {
  return GUIDE_BY_REQUIREMENT[requirementKey] ?? DEFAULT_GUIDE;
}

export type AcceptanceDraft = {
  method: string;
  verifiedBy: string;
  reference: string;
  sourceUrl: string;
  verifiedAt: string; // yyyy-mm-dd
  validThrough: string; // yyyy-mm-dd
  evidenceExpiresAt: string; // yyyy-mm-dd or ""
  requiresBusinessIdentity: boolean;
  legalBusinessName: string;
  legalBusinessNameConfirmed: boolean;
  today: string; // yyyy-mm-dd, supplied by the caller so this stays deterministic
};

export type AcceptanceValidation = {
  ok: boolean;
  errors: readonly string[];
};

function dayStart(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed) ? parsed : null;
}

function dayEnd(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = Date.parse(`${value}T23:59:59.999Z`);
  return Number.isFinite(parsed) ? parsed : null;
}

function httpsValid(value: string) {
  if (!value || value.length > 500) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}

function govHttpsValid(value: string) {
  if (!httpsValid(value)) return false;
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host.endsWith(".gov") && host.length > ".gov".length;
  } catch {
    return false;
  }
}

// Mirrors the server's acceptance guards so the owner sees any problem before
// submitting. Kept intentionally in lock-step with evidenceAuthenticityIsCurrent
// and the acceptance route; the server still enforces the real decision.
export function validateAcceptanceDraft(draft: AcceptanceDraft): AcceptanceValidation {
  const errors: string[] = [];
  const method = draft.method.trim();
  if (!EVIDENCE_AUTHENTICITY_METHOD_VALUES.includes(method as AcceptanceMethod)) {
    errors.push("Choose how you verified this document (the external method).");
  }
  if (draft.verifiedBy.trim().length < 2) {
    errors.push("Enter who performed the external check.");
  }
  if (draft.reference.trim().length < 8) {
    errors.push("Enter the external result or case reference (at least 8 characters).");
  }
  if (method === "official_online_lookup") {
    if (!govHttpsValid(draft.sourceUrl.trim())) {
      errors.push("An official online lookup must use an official government (.gov) https source.");
    }
  } else if (!httpsValid(draft.sourceUrl.trim())) {
    errors.push("Enter a secure https source URL for where you verified this.");
  }

  const verifiedAt = dayStart(draft.verifiedAt);
  const today = dayStart(draft.today);
  const todayEnd = dayEnd(draft.today);
  if (verifiedAt === null || todayEnd === null || verifiedAt > todayEnd) {
    errors.push("Enter a valid checked date that is not in the future.");
  }
  const validThrough = dayEnd(draft.validThrough);
  if (validThrough === null || (today !== null && validThrough < today)) {
    errors.push("Enter an authenticity-valid-through date that is today or later.");
  }

  if (draft.evidenceExpiresAt) {
    const expiry = dayEnd(draft.evidenceExpiresAt);
    if (validThrough !== null && expiry !== null && validThrough > expiry) {
      errors.push("The authenticity check cannot stay valid after the document itself expires.");
    }
  } else if (verifiedAt !== null && validThrough !== null) {
    const maximum = new Date(verifiedAt);
    maximum.setUTCFullYear(maximum.getUTCFullYear() + 1);
    maximum.setUTCHours(23, 59, 59, 999);
    if (validThrough > maximum.getTime()) {
      errors.push(
        "Without a document expiration date, the authenticity check must be re-done within "
        + "one year of the checked date.",
      );
    }
  }

  if (draft.requiresBusinessIdentity) {
    if (draft.legalBusinessName.trim().length < 2 || !draft.legalBusinessNameConfirmed) {
      errors.push("Enter and confirm the exact legal business name from the verified source.");
    }
  }

  return { ok: errors.length === 0, errors };
}
