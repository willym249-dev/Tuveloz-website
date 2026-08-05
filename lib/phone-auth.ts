import { env } from "cloudflare:workers";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../db";
import { accountPhoneNumbers, phoneLoginCodes } from "../db/schema";
import {
  constantTimeEqual,
  createAccountSession,
  eligibleAccountRoles,
  hmacHex,
  isAccountRole,
  parseStoredDate,
  randomDigits,
  type AccountRole,
} from "./account-auth";
import { sendAccountSecurityAlert } from "./email-notifications";

/**
 * Launch boundary. Production SMS delivery stays code-locked off until a vetted
 * SMS sender/verification service, billing/rate caps, consent wording, privacy
 * treatment, and abuse controls are configured and reviewed. This mirrors the
 * fail-closed `STRIPE_LIVE_MODE_ENABLED = false` pattern: with the lock off,
 * every send path throws "not configured" and no text is ever delivered, so the
 * flow cannot be exercised in production by accident. Phone sign-in never grants
 * or elevates owner/admin access — owner access stays on the separate Cloudflare
 * Access application and is unaffected by anything in this module.
 */
export const PHONE_SMS_LIVE_MODE_ENABLED = false;

const CODE_LIFETIME_MS = 10 * 60 * 1000;
const SEND_RATE_WINDOW_MS = 15 * 60 * 1000;
const SEND_RATE_LIMIT = 3;
const RESEND_COOLDOWN_MS = 60 * 1000;
const DAILY_SEND_LIMIT = 5;
const DAILY_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_ATTEMPTS = 5;

type PhonePurpose = "signin" | "add";

type RuntimeEnv = Record<string, string | undefined>;

function runtimeEnv() {
  return env as unknown as RuntimeEnv;
}

/**
 * Normalizes user-entered input to a U.S. E.164 number (+1XXXXXXXXXX) or "".
 * Enforces NANP area/exchange rules (both start 2-9) so obvious junk never
 * reaches the SMS sender. Returns "" for anything that is not a valid U.S.
 * mobile-format number, which callers treat as "not eligible" without leaking
 * whether a real account exists.
 */
export function normalizeUsPhone(value: unknown): string {
  if (typeof value !== "string") return "";
  let national = value.replace(/[^\d]/g, "");
  if (national.length === 11 && national.startsWith("1")) {
    national = national.slice(1);
  }
  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(national)) return "";
  return `+1${national}`;
}

export function isValidUsE164(value: string): boolean {
  return /^\+1[2-9]\d{2}[2-9]\d{6}$/.test(value);
}

/** Last four digits for a privacy-preserving confirmation display. */
export function maskedPhone(value: string): string {
  return isValidUsE164(value) ? `•••-•••-${value.slice(-4)}` : "";
}

/** Whether text sign-in can actually deliver right now (live lock + secrets). */
export function phoneSignInIsLive(): boolean {
  return smsIsConfigured();
}

/** Masked current phone for the signed-in account, or "" if none is set. */
export async function accountPhoneMasked(email: string): Promise<string> {
  const [row] = await getDb().select({ phoneE164: accountPhoneNumbers.phoneE164 })
    .from(accountPhoneNumbers)
    .where(eq(accountPhoneNumbers.email, email))
    .limit(1);
  return row ? maskedPhone(row.phoneE164) : "";
}

function smsIsConfigured(): boolean {
  const variables = runtimeEnv();
  return PHONE_SMS_LIVE_MODE_ENABLED
    && Boolean(variables.SMS_PROVIDER)
    && Boolean(variables.SMS_API_URL)
    && Boolean(variables.SMS_API_KEY)
    && Boolean(variables.SMS_SENDER_ID);
}

/**
 * Sends a one-time code by SMS. Fail-closed: throws unless the live-mode lock is
 * released AND every SMS secret is present. Only requested authentication texts
 * are sent — no marketing enrollment. The plaintext code and message body are
 * never logged or persisted; only a delivery status is logged on failure.
 */
async function sendSmsCode(phone: string, code: string, purpose: PhonePurpose) {
  const variables = runtimeEnv();
  if (!smsIsConfigured()) {
    throw new Error("SMS sign-in is not configured.");
  }
  const actionLabel = purpose === "add"
    ? "verify this phone number"
    : "sign in";
  const message = [
    `Tuveloz code: ${code}.`,
    `Use it to ${actionLabel}. It expires in 10 minutes and can be used once.`,
    "Message and data rates may apply. Reply STOP to opt out.",
  ].join(" ");
  const response = await fetch(String(variables.SMS_API_URL), {
    method: "POST",
    headers: {
      authorization: `Bearer ${variables.SMS_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: variables.SMS_SENDER_ID,
      to: phone,
      text: message,
    }),
  });
  if (!response.ok) {
    console.error("SMS provider rejected a sign-in code", {
      status: response.status,
    });
    throw new Error("The SMS service could not send this code.");
  }
}

async function verifiedPhoneOwnerEmail(phone: string): Promise<string> {
  const [row] = await getDb().select({ email: accountPhoneNumbers.email })
    .from(accountPhoneNumbers)
    .where(eq(accountPhoneNumbers.phoneE164, phone))
    .limit(1);
  return row?.email ?? "";
}

async function sendWindowState(phone: string, purpose: PhonePurpose) {
  const rows = await getDb().select({ createdAt: phoneLoginCodes.createdAt })
    .from(phoneLoginCodes)
    .where(and(
      eq(phoneLoginCodes.phoneE164, phone),
      eq(phoneLoginCodes.purpose, purpose),
    ))
    .orderBy(desc(phoneLoginCodes.createdAt))
    .limit(DAILY_SEND_LIMIT);
  const now = Date.now();
  const times = rows
    .map((row) => parseStoredDate(row.createdAt))
    .filter((value) => Number.isFinite(value));
  return {
    inWindow: times.filter((value) => value >= now - SEND_RATE_WINDOW_MS).length,
    inDay: times.filter((value) => value >= now - DAILY_WINDOW_MS).length,
    lastAt: times.length > 0 ? Math.max(...times) : 0,
  };
}

type IssueResult =
  | { accepted: true; delivered: true }
  | { accepted: false; delivered: false; rateLimited: true };

/**
 * Rate-limits, then generates, hashes, stores, and sends a one-time code. The
 * code is hashed with the server pepper (HMAC) before storage — the plaintext
 * is only ever held in memory to send the text. If the send fails, the stored
 * row is deleted so a failed attempt never counts against verification.
 */
async function issuePhoneCode(
  phone: string,
  purpose: PhonePurpose,
  email: string,
): Promise<IssueResult> {
  const sends = await sendWindowState(phone, purpose);
  const now = Date.now();
  if (
    sends.inWindow >= SEND_RATE_LIMIT
    || sends.inDay >= DAILY_SEND_LIMIT
    || (sends.lastAt > 0 && now - sends.lastAt < RESEND_COOLDOWN_MS)
  ) {
    return { accepted: false, delivered: false, rateLimited: true };
  }

  const id = crypto.randomUUID();
  const code = randomDigits();
  const codeHash = await hmacHex(`${id}:${phone}:${purpose}:${email}:${code}`);
  const createdAt = new Date().toISOString();
  await getDb().insert(phoneLoginCodes).values({
    id,
    phoneE164: phone,
    purpose,
    email,
    codeHash,
    expiresAt: new Date(now + CODE_LIFETIME_MS).toISOString(),
    attempts: 0,
    usedAt: "",
    createdAt,
  });

  try {
    await sendSmsCode(phone, code, purpose);
  } catch (error) {
    await getDb().delete(phoneLoginCodes).where(eq(phoneLoginCodes.id, id));
    throw error;
  }
  return { accepted: true, delivered: true };
}

/**
 * Starts phone sign-in. Enumeration-safe: an invalid number, an unknown number,
 * or a number whose account has no eligible role all return the same generic
 * "accepted" shape with no text sent and no persisted row, so a caller cannot
 * tell whether a number is registered. Only a verified number bound to an
 * eligible account triggers a real send.
 */
export async function requestPhoneSignInCode(rawPhone: unknown) {
  const phone = normalizeUsPhone(rawPhone);
  if (!phone) return { accepted: true, delivered: false } as const;
  const email = await verifiedPhoneOwnerEmail(phone);
  if (!email) return { accepted: true, delivered: false } as const;
  const roles = await eligibleAccountRoles(email);
  if (roles.length === 0) return { accepted: true, delivered: false } as const;
  const result = await issuePhoneCode(phone, "signin", email);
  if (!result.accepted) {
    return { accepted: false, delivered: false, rateLimited: true } as const;
  }
  return { accepted: true, delivered: true } as const;
}

/**
 * Verifies a phone sign-in code and, on success, creates a customer/provider
 * session. Attempts are capped and the code is single-use. Ownership is
 * re-checked at verification time (number-recycling safeguard): if the number
 * no longer maps to the same account, the code is burned and no session is
 * created. The chosen role must be one the account is eligible for; the code
 * never yields owner/admin access.
 */
export async function verifyPhoneSignInCode(
  rawPhone: unknown,
  rawCode: unknown,
  preferredRole?: unknown,
) {
  const phone = normalizeUsPhone(rawPhone);
  const code = typeof rawCode === "string" ? rawCode.trim() : "";
  if (!phone || !/^\d{6}$/.test(code)) return { ok: false as const };

  const [challenge] = await getDb().select().from(phoneLoginCodes)
    .where(and(
      eq(phoneLoginCodes.phoneE164, phone),
      eq(phoneLoginCodes.purpose, "signin"),
      eq(phoneLoginCodes.usedAt, ""),
    ))
    .orderBy(desc(phoneLoginCodes.createdAt))
    .limit(1);
  if (
    !challenge
    || challenge.attempts >= MAX_ATTEMPTS
    || parseStoredDate(challenge.expiresAt) <= Date.now()
  ) {
    return { ok: false as const };
  }

  const suppliedHash = await hmacHex(
    `${challenge.id}:${phone}:signin:${challenge.email}:${code}`,
  );
  if (!constantTimeEqual(challenge.codeHash, suppliedHash)) {
    const attempts = challenge.attempts + 1;
    await getDb().update(phoneLoginCodes).set({
      attempts,
      usedAt: attempts >= MAX_ATTEMPTS ? new Date().toISOString() : "",
    }).where(eq(phoneLoginCodes.id, challenge.id));
    return { ok: false as const };
  }

  const burn = async () => {
    await getDb().update(phoneLoginCodes)
      .set({ usedAt: new Date().toISOString() })
      .where(eq(phoneLoginCodes.id, challenge.id));
  };

  const currentOwner = await verifiedPhoneOwnerEmail(phone);
  if (!currentOwner || currentOwner !== challenge.email) {
    await burn();
    return { ok: false as const };
  }
  const roles = await eligibleAccountRoles(challenge.email);
  if (roles.length === 0) {
    await burn();
    return { ok: false as const };
  }
  await burn();

  const role: AccountRole = isAccountRole(preferredRole)
    && roles.includes(preferredRole)
    ? preferredRole
    : roles.includes("customer")
      ? "customer"
      : roles[0];
  const session = await createAccountSession(challenge.email, role);
  return session ? { ok: true as const, ...session } : { ok: false as const };
}

/**
 * Starts adding or changing the phone number on an already-authenticated
 * account. The route enforces step-up re-authentication before calling this. If
 * the number is already verified on a different account, this returns the same
 * generic "accepted" shape without sending — so it never reveals that a number
 * belongs to someone else, and it never hijacks another account's number.
 */
export async function requestPhoneChangeCode(
  accountEmail: string,
  rawPhone: unknown,
) {
  const phone = normalizeUsPhone(rawPhone);
  if (!phone) return { ok: false as const, reason: "invalid_phone" as const };

  const existingOwner = await verifiedPhoneOwnerEmail(phone);
  if (existingOwner && existingOwner !== accountEmail) {
    return { ok: true as const, delivered: false };
  }
  const result = await issuePhoneCode(phone, "add", accountEmail);
  if (!result.accepted) {
    return { ok: false as const, reason: "rate_limited" as const };
  }
  return { ok: true as const, delivered: true };
}

/**
 * Confirms a phone add/change by one-time code and binds the verified number to
 * the account (one number per account; one account per number). Sends an
 * out-of-band security alert to the account email so a surprise change is
 * visible even if the attacker controls the phone.
 */
export async function confirmPhoneChange(
  accountEmail: string,
  accountRole: AccountRole,
  rawPhone: unknown,
  rawCode: unknown,
) {
  const phone = normalizeUsPhone(rawPhone);
  const code = typeof rawCode === "string" ? rawCode.trim() : "";
  if (!phone || !/^\d{6}$/.test(code)) return { ok: false as const };

  const [challenge] = await getDb().select().from(phoneLoginCodes)
    .where(and(
      eq(phoneLoginCodes.phoneE164, phone),
      eq(phoneLoginCodes.purpose, "add"),
      eq(phoneLoginCodes.email, accountEmail),
      eq(phoneLoginCodes.usedAt, ""),
    ))
    .orderBy(desc(phoneLoginCodes.createdAt))
    .limit(1);
  if (
    !challenge
    || challenge.attempts >= MAX_ATTEMPTS
    || parseStoredDate(challenge.expiresAt) <= Date.now()
  ) {
    return { ok: false as const };
  }

  const suppliedHash = await hmacHex(
    `${challenge.id}:${phone}:add:${accountEmail}:${code}`,
  );
  if (!constantTimeEqual(challenge.codeHash, suppliedHash)) {
    const attempts = challenge.attempts + 1;
    await getDb().update(phoneLoginCodes).set({
      attempts,
      usedAt: attempts >= MAX_ATTEMPTS ? new Date().toISOString() : "",
    }).where(eq(phoneLoginCodes.id, challenge.id));
    return { ok: false as const };
  }

  // Re-check ownership at commit time so a race cannot bind a number another
  // account verified in the meantime; the unique index is the final backstop.
  const existingOwner = await verifiedPhoneOwnerEmail(phone);
  if (existingOwner && existingOwner !== accountEmail) {
    await getDb().update(phoneLoginCodes)
      .set({ usedAt: new Date().toISOString() })
      .where(eq(phoneLoginCodes.id, challenge.id));
    return { ok: false as const };
  }

  const now = new Date().toISOString();
  await getDb().insert(accountPhoneNumbers).values({
    email: accountEmail,
    phoneE164: phone,
    verifiedAt: now,
    createdAt: now,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: accountPhoneNumbers.email,
    set: { phoneE164: phone, verifiedAt: now, updatedAt: now },
  });
  await getDb().update(phoneLoginCodes)
    .set({ usedAt: now })
    .where(eq(phoneLoginCodes.id, challenge.id));

  await sendAccountSecurityAlert({
    eventId: challenge.id,
    email: accountEmail,
    role: accountRole,
    action: "phone_updated",
  });
  return { ok: true as const, phone };
}
