import { and, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  customerAgreementAcceptances,
  customerRequests,
  providerApplications,
  providerInvoices,
  providerQuotes,
} from "../../../db/schema";
import { getAccountSession } from "../../../lib/account-auth";
import {
  CUSTOMER_COMPLETION_AGREEMENT_KEY,
  CUSTOMER_COMPLETION_AGREEMENT_VERSION,
  customerCompletionAgreementEvidenceText,
  customerCompletionAgreementHash,
  customerCompletionConfirmationText,
  customerCompletionScopeSnapshot,
  type CustomerCompletionScope,
} from "../../../lib/customer-completion-confirmation";
import {
  customerAcceptanceDeviceContext,
  requestIpAddress,
} from "../../../lib/customer-job-scope";
import { appendJobLifecycleEvent } from "../../../lib/job-operations";
import { policyAccepted } from "../../../lib/policies";
import { isSameOriginRequest } from "../../../lib/request-security";

function noStoreJson(body: Record<string, unknown>, status = 200) {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

// The customer's completion confirmation is a payout-release control, not a
// policy acceptance: it binds the customer's affirmation to the exact final
// invoice, work summary, and disclosed warranty position for the accepted
// scope. Payout readiness fails closed until this record exists.
async function completionConfirmationContext(token: string) {
  if (!token) {
    return { kind: "error", error: "Private request link not found.", status: 404 } as const;
  }
  const db = getDb();
  const [job] = await db.select().from(customerRequests)
    .where(eq(customerRequests.accessToken, token)).limit(1);
  if (!job) {
    return { kind: "error", error: "Private request link not found.", status: 404 } as const;
  }
  if (job.status !== "completed") {
    return {
      kind: "unavailable",
      unavailableReason: "The provider has not marked this job completed yet.",
    } as const;
  }
  const [quote] = await db.select().from(providerQuotes)
    .where(and(
      eq(providerQuotes.requestId, job.id),
      eq(providerQuotes.status, "accepted"),
    )).limit(1);
  if (!quote) {
    return {
      kind: "unavailable",
      unavailableReason: "No accepted quote is bound to this job.",
    } as const;
  }
  const [finalInvoice] = await db.select().from(providerInvoices)
    .where(and(
      eq(providerInvoices.requestId, job.id),
      eq(providerInvoices.scopeVersion, quote.scopeVersion),
      eq(providerInvoices.status, "final"),
    )).limit(1);
  if (!finalInvoice) {
    return {
      kind: "unavailable",
      unavailableReason: "The provider's final invoice has not been issued yet.",
    } as const;
  }
  const scope: CustomerCompletionScope = {
    requestId: job.id,
    quoteId: quote.id,
    scopeVersion: quote.scopeVersion,
    providerName: quote.providerName,
    invoiceNumber: finalInvoice.invoiceNumber,
    invoiceTotalCents: finalInvoice.totalAmountCents,
    workSummary: finalInvoice.workSummary,
    workmanshipWarranty: quote.workmanshipWarranty,
  };
  const [existing] = await db.select({
    id: customerAgreementAcceptances.id,
    acceptedAt: customerAgreementAcceptances.acceptedAt,
  }).from(customerAgreementAcceptances)
    .where(and(
      eq(customerAgreementAcceptances.requestId, job.id),
      eq(customerAgreementAcceptances.quoteId, quote.id),
      eq(customerAgreementAcceptances.scopeVersion, quote.scopeVersion),
      eq(customerAgreementAcceptances.agreementKey, CUSTOMER_COMPLETION_AGREEMENT_KEY),
      eq(customerAgreementAcceptances.agreementVersion, CUSTOMER_COMPLETION_AGREEMENT_VERSION),
    )).limit(1);
  return { kind: "ready", job, quote, finalInvoice, scope, existing } as const;
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const context = await completionConfirmationContext(token);
  if (context.kind === "error") {
    return noStoreJson({ error: context.error }, context.status);
  }
  if (context.kind === "unavailable") {
    return noStoreJson({ available: false, reason: context.unavailableReason });
  }
  return noStoreJson({
    available: true,
    confirmed: Boolean(context.existing),
    confirmedAt: context.existing?.acceptedAt ?? "",
    agreementKey: CUSTOMER_COMPLETION_AGREEMENT_KEY,
    agreementVersion: CUSTOMER_COMPLETION_AGREEMENT_VERSION,
    agreementHash: await customerCompletionAgreementHash(context.scope),
    presentedText: customerCompletionConfirmationText(context.scope),
    invoiceNumber: context.scope.invoiceNumber,
    workSummary: context.scope.workSummary,
    workmanshipWarranty: context.scope.workmanshipWarranty,
    invoiceTotalCents: context.scope.invoiceTotalCents,
  });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return noStoreJson({
      error: "This completion confirmation must be submitted from TUVELOZ.",
      code: "SAME_ORIGIN_REQUIRED",
    }, 403);
  }
  const body = (await request.json()) as {
    token?: string;
    confirmed?: unknown;
    agreementHash?: string;
  };
  const context = await completionConfirmationContext(body.token ?? "");
  if (context.kind === "error") {
    return noStoreJson({ error: context.error }, context.status);
  }
  if (context.kind === "unavailable") {
    return noStoreJson({ error: context.unavailableReason }, 409);
  }
  const { job, quote, scope, existing } = context;
  if (existing) {
    return noStoreJson({ ok: true, alreadyConfirmed: true });
  }
  if (!policyAccepted(body.confirmed)) {
    return noStoreJson({
      error: "Confirm that the described work was completed before submitting.",
    }, 400);
  }
  const expectedHash = await customerCompletionAgreementHash(scope);
  if (body.agreementHash !== expectedHash) {
    return noStoreJson({
      error: "The displayed completion summary changed. Reload and review it again.",
      code: "COMPLETION_SUMMARY_STALE",
    }, 409);
  }
  const db = getDb();
  const session = await getAccountSession(request);
  const acceptedAt = new Date().toISOString();
  const sessionId = session?.role === "customer"
      && session.email.toLowerCase() === job.email.toLowerCase()
    ? session.id
    : crypto.randomUUID();
  try {
    await db.insert(customerAgreementAcceptances).values({
      id: crypto.randomUUID(),
      customerEmail: job.email,
      requestId: job.id,
      quoteId: quote.id,
      scopeVersion: quote.scopeVersion,
      scopeSnapshot: customerCompletionScopeSnapshot(scope),
      agreementKey: CUSTOMER_COMPLETION_AGREEMENT_KEY,
      agreementVersion: CUSTOMER_COMPLETION_AGREEMENT_VERSION,
      agreementHash: expectedHash,
      agreementText: customerCompletionAgreementEvidenceText(scope),
      acceptedByName: job.name,
      acceptanceAction: "affirmative-customer-completion-confirmation-checkbox",
      acceptedAt,
      ipAddress: requestIpAddress(request),
      sessionId,
      deviceContext: customerAcceptanceDeviceContext(request),
      createdAt: acceptedAt,
    });
  } catch {
    const retried = await completionConfirmationContext(body.token ?? "");
    if (retried.kind === "ready" && retried.existing) {
      return noStoreJson({ ok: true, alreadyConfirmed: true });
    }
    return noStoreJson({ error: "Unable to record the completion confirmation." }, 500);
  }
  const [provider] = await db.select({ id: providerApplications.id })
    .from(providerApplications)
    .where(eq(providerApplications.email, quote.providerEmail))
    .limit(1);
  await appendJobLifecycleEvent({
    requestId: job.id,
    quoteId: quote.id,
    providerId: provider?.id ?? "",
    actorRole: "customer",
    actorId: job.email,
    eventType: "customer_completion_confirmed",
    fromStatus: job.status,
    toStatus: job.status,
    scopeVersion: quote.scopeVersion,
    details: {
      invoiceNumber: scope.invoiceNumber,
      agreementHash: expectedHash,
    },
  });
  return noStoreJson({ ok: true, confirmedAt: acceptedAt }, 201);
}
