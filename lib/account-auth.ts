import { env } from "cloudflare:workers";
import { and, desc, eq, ne } from "drizzle-orm";
import { getDb } from "../db";
import {
  accountCredentials,
  authSessions,
  customerRequests,
  loginCodes,
  passwordVerificationCodes,
  providerApplications,
  providerCredentialVerifications,
  providerPathwayProfiles,
  providerServiceEligibility,
} from "../db/schema";
import {
  parseProviderSelfAssessment,
} from "./provider-compliance";
import {
  providerCredentialRequirementsAreSatisfied,
  requiredProviderCredentialRequirements,
} from "./provider-credentials";
import { sendAccountSecurityAlert } from "./email-notifications";
import {
  isPathwayLevelCompatible,
  isProviderLevel,
  isProviderPathway,
  isServiceCode,
  POLICY_JURISDICTION,
  POLICY_VERSION,
} from "./provider-policy";
import { parseProviderServices } from "./service-matching";
import {
  CUSTOMER_POLICY_BUNDLE_VERSION,
  PROVIDER_POLICY_BUNDLE_VERSION,
} from "./policies";
import { ELIGIBILITY_RULES_VERSION } from "./provider-eligibility-engine";

export const ACCOUNT_ROLES = ["customer", "provider"] as const;
export type AccountRole = (typeof ACCOUNT_ROLES)[number];
export const PASSWORD_PURPOSES = ["create", "reset"] as const;
export type PasswordPurpose = (typeof PASSWORD_PURPOSES)[number];
type PasswordChallengePurpose = PasswordPurpose | "signin";

const LOGIN_CODE_LIFETIME_MS = 10 * 60 * 1000;
const LOGIN_RATE_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_RATE_LIMIT = 3;
const LOGIN_MAX_ATTEMPTS = 5;
// Cloudflare Workers rejects a single PBKDF2 operation above 100,000 rounds.
// A server-side HMAC pepper protects the password material before PBKDF2.
const PASSWORD_HASH_ITERATIONS = 100_000;
const PASSWORD_MIN_LENGTH = 10;
const PASSWORD_MAX_LENGTH = 128;
const PASSWORD_LOGIN_MAX_ATTEMPTS = 5;
const PASSWORD_LOCKOUT_MS = 15 * 60 * 1000;
const DUMMY_PASSWORD_SALT = "dHV2ZWxvei1kdW1teS1zYWx0";
const SESSION_LIFETIME_SECONDS = 12 * 60 * 60;
const SESSION_LIFETIME_MS = SESSION_LIFETIME_SECONDS * 1000;
const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const SESSION_TOUCH_INTERVAL_MS = 5 * 60 * 1000;
const PRODUCTION_COOKIE_NAME = "__Host-tuveloz_session";
const LOCAL_COOKIE_NAME = "tuveloz_session";
const BLOCKED_PASSWORDS = new Set([
  "123456789012345",
  "adminadminadmin",
  "iloveyouiloveyou",
  "letmeinletmein",
  "password123456",
  "passwordpassword",
  "qwertyuiopasdfgh",
  "tuveloz12345678",
  "tuveloztuveloz",
]);

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

export function isPasswordPurpose(value: unknown): value is PasswordPurpose {
  return PASSWORD_PURPOSES.includes(value as PasswordPurpose);
}

export function isValidAccountEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function passwordValidationError(value: unknown) {
  if (typeof value !== "string") {
    return "Enter a password.";
  }
  const characterCount = Array.from(value).length;
  if (characterCount < PASSWORD_MIN_LENGTH) {
    return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (characterCount > PASSWORD_MAX_LENGTH) {
    return `Use no more than ${PASSWORD_MAX_LENGTH} characters.`;
  }
  if (!/\p{Lu}/u.test(value)) {
    return "Add at least one uppercase letter.";
  }
  if (!/[^\p{L}\p{N}\s]/u.test(value)) {
    return "Add at least one special character.";
  }
  const normalized = value.normalize("NFKC").toLowerCase();
  if (
    BLOCKED_PASSWORDS.has(normalized)
    || new Set(Array.from(normalized)).size < 3
  ) {
    return "Choose a less common password.";
  }
  return "";
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
  return bytesToBase64Url(bytes);
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const value of bytes) binary += String.fromCharCode(value);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlToBytes(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "=",
  );
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function derivePasswordHash(
  password: string,
  salt: string,
  iterations: number,
) {
  const pepperKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const pepperedPassword = await crypto.subtle.sign(
    "HMAC",
    pepperKey,
    new TextEncoder().encode(`password:${password.normalize("NFKC")}`),
  );
  const material = await crypto.subtle.importKey(
    "raw",
    pepperedPassword,
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: base64UrlToBytes(salt),
      iterations,
    },
    material,
    256,
  );
  return bytesToBase64Url(new Uint8Array(bits));
}

async function createPasswordHash(password: string) {
  const saltBytes = new Uint8Array(16);
  crypto.getRandomValues(saltBytes);
  const salt = bytesToBase64Url(saltBytes);
  return {
    hash: await derivePasswordHash(password, salt, PASSWORD_HASH_ITERATIONS),
    iterations: PASSWORD_HASH_ITERATIONS,
    salt,
  };
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
  const db = getDb();
  const [provider] = await db.select().from(providerApplications)
    .where(and(
      eq(providerApplications.email, email),
      eq(providerApplications.status, "approved"),
      eq(providerApplications.verificationStatus, "verified"),
      eq(providerApplications.isTestProvider, "no"),
    ))
    .limit(1);
  if (!provider) return null;

  const [profile] = await db.select().from(providerPathwayProfiles)
    .where(eq(providerPathwayProfiles.providerId, provider.id))
    .orderBy(desc(providerPathwayProfiles.pathwayVersion))
    .limit(1);
  if (
    !profile
    || profile.status !== "active"
    || profile.policyVersion !== POLICY_VERSION
    || profile.relationshipPath !== "independent_startup"
    || !isProviderPathway(profile.relationshipPath)
    || !isProviderLevel(profile.providerLevel)
    || profile.providerLevel === "learning_account"
    || !isPathwayLevelCompatible(profile.relationshipPath, profile.providerLevel)
    || !profile.providerPersonId
    || profile.registrationHolderId !== provider.id
    || provider.serviceRulesVersion !== POLICY_VERSION
  ) {
    return null;
  }

  const rawApprovedServices = parseProviderServices(provider.approvedServices);
  const approvedServices = rawApprovedServices.filter(isServiceCode)
    .filter((serviceCode) => serviceCode !== "general_auto_repair");
  if (
    approvedServices.length === 0
    || approvedServices.length !== rawApprovedServices.length
  ) {
    return null;
  }
  const eligibilityRows = await db.select().from(providerServiceEligibility)
    .where(and(
      eq(providerServiceEligibility.providerId, provider.id),
      eq(providerServiceEligibility.personId, profile.providerPersonId),
      eq(providerServiceEligibility.jurisdiction, POLICY_JURISDICTION),
      eq(providerServiceEligibility.eligibilityState, "eligible"),
    ));
  const now = Date.now();
  const eligibleServiceCodes = new Set(eligibilityRows
    .filter((row) => {
      const validThrough = Date.parse(
        row.validThrough.includes("T")
          ? row.validThrough
          : `${row.validThrough}T23:59:59.999Z`,
      );
      return row.policyVersion === POLICY_VERSION
        && row.relationshipPath === profile.relationshipPath
        && row.providerLevel === profile.providerLevel
        && row.rulesEngineVersion === ELIGIBILITY_RULES_VERSION
        && Number.isFinite(validThrough)
        && validThrough >= now
        && isServiceCode(row.serviceCode)
        && row.serviceCode !== "general_auto_repair";
    })
    .map((row) => row.serviceCode));
  if (!approvedServices.every((serviceCode) => eligibleServiceCodes.has(serviceCode))) {
    return null;
  }

  const credentialRequirements = requiredProviderCredentialRequirements(
    provider.approvedServices,
    provider.serviceArea,
    parseProviderSelfAssessment(provider.providerSelfAssessment),
  );
  const credentialRecords = credentialRequirements.length > 0
    ? await getDb().select().from(providerCredentialVerifications)
      .where(eq(providerCredentialVerifications.providerId, provider.id))
    : [];
  if (!providerCredentialRequirementsAreSatisfied(
    credentialRequirements,
    credentialRecords,
  )) {
    return null;
  }
  return provider;
}

export async function providerApplicationFor(email: string) {
  const [provider] = await getDb().select().from(providerApplications)
    .where(and(
      eq(providerApplications.email, email),
      ne(providerApplications.status, "declined"),
    ))
    .orderBy(desc(providerApplications.createdAt))
    .limit(1);
  return provider ?? null;
}

async function providerDestinationFor(email: string) {
  const provider = await verifiedProviderFor(email)
    || await testProviderAccountFor(email);
  return provider ? "/provider-jobs" : "/provider-onboarding";
}

export async function eligibleAccountRoles(email: string): Promise<AccountRole[]> {
  const [customerRows, credentialRows, provider] = await Promise.all([
    getDb().select({ id: customerRequests.id }).from(customerRequests)
      .where(eq(customerRequests.email, email)).limit(1),
    getDb().select({ email: accountCredentials.email }).from(accountCredentials)
      .where(eq(accountCredentials.email, email)).limit(1),
    providerApplicationFor(email),
  ]);
  const roles: AccountRole[] = [];
  if (credentialRows.length > 0 || customerRows.length > 0) roles.push("customer");
  if (provider) roles.push("provider");
  return roles;
}

export async function createAccountSession(email: string, role: AccountRole) {
  const roles = await eligibleAccountRoles(email);
  if (!roles.includes(role)) return null;

  const token = randomToken();
  const tokenHash = await hmacHex(`session:${token}`);
  const now = new Date().toISOString();
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
    token,
    role,
    roles,
    destination: role === "customer"
      ? "/customer"
      : await providerDestinationFor(email),
  };
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

  const roleLabel = role === "provider" ? "provider" : "customer";
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

  const now = new Date().toISOString();
  await getDb().update(loginCodes).set({ usedAt: now })
    .where(eq(loginCodes.id, challenge.id));
  const session = await createAccountSession(email, role);
  return session ? { ok: true as const, ...session } : { ok: false as const };
}

async function sendPasswordVerificationEmail(
  email: string,
  role: AccountRole,
  purpose: PasswordChallengePurpose,
  code: string,
) {
  const apiKey = runtimeEnv().RESEND_API_KEY;
  const from = runtimeEnv().RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    throw new Error("Password verification email is not configured.");
  }

  const roleLabel = role === "provider" ? "provider" : "customer";
  const actionLabel = purpose === "create"
    ? "finish creating your account"
    : purpose === "reset"
      ? "reset your password"
      : "finish signing in";
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: purpose === "create"
        ? "Verify your Tuveloz account"
        : purpose === "reset"
          ? "Reset your Tuveloz password"
          : "Verify your Tuveloz sign-in",
      text: [
        `Use this code to ${actionLabel} for your Tuveloz ${roleLabel} workspace:`,
        "",
        code,
        "",
        "This code expires in 10 minutes and can be used once.",
        "If you did not request it, you can ignore this email.",
      ].join("\n"),
    }),
  });
  if (!response.ok) {
    console.error("Resend rejected a password verification code", {
      status: response.status,
      responseBody: await response.text(),
    });
    throw new Error("The email service could not send this code.");
  }
}

async function issuePasswordChallenge(
  email: string,
  role: AccountRole,
  purpose: PasswordChallengePurpose,
) {
  const recent = await getDb().select({ createdAt: passwordVerificationCodes.createdAt })
    .from(passwordVerificationCodes)
    .where(and(
      eq(passwordVerificationCodes.email, email),
      eq(passwordVerificationCodes.role, role),
      eq(passwordVerificationCodes.purpose, purpose),
    ))
    .orderBy(desc(passwordVerificationCodes.createdAt))
    .limit(LOGIN_RATE_LIMIT);
  const cutoff = Date.now() - LOGIN_RATE_WINDOW_MS;
  if (recent.filter((item) => parseStoredDate(item.createdAt) >= cutoff).length >= LOGIN_RATE_LIMIT) {
    return { accepted: false, delivered: false, rateLimited: true };
  }

  const id = crypto.randomUUID();
  const code = randomDigits();
  const createdAt = new Date().toISOString();
  const codeHash = await hmacHex(
    `${id}:${email}:${role}:${purpose}:${code}`,
  );
  await getDb().insert(passwordVerificationCodes).values({
    id,
    email,
    role,
    purpose,
    codeHash,
    expiresAt: new Date(Date.now() + LOGIN_CODE_LIFETIME_MS).toISOString(),
    attempts: 0,
    usedAt: "",
    createdAt,
  });

  try {
    await sendPasswordVerificationEmail(email, role, purpose, code);
  } catch (error) {
    await getDb().delete(passwordVerificationCodes)
      .where(eq(passwordVerificationCodes.id, id));
    throw error;
  }
  return { accepted: true, delivered: true };
}

export async function requestPasswordVerification(
  email: string,
  role: AccountRole,
  purpose: PasswordPurpose,
) {
  const [roles, credentialRows] = await Promise.all([
    eligibleAccountRoles(email),
    getDb().select({ email: accountCredentials.email })
      .from(accountCredentials)
      .where(eq(accountCredentials.email, email))
      .limit(1),
  ]);
  const hasCredential = credentialRows.length > 0;
  const roleCanCreate = role === "customer" || roles.includes(role);
  const actionAllowed = (purpose === "create" ? roleCanCreate : roles.includes(role))
    && (
      (purpose === "create" && !hasCredential)
      || (purpose === "reset" && hasCredential)
    );
  if (!actionAllowed) {
    return { accepted: true, delivered: false };
  }

  return issuePasswordChallenge(email, role, purpose);
}

export async function completePasswordVerification(
  email: string,
  role: AccountRole,
  purpose: PasswordPurpose,
  code: string,
  password: string,
  acceptedTerms: boolean,
) {
  if (
    passwordValidationError(password)
    || (purpose === "create" && !acceptedTerms)
  ) {
    return { ok: false as const };
  }
  const [challenge] = await getDb().select().from(passwordVerificationCodes)
    .where(and(
      eq(passwordVerificationCodes.email, email),
      eq(passwordVerificationCodes.role, role),
      eq(passwordVerificationCodes.purpose, purpose),
      eq(passwordVerificationCodes.usedAt, ""),
    ))
    .orderBy(desc(passwordVerificationCodes.createdAt))
    .limit(1);
  if (
    !challenge
    || challenge.attempts >= LOGIN_MAX_ATTEMPTS
    || parseStoredDate(challenge.expiresAt) <= Date.now()
  ) {
    return { ok: false as const };
  }

  const suppliedHash = await hmacHex(
    `${challenge.id}:${email}:${role}:${purpose}:${code}`,
  );
  if (!constantTimeEqual(challenge.codeHash, suppliedHash)) {
    const attempts = challenge.attempts + 1;
    await getDb().update(passwordVerificationCodes).set({
      attempts,
      usedAt: attempts >= LOGIN_MAX_ATTEMPTS ? new Date().toISOString() : "",
    }).where(eq(passwordVerificationCodes.id, challenge.id));
    return { ok: false as const };
  }

  const [roles, credentialRows] = await Promise.all([
    eligibleAccountRoles(email),
    getDb().select({ email: accountCredentials.email })
      .from(accountCredentials)
      .where(eq(accountCredentials.email, email))
      .limit(1),
  ]);
  const hasCredential = credentialRows.length > 0;
  const roleCanCreate = role === "customer" || roles.includes(role);
  if (
    !(purpose === "create" ? roleCanCreate : roles.includes(role))
    || (purpose === "create" && hasCredential)
    || (purpose === "reset" && !hasCredential)
  ) {
    await getDb().update(passwordVerificationCodes)
      .set({ usedAt: new Date().toISOString() })
      .where(eq(passwordVerificationCodes.id, challenge.id));
    return { ok: false as const };
  }

  const passwordRecord = await createPasswordHash(password);
  const now = new Date().toISOString();
  const policyVersion = role === "provider"
    ? PROVIDER_POLICY_BUNDLE_VERSION
    : CUSTOMER_POLICY_BUNDLE_VERSION;
  const policyRecord = purpose === "create"
    ? { termsAcceptedAt: now, termsVersion: policyVersion }
    : {};
  await getDb().insert(accountCredentials).values({
    email,
    passwordHash: passwordRecord.hash,
    passwordSalt: passwordRecord.salt,
    passwordIterations: passwordRecord.iterations,
    verifiedAt: now,
    failedAttempts: 0,
    lockedUntil: "",
    ...policyRecord,
    createdAt: now,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: accountCredentials.email,
    set: {
      passwordHash: passwordRecord.hash,
      passwordSalt: passwordRecord.salt,
      passwordIterations: passwordRecord.iterations,
      verifiedAt: now,
      failedAttempts: 0,
      lockedUntil: "",
      ...policyRecord,
      updatedAt: now,
    },
  });
  await getDb().update(passwordVerificationCodes)
    .set({ usedAt: now })
    .where(eq(passwordVerificationCodes.id, challenge.id));
  await getDb().delete(authSessions).where(eq(authSessions.email, email));
  const session = await createAccountSession(email, role);
  if (!session) return { ok: false as const };
  await sendAccountSecurityAlert({
    eventId: challenge.id,
    email,
    role,
    action: purpose === "create" ? "account_created" : "password_reset",
  });
  return { ok: true as const, ...session };
}

export async function signInWithPassword(
  email: string,
  role: AccountRole,
  password: string,
) {
  const [credential] = await getDb().select().from(accountCredentials)
    .where(eq(accountCredentials.email, email))
    .limit(1);
  const storedSalt = credential?.passwordSalt ?? DUMMY_PASSWORD_SALT;
  const storedIterations = credential?.passwordIterations ?? PASSWORD_HASH_ITERATIONS;
  const suppliedHash = await derivePasswordHash(
    password,
    storedSalt,
    storedIterations,
  );
  const lockExpiresAt = credential?.lockedUntil
    ? parseStoredDate(credential.lockedUntil)
    : 0;
  const currentlyLocked = lockExpiresAt > Date.now();
  const passwordMatches = Boolean(
    credential
    && constantTimeEqual(credential.passwordHash, suppliedHash),
  );
  const roles = await eligibleAccountRoles(email);

  if (!credential || currentlyLocked || !passwordMatches || !roles.includes(role)) {
    if (credential && !currentlyLocked && !passwordMatches) {
      const previousAttempts = lockExpiresAt > 0 ? 0 : credential.failedAttempts;
      const failedAttempts = previousAttempts + 1;
      await getDb().update(accountCredentials).set({
        failedAttempts: failedAttempts >= PASSWORD_LOGIN_MAX_ATTEMPTS ? 0 : failedAttempts,
        lockedUntil: failedAttempts >= PASSWORD_LOGIN_MAX_ATTEMPTS
          ? new Date(Date.now() + PASSWORD_LOCKOUT_MS).toISOString()
          : "",
        updatedAt: new Date().toISOString(),
      }).where(eq(accountCredentials.email, email));
    }
    return { ok: false as const };
  }

  const now = new Date().toISOString();
  if (credential.passwordIterations < PASSWORD_HASH_ITERATIONS) {
    const upgraded = await createPasswordHash(password);
    await getDb().update(accountCredentials).set({
      passwordHash: upgraded.hash,
      passwordSalt: upgraded.salt,
      passwordIterations: upgraded.iterations,
      failedAttempts: 0,
      lockedUntil: "",
      updatedAt: now,
    }).where(eq(accountCredentials.email, email));
  } else {
    await getDb().update(accountCredentials).set({
      failedAttempts: 0,
      lockedUntil: "",
      updatedAt: now,
    }).where(eq(accountCredentials.email, email));
  }

  const challenge = await issuePasswordChallenge(email, role, "signin");
  if (!challenge.accepted) {
    return { ok: false as const, rateLimited: true as const };
  }
  return { ok: true as const, challengeRequired: true as const };
}

export async function verifyPasswordSignIn(
  email: string,
  role: AccountRole,
  code: string,
) {
  const purpose: PasswordChallengePurpose = "signin";
  const [challenge] = await getDb().select().from(passwordVerificationCodes)
    .where(and(
      eq(passwordVerificationCodes.email, email),
      eq(passwordVerificationCodes.role, role),
      eq(passwordVerificationCodes.purpose, purpose),
      eq(passwordVerificationCodes.usedAt, ""),
    ))
    .orderBy(desc(passwordVerificationCodes.createdAt))
    .limit(1);
  if (
    !challenge
    || challenge.attempts >= LOGIN_MAX_ATTEMPTS
    || parseStoredDate(challenge.expiresAt) <= Date.now()
  ) {
    return { ok: false as const };
  }

  const suppliedHash = await hmacHex(
    `${challenge.id}:${email}:${role}:${purpose}:${code}`,
  );
  if (!constantTimeEqual(challenge.codeHash, suppliedHash)) {
    const attempts = challenge.attempts + 1;
    await getDb().update(passwordVerificationCodes).set({
      attempts,
      usedAt: attempts >= LOGIN_MAX_ATTEMPTS ? new Date().toISOString() : "",
    }).where(eq(passwordVerificationCodes.id, challenge.id));
    return { ok: false as const };
  }

  const roles = await eligibleAccountRoles(email);
  if (!roles.includes(role)) {
    await getDb().update(passwordVerificationCodes)
      .set({ usedAt: new Date().toISOString() })
      .where(eq(passwordVerificationCodes.id, challenge.id));
    return { ok: false as const };
  }

  await getDb().update(passwordVerificationCodes)
    .set({ usedAt: new Date().toISOString() })
    .where(eq(passwordVerificationCodes.id, challenge.id));
  const session = await createAccountSession(email, role);
  return session ? { ok: true as const, ...session } : { ok: false as const };
}

export async function getAccountSession(request: Request) {
  const token = sessionTokenFrom(request);
  if (!token) return null;
  const tokenHash = await hmacHex(`session:${token}`);
  const [session] = await getDb().select().from(authSessions)
    .where(eq(authSessions.tokenHash, tokenHash)).limit(1);
  const now = Date.now();
  const expiresAt = session ? parseStoredDate(session.expiresAt) : Number.NaN;
  const createdAt = session ? parseStoredDate(session.createdAt) : Number.NaN;
  const lastSeenAt = session ? parseStoredDate(session.lastSeenAt) : Number.NaN;
  const invalidTimestamps = !Number.isFinite(expiresAt)
    || !Number.isFinite(createdAt)
    || !Number.isFinite(lastSeenAt);
  const absoluteExpired = session
    ? now >= Math.min(expiresAt, createdAt + SESSION_LIFETIME_MS)
    : true;
  const idleExpired = session
    ? now - lastSeenAt >= SESSION_IDLE_TIMEOUT_MS
    : true;
  if (
    !session
    || invalidTimestamps
    || absoluteExpired
    || idleExpired
    || !isAccountRole(session.role)
  ) {
    if (session) {
      await getDb().delete(authSessions).where(eq(authSessions.id, session.id));
    }
    return null;
  }
  const roles = await eligibleAccountRoles(session.email);
  if (!roles.includes(session.role)) {
    await getDb().delete(authSessions).where(eq(authSessions.id, session.id));
    return null;
  }
  let refreshedLastSeenAt = session.lastSeenAt;
  if (now - lastSeenAt >= SESSION_TOUCH_INTERVAL_MS) {
    refreshedLastSeenAt = new Date(now).toISOString();
    await getDb().update(authSessions).set({
      lastSeenAt: refreshedLastSeenAt,
    }).where(eq(authSessions.id, session.id));
  }
  return {
    ...session,
    lastSeenAt: refreshedLastSeenAt,
    role: session.role as AccountRole,
    availableRoles: roles,
  };
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
    destination: role === "customer"
      ? "/customer"
      : await providerDestinationFor(session.email),
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

/**
 * Isolated review accounts are intentionally excluded from every normal
 * provider lookup. Only explicitly test-only marketplace routes may call this
 * helper, and those routes must also require a persisted test job.
 */
export async function testProviderAccountFor(email: string) {
  const [provider] = await getDb().select().from(providerApplications)
    .where(and(
      eq(providerApplications.email, email),
      eq(providerApplications.status, "approved"),
      eq(providerApplications.verificationStatus, "test"),
      eq(providerApplications.isTestProvider, "yes"),
    ))
    .orderBy(desc(providerApplications.createdAt))
    .limit(1);
  return provider ?? null;
}
