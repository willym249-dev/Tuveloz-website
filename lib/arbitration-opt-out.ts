import { and, eq } from "drizzle-orm";
import { getDb } from "../db";
import { arbitrationOptOuts } from "../db/schema";
import { TERMS_VERSION } from "./policies";

/**
 * Section 13 of the Terms of Use gives everyone 30 days to decline the
 * arbitration agreement, at no cost, with a written confirmation, and with no
 * effect on their account. This module is how that promise is kept.
 *
 * Three things make it different from an ordinary form handler:
 *
 * 1. **The record is the point.** Whether a person is bound by the arbitration
 *    agreement can matter years later, in front of a judge deciding a motion
 *    to compel. So rows are append-only — never edited, never deleted — and
 *    each one stores which version of the Terms it was made against.
 * 2. **An opt-out is scoped to a version.** Declining arbitration under the
 *    2026-08-07 Terms is not a standing refusal of every future version; a new
 *    version restarts the 30 days and gets its own row. That is the same rule
 *    the Terms state, so the data has to match the promise.
 * 3. **It cannot fail quietly.** Unlike consent capture, which is best effort,
 *    a failure here has to reach the caller so the person can be told to email
 *    hello@tuveloz.com instead. Silently dropping an opt-out would leave
 *    someone believing they had preserved a right they had not.
 */

export const ARBITRATION_OPT_OUT_METHODS = ["form", "email"] as const;
export type ArbitrationOptOutMethod = (typeof ARBITRATION_OPT_OUT_METHODS)[number];

/** Self-reported and display-only. It never changes whether the opt-out counts. */
export const ARBITRATION_OPT_OUT_ROLES = ["customer", "provider", ""] as const;
export type ArbitrationOptOutRole = (typeof ARBITRATION_OPT_OUT_ROLES)[number];

export function isArbitrationOptOutRole(value: unknown): value is ArbitrationOptOutRole {
  return typeof value === "string"
    && (ARBITRATION_OPT_OUT_ROLES as readonly string[]).includes(value);
}

export type ArbitrationOptOutResult =
  | { status: "recorded"; id: string; termsVersion: string; recordedAt: string }
  | { status: "already_recorded"; id: string; termsVersion: string; recordedAt: string };

/**
 * Records an opt-out and returns the stored row.
 *
 * Idempotent on (email, terms version): submitting twice is not an error and
 * not a second opt-out, it returns the first one. The original timestamp is
 * kept, because the date the right was exercised is the fact that matters, and
 * a resubmission must never move it later than the 30-day window.
 *
 * Throws if the write fails. The caller is expected to tell the person to use
 * the email route rather than pretend it worked.
 */
export async function recordArbitrationOptOut(input: {
  email: string;
  role?: ArbitrationOptOutRole;
  method: ArbitrationOptOutMethod;
  /** Defaults to the Terms version currently published. */
  termsVersion?: string;
  now?: string;
}): Promise<ArbitrationOptOutResult> {
  const email = input.email.trim().toLowerCase();
  if (!email) throw new Error("An arbitration opt-out needs an email address.");
  const termsVersion = (input.termsVersion ?? TERMS_VERSION).trim();
  if (!termsVersion) throw new Error("An arbitration opt-out needs a Terms version.");

  const db = getDb();
  const recordedAt = input.now ?? new Date().toISOString();
  const id = crypto.randomUUID();

  await db.insert(arbitrationOptOuts).values({
    id,
    email,
    role: input.role ?? "",
    termsVersion,
    method: input.method,
    recordedAt,
    confirmationSentAt: "",
  }).onConflictDoNothing({
    target: [arbitrationOptOuts.email, arbitrationOptOuts.termsVersion],
  });

  const [stored] = await db.select({
    id: arbitrationOptOuts.id,
    recordedAt: arbitrationOptOuts.recordedAt,
  }).from(arbitrationOptOuts)
    .where(and(
      eq(arbitrationOptOuts.email, email),
      eq(arbitrationOptOuts.termsVersion, termsVersion),
    ))
    .limit(1);

  if (!stored) throw new Error("The arbitration opt-out did not save.");

  return {
    status: stored.id === id ? "recorded" : "already_recorded",
    id: stored.id,
    termsVersion,
    recordedAt: stored.recordedAt,
  };
}

/**
 * Stamps that the written confirmation went out. Best effort on purpose: the
 * opt-out is already valid without it, so a mail failure must never look like
 * a failure to opt out.
 */
export async function markArbitrationOptOutConfirmed(id: string, now?: string) {
  try {
    await getDb().update(arbitrationOptOuts)
      .set({ confirmationSentAt: now ?? new Date().toISOString() })
      .where(eq(arbitrationOptOuts.id, id));
  } catch (error) {
    console.error("Unable to stamp an arbitration opt-out confirmation", error);
  }
}

/** Whether this address declined arbitration under a given Terms version. */
export async function hasOptedOutOfArbitration(
  email: string,
  termsVersion: string = TERMS_VERSION,
) {
  const [row] = await getDb().select({ id: arbitrationOptOuts.id })
    .from(arbitrationOptOuts)
    .where(and(
      eq(arbitrationOptOuts.email, email.trim().toLowerCase()),
      eq(arbitrationOptOuts.termsVersion, termsVersion.trim()),
    ))
    .limit(1);
  return Boolean(row);
}
