import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type {
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { getDb } from "../db";
import { passkeyCredentials } from "../db/schema";
import {
  createAccountSession,
  getAccountSession,
  type AccountRole,
} from "./account-auth";

const PASSKEY_CHALLENGE_SECONDS = 5 * 60;
const PRODUCTION_COOKIE_NAME = "__Host-tuveloz_passkey";
const LOCAL_COOKIE_NAME = "tuveloz_passkey";
const SUPPORTED_ALGORITHMS = [-7, -257] as const;

type RuntimeEnv = Record<string, string | undefined>;
type PasskeyPurpose = "register" | "authenticate";

type ChallengeState = {
  challenge: string;
  email?: string;
  expiresAt: number;
  origin: string;
  purpose: PasskeyPurpose;
  role?: AccountRole;
  rpID: string;
  userId?: string;
  version: 1;
};

function runtimeEnv() {
  return env as unknown as RuntimeEnv;
}

function passkeySecret() {
  const value = runtimeEnv().AUTH_CODE_SECRET ?? "";
  if (value.length < 32) {
    throw new Error("AUTH_CODE_SECRET must be configured with at least 32 characters.");
  }
  return value;
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

async function hmac(value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passkeySecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value),
  );
  return bytesToBase64Url(new Uint8Array(signature));
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

function requestContext(request: Request) {
  const url = new URL(request.url);
  const hostname = url.hostname.toLowerCase();
  const rpID = hostname === "tuveloz.com" || hostname.endsWith(".tuveloz.com")
    ? "tuveloz.com"
    : hostname;
  return { origin: url.origin, rpID, secure: url.protocol === "https:" };
}

function cookiesFor(request: Request) {
  const result = new Map<string, string>();
  for (const pair of (request.headers.get("cookie") ?? "").split(";")) {
    const [rawName, ...rawValue] = pair.trim().split("=");
    if (rawName) result.set(rawName, rawValue.join("="));
  }
  return result;
}

async function challengeCookie(request: Request, state: ChallengeState) {
  const { secure } = requestContext(request);
  const name = secure ? PRODUCTION_COOKIE_NAME : LOCAL_COOKIE_NAME;
  const encodedState = bytesToBase64Url(
    new TextEncoder().encode(JSON.stringify(state)),
  );
  const signature = await hmac(encodedState);
  return [
    `${name}=${encodedState}.${signature}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    secure ? "Secure" : "",
    `Max-Age=${PASSKEY_CHALLENGE_SECONDS}`,
  ].filter(Boolean).join("; ");
}

export function expiredPasskeyChallengeCookies(request: Request) {
  const { secure } = requestContext(request);
  const expires =
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; Path=/; HttpOnly; SameSite=Strict";
  return [
    `${PRODUCTION_COOKIE_NAME}=; ${expires}; Secure`,
    `${LOCAL_COOKIE_NAME}=; ${expires}${secure ? "; Secure" : ""}`,
  ];
}

async function readChallenge(
  request: Request,
  purpose: PasskeyPurpose,
) {
  const cookies = cookiesFor(request);
  const value =
    cookies.get(PRODUCTION_COOKIE_NAME) ?? cookies.get(LOCAL_COOKIE_NAME) ?? "";
  const [encodedState, suppliedSignature] = value.split(".");
  if (!encodedState || !suppliedSignature) return null;
  const expectedSignature = await hmac(encodedState);
  if (!constantTimeEqual(suppliedSignature, expectedSignature)) return null;

  try {
    const state = JSON.parse(
      new TextDecoder().decode(base64UrlToBytes(encodedState)),
    ) as ChallengeState;
    const context = requestContext(request);
    if (
      state.version !== 1
      || state.purpose !== purpose
      || state.expiresAt <= Date.now()
      || state.origin !== context.origin
      || state.rpID !== context.rpID
    ) {
      return null;
    }
    return state;
  } catch {
    return null;
  }
}

async function stableUserId(email: string, role: AccountRole) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`tuveloz-passkey:${role}:${email}`),
  );
  return new Uint8Array(digest);
}

function parseTransports(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is AuthenticatorTransportFuture =>
        typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

export async function beginPasskeyRegistration(request: Request) {
  const session = await getAccountSession(request);
  if (!session) return null;

  const existing = await getDb().select().from(passkeyCredentials)
    .where(and(
      eq(passkeyCredentials.email, session.email),
      eq(passkeyCredentials.role, session.role),
    ));
  const userID = await stableUserId(session.email, session.role);
  const context = requestContext(request);
  const options = await generateRegistrationOptions({
    rpName: "Tuveloz",
    rpID: context.rpID,
    userName: session.email,
    userDisplayName: session.email,
    userID,
    timeout: 60_000,
    attestationType: "none",
    excludeCredentials: existing.map((credential) => ({
      id: credential.id,
      transports: parseTransports(credential.transports),
    })),
    authenticatorSelection: {
      residentKey: "required",
      userVerification: "required",
    },
    preferredAuthenticatorType: "localDevice",
    supportedAlgorithmIDs: [...SUPPORTED_ALGORITHMS],
  });
  const state: ChallengeState = {
    challenge: options.challenge,
    email: session.email,
    expiresAt: Date.now() + PASSKEY_CHALLENGE_SECONDS * 1000,
    origin: context.origin,
    purpose: "register",
    role: session.role,
    rpID: context.rpID,
    userId: bytesToBase64Url(userID),
    version: 1,
  };
  return { cookie: await challengeCookie(request, state), options };
}

export async function finishPasskeyRegistration(
  request: Request,
  response: RegistrationResponseJSON,
) {
  const [session, state] = await Promise.all([
    getAccountSession(request),
    readChallenge(request, "register"),
  ]);
  if (
    !session
    || !state?.email
    || !state.role
    || !state.userId
    || session.email !== state.email
    || session.role !== state.role
  ) {
    return { ok: false as const };
  }

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge: state.challenge,
    expectedOrigin: state.origin,
    expectedRPID: state.rpID,
    requireUserVerification: true,
    supportedAlgorithmIDs: [...SUPPORTED_ALGORITHMS],
  });
  if (!verification.verified) return { ok: false as const };

  const { credential, credentialBackedUp, credentialDeviceType } =
    verification.registrationInfo;
  const [existing] = await getDb().select().from(passkeyCredentials)
    .where(eq(passkeyCredentials.id, credential.id)).limit(1);
  if (
    existing
    && (existing.email !== session.email || existing.role !== session.role)
  ) {
    return { ok: false as const };
  }

  const values = {
    email: session.email,
    role: session.role,
    webauthnUserId: state.userId,
    publicKey: bytesToBase64Url(credential.publicKey),
    counter: credential.counter,
    transports: JSON.stringify(
      credential.transports ?? response.response.transports ?? [],
    ),
    deviceType: credentialDeviceType,
    backedUp: credentialBackedUp ? "yes" : "no",
  };
  if (existing) {
    await getDb().update(passkeyCredentials).set(values)
      .where(eq(passkeyCredentials.id, credential.id));
  } else {
    await getDb().insert(passkeyCredentials).values({
      id: credential.id,
      ...values,
      createdAt: new Date().toISOString(),
      lastUsedAt: "",
    });
  }
  return { ok: true as const };
}

export async function beginPasskeyAuthentication(request: Request) {
  const context = requestContext(request);
  const options = await generateAuthenticationOptions({
    rpID: context.rpID,
    timeout: 60_000,
    userVerification: "required",
  });
  const state: ChallengeState = {
    challenge: options.challenge,
    expiresAt: Date.now() + PASSKEY_CHALLENGE_SECONDS * 1000,
    origin: context.origin,
    purpose: "authenticate",
    rpID: context.rpID,
    version: 1,
  };
  return { cookie: await challengeCookie(request, state), options };
}

export async function finishPasskeyAuthentication(
  request: Request,
  response: AuthenticationResponseJSON,
) {
  const state = await readChallenge(request, "authenticate");
  if (!state) return { ok: false as const };

  const [stored] = await getDb().select().from(passkeyCredentials)
    .where(eq(passkeyCredentials.id, response.id)).limit(1);
  if (!stored || (stored.role !== "customer" && stored.role !== "provider")) {
    return { ok: false as const };
  }
  if (
    response.response.userHandle
    && response.response.userHandle !== stored.webauthnUserId
  ) {
    return { ok: false as const };
  }

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge: state.challenge,
    expectedOrigin: state.origin,
    expectedRPID: state.rpID,
    credential: {
      id: stored.id,
      publicKey: base64UrlToBytes(stored.publicKey),
      counter: stored.counter,
      transports: parseTransports(stored.transports),
    },
    requireUserVerification: true,
  });
  if (!verification.verified) return { ok: false as const };

  await getDb().update(passkeyCredentials).set({
    counter: verification.authenticationInfo.newCounter,
    deviceType: verification.authenticationInfo.credentialDeviceType,
    backedUp: verification.authenticationInfo.credentialBackedUp ? "yes" : "no",
    lastUsedAt: new Date().toISOString(),
  }).where(eq(passkeyCredentials.id, stored.id));

  const session = await createAccountSession(
    stored.email,
    stored.role as AccountRole,
  );
  return session ? { ok: true as const, ...session } : { ok: false as const };
}
