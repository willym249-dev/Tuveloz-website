import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { providerApplications } from "../../../../db/schema";
import {
  parseProviderAreas,
  parseProviderServices,
  PROVIDER_AREA_OPTIONS,
  serializeProviderAreas,
  serializeProviderServices,
} from "../../../../lib/service-matching";
import {
  evaluateProviderServices,
  getProviderLegalRequirementFlags,
  parseProviderSelfAssessment,
  providerAreasHaveReviewedCompliance,
} from "../../../../lib/provider-compliance";
import {
  getAuthenticatedEmail,
  isOwnerRequest,
} from "../../../../lib/owner-auth";
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

function parseChecklist(value: string) {
  try {
    const parsed = JSON.parse(value) as Partial<VerificationChecklist>;
    return Object.fromEntries(
      CHECKLIST_KEYS.map((key) => [key, parsed[key] === true]),
    ) as VerificationChecklist;
  } catch {
    return Object.fromEntries(
      CHECKLIST_KEYS.map((key) => [key, false]),
    ) as VerificationChecklist;
  }
}

function cleanChecklist(value: unknown) {
  const input = value && typeof value === "object"
    ? value as Partial<Record<ChecklistKey, unknown>>
    : {};
  return Object.fromEntries(
    CHECKLIST_KEYS.map((key) => [key, input[key] === true]),
  ) as VerificationChecklist;
}

function requiredChecklistKeys(services: string[], serviceArea: string) {
  const requirements = getProviderLegalRequirementFlags(services, serviceArea);
  const keys: ChecklistKey[] = [];

  if (requirements.montgomeryRegistration) {
    keys.push("localRegistration");
  }
  if (requirements.marylandCustomerPaperwork || requirements.virginiaCustomerPaperwork) {
    keys.push("consumerRules");
  }
  if (requirements.tintCompliance || requirements.washWaterCompliance) {
    keys.push("serviceRules");
  }

  return keys;
}

export async function POST(request: Request) {
  if (!isOwnerRequest(request)) {
    return Response.json({ error: "Owner access required." }, { status: 403 });
  }
  const email = getAuthenticatedEmail(request);

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

  if (body.action === "save-verification") {
    if (provider.status === "declined") {
      return Response.json({ error: "A declined provider cannot be verified." }, { status: 409 });
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
      verificationStatus: "in review",
      verifiedAt: "",
      verifiedBy: "",
    }).where(eq(providerApplications.id, provider.id));
    return Response.json({
      ok: true,
      verificationChecklist: JSON.stringify(checklist),
      approvedServices: approvedServicesValue,
      verificationStatus: "in review",
    });
  }

  if (body.action === "mark-test") {
    if (provider.status === "declined") {
      return Response.json({ error: "A declined provider cannot receive test access." }, { status: 409 });
    }
    const accessToken = provider.accessToken || crypto.randomUUID();
    await db.update(providerApplications).set({
      accessToken,
      status: "approved",
      verificationStatus: "test",
      isTestProvider: "yes",
      alertsEnabled: "no",
      verifiedAt: "",
      verifiedBy: "",
    }).where(eq(providerApplications.id, provider.id));
    return Response.json({
      ok: true,
      accessToken,
      status: "approved",
      verificationStatus: "test",
      isTestProvider: "yes",
    });
  }

  if (body.action === "verify") {
    if (provider.status === "declined") {
      return Response.json({ error: "A declined provider cannot be verified." }, { status: 409 });
    }
    const checklist = parseChecklist(provider.verificationChecklist);
    const approvedServices = parseProviderServices(provider.approvedServices);
    if (approvedServices.length === 0) {
      return Response.json({ error: "Approve and save at least one requested service before verification." }, { status: 409 });
    }
    if (!providerAreasHaveReviewedCompliance(provider.serviceArea)) {
      return Response.json({
        error: "This provider cannot be verified until the state and local requirements for every service area are reviewed.",
      }, { status: 409 });
    }
    const requiredKeys = requiredChecklistKeys(approvedServices, provider.serviceArea);
    if (requiredKeys.some((key) => !checklist[key])) {
      return Response.json({ error: "Complete and save every required legal check before verification." }, { status: 409 });
    }
    const normalizedAreas = parseProviderAreas(provider.serviceArea);
    if (
      normalizedAreas.length === 0
      || normalizedAreas.some((area) => !PROVIDER_AREA_OPTIONS.includes(
        area as (typeof PROVIDER_AREA_OPTIONS)[number],
      ))
    ) {
      return Response.json({ error: "This provider must use only an active pilot service area." }, { status: 409 });
    }
    const accessToken = provider.accessToken || crypto.randomUUID();
    await db.update(providerApplications).set({
      accessToken,
      serviceArea: serializeProviderAreas(normalizedAreas),
      status: "approved",
      verificationStatus: "verified",
      isTestProvider: "no",
      verifiedAt: new Date().toISOString(),
      verifiedBy: email,
    }).where(eq(providerApplications.id, provider.id));
    return Response.json({
      ok: true,
      accessToken,
      serviceArea: serializeProviderAreas(normalizedAreas),
      status: "approved",
      verificationStatus: "verified",
    });
  }

  if (body.status !== "declined") {
    return Response.json({ error: "Invalid provider update." }, { status: 400 });
  }

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

  return Response.json({ ok: true, accessToken: "", verificationStatus: "declined" });
}
