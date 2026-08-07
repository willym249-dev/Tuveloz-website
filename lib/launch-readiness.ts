import { officialSourceReferenceIsValid } from "./legal-compliance-evidence";

export type LaunchReviewStage = "provider_onboarding" | "transaction_pilot";

export type LaunchGateAuthority =
  | "TUVELOZ owner"
  | "Official legal or licensing source"
  | "Insurance broker or carrier"
  | "CPA or tax adviser"
  | "Payment processor"
  | "Security or privacy reviewer"
  | "Identity or business verification provider"
  | "Screening or compliance reviewer";

export type LaunchGateStatus = "pending" | "approved" | "blocked" | "not_applicable";

export type LaunchAuthorityApproval = {
  authority: LaunchGateAuthority;
  approvedBy: string;
  evidenceReference: string;
  approvedAt: string;
  validThrough: string;
};

export type LaunchGateDefinition = {
  key: string;
  stage: LaunchReviewStage;
  category: string;
  title: string;
  plainLanguage: string;
  authority: readonly LaunchGateAuthority[];
  required: boolean;
  requiresValidThrough?: boolean;
  acceptedOfficialSourceReferences?: readonly string[];
};

const OFFICIAL_SOURCE = {
  electronicAcceptance:
    "https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gcl&section=21-106",
  montgomeryRepairRegistration:
    "https://www.montgomerycountymd.gov/OCP/licensing/mvr_tow_main.html",
  marylandBusinessRecords:
    "https://dat.maryland.gov/pages/services.aspx",
  marylandPrivacy:
    "https://oag.maryland.gov/resources-info/Pages/data-privacy.aspx",
  marylandDataBreach:
    "https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gcl&section=14-3504",
  consumerProtection:
    "https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gcl&section=13-301",
  repairAuthorization:
    "https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gcl&section=14-1008",
  repairInvoice:
    "https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gcl&section=14-1003",
  screening:
    "https://www.ftc.gov/business-guidance/resources/background-checks-what-employers-need-know",
} as const;

export const OWNER_LEGAL_REVIEW_CHOICE_GATE_KEY = "owner_legal_review_choice";

export const OWNER_LEGAL_REVIEW_ACKNOWLEDGEMENT =
  "I understand that proceeding without counsel is an owner choice, not legal approval, and does not remove or satisfy any applicable legal, licensing, insurance, tax, payment, privacy, security, identity-verification, service-matrix, or provider-of-record requirement.";

export type OwnerLegalReviewChoice = {
  format: "tuveloz_owner_legal_review_choice_v1";
  decision: "proceeding_without_counsel";
  scope: string;
  acknowledgedNoLegalApproval: true;
  acknowledgedMandatoryRequirementsRemain: true;
  acknowledgement: typeof OWNER_LEGAL_REVIEW_ACKNOWLEDGEMENT;
  decidedAt: string;
  decidedBy: string;
};

export function encodeOwnerLegalReviewChoice(choice: OwnerLegalReviewChoice) {
  return JSON.stringify(choice);
}

/**
 * These are evidence gates, not switches. Recording a decision here never
 * enables services, customer requests, Stripe live mode, or provider access.
 */
export const LAUNCH_GATE_CATALOG: readonly LaunchGateDefinition[] = [
  {
    key: "entity_authority_domain_and_code",
    stage: "provider_onboarding",
    category: "business",
    title: "Company authority, domain, code, and vendor rights confirmed",
    plainLanguage: "Confirm TUVELOZ LLC records, ownership authority, domain control, code ownership, contractor assignments, and essential vendor contracts.",
    authority: ["TUVELOZ owner"],
    required: true,
    requiresValidThrough: true,
  },
  {
    key: "provider_onboarding_legal_requirements",
    stage: "provider_onboarding",
    category: "legal",
    title: "Provider-onboarding legal requirements documented and implemented",
    plainLanguage: "Map the official requirements that actually apply to the provider application, agreements, electronic acceptance, evidence requests, corrections, and appeals; keep the source references and implementation record.",
    authority: ["TUVELOZ owner", "Official legal or licensing source"],
    required: true,
    requiresValidThrough: true,
    acceptedOfficialSourceReferences: [OFFICIAL_SOURCE.electronicAcceptance],
  },
  {
    key: "provider_evidence_and_insurance_matrix",
    stage: "provider_onboarding",
    category: "provider compliance",
    title: "Exact-service legal evidence and insurance matrix verified",
    plainLanguage: "Official legal or licensing sources and the insurance reviewer identify what evidence and coverage each exact service and location requires. Services without both records remain disabled.",
    authority: ["Official legal or licensing source", "Insurance broker or carrier"],
    required: true,
    requiresValidThrough: true,
    acceptedOfficialSourceReferences: [OFFICIAL_SOURCE.montgomeryRepairRegistration],
  },
  {
    key: "provider_identity_and_business_verification",
    stage: "provider_onboarding",
    category: "provider compliance",
    title: "Provider identity and business-verification process verified",
    plainLanguage: "The actual verification provider, official registration sources, and the security reviewer confirm matching rules, audit references, correction paths, and truthful public wording. Owner checkboxes alone are not sufficient verification.",
    authority: ["Identity or business verification provider", "Official legal or licensing source", "Security or privacy reviewer"],
    required: true,
    requiresValidThrough: true,
    acceptedOfficialSourceReferences: [OFFICIAL_SOURCE.marylandBusinessRecords],
  },
  {
    key: "privacy_retention_and_data_rights",
    stage: "provider_onboarding",
    category: "privacy",
    title: "Privacy, retention, deletion, and legal-hold requirements verified",
    plainLanguage: "Document the applicable official requirements and verify what TUVELOZ collects, why it is collected, who can access it, how long it stays, how requests are verified, and when deletion must pause for a legal hold.",
    authority: ["Official legal or licensing source", "Security or privacy reviewer"],
    required: true,
    requiresValidThrough: true,
    acceptedOfficialSourceReferences: [OFFICIAL_SOURCE.marylandPrivacy],
  },
  {
    key: "evidence_file_security_and_scanner",
    stage: "provider_onboarding",
    category: "security",
    title: "Private-file security and malware scanner verified",
    plainLanguage: "Confirm restricted storage, access logs, download controls, backups, deletion behavior, and a real external malware scanner. A pending scan must keep evidence quarantined.",
    authority: ["Security or privacy reviewer"],
    required: true,
    requiresValidThrough: true,
  },
  {
    key: "security_and_data_incident_plan",
    stage: "provider_onboarding",
    category: "security",
    title: "Security and data-incident plan tested",
    plainLanguage: "Assign the responsible person, escalation contacts, evidence-preservation steps, account containment, required legal notices, and vendor notification procedure.",
    authority: ["TUVELOZ owner", "Official legal or licensing source", "Security or privacy reviewer"],
    required: true,
    requiresValidThrough: true,
    acceptedOfficialSourceReferences: [OFFICIAL_SOURCE.marylandDataBreach],
  },
  {
    key: "customer_workflow_and_terms_requirements",
    stage: "transaction_pilot",
    category: "legal",
    title: "Customer workflow and core legal requirements verified",
    plainLanguage: "Map the applicable official requirements to the real homepage, request, quote, booking, scope change, cancellation, incident, invoice, warranty, checkout, receipt, and support experience, not only the policy pages.",
    authority: ["TUVELOZ owner", "Official legal or licensing source"],
    required: true,
    requiresValidThrough: true,
    acceptedOfficialSourceReferences: [OFFICIAL_SOURCE.consumerProtection],
  },
  {
    key: "maryland_repair_duty_allocation",
    stage: "transaction_pilot",
    category: "legal",
    title: "Maryland repair duties assigned and evidenced",
    plainLanguage: "A written duty map tied to official sources assigns estimates, authorization, invoices, returned parts, records, warranties, registrations, and repair-facility duties among TUVELOZ, mobile providers, and shops.",
    authority: ["TUVELOZ owner", "Official legal or licensing source"],
    required: true,
    requiresValidThrough: true,
    acceptedOfficialSourceReferences: [OFFICIAL_SOURCE.repairAuthorization],
  },
  {
    key: "platform_and_service_insurance_bound",
    stage: "transaction_pilot",
    category: "insurance",
    title: "TUVELOZ coverage and launch-service risk approved",
    plainLanguage: "The broker or carrier confirms bound platform coverage and approves every service that will be enabled, including mobile work and any exclusions. Tracked, not blocking — no Maryland statute requires platform coverage, so this is an owner decision rather than a legal gate. The exposure it covers is a customer suing both the provider and Tuveloz over work performed at their location.",
    authority: ["Insurance broker or carrier"],
    // Owner decision, August 2026: tracked rather than blocking. Flip back to
    // true to make bound coverage a precondition for the transaction-pilot
    // stage again.
    required: false,
    requiresValidThrough: true,
  },
  {
    key: "stripe_connect_business_model",
    stage: "transaction_pilot",
    category: "payments",
    title: "Payment processor approves the actual marketplace model",
    plainLanguage: "Stripe or the chosen processor approves TUVELOZ's Connect configuration, account types, payout controls, refunds, disputes, reserves, negative balances, and supported service categories.",
    authority: ["Payment processor"],
    required: true,
    requiresValidThrough: true,
  },
  {
    key: "cpa_tax_mor_and_transaction_map",
    stage: "transaction_pilot",
    category: "tax and accounting",
    title: "CPA approves tax, merchant-of-record, fees, and ledger treatment",
    plainLanguage: "Approve who sells the service, who collects and reports each amount, tax handling, information reporting, refunds, chargebacks, reserves, and provider clawbacks.",
    authority: ["CPA or tax adviser"],
    required: true,
    requiresValidThrough: true,
  },
  {
    key: "checkout_fee_receipt_copy",
    stage: "transaction_pilot",
    category: "payments",
    title: "Checkout, fee, tax, and receipt display verified",
    plainLanguage: "The customer sees provider amount, parts and labor, TUVELOZ fee, taxes and other charges, total, scope, provider identity, and refund terms before accepting.",
    authority: ["Official legal or licensing source", "CPA or tax adviser"],
    required: true,
    requiresValidThrough: true,
    acceptedOfficialSourceReferences: [OFFICIAL_SOURCE.repairInvoice],
  },
  {
    key: "cancellation_refund_no_show_policy",
    stage: "transaction_pilot",
    category: "operations",
    title: "Cancellation, no-show, refund, and dispute rules verified",
    plainLanguage: "Verify notice windows, travel, committed parts, completed work, unearned funds, decision evidence, chargebacks, payout effects, and customer/provider notices.",
    authority: ["Official legal or licensing source", "CPA or tax adviser", "Payment processor"],
    required: true,
    requiresValidThrough: true,
    acceptedOfficialSourceReferences: [OFFICIAL_SOURCE.consumerProtection],
  },
  {
    key: "vehicle_incident_claims_and_stop_work",
    stage: "transaction_pilot",
    category: "safety and claims",
    title: "Vehicle incident, injury, damage, and stop-work plan tested",
    plainLanguage: "Test emergency handling, work stoppage, evidence preservation, payment holds, insurer tender, customer/provider communications, and claim resolution records.",
    authority: ["Official legal or licensing source", "Insurance broker or carrier", "TUVELOZ owner"],
    required: true,
    requiresValidThrough: true,
    acceptedOfficialSourceReferences: [OFFICIAL_SOURCE.repairAuthorization],
  },
  {
    key: "provider_expiration_reminder_delivery",
    stage: "transaction_pilot",
    category: "provider compliance",
    title: "Expiration reminder delivery and automatic blocking tested",
    plainLanguage: "Run the scheduled 60/30/14/7/1-day notices through the real delivery channel, record failures, and verify expiration immediately removes dependent services without a grace period.",
    authority: ["TUVELOZ owner", "Security or privacy reviewer"],
    required: true,
    requiresValidThrough: true,
  },
  {
    key: "screening_or_no_screening_position",
    stage: "transaction_pilot",
    category: "screening",
    title: "Screening position and public claims verified",
    plainLanguage: "Record official requirement sources and review either the complete screening and adverse-action workflow or a clear no-screening position. The site must never imply a check that was not performed.",
    authority: ["Official legal or licensing source", "Screening or compliance reviewer"],
    required: true,
    requiresValidThrough: true,
    acceptedOfficialSourceReferences: [OFFICIAL_SOURCE.screening],
  },
  {
    key: "employee_and_trainee_provider_of_record",
    stage: "transaction_pilot",
    category: "future provider pathways",
    title: "Employee and trainee provider-of-record model approved",
    plainLanguage: "This is optional for an independent-owner-only pilot. These people stay blocked until the sponsoring business model has documented official legal requirements, insurer and tax approval, and the product assigns every job to that business.",
    authority: ["Official legal or licensing source", "Insurance broker or carrier", "CPA or tax adviser"],
    required: false,
    requiresValidThrough: true,
    acceptedOfficialSourceReferences: [OFFICIAL_SOURCE.marylandBusinessRecords],
  },
] as const;

export type StoredLaunchGateDecision = {
  id: string;
  gateKey: string;
  gateVersion: number;
  status: string;
  required: string;
  evidenceReference: string;
  approvedBy: string;
  approvedAt: string;
  validThrough: string;
  notes: string;
  decidedBy: string;
  createdAt: string;
};

export function parseOwnerLegalReviewChoice(
  decision: StoredLaunchGateDecision | undefined,
) {
  if (!decision || decision.gateKey !== OWNER_LEGAL_REVIEW_CHOICE_GATE_KEY) {
    return null;
  }
  try {
    const parsed = JSON.parse(decision.evidenceReference) as Record<string, unknown>;
    if (
      parsed.format !== "tuveloz_owner_legal_review_choice_v1"
      || parsed.decision !== "proceeding_without_counsel"
      || typeof parsed.scope !== "string"
      || !parsed.scope.trim()
      || parsed.acknowledgedNoLegalApproval !== true
      || parsed.acknowledgedMandatoryRequirementsRemain !== true
      || parsed.acknowledgement !== OWNER_LEGAL_REVIEW_ACKNOWLEDGEMENT
      || typeof parsed.decidedAt !== "string"
      || !Number.isFinite(Date.parse(parsed.decidedAt))
      || typeof parsed.decidedBy !== "string"
      || !parsed.decidedBy.trim()
    ) {
      return null;
    }
    return parsed as OwnerLegalReviewChoice;
  } catch {
    return null;
  }
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed)
    && new Date(parsed).toISOString().slice(0, 10) === value;
}

export function encodeLaunchAuthorityApprovals(
  approvals: readonly LaunchAuthorityApproval[],
) {
  return JSON.stringify({ format: "tuveloz_launch_authority_evidence_v1", approvals });
}

export function launchAuthorityApprovals(
  gate: LaunchGateDefinition,
  decision: StoredLaunchGateDecision | undefined,
) {
  if (!decision) return [] as LaunchAuthorityApproval[];
  try {
    const parsed = JSON.parse(decision.evidenceReference) as {
      format?: unknown;
      approvals?: unknown;
    };
    if (
      parsed?.format === "tuveloz_launch_authority_evidence_v1"
      && Array.isArray(parsed.approvals)
    ) {
      return parsed.approvals.flatMap((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return [];
        const value = item as Record<string, unknown>;
        const authority = text(value.authority);
        if (!gate.authority.includes(authority as LaunchGateAuthority)) return [];
        return [{
          authority: authority as LaunchGateAuthority,
          approvedBy: text(value.approvedBy),
          evidenceReference: text(value.evidenceReference),
          approvedAt: text(value.approvedAt),
          validThrough: text(value.validThrough),
        }];
      });
    }
  } catch {
    // A pre-v1 single-authority record can remain reviewable, but it cannot
    // satisfy a multi-authority gate.
  }
  if (gate.authority.length !== 1) return [] as LaunchAuthorityApproval[];
  return [{
    authority: gate.authority[0],
    approvedBy: decision.approvedBy,
    evidenceReference: decision.evidenceReference,
    approvedAt: decision.approvedAt,
    validThrough: decision.validThrough,
  }];
}

export function officialSourceReferenceIsAllowedForLaunchGate(
  gate: LaunchGateDefinition,
  reference: string,
) {
  return officialSourceReferenceIsValid(reference)
    && Boolean(gate.acceptedOfficialSourceReferences?.includes(reference));
}

export function launchDecisionState(
  gate: LaunchGateDefinition,
  decision: StoredLaunchGateDecision | undefined,
  now = Date.now(),
) {
  if (!decision) return "missing" as const;
  if (decision.status === "blocked") return "blocked" as const;
  if (decision.status === "not_applicable") {
    return gate.required ? "not_approved" as const : "not_applicable" as const;
  }
  if (decision.status !== "approved") return "pending" as const;
  const approvals = launchAuthorityApprovals(gate, decision);
  const approvalByAuthority = new Map(approvals.map((item) => [item.authority, item]));
  if (gate.authority.some((authority) => !approvalByAuthority.has(authority))) {
    return "authority_evidence_missing" as const;
  }
  for (const authority of gate.authority) {
    const approval = approvalByAuthority.get(authority)!;
    if (!approval.evidenceReference || !approval.approvedBy || !validDate(approval.approvedAt)) {
      return "incomplete_approval" as const;
    }
    if (
      authority === "Official legal or licensing source"
      && !officialSourceReferenceIsAllowedForLaunchGate(
        gate,
        approval.evidenceReference,
      )
    ) {
      return "invalid_official_source" as const;
    }
    const approvedAt = Date.parse(`${approval.approvedAt}T00:00:00.000Z`);
    if (approvedAt > now) return "future_approval" as const;
    if (gate.requiresValidThrough && !approval.validThrough) {
      return "expiration_missing" as const;
    }
    if (approval.validThrough) {
      if (!validDate(approval.validThrough)) return "expiration_invalid" as const;
      const through = Date.parse(`${approval.validThrough}T23:59:59.999Z`);
      if (through < approvedAt || through < now) return "expired" as const;
      if (
        authority === "Official legal or licensing source"
        && through > approvedAt + (366 * 24 * 60 * 60 * 1000)
      ) {
        return "legal_review_window_too_long" as const;
      }
    }
  }
  return "approved" as const;
}

export function stageIsApproved(
  stage: LaunchReviewStage,
  decisions: ReadonlyMap<string, StoredLaunchGateDecision>,
  now = Date.now(),
) {
  return LAUNCH_GATE_CATALOG
    .filter((gate) => gate.stage === stage && gate.required)
    .every((gate) => launchDecisionState(gate, decisions.get(gate.key), now) === "approved");
}

export function launchGateByKey(key: string) {
  return LAUNCH_GATE_CATALOG.find((gate) => gate.key === key);
}
