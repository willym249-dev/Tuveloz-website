import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import { referralCodes, referralSignups } from "../db/schema";
import { generateReferralCode, normalizeReferralCode } from "./referral-code";

export { generateReferralCode, normalizeReferralCode } from "./referral-code";

/**
 * Referral attribution.
 *
 * A share code records who told someone about Tuveloz. That is all it does.
 * It never pays anything, never changes search ranking or job routing, and
 * never gives the referrer access to the referred person's details — the
 * founding-provider policy refuses ranking or routing preference outright, and
 * a referral must not become a way around that.
 */

export const REFERRAL_ROLES = ["provider", "customer"] as const;
export type ReferralRole = (typeof REFERRAL_ROLES)[number];

export function isReferralRole(value: string): value is ReferralRole {
  return (REFERRAL_ROLES as readonly string[]).includes(value);
}

/** One-way key so a referred person's address is never stored twice. */
export async function referredKeyHash(email: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(email.trim().toLowerCase()),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * The account's existing code, or a newly issued one. Codes are stable: an
 * account keeps the same code so a link already shared keeps working.
 */
export async function referralCodeFor(role: ReferralRole, email: string) {
  const db = getDb();
  const normalizedEmail = email.trim().toLowerCase();
  const [existing] = await db.select().from(referralCodes)
    .where(and(
      eq(referralCodes.ownerRole, role),
      sql`lower(${referralCodes.ownerEmail}) = ${normalizedEmail}`,
    ))
    .limit(1);
  if (existing) return existing;

  // A code collision is astronomically unlikely but must not hand one
  // account another's code, so the insert is allowed to fail and re-read.
  const now = new Date().toISOString();
  const code = generateReferralCode();
  try {
    await db.insert(referralCodes).values({
      code,
      ownerRole: role,
      ownerEmail: normalizedEmail,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
  } catch {
    const [raced] = await db.select().from(referralCodes)
      .where(and(
        eq(referralCodes.ownerRole, role),
        sql`lower(${referralCodes.ownerEmail}) = ${normalizedEmail}`,
      ))
      .limit(1);
    if (raced) return raced;
    throw new Error("Unable to issue a referral code.");
  }
  return {
    code,
    ownerRole: role,
    ownerEmail: normalizedEmail,
    status: "active",
    createdAt: now,
    updatedAt: now,
  };
}

export async function referralSignupCount(role: ReferralRole, email: string) {
  const [row] = await getDb().select({ count: sql<number>`count(*)` })
    .from(referralSignups)
    .where(and(
      eq(referralSignups.referrerRole, role),
      sql`lower(${referralSignups.referrerEmail}) = ${email.trim().toLowerCase()}`,
    ));
  return Number(row?.count ?? 0);
}

/**
 * Credits a signup to a share code. Best effort by design: attribution must
 * never be able to fail a real application or account creation, and a person
 * is credited at most once, to the first code that named them.
 */
export async function recordReferralSignup(input: {
  rawCode: unknown;
  referredRole: ReferralRole;
  referredEmail: string;
  referredEntityId: string;
}) {
  const code = normalizeReferralCode(input.rawCode);
  if (!code) return null;
  try {
    const db = getDb();
    const [owner] = await db.select().from(referralCodes)
      .where(and(eq(referralCodes.code, code), eq(referralCodes.status, "active")))
      .limit(1);
    if (!owner) return null;
    // Nobody refers themselves.
    if (owner.ownerEmail.toLowerCase() === input.referredEmail.trim().toLowerCase()) {
      return null;
    }
    const referredKey = await referredKeyHash(input.referredEmail);
    await db.insert(referralSignups).values({
      id: crypto.randomUUID(),
      code,
      referrerRole: owner.ownerRole,
      referrerEmail: owner.ownerEmail,
      referredRole: input.referredRole,
      referredEntityId: input.referredEntityId,
      referredKey,
      status: "recorded",
      createdAt: new Date().toISOString(),
    }).onConflictDoNothing();
    return code;
  } catch (error) {
    console.error("Unable to record a referral signup", error);
    return null;
  }
}
