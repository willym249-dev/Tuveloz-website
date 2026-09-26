import { env } from "cloudflare:workers";
import { and, eq, inArray, notExists, sql } from "drizzle-orm";
import { getDb } from "../db";
import { customerRequests, emailNotificationOutbox, jobIncidents, providerApplications, providerQuotes } from "../db/schema";

const OWNER_ALERT_PREFIX = "owner:incident:job-report:";
const TEST_ALERT_PREFIX = "test:incident:job-report:";
const OPEN_STATUSES = ["open", "under_review", "insurer_review"];

function existingAlert(incidentId: string) {
  return inArray(emailNotificationOutbox.eventKey, [
    `${OWNER_ALERT_PREFIX}${incidentId}`, `${TEST_ALERT_PREFIX}${incidentId}`,
  ]);
}

/** Queue from persisted records only. No caller-supplied recipient or content.
 * Test classification is part of the durable key and can never become sendable
 * when someone later edits a fixture's flags. Recovery does not replace rows.
 */
export async function queueIncidentOwnerAlert(incidentId: string): Promise<"queued" | "test_only" | "unavailable"> {
  const db = getDb();
  const [existing] = await db.select({ eventKey: emailNotificationOutbox.eventKey })
    .from(emailNotificationOutbox).where(existingAlert(incidentId)).limit(1);
  if (existing) return existing.eventKey.startsWith(TEST_ALERT_PREFIX) ? "test_only" : "queued";

  const [record] = await db.select({
    id: jobIncidents.id, requestId: jobIncidents.requestId,
    isTestJob: customerRequests.isTestJob, isTestProvider: providerApplications.isTestProvider,
  }).from(jobIncidents)
    .innerJoin(customerRequests, eq(customerRequests.id, jobIncidents.requestId))
    .innerJoin(providerApplications, eq(providerApplications.id, jobIncidents.providerId))
    .innerJoin(providerQuotes, and(
      eq(providerQuotes.id, jobIncidents.quoteId),
      eq(providerQuotes.requestId, jobIncidents.requestId),
      sql`lower(${providerQuotes.providerEmail}) = lower(${providerApplications.email})`,
    ))
    .where(and(eq(jobIncidents.id, incidentId), inArray(jobIncidents.status, OPEN_STATUSES)))
    .limit(1);
  if (!record) return "unavailable";

  const runtime = env as unknown as Record<string, string | undefined>;
  const ownerEmail = (runtime.OWNER_EMAIL ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) {
    throw new Error("Incident owner email is not configured");
  }
  // Anything other than two explicit real-record flags is quarantined. Staging
  // is also quarantined even if its fixture flags were entered incorrectly.
  const testOnly = record.isTestJob !== "no" || record.isTestProvider !== "no"
    || runtime.APP_ENVIRONMENT?.trim().toLowerCase() === "staging";
  const eventKey = `${testOnly ? TEST_ALERT_PREFIX : OWNER_ALERT_PREFIX}${record.id}`;
  const link = new URL(testOnly ? "/job-operations" : "/admin/compliance-operations", runtime.SITE_URL || "https://tuveloz.com");
  if (testOnly) link.searchParams.set("requestId", record.requestId);
  const now = new Date().toISOString();
  const alertId = `incident-owner-alert:${record.id}`;
  await db.insert(emailNotificationOutbox).values({
    id: alertId, eventKey, recipientEmail: ownerEmail,
    subject: `${testOnly ? "TEST ONLY — " : ""}Tuveloz: a job report needs review / Reporte por revisar`,
    textBody: [
      ...(testOnly ? ["TEST ONLY / SOLO UNA PRUEBA — this message is quarantined and will not be sent.", ""] : []),
      "A report has been saved for a Tuveloz job. Please open the protected job record to review it and the current work and payment status.",
      "Contact each participant separately when appropriate. This alert does not contact emergency services or notify an insurer.",
      "", "Se guardó un reporte sobre un servicio de Tuveloz. Abre el registro privado del servicio para revisar el reporte y el estado actual del trabajo y del pago.",
      "Comunícate con cada participante por separado cuando corresponda. Este aviso no contacta a los servicios de emergencia ni notifica a una aseguradora.",
      "", `Report reference / Referencia del reporte: ${record.id}`, link.toString(),
    ].join("\n"),
    status: "pending", attempts: 0, lastError: "", createdAt: now, updatedAt: now, sentAt: "",
  }).onConflictDoNothing();
  // The deterministic primary key also prevents two differently classified
  // copies if a fixture flag changes between concurrent enqueues. First saved
  // classification wins; return that persisted result, not the earlier read.
  const [saved] = await db.select({ eventKey: emailNotificationOutbox.eventKey })
    .from(emailNotificationOutbox).where(eq(emailNotificationOutbox.id, alertId)).limit(1);
  if (!saved) throw new Error("Incident owner alert was not saved");
  // The Worker flush attempts delivery after the route. A saved report must
  // not become a failed API response because an email service is unavailable.
  return saved.eventKey.startsWith(TEST_ALERT_PREFIX) ? "test_only" : "queued";
}

/** Recover a missed enqueue after a process/database interruption. Existing
 * records, including quarantined fixtures, are never reclassified or resent.
 * Closed historical reports are not backfilled as new incidents.
 */
export async function recoverIncidentOwnerAlerts(limit = 20) {
  const db = getDb();
  const records = await db.select({ id: jobIncidents.id }).from(jobIncidents)
    .innerJoin(customerRequests, eq(customerRequests.id, jobIncidents.requestId))
    .innerJoin(providerApplications, eq(providerApplications.id, jobIncidents.providerId))
    .innerJoin(providerQuotes, and(
      eq(providerQuotes.id, jobIncidents.quoteId), eq(providerQuotes.requestId, jobIncidents.requestId),
      sql`lower(${providerQuotes.providerEmail}) = lower(${providerApplications.email})`,
    ))
    .where(and(inArray(jobIncidents.status, OPEN_STATUSES), notExists(
      db.select({ id: emailNotificationOutbox.id }).from(emailNotificationOutbox).where(sql`
        ${emailNotificationOutbox.eventKey} IN (
          ${OWNER_ALERT_PREFIX} || ${jobIncidents.id}, ${TEST_ALERT_PREFIX} || ${jobIncidents.id}
        )`),
    )))
    .orderBy(jobIncidents.createdAt, jobIncidents.id)
    .limit(Number.isFinite(limit) ? Math.max(1, Math.min(20, Math.floor(limit))) : 20);
  let queued = 0;
  let failed = 0;
  for (const record of records) {
    try {
      if (await queueIncidentOwnerAlert(record.id) !== "unavailable") queued++;
    } catch {
      failed++;
      console.error("Unable to queue incident owner alert", { incidentId: record.id });
    }
  }
  return { queued, failed };
}
