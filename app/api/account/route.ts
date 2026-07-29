import { desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  customerRequests,
  providerQuotes,
  stripePayments,
} from "../../../db/schema";
import {
  getAccountSession,
  providerAccountFor,
} from "../../../lib/account-auth";

export async function GET(request: Request) {
  try {
    const session = await getAccountSession(request);
    if (!session) {
      return Response.json(
        { error: "Sign in to open your Tuveloz workspace." },
        { status: 401, headers: { "cache-control": "no-store" } },
      );
    }

    if (session.role === "customer") {
      const requests = await getDb().select({
        id: customerRequests.id,
        vehicle: customerRequests.vehicle,
        service: customerRequests.service,
        launchArea: customerRequests.launchArea,
        municipality: customerRequests.municipality,
        status: customerRequests.status,
        createdAt: customerRequests.createdAt,
      }).from(customerRequests)
        .where(eq(customerRequests.email, session.email))
        .orderBy(desc(customerRequests.createdAt))
        .limit(100);
      const quoteRows = requests.length > 0
        ? await getDb().select({
            requestId: providerQuotes.requestId,
          }).from(providerQuotes)
            .where(inArray(providerQuotes.requestId, requests.map((item) => item.id)))
        : [];
      const quoteCounts = quoteRows.reduce<Record<string, number>>((counts, quote) => {
        counts[quote.requestId] = (counts[quote.requestId] ?? 0) + 1;
        return counts;
      }, {});
      const payments = await getDb().select({
        id: stripePayments.id,
        paymentType: stripePayments.paymentType,
        requestId: stripePayments.requestId,
        productName: stripePayments.productName,
        currency: stripePayments.currency,
        quantity: stripePayments.quantity,
        providerAmountCents: stripePayments.providerAmountCents,
        applicationFeeCents: stripePayments.applicationFeeCents,
        customerTotalCents: stripePayments.customerTotalCents,
        status: stripePayments.status,
        paidAt: stripePayments.paidAt,
        refundAmountCents: stripePayments.refundAmountCents,
        refundedAt: stripePayments.refundedAt,
        disputeStatus: stripePayments.disputeStatus,
        createdAt: stripePayments.createdAt,
      }).from(stripePayments)
        .where(sql`lower(${stripePayments.customerEmail}) = ${session.email.toLowerCase()}`)
        .orderBy(desc(stripePayments.createdAt))
        .limit(100);
      return Response.json({
        role: "customer",
        email: session.email,
        availableRoles: session.availableRoles,
        requests: requests.map((item) => ({
          ...item,
          quoteCount: quoteCounts[item.id] ?? 0,
        })),
        payments,
      }, { headers: { "cache-control": "no-store" } });
    }

    const provider = await providerAccountFor(session.email);
    if (!provider) {
      return Response.json(
        { error: "Verified provider access is no longer active." },
        { status: 403, headers: { "cache-control": "no-store" } },
      );
    }
    return Response.json({
      role: "provider",
      email: session.email,
      availableRoles: session.availableRoles,
      provider: {
        name: provider.name,
        verificationStatus: provider.verificationStatus,
      },
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("Unable to load a Tuveloz account", error);
    return Response.json(
      { error: "Account access is temporarily unavailable." },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
