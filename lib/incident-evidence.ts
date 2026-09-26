import { env } from "cloudflare:workers";
import { desc, eq } from "drizzle-orm";
import { getDb } from "../db";
import { jobLifecycleEvents } from "../db/schema";
import { JOB_OPERATIONS_RULES_VERSION, sha256JobOperationText, type AssignedJobOperationContext } from "./job-operations";

export function incidentEvidenceIds(value: string): string[] | null {
  try {
    const ids: unknown = JSON.parse(value);
    return Array.isArray(ids) && ids.every(id => typeof id === "string" && id.length > 0 && id.length <= 160)
      ? ids : null;
  } catch { return null; }
}

// Called only after the route verifies actor access, a persisted test assignment,
// an open incident, and a saved evidence item belonging to the same parties/job.
// The audit and append share one transaction. A stale read writes neither.
export async function linkIncidentEvidence(input: {
  context: AssignedJobOperationContext;
  actor: { role: "owner" | "customer" | "provider"; email: string };
  incidentId: string;
  evidenceId: string;
  previousReferences: string;
  nextReferences: string;
}) {
  const { context, actor, incidentId, evidenceId, previousReferences, nextReferences } = input;
  const [previous] = await getDb().select({ eventHash: jobLifecycleEvents.eventHash }).from(jobLifecycleEvents)
    .where(eq(jobLifecycleEvents.requestId, context.requestId)).orderBy(desc(jobLifecycleEvents.occurredAt)).limit(1);
  const previousEventHash = previous?.eventHash ?? "";
  const eventId = crypto.randomUUID();
  const now = new Date().toISOString();
  const event = {
    requestId: context.requestId, quoteId: context.quoteId, providerId: context.providerId,
    actorRole: actor.role, actorId: actor.email, eventType: "incident_evidence_linked",
    fromStatus: context.requestStatus, toStatus: context.requestStatus, scopeVersion: context.scopeVersion,
    reasonCode: "saved_job_evidence", details: { incidentId, evidenceId, transferCreated: false },
  };
  const details = JSON.stringify(event.details);
  const eventHash = await sha256JobOperationText(JSON.stringify({
    id: eventId, ...event, details, occurredAt: now, previousEventHash, rulesVersion: JOB_OPERATIONS_RULES_VERSION,
  }));
  const results = await env.DB.batch([
    env.DB.prepare(`INSERT INTO job_lifecycle_events
      (id, request_id, quote_id, provider_id, actor_role, actor_id, event_type,
       from_status, to_status, scope_version, reason_code, details, previous_event_hash,
       event_hash, occurred_at, created_at)
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      FROM job_incidents incident
      WHERE incident.id = ? AND incident.request_id = ?
        AND incident.quote_id = ? AND incident.provider_id = ?
        AND incident.status IN ('open', 'under_review', 'insurer_review')
        AND incident.evidence_references = ?
        AND EXISTS (SELECT 1 FROM customer_requests request
          JOIN provider_quotes quote ON quote.id = incident.quote_id AND quote.request_id = request.id
          JOIN provider_applications provider ON provider.id = incident.provider_id
          WHERE request.id = incident.request_id AND request.is_test_job = 'yes'
            AND provider.is_test_provider = 'yes' AND quote.status = 'accepted'
            AND lower(request.email) = lower(?) AND lower(provider.email) = lower(?)
            AND lower(quote.provider_email) = lower(provider.email))
        AND EXISTS (SELECT 1 FROM job_evidence_items evidence
          WHERE evidence.id = ? AND evidence.request_id = incident.request_id
            AND lower(evidence.customer_email) = lower(?) AND lower(evidence.provider_email) = lower(?))
        AND COALESCE((SELECT event_hash FROM job_lifecycle_events
          WHERE request_id = ? ORDER BY occurred_at DESC LIMIT 1), '') = ?`)
      .bind(eventId, context.requestId, context.quoteId, context.providerId, actor.role, actor.email,
        event.eventType, event.fromStatus, event.toStatus, event.scopeVersion, event.reasonCode,
        details, previousEventHash, eventHash, now, now, incidentId, context.requestId,
        context.quoteId, context.providerId, previousReferences, context.customerEmail, context.providerEmail,
        evidenceId, context.customerEmail,
        context.providerEmail, context.requestId, previousEventHash),
    env.DB.prepare(`UPDATE job_incidents SET evidence_references = ?, updated_at = ?
      WHERE id = ? AND request_id = ? AND evidence_references = ?
        AND EXISTS (SELECT 1 FROM job_lifecycle_events WHERE id = ? AND event_hash = ?)`)
      .bind(nextReferences, now, incidentId, context.requestId, previousReferences, eventId, eventHash),
  ]);
  return results[1].meta.changes === 1;
}
