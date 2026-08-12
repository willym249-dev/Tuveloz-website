import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import { phoneContactConsents } from "../db/schema";
import { resolvePhoneContactConsent } from "./phone-consent-text";

export * from "./phone-consent-text";

/**
 * Server-side storage for phone contact consent. The wording, versions, and
 * pure resolution rules live in ./phone-consent-text so a browser form can
 * apply and display exactly what the server records.
 */

export const PHONE_CONSENT_ROLES = ["customer", "provider", "fleet"] as const;
export type PhoneConsentRole = (typeof PHONE_CONSENT_ROLES)[number];

function newRevokeToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Writes the central record every promotional sender must consult.
 *
 * Best effort: recording consent must never fail the application, request, or
 * inquiry it came from. Two rules keep a stored number honest across repeat
 * submissions — a new opt-in clears an earlier revocation, because the person
 * just asked again; and re-submitting *without* ticking the box never silently
 * upgrades an existing record, it only refreshes the number.
 */
export async function recordPhoneContactConsent(input: {
  role: PhoneConsentRole;
  email: string;
  phone: unknown;
  smsMarketingConsent: unknown;
  source: string;
  spanish?: boolean;
}) {
  try {
    const email = input.email.trim().toLowerCase();
    if (!email) return null;
    const resolved = resolvePhoneContactConsent({
      phone: input.phone,
      smsMarketingConsent: input.smsMarketingConsent,
      spanish: input.spanish,
    });
    if (!resolved.phone) return null;

    const db = getDb();
    const now = new Date().toISOString();
    const [existing] = await db.select().from(phoneContactConsents)
      .where(and(
        eq(phoneContactConsents.role, input.role),
        sql`lower(${phoneContactConsents.email}) = ${email}`,
      ))
      .limit(1);

    if (!existing) {
      await db.insert(phoneContactConsents).values({
        id: crypto.randomUUID(),
        role: input.role,
        email,
        phone: resolved.phone,
        source: input.source.slice(0, 60),
        smsMarketingConsentText: resolved.smsMarketingConsentText,
        smsMarketingConsentVersion: resolved.smsMarketingConsentVersion,
        smsMarketingConsentedAt: resolved.smsMarketingConsentedAt,
        smsMarketingRevokedAt: "",
        revokeToken: newRevokeToken(),
        createdAt: now,
        updatedAt: now,
      }).onConflictDoNothing();
      return resolved;
    }

    const optedInNow = Boolean(resolved.smsMarketingConsentedAt);
    await db.update(phoneContactConsents).set({
      phone: resolved.phone,
      source: input.source.slice(0, 60),
      ...(optedInNow
        ? {
          smsMarketingConsentText: resolved.smsMarketingConsentText,
          smsMarketingConsentVersion: resolved.smsMarketingConsentVersion,
          smsMarketingConsentedAt: resolved.smsMarketingConsentedAt,
          // Asking again is a fresh opt-in, so an old revocation lifts.
          smsMarketingRevokedAt: "",
        }
        : {}),
      updatedAt: now,
    }).where(eq(phoneContactConsents.id, existing.id));
    return resolved;
  } catch (error) {
    console.error("Unable to record phone contact consent", error);
    return null;
  }
}

/**
 * Stops promotional texts. Revocation is deliberately easier than consent:
 * it takes only the token, needs no sign-in, and is idempotent, because the
 * FCC's April 2025 rules require honoring an opt-out made by any reasonable
 * method. The number itself is kept so transactional contact about a live job
 * still works — this revokes marketing, not the ability to reach someone about
 * their own vehicle.
 */
export async function revokeMarketingSmsConsent(token: string) {
  const trimmed = token.trim();
  if (!/^[a-f0-9]{64}$/.test(trimmed)) return false;
  const now = new Date().toISOString();
  const result = await getDb().update(phoneContactConsents).set({
    smsMarketingRevokedAt: now,
    updatedAt: now,
  }).where(eq(phoneContactConsents.revokeToken, trimmed));
  return (result.meta.changes ?? 0) > 0;
}
