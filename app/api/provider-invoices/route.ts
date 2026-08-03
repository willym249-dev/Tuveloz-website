import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { providerInvoices } from "../../../db/schema";
import {
  getAccountSession,
  providerAccountFor,
  testProviderAccountFor,
} from "../../../lib/account-auth";

const NO_STORE_HEADERS = { "cache-control": "no-store" };

async function activeProvider(request: Request) {
  const session = await getAccountSession(request);
  if (!session || session.role !== "provider") return null;
  return (await providerAccountFor(session.email))
    || (await testProviderAccountFor(session.email));
}

export async function GET(request: Request) {
  const provider = await activeProvider(request);
  if (!provider) {
    return Response.json({ error: "Sign in as a provider to view invoices." }, { status: 401 });
  }

  const invoices = await getDb().select().from(providerInvoices)
    .where(eq(providerInvoices.providerId, provider.id))
    .orderBy(desc(providerInvoices.createdAt));

  return Response.json({
    invoices: invoices.map((invoice) => ({
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      totalAmountCents: invoice.totalAmountCents,
      laborAmountCents: invoice.laborAmountCents,
      partsAmountCents: invoice.partsAmountCents,
      taxAmountCents: invoice.taxAmountCents,
      workSummary: invoice.workSummary,
      issuedAt: invoice.issuedAt,
      createdAt: invoice.createdAt,
    })),
  }, { headers: NO_STORE_HEADERS });
}
