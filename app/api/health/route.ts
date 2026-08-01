import { env } from "cloudflare:workers";
import {
  DEPLOYMENT_BUILT_AT,
  DEPLOYMENT_COMMIT,
} from "../../../lib/deployment-release";

const REQUIRED_TABLES = [
  "account_credentials",
  "customer_requests",
  "provider_applications",
  "email_notification_outbox",
  "job_authorizations",
  "job_authorization_events",
  "account_communication_preferences",
  "privacy_requests",
  "job_evidence_items",
  "job_authorization_snapshots",
  "job_scope_versions",
  "provider_audit_events",
  "provider_pathway_profiles",
  "provider_personnel",
  "provider_evidence_submissions",
  "agreement_acceptances",
  "provider_service_eligibility",
  "service_activation_decisions",
  "supervision_checkpoints",
  "compliance_reminders",
  "customer_agreement_acceptances",
  "data_rights_requests",
  "evidence_file_scans",
  "job_cancellations",
  "job_change_orders",
  "job_incidents",
  "job_lifecycle_events",
  "launch_gate_decisions",
  "payment_adjustments",
  "provider_appeals",
  "provider_invoices",
] as const;

const REQUIRED_GUARDED_TRIGGERS = [
  "accepted_quote_creates_initial_authorization_update",
  "accepted_quote_creates_initial_authorization_insert",
] as const;

// Table existence verifies the CREATE migrations. These zero-row probes also
// verify the columns added by the follow-up eligibility and payment migrations
// without exposing any production records through the health response.
const REQUIRED_COLUMN_PROBES = [
  `SELECT scope_version, scope_authorization_decision_id,
          authorized_price_snapshot
     FROM stripe_payments
    LIMIT 0`,
  `SELECT authenticity_verification_method, authenticity_verified_by,
          authenticity_verification_reference, authenticity_source_url,
          authenticity_verified_at, authenticity_valid_through
     FROM provider_evidence_submissions
    LIMIT 0`,
  `SELECT identity_verification_provider, identity_verification_reference,
          identity_verification_checked_at, identity_verification_valid_through,
          age_verification_provider, age_verification_reference,
          age_verification_checked_at, age_verification_valid_through
     FROM provider_personnel
    LIMIT 0`,
] as const;

type TableRow = {
  name: string;
};

type TriggerRow = {
  name: string;
  sql: string | null;
};

export async function GET() {
  const checkedAt = new Date().toISOString();
  let databaseReady = false;
  let requiredColumnsReady = false;
  let missingTables: string[] = [...REQUIRED_TABLES];
  let missingGuardedTriggers: string[] = [...REQUIRED_GUARDED_TRIGGERS];

  try {
    const placeholders = REQUIRED_TABLES.map(() => "?").join(", ");
    const result = await env.DB.prepare(
      `SELECT name
         FROM sqlite_master
        WHERE type = 'table'
          AND name IN (${placeholders})`,
    ).bind(...REQUIRED_TABLES).all<TableRow>();
    const available = new Set((result.results ?? []).map((row) => row.name));
    missingTables = REQUIRED_TABLES.filter((table) => !available.has(table));
    databaseReady = true;
    if (missingTables.length === 0) {
      const triggerPlaceholders = REQUIRED_GUARDED_TRIGGERS.map(() => "?").join(", ");
      const [triggerResult] = await Promise.all([
        env.DB.prepare(
          `SELECT name, sql
             FROM sqlite_master
            WHERE type = 'trigger'
              AND name IN (${triggerPlaceholders})`,
        ).bind(...REQUIRED_GUARDED_TRIGGERS).all<TriggerRow>(),
        Promise.all(
          REQUIRED_COLUMN_PROBES.map((query) => env.DB.prepare(query).all()),
        ),
      ] as const);
      const guardedTriggers = new Set(
        (triggerResult.results ?? [])
          .filter((row) => row.sql?.includes("is_test_job") && row.sql.includes("= 'no'"))
          .map((row) => row.name),
      );
      missingGuardedTriggers = REQUIRED_GUARDED_TRIGGERS.filter(
        (trigger) => !guardedTriggers.has(trigger),
      );
      requiredColumnsReady = true;
    }
  } catch (error) {
    console.error("Tuveloz health check could not read the production schema", error);
  }

  const schemaReady = databaseReady
    && missingTables.length === 0
    && missingGuardedTriggers.length === 0
    && requiredColumnsReady;
  const status = schemaReady ? "ok" : "degraded";

  return Response.json(
    {
      status,
      checkedAt,
      release: {
        commit: DEPLOYMENT_COMMIT,
        builtAt: DEPLOYMENT_BUILT_AT,
      },
      checks: {
        application: "ready",
        database: databaseReady ? "ready" : "unavailable",
        schema: schemaReady ? "ready" : "migration-required",
      },
      missingTables,
      missingGuardedTriggers,
      privacy: "This endpoint reports operational readiness only. It does not expose credentials, private records, user counts, payment details, or internal security controls.",
    },
    {
      status: status === "ok" ? 200 : 503,
      headers: {
        "cache-control": "no-store, max-age=0",
        "content-type": "application/json; charset=utf-8",
      },
    },
  );
}
