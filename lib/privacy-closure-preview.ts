// Counts identify records needing review, never ownership or permission to erase.
// Keep SQL identifiers/predicates static. The only input is a bound request ID.
const email = (column = "email") => `lower(${column}) IN (SELECT lower(email) FROM subject)`;
const provider = (column = "provider_id") => `${column} IN (SELECT id FROM providers)`;
const job = (column = "request_id") => `${column} IN (SELECT id FROM jobs)`;

const groups = {
  access: "Sign-in and account settings",
  contact: "Messages, notifications and contact preferences",
  provider: "Provider applications and documents",
  jobs: "Job and repair records shared with other people",
  payments: "Payment and accounting records",
  privacy: "Privacy requests and review history",
} as const;
type Group = keyof typeof groups;
type Rule = { table: string; group: Group; where: string };
const rules: Rule[] = [];
function include(group: Group, tables: string[], where: string) {
  for (const table of tables) rules.push({ table, group, where });
}

include("access", ["account_credentials", "auth_sessions", "login_codes", "password_verification_codes",
  "passkey_credentials", "account_phone_numbers", "account_service_area_settings", "customer_profiles", "account_promotions"], email());
include("access", ["customer_vehicles", "saved_providers"], email("customer_email"));
include("access", ["phone_login_codes"], `${email()} OR phone_e164 IN (SELECT phone_e164 FROM account_phone_numbers WHERE ${email()})`);
include("contact", ["account_communication_preferences", "account_notifications", "phone_contact_consents",
  "launch_update_subscribers", "fleet_inquiries", "launch_feedback", "expansion_interests"], email());
include("contact", ["email_notification_outbox"], email("recipient_email"));
include("contact", ["job_messages"], `${email("sender_email")} OR ${email("recipient_email")}`);
include("privacy", ["privacy_requests", "account_closures"], email());
include("privacy", ["data_rights_requests"], `${email("requester_email")} OR ${provider()}`);
include("provider", ["provider_applications", "provider_application_challenges"], email());
include("provider", ["provider_application_email_claims", "provider_application_submission_evidence"], `${email("normalized_email")} OR ${provider()}`);
include("provider", ["provider_profiles", "provider_gallery_items", "provider_catalog_items", "provider_submitted_credentials",
  "provider_credential_verifications", "provider_evidence_submissions", "provider_identity_verification_sessions",
  "agreement_acceptances", "provider_service_eligibility", "service_activation_decisions", "provider_personnel",
  "evidence_file_scans"], provider());
include("provider", ["provider_pathway_profiles"], `${provider()} OR ${provider("sponsoring_provider_id")} OR ${provider("registration_holder_id")}`);
include("provider", ["provider_appeals"], `${provider()} OR ${email("submitted_by_email")}`);
include("provider", ["compliance_reminders"], `${provider()} OR ${email("recipient_email")}`);
include("provider", ["provider_audit_events"], `${provider()} OR ${job()}`);
include("jobs", ["customer_requests"], "id IN (SELECT id FROM jobs)");
include("jobs", ["provider_quotes", "provider_job_records", "job_inspection_items", "job_appointments",
  "job_reviews", "job_authorizations", "repair_authorization_records", "appointments", "job_location_shares"], `${job()} OR ${email("provider_email")}`);
include("jobs", ["job_scope_versions", "job_authorization_snapshots", "job_authorization_events",
  "supervision_checkpoints", "job_lifecycle_events", "job_change_orders"], job());
include("jobs", ["job_cancellations"], `${job()} OR ${email("requested_by_email")}`);
include("jobs", ["job_incidents"], `${job()} OR ${provider()} OR ${email("reporter_email")}`);
include("jobs", ["job_evidence_items"], `${job()} OR ${email("customer_email")} OR ${email("provider_email")} OR ${email("uploaded_by_email")}`);
include("jobs", ["repair_authorization_items"], "authorization_id IN (SELECT id FROM repair_authorization_records WHERE " + job() + ` OR ${email("provider_email")} OR ${email("customer_email")})`);
include("jobs", ["customer_agreement_acceptances"], `${job()} OR ${email("customer_email")}`);
include("payments", ["stripe_customers"], email("customer_email"));
include("payments", ["stripe_payments"], "id IN (SELECT id FROM payments)");
include("payments", ["stripe_connected_account_snapshots"], provider("provider_application_id"));
include("payments", ["payment_adjustments"], `${job()} OR payment_id IN (SELECT id FROM payments)`);
include("payments", ["provider_invoices"], `${job()} OR ${provider()}`);
include("payments", ["provider_invoice_items"], `invoice_id IN (SELECT id FROM provider_invoices WHERE ${job()} OR ${provider()})`);

// No global scans of opaque payloads, hashed identifiers or unrelated records.
// These sources must be investigated separately before any fulfillment claim.
export const PRIVACY_MANUAL_SOURCES = [
  { table: "analytics_events", reason: "Event properties need a separate scoped review." },
  { table: "public_write_rate_limits", reason: "Hashed rate-limit identifiers need a separate retention review." },
  { table: "launch_gate_decisions", reason: "Business decision notes may mention an account; ownership cannot be inferred." },
  { table: "referral_codes", reason: "Referral relationships and hashed signup references need a separate review." },
  { table: "referral_signups", reason: "Referral relationships and hashed signup references need a separate review." },
  { table: "self_hosted_scan_jobs", reason: "Scan jobs can link to several file types and need a separate review." },
  { table: "stripe_webhook_events", reason: "Stripe event and object identifiers need a separate scoped review." },
] as const;

export const PRIVACY_PREVIEW_TABLES = rules.map(({ table }) => table);

// One SELECT gives a consistent point-in-time view, including the request state.
// No file keys, tokens, password hashes, document contents or counterparty data
// leave this query. A related job is shared data, not a deletion target.
export const PRIVACY_CLOSURE_PREVIEW_SQL = `
WITH subject AS (
  SELECT id, email, role, request_type, status, updated_at FROM privacy_requests WHERE id = ?
), providers AS (
  SELECT id FROM provider_applications WHERE ${email()}
), jobs AS (
  SELECT id FROM customer_requests WHERE ${email()}
  UNION SELECT request_id FROM provider_quotes WHERE ${email("provider_email")}
  UNION SELECT request_id FROM job_authorizations WHERE ${email("customer_email")} OR ${email("provider_email")}
  UNION SELECT request_id FROM repair_authorization_records WHERE ${email("customer_email")} OR ${email("provider_email")}
  UNION SELECT request_id FROM provider_invoices WHERE ${provider()}
), payments AS (
  SELECT id FROM stripe_payments WHERE ${email("customer_email")} OR ${provider("provider_application_id")} OR ${job()}
)
SELECT 'request' AS item, json_object('id',id,'role',role,'requestType',request_type,'status',status,'updatedAt',updated_at) AS value FROM subject
${rules.map(({ table, where }) => `UNION ALL SELECT '${table}', CAST(COUNT(*) AS TEXT) FROM ${table} WHERE ${where}`).join("\n")}
UNION ALL SELECT 'legalHolds', CAST(COUNT(*) AS TEXT) FROM data_rights_requests
 WHERE (${email("requester_email")} OR ${provider()}) AND legal_hold <> 'no'
UNION ALL SELECT 'incidents', CAST(COUNT(*) AS TEXT) FROM job_incidents
 WHERE (${job()} OR ${provider()} OR ${email("reporter_email")}) AND (status NOT IN ('resolved','closed') OR hold_payments = 'yes')
`;

export type ClosurePreview = {
  mode: "review-only";
  scope: "whole-account";
  canExecute: false;
  coverageComplete: false;
  request: { id: string; role: string; requestType: string; status: string; updatedAt: string };
  generatedAt: string;
  groups: { id: Group; label: string; recordCount: number; sources: { table: string; recordCount: number }[] }[];
  flags: { legalHolds: number; incidents: number };
  manualSources: typeof PRIVACY_MANUAL_SOURCES;
  nextSteps: string[];
};

export function closurePreview(rows: { item: string; value: string }[]): ClosurePreview | null {
  const values = new Map(rows.map(row => [row.item, row.value]));
  const requestRow = values.get("request");
  if (!requestRow) return null;
  const count = (key: string) => {
    const value = values.get(key);
    if (value === undefined || !/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) {
      throw new Error("Incomplete privacy preview");
    }
    return Number(value);
  };
  return {
    mode: "review-only", scope: "whole-account", canExecute: false, coverageComplete: false,
    request: JSON.parse(requestRow), generatedAt: new Date().toISOString(),
    groups: (Object.entries(groups) as [Group, string][]).map(([id, label]) => {
      const sources = rules.filter(rule => rule.group === id).map(({ table }) => ({ table, recordCount: count(table) }));
      return { id, label, recordCount: sources.reduce((total, source) => total + source.recordCount, 0), sources };
    }),
    flags: { legalHolds: count("legalHolds"), incidents: count("incidents") },
    manualSources: PRIVACY_MANUAL_SOURCES,
    nextSteps: [
      "Confirm whether the person wants to close the whole account or only one role. This preview includes both customer and provider records linked to the login.",
      "Decide what to delete, de-identify or retain, with a reason and review date for each category. Shared job records also concern other people.",
      "Review jobs, payments, disputes, safety reports and legal holds. A zero count here does not confirm that no external hold exists.",
      "Review uploaded files, embedded notes, vendor records and backups separately. These counts do not confirm file existence or deletion.",
      "Account closure and deletion execution are not available in this preview. Do not mark the request completed on the strength of this report.",
    ],
  };
}
