import { env } from "cloudflare:workers";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../db";
import {
  authSessions,
  customerRequests,
  loginCodes,
  providerApplications,
} from "../db/schema";

export const ACCOUNT_ROLES = ["customer", "provider"] as const;
export type AccountRole = (typeof ACCOUNT_ROLES)[number];

const LOGIN_CODE_LIFETIME_MS = 10 * 60 * 1000;
const LOGIN_RATE_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_RATE_LIMIT = 3;
const LOGIN_MAX_ATTEMPTS = 5;
const SESSION_LIFETIME_SECONDS = 30 * 24 * 60 * 60;
const SESSION_LIFETIME_MS = SESSION_LIFETIME_SECONDS * 1000;
const PRODUCTION_COOKIE_NAME = "__Host-tuveloz_session";
const LOCAL_COOKIE_NAME = "tuveloz_session";

type RuntimeEnv = Record<string, string | undefined>;

function runtimeEnv() {
  return env as unknown as RuntimeEnv;
}

export function normalizeAccountEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase().slice(0, 180) : "";
}

export function isAccountRole(value: unknown): value is AccountRole {
  return ACCOUNT_ROLES.includes(value as AccountRole);
}

export function isValidAccountEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

function secret() {
  const value = runtimeEnv().AUTH_CODE_SECRET ?? "";
  if (value.length < 32) {
    throw new Error("AUTH_CODE_SECRET must be configured with at least 32 characters.");
  }
  return value;
}

function randomDigits() {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return String(values[0] % 1_000_000).padStart(6, "0");
}

function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const value of bytes) binary += String.fromCharCode(value);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function hmacHex(value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

function parseStoredDate(value: string) {
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
    ? `${value.replace(" ", "T")}Z`
    : value;
  return Date.parse(normalized);
}

function cookiesFor(request: Request) {
  const result = new Map<string, string>();
  for (const pair of (request.headers.get("cookie") ?? "").split(";")) {
    const [rawName, ...rawValue] = pair.trim().split("=");
    if (rawName) result.set(rawName, rawValue.join("="));
  }
  return result;
}

function requestIsSecure(request: Request) {
  return new URL(request.url).protocol === "https:";
}

function sessionTokenFrom(request: Request) {
  const cookies = cookiesFor(request);
  return cookies.get(PRODUCTION_COOKIE_NAME) ?? cookies.get(LOCAL_COOKIE_NAME) ?? "";
}

export function sessionCookie(request: Request, token: string) {
  const secure = requestIsSecure(request);
  const name = secure ? PRODUCTION_COOKIE_NAME : LOCAL_COOKIE_NAME;
  return [
    `${name}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    secure ? "Secure" : "",
    `Max-Age=${SESSION_LIFETIME_SECONDS}`,
  ].filter(Boolean).join("; ");
}

export function expiredSessionCookies(request: Request) {
  const secure = requestIsSecure(request);
  const expires = "Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; Path=/; HttpOnly; SameSite=Lax";
  return [
    `${PRODUCTION_COOKIE_NAME}=; ${expires}; Secure`,
    `${LOCAL_COOKIE_NAME}=; ${expires}${secure ? "; Secure" : ""}`,
  ];
}

async function verifiedProviderFor(email: string) {
  const [provider] = await getDb().select().from(providerApplications)
    .where(and(
      eq(providerApplications.email, email),
      eq(providerApplications.status, "approved"),
      eq(providerApplications.verificationStatus, "verified"),
      eq(providerApplications.isTestProvider, "no"),
    ))
    .limit(1);
  return provider ?? null;
}

export async function eligibleAccountRoles(email: string): Promise<AccountRole[]> {
  const [customerRows, provider] = await Promise.all([
    getDb().select({ id: customerRequests.id }).from(customerRequests)
      .where(eq(customerRequests.email, email)).limit(1),
    verifiedProviderFor(email),
  ]);
  const roles: AccountRole[] = [];
  if (customerRows.length > 0) roles.push("customer");
  if (provider) roles.push("provider");
  return roles;
}

async function sendLoginCodeEmail(
  email: string,
  role: AccountRole,
  code: string,
) {
  const apiKey = runtimeEnv().RESEND_API_KEY;
  const from = runtimeEnv().RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    throw new Error("Passwordless email is not configured.");
  }

  const roleLabel = role === "provider" ? "verified provider" : "customer";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: "Your Tuveloz sign-in code",
      text: [
        `Your Tuveloz ${roleLabel} sign-in code is:`,
        "",
        code,
        "",
        "This code expires in 10 minutes and can be used once.",
        "If you did not request it, you can ignore this email.",
      ].join("\n"),
    }),
  });
  if (!response.ok) {
    console.error("Resend rejected a sign-in code", {
      status: response.status,
      responseBody: await response.text(),
    });
    throw new Error("The email service could not send this code.");
  }
}

export async function requestAccountCode(email: string, role: AccountRole) {
  const roles = await eligibleAccountRoles(email);
  if (!roles.includes(role)) {
    return { accepted: true, delivered: false };
  }

  const recent = await getDb().select({ createdAt: loginCodes.createdAt })
    .from(loginCodes)
    .where(and(eq(loginCodes.email, email), eq(loginCodes.role, role)))
    .orderBy(desc(loginCodes.createdAt))
    .limit(LOGIN_RATE_LIMIT);
  const cutoff = Date.now() - LOGIN_RATE_WINDOW_MS;
  if (recent.filter((item) => parseStoredDate(item.createdAt) >= cutoff).length >= LOGIN_RATE_LIMIT) {
    return { accepted: false, delivered: false, rateLimited: true };
  }

  const id = crypto.randomUUID();
  const code = randomDigits();
  const createdAt = new Date().toISOString();
  const codeHash = await hmacHex(`${id}:${email}:${role}:${code}`);
  await getDb().insert(loginCodes).values({
    id,
    email,
    role,
    codeHash,
    expiresAt: new Date(Date.now() + LOGIN_CODE_LIFETIME_MS).toISOString(),
    attempts: 0,
    usedAt: "",
    createdAt,
  });

  try {
    await sendLoginCodeEmail(email, role, code);
  } catch (error) {
    await getDb().delete(loginCodes).where(eq(loginCodes.id, id));
    throw error;
  }
  return { accepted: true, delivered: true };
}

export async function verifyAccountCode(
  email: string,
  role: AccountRole,
  code: string,
) {
  const [challenge] = await getDb().select().from(loginCodes)
    .where(and(
      eq(loginCodes.email, email),
      eq(loginCodes.role, role),
      eq(loginCodes.usedAt, ""),
    ))
    .orderBy(desc(loginCodes.createdAt))
    .limit(1);
  if (
    !challenge
    || challenge.attempts >= LOGIN_MAX_ATTEMPTS
    || parseStoredDate(challenge.expiresAt) <= Date.now()
  ) {
    return { ok: false as const };
  }

  const suppliedHash = await hmacHex(`${challenge.id}:${email}:${role}:${code}`);
  if (!constantTimeEqual(challenge.codeHash, suppliedHash)) {
    const attempts = challenge.attempts + 1;
    await getDb().update(loginCodes).set({
      attempts,
      usedAt: attempts >= LOGIN_MAX_ATTEMPTS ? new Date().toISOString() : "",
    }).where(eq(loginCodes.id, challenge.id));
    return { ok: false as const };
  }

  const roles = await eligibleAccountRoles(email);
  if (!roles.includes(role)) {
    await getDb().update(loginCodes).set({ usedAt: new Date().toISOString() })
      .where(eq(loginCodes.id, challenge.id));
    return { ok: false as const };
  }

  const token = randomToken();
  const tokenHash = await hmacHex(`session:${token}`);
  const now = new Date().toISOString();
  await getDb().update(loginCodes).set({ usedAt: now })
    .where(eq(loginCodes.id, challenge.id));
  await getDb().insert(authSessions).values({
    id: crypto.randomUUID(),
    tokenHash,
    email,
    role,
    expiresAt: new Date(Date.now() + SESSION_LIFETIME_MS).toISOString(),
    createdAt: now,
    lastSeenAt: now,
  });

  return {
    ok: true as const,
    token,
    role,
    roles,
    destination: role === "customer" ? "/customer" : "/provider-jobs",
  };
}

export async function getAccountSession(request: Request) {
  const token = sessionTokenFrom(request);
  if (!token) return null;
  const tokenHash = await hmacHex(`session:${token}`);
  const [session] = await getDb().select().from(authSessions)
    .where(eq(authSessions.tokenHash, tokenHash)).limit(1);
  if (!session || parseStoredDate(session.expiresAt) <= Date.now() || !isAccountRole(session.role)) {
    if (session) await getDb().delete(authSessions).where(eq(authSessions.id, session.id));
    return null;
  }
  const roles = await eligibleAccountRoles(session.email);
  if (!roles.includes(session.role)) {
    await getDb().delete(authSessions).where(eq(authSessions.id, session.id));
    return null;
  }
  return { ...session, role: session.role as AccountRole, availableRoles: roles };
}

export async function switchAccountRole(request: Request, role: AccountRole) {
  const session = await getAccountSession(request);
  if (!session || !session.availableRoles.includes(role)) return null;
  await getDb().update(authSessions).set({
    role,
    lastSeenAt: new Date().toISOString(),
  }).where(eq(authSessions.id, session.id));
  return {
    role,
    destination: role === "customer" ? "/customer" : "/provider-jobs",
  };
}

export async function endAccountSession(request: Request) {
  const token = sessionTokenFrom(request);
  if (!token) return;
  const tokenHash = await hmacHex(`session:${token}`);
  await getDb().delete(authSessions).where(eq(authSessions.tokenHash, tokenHash));
}

export async function providerAccountFor(email: string) {
  return verifiedProviderFor(email);
}
