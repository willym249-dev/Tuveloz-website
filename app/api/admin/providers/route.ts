import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { providerApplications } from "../../../../db/schema";
import {
  parseProviderServices,
  serializeProviderServices,
} from "../../../../lib/service-matching";
import {
  evaluateProviderServices,
  parseProviderSelfAssessment,
} from "../../../../lib/provider-compliance";
import { isSameOriginRequest } from "../../../../lib/account-auth";
import { isVerifiedOwnerRequest } from "../../../../lib/owner-auth";
import { expireOpenCheckoutSessionsForLaunchShutdown } from "../../../../lib/stripe-payments";
const CHECKLIST_KEYS = [
  "businessIdentity",
  "serviceExperience",
  "stateRegistration",
  "localRegistration",
  "consumerRules",
  "serviceRules",
] as const;

type ChecklistKey = (typeof CHECKLIST_KEYS)[number];
type VerificationChecklist = Record<ChecklistKey, boolean>;

function cleanChecklist(value: unknown) {
  const input = value && typeof value === "object"
    ? value as Partial<Record<ChecklistKey, unknown>>
    : {};
  return Object.fromEntries(
    CHECKLIST_KEYS.map((key) => [key, input[key] === true]),
  ) as VerificationChecklist;
}

export async function POST(request: Request) {
  if (!(await isVerifiedOwnerRequest(request))) {
    return Response.json({ error: "Owner access required." }, { status: 403 });
  }
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Cross-origin owner actions are not allowed." }, { status: 403 });
  }
  const body = (await request.json()) as {
    id?: string;
    action?: string;
    status?: string;
    checklist?: unknown;
    approvedServices?: unknown;
  };
  if (!body.id) {
    return Response.json({ error: "Invalid provider update." }, { status: 400 });
  }
  const db = getDb();
  const [provider] = await db.select().from(providerApplications)
    .where(eq(providerApplications.id, body.id)).limit(1);
  if (!provider) {
    return Response.json({ error: "Provider application not found." }, { status: 404 });
  }

  if (body.action === "save-credential" || body.action === "verify") {
    return Response.json({
      error: "Legacy whole-provider verification is disabled. Test fixtures can never be converted into real or public verified providers; use Provider Registration & Compliance for v0.11 review.",
      code: "LEGACY_VERIFICATION_DISABLED",
    }, { status: 409, headers: { "cache-control": "no-store" } });
  }

  if (body.action === "save-verification" && provider.isTestProvider !== "yes") {
    return Response.json({
      error: "Use Provider Registration & Compliance for real providers. The legacy checklist is available only inside an isolated test fixture.",
      code: "USE_PROVIDER_COMPLIANCE_QUEUE",
    }, { status: 409, headers: { "cache-control": "no-store" } });
  }

  if (body.action === "save-verification") {
    if (provider.status === "declined" || provider.isTestProvider !== "yes") {
      return Response.json({ error: "Only an active isolated test fixture can save this legacy checklist." }, { status: 409 });
    }
    const checklist = cleanChecklist(body.checklist);
    const requestedServices = parseProviderServices(provider.service);
    const approvedServices = Array.isArray(body.approvedServices)
      ? [...new Set(body.approvedServices
          .filter((service): service is string => typeof service === "string")
          .map((service) => service.trim())
          .filter((service) => requestedServices.includes(service)))]
      : [];
    const eligibilityByService = evaluateProviderServices(
      requestedServices,
      provider.serviceArea,
      parseProviderSelfAssessment(provider.providerSelfAssessment),
    );
    const blockedService = approvedServices.find(
      (service) => eligibilityByService[service]?.status === "blocked",
    );
    if (blockedService) {
      return Response.json({
        error: `${blockedService} is blocked by the saved eligibility answers and cannot be approved.`,
      }, { status: 409 });
    }
    const approvedServicesValue = serializeProviderServices(approvedServices);
    await db.update(providerApplications).set({
      verificationChecklist: JSON.stringify(checklist),
      serviceEligibilityStatuses: JSON.stringify(eligibilityByService),
      approvedServices: approvedServicesValue,
      status: "approved",
      verificationStatus: "test",
      isTestProvider: "yes",
      alertsEnabled: "no",
      verifiedAt: "",
      verifiedBy: "",
    }).where(eq(providerApplications.id, provider.id));
    return Response.json({
      ok: true,
      verificationChecklist: JSON.stringify(checklist),
      approvedServices: approvedServicesValue,
      verificationStatus: "test",
      isTestProvider: "yes",
    });
  }

  if (body.action === "mark-test") {
    return Response.json({
      error: "A real provider application cannot be converted into a test fixture. Test providers must originate as isolated synthetic records with no real applicant data.",
      code: "REAL_RECORD_TEST_CONVERSION_DISABLED",
    }, { status: 409, headers: { "cache-control": "no-store" } });
  }

  if (body.status !== "declined") {
    return Response.json({ error: "Invalid provider update." }, { status: 400 });
  }

  if (provider.status !== "new") {
    return Response.json({ error: "This provider application was already reviewed." }, { status: 409 });
  }

  // Quarantine every locally open Checkout Session before this provider
  // record can be revoked. The cleanup helper changes local payment state
  // before contacting Stripe, so a remote expiration failure still fails
  // closed; a database cleanup failure prevents the decline from being saved.
  await expireOpenCheckoutSessionsForLaunchShutdown();

  const updated = await db
    .update(providerApplications)
    .set({
      status: "declined",
      accessToken: "",
      verificationStatus: "declined",
      isTestProvider: "no",
      approvedServices: "",
    })
    .where(and(
      eq(providerApplications.id, provider.id),
      eq(providerApplications.status, "new"),
    ))
    .returning({ id: providerApplications.id });
  if (updated.length === 0) {
    return Response.json({ error: "This provider application was already reviewed." }, { status: 409 });
  }

  await expireOpenCheckoutSessionsForLaunchShutdown();
  return Response.json({ ok: true, verificationStatus: "declined" });
}
