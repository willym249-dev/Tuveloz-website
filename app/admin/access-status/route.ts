import { env } from "cloudflare:workers";
import {
  OWNER_NO_STORE_HEADERS,
  ownerDataFailureResponse,
  ownerVerificationFailureResponse,
} from "../../../lib/owner-api-response";
import {
  ownerBridgeCookie,
  verifyOwnerRequest,
} from "../../../lib/owner-auth";

const REQUIRED_OWNER_TABLES = [
  "account_credentials",
  "account_notifications",
  "account_service_area_settings",
  "appointments",
  "auth_sessions",
  "customer_profiles",
  "customer_requests",
  "email_notification_outbox",
  "expansion_interests",
  "launch_feedback",
  "provider_applications",
  "provider_credential_verifications",
  "provider_quotes",
  "saved_providers",
  "stripe_payments",
] as const;

const REQUIRED_OWNER_COLUMN_PROBES = [
  `SELECT id, email, status, municipality, zip, service_locations,
          service_address, is_test_job, created_at
     FROM customer_requests
    LIMIT 0`,
  `SELECT id, email, status, verification_status, is_test_provider,
          verification_checklist, approved_services, access_token, created_at
     FROM provider_applications
    LIMIT 0`,
  `SELECT id, request_id, provider_email, status, price_cents,
          customer_fee_cents, customer_total_cents, created_at
     FROM provider_quotes
    LIMIT 0`,
  `SELECT id, provider_id, requirement_key, status, checked_at,
          expires_at, updated_at
     FROM provider_credential_verifications
    LIMIT 0`,
  `SELECT id, audience, feature_wanted, problem_to_solve, trust_builder,
          email, status, created_at
     FROM launch_feedback
    LIMIT 0`,
  `SELECT id, audience, provider_type, locality, state, email, created_at
     FROM expansion_interests
    LIMIT 0`,
  `SELECT email, verified_at, locked_until, terms_accepted_at,
          terms_version, created_at, updated_at
     FROM account_credentials
    LIMIT 0`,
  `SELECT email, expires_at, last_seen_at
     FROM auth_sessions
    LIMIT 0`,
  `SELECT email, display_name, updated_at
     FROM customer_profiles
    LIMIT 0`,
  `SELECT customer_email
     FROM saved_providers
    LIMIT 0`,
  `SELECT id, customer_email, provider_application_id, status
     FROM stripe_payments
    LIMIT 0`,
  `SELECT email, municipality, zip, service_locations, updated_at, role
     FROM account_service_area_settings
    LIMIT 0`,
  `SELECT customer_email, status
     FROM appointments
    LIMIT 0`,
  `SELECT email, read_at, role
     FROM account_notifications
    LIMIT 0`,
  `SELECT recipient_email, status
     FROM email_notification_outbox
    LIMIT 0`,
] as const;

type TableRow = { name: string };

function schemaFailure(missingTables: readonly string[]) {
  console.error("Owner dashboard schema probe found missing tables", missingTables);
  return Response.json(
    {
      code: "OWNER_SCHEMA_MIGRATION_REQUIRED",
      category: "schema",
      error: "The owner dashboard database needs the current application migration.",
      retryable: false,
      reauthenticate: false,
    },
    { status: 503, headers: OWNER_NO_STORE_HEADERS },
  );
}

export async function GET(request: Request) {
  const verification = await verifyOwnerRequest(request);
  if (!verification.ok) {
    return ownerVerificationFailureResponse(verification);
  }

  try {
    const placeholders = REQUIRED_OWNER_TABLES.map(() => "?").join(", ");
    const result = await env.DB.prepare(
      `SELECT name
         FROM sqlite_master
        WHERE type = 'table'
          AND name IN (${placeholders})`,
    ).bind(...REQUIRED_OWNER_TABLES).all<TableRow>();
    const available = new Set((result.results ?? []).map((row) => row.name));
    const missingTables = REQUIRED_OWNER_TABLES.filter((table) => !available.has(table));
    if (missingTables.length > 0) return schemaFailure(missingTables);

    await Promise.all(
      REQUIRED_OWNER_COLUMN_PROBES.map((query) => env.DB.prepare(query).all()),
    );

    const headers = new Headers(OWNER_NO_STORE_HEADERS);
    if (verification.source !== "owner-bridge") {
      headers.append("set-cookie", ownerBridgeCookie(verification.token));
    }
    return Response.json(
      {
        ok: true,
        access: "verified",
        database: "ready",
        schema: "ready",
        checkedAt: new Date().toISOString(),
      },
      { headers },
    );
  } catch (error) {
    return ownerDataFailureResponse(error, "access and schema check");
  }
}
