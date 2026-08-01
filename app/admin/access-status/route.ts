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
  "launch_feedback",
  "provider_applications",
  "provider_credential_verifications",
  "provider_quotes",
  "saved_providers",
  "stripe_payments",
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

    await Promise.all([
      env.DB.prepare(
        `SELECT id, email, status, municipality, zip, service_locations, created_at
           FROM customer_requests
          LIMIT 0`,
      ).all(),
      env.DB.prepare(
        `SELECT id, email, status, verification_status, is_test_provider
           FROM provider_applications
          LIMIT 0`,
      ).all(),
      env.DB.prepare(
        `SELECT id, customer_email, provider_application_id, status
           FROM stripe_payments
          LIMIT 0`,
      ).all(),
    ]);

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
