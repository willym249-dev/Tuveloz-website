import { desc, eq } from "drizzle-orm";
import { getDb } from "../db";
import { providerAuditEvents } from "../db/schema";
import { POLICY_VERSION } from "./provider-policy";
import { sha256Text } from "./provider-policy-acceptance";

export type ProviderAuditInput = {
  providerId: string;
  personId?: string;
  requestId?: string;
  serviceCode?: string;
  jurisdiction?: string;
  eventType: string;
  entityType: string;
  entityId: string;
  actorType: string;
  actorId: string;
  outcome: string;
  reasonCodes?: readonly string[];
  metadata?: Record<string, unknown>;
};

export async function recordProviderAuditEvent(input: ProviderAuditInput) {
  const db = getDb();
  const previous = await db.select({ eventHash: providerAuditEvents.eventHash })
    .from(providerAuditEvents)
    .where(eq(providerAuditEvents.providerId, input.providerId))
    .orderBy(desc(providerAuditEvents.occurredAt))
    .limit(1);
  const occurredAt = new Date().toISOString();
  const previousEventHash = previous[0]?.eventHash ?? "";
  const eventId = crypto.randomUUID();
  const normalized = {
    id: eventId,
    providerId: input.providerId,
    personId: input.personId ?? "",
    requestId: input.requestId ?? "",
    serviceCode: input.serviceCode ?? "",
    jurisdiction: input.jurisdiction ?? "",
    eventType: input.eventType,
    entityType: input.entityType,
    entityId: input.entityId,
    actorType: input.actorType,
    actorId: input.actorId,
    outcome: input.outcome,
    reasonCodes: [...(input.reasonCodes ?? [])],
    metadata: input.metadata ?? {},
    policyVersion: POLICY_VERSION,
    previousEventHash,
    occurredAt,
  };
  const eventHash = await sha256Text(JSON.stringify(normalized));
  await db.insert(providerAuditEvents).values({
    id: eventId,
    providerId: normalized.providerId,
    personId: normalized.personId,
    requestId: normalized.requestId,
    serviceCode: normalized.serviceCode,
    jurisdiction: normalized.jurisdiction,
    eventType: normalized.eventType,
    entityType: normalized.entityType,
    entityId: normalized.entityId,
    eventVersion: 1,
    actorType: normalized.actorType,
    actorId: normalized.actorId,
    outcome: normalized.outcome,
    reasonCodes: JSON.stringify(normalized.reasonCodes),
    metadata: JSON.stringify(normalized.metadata),
    policyVersion: normalized.policyVersion,
    previousEventHash,
    eventHash,
    occurredAt,
    createdAt: occurredAt,
  });
  return { id: eventId, eventHash, occurredAt };
}
