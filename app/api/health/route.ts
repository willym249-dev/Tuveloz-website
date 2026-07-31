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
  "privacy_requests",
  "job_evidence_items",
] as const;

type TableRow = {
  name: string;
};

export async function GET() {
  const checkedAt = new Date().toISOString();
  let databaseReady = false;
  let missingTables: string[] = [...REQUIRED_TABLES];

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
  } catch (error) {
    console.error("Tuveloz health check could not read the production schema", error);
  }

  const schemaReady = databaseReady && missingTables.length === 0;
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
