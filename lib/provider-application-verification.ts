import { env } from "cloudflare:workers";
import { and, desc, eq, gt, lt, sql } from "drizzle-orm";
import { getDb } from "../db";
import {
  providerApplicationChallenges,
  publicWriteRateLimits,
} from "../db/schema";
import {
  cleanProviderSelfAssessment,
  providerAreasHaveReviewedCompliance,
} from "./provider-compliance";
import {
  PROVIDER_ACCEPTANCE_DOCUMENTS,
  providerAgreementEvidenceText,
  sha256Text,
} from "./provider-policy-acceptance";
import {
  canonicalJson,
  PROVIDER_APPLICATION_PAYLOAD_HASH_ACCEPTANCE_MARKER,
  providerApplicationPayloadHashWithSecret,
} from "./provider-application-payload-hash";
import {
  isServiceCode,
  POLICY_JURISDICTION,
  POLICY_STATUS,
  POLICY_VERSION,
  providerLevelForService,
  PROVIDER_POLICY_MATRIX,
  type ProviderLevel,
  type ProviderPathway,
  type ServiceCode,
} from "./provider-policy";
import {
  parseProviderAreas,
  PROVIDER_AREA_OPTIONS,
  PROVIDER_WORK_LOCATION_OPTIONS,
  serializeLocationOptions,
  serializeProviderAreas,
  serializeProviderServices,
} from "./service-matching";
import { PROVIDER_POLICY_BUNDLE_VERSION } from "./policies";

export const PROVIDER_APPLICATION_MAX_JSON_BYTES = 48 * 1024;
export const PROVIDER_APPLICATION_CHALLENGE_LIFETIME_MS = 10 * 60 * 1000;
export const PROVIDER_APPLICATION_CHALLENGE_MAX_ATTEMPTS = 5;
const EMAIL_CHALLENGE_WINDOW_MS = 15 * 60 * 1000;
const EMAIL_CHALLENGE_LIMIT = 3;
const SOURCE_CHALLENGE_WINDOW_MS = 60 * 60 * 1000;
const SOURCE_CHALLENGE_LIMIT = 10;
const CHALLENGE_RETENTION_AFTER_EXPIRY_MS = 24 * 60 * 60 * 1000;
const RATE_LIMIT_RETENTION_MS = 48 * 60 * 60 * 1000;

export const PROVIDER_APPLICATION_CHALLENGE_MESSAGE =
  "If that email can receive messages, a 6-digit TUVELOZ code is on its way. Use the most recent code within 10 minutes.";
export const PROVIDER_APPLICATION_GENERIC_COMPLETE_MESSAGE =
  "Verification is complete. If no application existed for this email, a new application was created. Sign in with that email to view or continue onboarding. Changes to an existing application are made only after sign-in and were not saved by this public form.";

type RuntimeEnv = Record<string, string | undefined>;
export type ApplicationPathway = "learning_account" | ProviderPathway;

const APPLICATION_PATHWAYS = new Set<ApplicationPathway>([
  "learning_account",
  "independent_startup",
  "sponsored_trainee_employee",
  "provider_business_employee",
]);
const ALLOWED_AREAS = new Set<string>(PROVIDER_AREA_OPTIONS);
const LEVEL_PRIORITY: readonly ProviderLevel[] = [
  "sponsored_trainee",
  "provisional_independent",
  "standard_provider",
  "specialty_provider",
];

export class ProviderApplicationValidationError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

function runtimeEnv() {
  return env as unknown as RuntimeEnv;
}

function secret() {
  const value = runtimeEnv().AUTH_CODE_SECRET ?? "";
  if (value.length < 32) {
    throw new Error("AUTH_CODE_SECRET must be configured with at least 32 characters.");
  }
  return value;
}

function clean(value: unknown, maximum: number) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function requestedServiceCodes(body: Record<string, unknown>) {
  const source = Array.isArray(body.serviceCodes)
    ? body.serviceCodes
    : Array.isArray(body.services)
      ? body.services
      : [];
  const values = source.map((value) => clean(value, 100)).filter(Boolean);
  return [...new Set(values)];
}

/**
 * Each exact service carries its own lawful provider level, so one application
 * may span levels — a solo owner-operator can offer standard battery work and
 * specialty A/C service together. Services that are prohibited or unavailable
 * on the chosen pathway are reported individually instead of collapsing the
 * whole application to a single level.
 */
function serviceLevelsForApplication(
  pathway: ApplicationPathway,
  serviceCodes: readonly ServiceCode[],
): {
  levels: Record<string, ProviderLevel>;
  unsupported: ServiceCode[];
} {
  const levels: Record<string, ProviderLevel> = {};
  const unsupported: ServiceCode[] = [];
  if (pathway === "learning_account") return { levels, unsupported };
  for (const serviceCode of serviceCodes) {
    const level = providerLevelForService(serviceCode, pathway);
    if (level) levels[serviceCode] = level;
    else unsupported.push(serviceCode);
  }
  return { levels, unsupported };
}

/**
 * The profile's summary level. Authorization never relies on this value — the
 * eligibility engine decides each service against that service's own level and
 * credentials. It exists so dashboards can name the highest tier a provider
 * currently holds.
 */
function summaryLevelForApplication(
  pathway: ApplicationPathway,
  serviceLevels: Record<string, ProviderLevel>,
): ProviderLevel | null {
  if (pathway === "learning_account") return "learning_account";
  const held = new Set(Object.values(serviceLevels));
  const compatibleLevels = PROVIDER_POLICY_MATRIX
    .pathway_level_compatibility[pathway];
  const ordered = [...LEVEL_PRIORITY]
    .reverse()
    .filter((level) => held.has(level) && compatibleLevels.includes(level));
  return ordered[0] ?? null;
}

export function providerApplicationRelationship(pathway: ApplicationPathway) {
  if (pathway === "independent_startup") return "owner_operator";
  if (pathway === "sponsored_trainee_employee") return "trainee";
  if (pathway === "provider_business_employee") return "employee";
  return "learner";
}

export function providerApplicationRequestIp(request: Request) {
  return clean(
    request.headers.get("cf-connecting-ip")
      || request.headers.get("x-forwarded-for")?.split(",")[0]
      || "unknown",
    128,
  );
}

export function normalizeProviderApplicationPayload(body: Record<string, unknown>) {
  const name = clean(body.name, 120);
  const email = clean(body.email, 180).toLowerCase();
  // Phone is always optional: providers are independent contractors, and only
  // email is needed to verify and deliver the application record.
  const phone = clean(body.phone, 40);
  const preferredLanguage = clean(body.preferredLanguage, 60) || "English";
  const applicationPathwayValue = clean(body.applicationPathway, 80);
  const applicationPathway = APPLICATION_PATHWAYS.has(applicationPathwayValue as ApplicationPathway)
    ? applicationPathwayValue as ApplicationPathway
    : null;
  const rawServiceCodes = requestedServiceCodes(body);
  const serviceCodes = rawServiceCodes.filter(isServiceCode).sort();
  const serviceArea = clean(body.serviceArea, 240);
  const businessMunicipality = clean(body.businessMunicipality, 100);
  const rawWorkLocations = Array.isArray(body.workLocations)
    ? body.workLocations.map((value) => clean(value, 100)).filter(Boolean)
    : [clean(body.workLocations, 100)].filter(Boolean);
  const workLocations = [...new Set(rawWorkLocations)].sort((left, right) => (
    PROVIDER_WORK_LOCATION_OPTIONS.indexOf(left as (typeof PROVIDER_WORK_LOCATION_OPTIONS)[number])
    - PROVIDER_WORK_LOCATION_OPTIONS.indexOf(right as (typeof PROVIDER_WORK_LOCATION_OPTIONS)[number])
  ));
  const businessServiceAddress = clean(body.businessServiceAddress, 240);
  const legalBusinessName = clean(body.legalBusinessName, 180);
  const businessEntityType = clean(body.businessEntityType, 100);
  const businessFormationState = clean(body.businessFormationState, 100);
  const sponsoringProviderLegalName = clean(body.sponsoringProviderLegalName, 180);
  const sponsorContactName = clean(body.sponsorContactName, 120);
  const sponsorContactEmail = clean(body.sponsorContactEmail, 180).toLowerCase();
  const sponsorContactTitle = clean(body.sponsorContactTitle, 100);
  const signerName = clean(body.signerName, 120);
  const signerTitle = clean(body.signerTitle, 100);
  const performingPersonFirstName = clean(body.performingPersonFirstName, 80);
  const performingPersonLastName = clean(body.performingPersonLastName, 80);
  const performingPersonIdentityAcknowledged =
    body.performingPersonIdentityAcknowledged === true;
  const experience = clean(body.experience, 1000);
  const rulesReviewed = body.rulesReviewed === true;
  const adultAcknowledged = body.adultAcknowledged === true;
  const employmentResponsibilityAcknowledged =
    body.employmentWorkAuthorizationResponsibilityAcknowledged === true;
  const acceptedTerms = body.termsBundleAccepted === true;
  const privacyAcknowledged = body.privacyAcknowledged === true;

  if (
    !name
    || !email
    || !applicationPathway
    || !signerName
    || !signerTitle
    || !performingPersonFirstName
    || !performingPersonLastName
    || !performingPersonIdentityAcknowledged
  ) {
    throw new ProviderApplicationValidationError(
      "Complete the applicant, pathway, performing-person identity, and signer fields.",
    );
  }
  if (!isEmail(email)) {
    throw new ProviderApplicationValidationError("Enter a valid applicant email address.");
  }
  if (phone && !/^\+?[\d\s().-]{7,}$/.test(phone)) {
    throw new ProviderApplicationValidationError(
      "Enter a valid phone number, or leave the phone field blank.",
    );
  }
  if (!rawServiceCodes.length || rawServiceCodes.length !== serviceCodes.length) {
    throw new ProviderApplicationValidationError(
      "Choose only exact services listed in the current review matrix.",
    );
  }
  if (serviceCodes.includes("general_auto_repair")) {
    throw new ProviderApplicationValidationError(
      "General auto repair is too broad. Choose exact service codes.",
    );
  }

  const areas = [...new Set(parseProviderAreas(serviceArea))].sort();
  if (areas.length === 0 || areas.some((area) => !ALLOWED_AREAS.has(area))) {
    throw new ProviderApplicationValidationError("Choose at least one listed service area.");
  }
  if (!providerAreasHaveReviewedCompliance(areas)) {
    throw new ProviderApplicationValidationError(
      "This service area is not open for provider review yet.",
      409,
    );
  }
  if (!businessMunicipality) {
    throw new ProviderApplicationValidationError(
      "Enter the municipality where the provider is based.",
    );
  }
  if (
    workLocations.length === 0
    || workLocations.some((value) => !PROVIDER_WORK_LOCATION_OPTIONS.includes(
      value as (typeof PROVIDER_WORK_LOCATION_OPTIONS)[number],
    ))
  ) {
    throw new ProviderApplicationValidationError(
      "Choose only the listed service-location options.",
    );
  }
  if (workLocations.includes(PROVIDER_WORK_LOCATION_OPTIONS[1]) && !businessServiceAddress) {
    throw new ProviderApplicationValidationError(
      "Enter the business service address when customers may come to the business.",
    );
  }
  if (
    applicationPathway === "independent_startup"
    && (!legalBusinessName || !businessEntityType || !businessFormationState)
  ) {
    throw new ProviderApplicationValidationError(
      "The independent owner-operator pathway requires the provider business details.",
    );
  }
  if (
    (applicationPathway === "sponsored_trainee_employee"
      || applicationPathway === "provider_business_employee")
    && (
      !sponsoringProviderLegalName
      || !sponsorContactName
      || !sponsorContactTitle
      || !isEmail(sponsorContactEmail)
    )
  ) {
    throw new ProviderApplicationValidationError(
      "Enter the sponsoring or employer provider business and its authorized contact.",
    );
  }
  if (
    !rulesReviewed
    || !adultAcknowledged
    || !employmentResponsibilityAcknowledged
    || !acceptedTerms
    || !privacyAcknowledged
  ) {
    throw new ProviderApplicationValidationError(
      "Complete every required legal acknowledgment. Privacy remains a separate acknowledgment.",
    );
  }

  const { levels: serviceLevels, unsupported } = serviceLevelsForApplication(
    applicationPathway,
    serviceCodes,
  );
  if (unsupported.length) {
    throw new ProviderApplicationValidationError(
      `These services are not offered on the selected pathway: ${
        unsupported.join(", ")
      }. Remove them, or use an applicant-only account while you prepare independently. TUVELOZ does not provide training.`,
    );
  }
  const providerLevel = summaryLevelForApplication(
    applicationPathway,
    serviceLevels,
  );
  if (!providerLevel) {
    throw new ProviderApplicationValidationError(
      "Select at least one exact service that is lawful on the chosen pathway, or use an applicant-only account while you prepare independently. TUVELOZ does not provide training.",
    );
  }

  return {
    format: "tuveloz_provider_application_payload_v2" as const,
    name,
    email,
    phone,
    preferredLanguage,
    applicationPathway,
    providerLevel,
    serviceLevels,
    serviceCodes,
    service: serializeProviderServices(serviceCodes),
    areas,
    serviceArea: serializeProviderAreas(areas),
    businessMunicipality,
    workLocations,
    workLocationsSerialized: serializeLocationOptions(
      workLocations,
      PROVIDER_WORK_LOCATION_OPTIONS,
    ),
    businessServiceAddress,
    legalBusinessName,
    businessEntityType,
    businessFormationState,
    sponsoringProviderLegalName,
    sponsorContactName,
    sponsorContactEmail,
    sponsorContactTitle,
    signerName,
    signerTitle,
    performingPersonFirstName,
    performingPersonLastName,
    experience,
    providerSelfAssessment: cleanProviderSelfAssessment(body.providerSelfAssessment),
    acknowledgements: {
      rulesReviewed: true as const,
      adultAcknowledged: true as const,
      employmentResponsibilityAcknowledged: true as const,
      termsBundleAccepted: true as const,
      privacyAcknowledged: true as const,
      performingPersonIdentityAcknowledged: true as const,
    },
    policy: {
      policyVersion: POLICY_VERSION,
      policyStatus: POLICY_STATUS,
      jurisdiction: POLICY_JURISDICTION,
      policyBundleVersion: PROVIDER_POLICY_BUNDLE_VERSION,
    },
  };
}

export type NormalizedProviderApplication = ReturnType<
  typeof normalizeProviderApplicationPayload
>;

export function providerApplicationNormalizedSnapshot(
  application: NormalizedProviderApplication,
) {
  return canonicalJson(application);
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
  return [...new Uint8Array(signature)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

export async function providerApplicationDocumentBaseManifest() {
  return Promise.all(PROVIDER_ACCEPTANCE_DOCUMENTS.map(async (document) => ({
    key: document.key,
    version: document.version,
    control: document.control,
    baseAcceptanceEvidenceId: PROVIDER_APPLICATION_PAYLOAD_HASH_ACCEPTANCE_MARKER,
    baseAgreementHash: await sha256Text(providerAgreementEvidenceText(document, {
      purpose: "application_review_only",
      acceptanceEvidenceId: PROVIDER_APPLICATION_PAYLOAD_HASH_ACCEPTANCE_MARKER,
    })),
  })));
}

export async function providerApplicationFinalDocumentManifest(challengeId: string) {
  const baseManifest = await providerApplicationDocumentBaseManifest();
  return Promise.all(PROVIDER_ACCEPTANCE_DOCUMENTS.map(async (document, index) => {
    const agreementText = providerAgreementEvidenceText(document, {
      acceptanceEvidenceId: challengeId,
    });
    return {
      ...baseManifest[index],
      acceptanceEvidenceId: challengeId,
      finalAgreementHash: await sha256Text(agreementText),
    };
  }));
}

export async function providerApplicationPayloadHash(
  application: NormalizedProviderApplication,
) {
  const documents = await providerApplicationDocumentBaseManifest();
  return providerApplicationPayloadHashWithSecret(
    application,
    documents,
    secret(),
  );
}

function randomDigits() {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return String(value[0] % 1_000_000).padStart(6, "0");
}

async function consumeFixedWindow(
  action: string,
  keyHash: string,
  limit: number,
  windowMs: number,
) {
  const now = Date.now();
  const cutoff = now - windowMs;
  const rows = await getDb().insert(publicWriteRateLimits).values({
    action,
    keyHash,
    windowStartedAt: now,
    requestCount: 1,
    updatedAt: new Date(now).toISOString(),
  }).onConflictDoUpdate({
    target: [publicWriteRateLimits.action, publicWriteRateLimits.keyHash],
    set: {
      windowStartedAt: sql<number>`CASE WHEN ${publicWriteRateLimits.windowStartedAt} <= ${cutoff} THEN ${now} ELSE ${publicWriteRateLimits.windowStartedAt} END`,
      requestCount: sql<number>`CASE WHEN ${publicWriteRateLimits.windowStartedAt} <= ${cutoff} THEN 1 ELSE ${publicWriteRateLimits.requestCount} + 1 END`,
      updatedAt: new Date(now).toISOString(),
    },
  }).returning({
    count: publicWriteRateLimits.requestCount,
    windowStartedAt: publicWriteRateLimits.windowStartedAt,
  });
  return Boolean(rows[0])
    && rows[0].windowStartedAt > cutoff
    && rows[0].count <= limit;
}

async function sendProviderApplicationCode(email: string, code: string) {
  const apiKey = runtimeEnv().RESEND_API_KEY;
  const from = runtimeEnv().RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    throw new Error("Provider application email verification is not configured.");
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: "Verify your TUVELOZ provider application",
      text: [
        "Use this code to confirm control of the email address on your TUVELOZ provider application:",
        "",
        code,
        "",
        "The code expires in 10 minutes and can be used once.",
        "This verifies email control only. It does not verify identity, age, authority, business registration, licensing, insurance, qualifications, or eligibility for jobs.",
        "If you did not request this, do not share the code and ignore this email.",
      ].join("\n"),
    }),
  });
  if (!response.ok) {
    console.error("Resend rejected a provider application verification code", {
      status: response.status,
      responseBody: await response.text(),
    });
    throw new Error("Provider application verification email could not be sent.");
  }
}

async function latestUsableChallenge(email: string, payloadHash: string) {
  const [challenge] = await getDb().select({
    id: providerApplicationChallenges.id,
  }).from(providerApplicationChallenges).where(and(
    eq(providerApplicationChallenges.email, email),
    eq(providerApplicationChallenges.payloadHash, payloadHash),
    eq(providerApplicationChallenges.usedAt, ""),
    gt(providerApplicationChallenges.expiresAt, new Date().toISOString()),
  )).orderBy(desc(providerApplicationChallenges.createdAt)).limit(1);
  return challenge?.id ?? crypto.randomUUID();
}

export async function issueProviderApplicationChallenge(
  application: NormalizedProviderApplication,
  request: Request,
) {
  const payloadHash = await providerApplicationPayloadHash(application);
  const sourceHash = await hmacHex(
    `provider-application-source:v1:${providerApplicationRequestIp(request)}`,
  );
  const emailHash = await hmacHex(`provider-application-email:v1:${application.email}`);
  const emailAllowed = await consumeFixedWindow(
    "provider-application-email-15m",
    emailHash,
    EMAIL_CHALLENGE_LIMIT,
    EMAIL_CHALLENGE_WINDOW_MS,
  );
  const sourceAllowed = await consumeFixedWindow(
    "provider-application-source-1h",
    sourceHash,
    SOURCE_CHALLENGE_LIMIT,
    SOURCE_CHALLENGE_WINDOW_MS,
  );
  if (!emailAllowed || !sourceAllowed) {
    return { challengeId: await latestUsableChallenge(application.email, payloadHash) };
  }

  const id = crypto.randomUUID();
  const code = randomDigits();
  const now = new Date();
  const codeHash = await hmacHex(
    `provider-application-code:v1:${id}:${application.email}:${payloadHash}:${code}`,
  );
  await getDb().insert(providerApplicationChallenges).values({
    id,
    email: application.email,
    payloadHash,
    codeHash,
    sourceHash,
    expiresAt: new Date(now.getTime() + PROVIDER_APPLICATION_CHALLENGE_LIFETIME_MS).toISOString(),
    attempts: 0,
    usedAt: "",
    createdAt: now.toISOString(),
  });
  try {
    await sendProviderApplicationCode(application.email, code);
  } catch (error) {
    await getDb().delete(providerApplicationChallenges)
      .where(eq(providerApplicationChallenges.id, id));
    throw error;
  }
  return { challengeId: id };
}

export async function verifyProviderApplicationChallenge(
  application: NormalizedProviderApplication,
  challengeId: string,
  code: string,
) {
  if (!/^[0-9]{6}$/.test(code) || !/^[0-9a-f-]{36}$/i.test(challengeId)) {
    return null;
  }
  const payloadHash = await providerApplicationPayloadHash(application);
  const now = new Date().toISOString();
  const suppliedHash = await hmacHex(
    `provider-application-code:v1:${challengeId}:${application.email}:${payloadHash}:${code}`,
  );

  // Claim exactly one attempt before comparing the supplied code. Concurrent
  // guesses cannot all read the same counter and overwrite it with the same
  // value; the conditional UPDATE permits at most five total comparisons.
  const claimedAttempts = await getDb().update(providerApplicationChallenges).set({
    attempts: sql<number>`${providerApplicationChallenges.attempts} + 1`,
  }).where(and(
    eq(providerApplicationChallenges.id, challengeId),
    eq(providerApplicationChallenges.email, application.email),
    eq(providerApplicationChallenges.payloadHash, payloadHash),
    eq(providerApplicationChallenges.usedAt, ""),
    eq(providerApplicationChallenges.verifiedAt, ""),
    gt(providerApplicationChallenges.expiresAt, now),
    lt(
      providerApplicationChallenges.attempts,
      PROVIDER_APPLICATION_CHALLENGE_MAX_ATTEMPTS,
    ),
  )).returning();
  const challenge = claimedAttempts[0];

  // A correct code may be retried after an unrelated application transaction
  // failure. Once verified, further guesses no longer consume attempts.
  if (!challenge) {
    const [previouslyVerified] = await getDb().select()
      .from(providerApplicationChallenges)
      .where(and(
        eq(providerApplicationChallenges.id, challengeId),
        eq(providerApplicationChallenges.email, application.email),
        eq(providerApplicationChallenges.payloadHash, payloadHash),
        eq(providerApplicationChallenges.codeHash, suppliedHash),
        eq(providerApplicationChallenges.usedAt, ""),
        gt(providerApplicationChallenges.verifiedAt, ""),
        gt(providerApplicationChallenges.expiresAt, now),
      ))
      .limit(1);
    return previouslyVerified ? { challenge: previouslyVerified, payloadHash } : null;
  }

  if (!constantTimeEqual(challenge.codeHash, suppliedHash)) {
    if (challenge.attempts >= PROVIDER_APPLICATION_CHALLENGE_MAX_ATTEMPTS) {
      await getDb().update(providerApplicationChallenges).set({ usedAt: now })
        .where(and(
          eq(providerApplicationChallenges.id, challenge.id),
          eq(providerApplicationChallenges.usedAt, ""),
          eq(providerApplicationChallenges.verifiedAt, ""),
          eq(
            providerApplicationChallenges.attempts,
            PROVIDER_APPLICATION_CHALLENGE_MAX_ATTEMPTS,
          ),
        ));
    }
    return null;
  }

  const verifiedRows = await getDb().update(providerApplicationChallenges).set({
    verifiedAt: now,
  }).where(and(
    eq(providerApplicationChallenges.id, challenge.id),
    eq(providerApplicationChallenges.codeHash, suppliedHash),
    eq(providerApplicationChallenges.usedAt, ""),
    eq(providerApplicationChallenges.verifiedAt, ""),
    eq(providerApplicationChallenges.attempts, challenge.attempts),
    gt(providerApplicationChallenges.expiresAt, now),
  )).returning();
  const verifiedChallenge = verifiedRows[0];
  if (!verifiedChallenge) {
    return null;
  }
  return { challenge: verifiedChallenge, payloadHash };
}

export async function cleanupProviderApplicationVerificationState(now = Date.now()) {
  const challengeCutoff = new Date(
    now - CHALLENGE_RETENTION_AFTER_EXPIRY_MS,
  ).toISOString();
  const rateLimitCutoff = new Date(now - RATE_LIMIT_RETENTION_MS).toISOString();
  await getDb().batch([
    getDb().delete(providerApplicationChallenges)
      .where(lt(providerApplicationChallenges.expiresAt, challengeCutoff)),
    getDb().delete(publicWriteRateLimits)
      .where(lt(publicWriteRateLimits.updatedAt, rateLimitCutoff)),
  ] as const);
}
