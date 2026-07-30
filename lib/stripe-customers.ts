import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { getDb } from "../db";
import { stripeCustomers } from "../db/schema";

function normalizedEmail(email: string) {
  return email.trim().toLowerCase();
}

async function stableEmailDigest(email: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(normalizedEmail(email)),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function stripeCustomerIdForEmail(email: string) {
  const [record] = await getDb().select({
    stripeCustomerId: stripeCustomers.stripeCustomerId,
  }).from(stripeCustomers)
    .where(eq(stripeCustomers.customerEmail, normalizedEmail(email)))
    .limit(1);
  return record?.stripeCustomerId ?? "";
}

export async function getOrCreateStripeCustomer(
  stripeClient: Stripe,
  email: string,
) {
  const customerEmail = normalizedEmail(email);
  const existingId = await stripeCustomerIdForEmail(customerEmail);
  if (existingId) {
    try {
      const existing = await stripeClient.customers.retrieve(existingId);
      if (!existing.deleted) return existing.id;
    } catch (error) {
      const stripeError = error as { code?: string; statusCode?: number };
      if (stripeError.code !== "resource_missing" && stripeError.statusCode !== 404) {
        throw error;
      }
    }
  }

  // If Stripe accepted a prior request but the database write failed, this
  // stable key returns the same Customer instead of creating a duplicate.
  const digest = await stableEmailDigest(customerEmail);
  const customer = await stripeClient.customers.create(
    {
      email: customerEmail,
      metadata: {
        tuveloz_account: "customer",
      },
    },
    {
      idempotencyKey: existingId
        ? `tuveloz-customer-replacement-${digest}-${crypto.randomUUID()}`
        : `tuveloz-customer-${digest}`,
    },
  );
  const now = new Date().toISOString();
  await getDb().insert(stripeCustomers).values({
    customerEmail,
    stripeCustomerId: customer.id,
    createdAt: now,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: stripeCustomers.customerEmail,
    set: {
      stripeCustomerId: customer.id,
      updatedAt: now,
    },
  });
  return customer.id;
}
