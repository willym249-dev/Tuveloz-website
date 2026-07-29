import { getDb } from "../../../db";
import { providerApplications } from "../../../db/schema";
import {
  cleanProviderSelfAssessment,
  evaluateProviderServices,
  providerAreasHaveReviewedCompliance,
} from "../../../lib/provider-compliance";
import {
  parseProviderAreas,
  PROVIDER_AREA_OPTIONS,
  PROVIDER_SERVICE_OPTIONS,
  PROVIDER_WORK_LOCATION_OPTIONS,
  serializeLocationOptions,
  serializeProviderAreas,
  serializeProviderServices,
} from "../../../lib/service-matching";
import {
  policyAccepted,
  PROVIDER_POLICY_BUNDLE_VERSION,
} from "../../../lib/policies";

const ALLOWED_SERVICES = new Set<string>(PROVIDER_SERVICE_OPTIONS);
const ALLOWED_AREAS = new Set<string>(PROVIDER_AREA_OPTIONS);
const SERVICE_RULES_VERSION = "2026-07-27-montgomery-launch-compliance";

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const name = clean(body.name, 120);
    const email = clean(body.email, 180).toLowerCase();
    const preferredLanguage = clean(body.preferredLanguage, 60) || "English";
    const services = Array.isArray(body.services)
      ? body.services.map((service) => clean(service, 100)).filter(Boolean)
      : [clean(body.service, 100)].filter(Boolean);
    const serviceArea = clean(body.serviceArea, 120);
    const businessMunicipality = clean(body.businessMunicipality, 100);
    const workLocations = Array.isArray(body.workLocations)
      ? body.workLocations.map((value) => clean(value, 100)).filter(Boolean)
      : [clean(body.workLocations, 100)].filter(Boolean);
    const businessServiceAddress = clean(body.businessServiceAddress, 240);
    const experience = clean(body.experience, 1000);
    const insuranceStatus = clean(body.insuranceStatus, 80);

    const rulesReviewed = body.rulesReviewed === true;
    const providerAttestation = body.providerAttestation === true;
    const legalResponsibility = body.legalResponsibility === true;
    const acceptedTerms = policyAccepted(body.termsAccepted);
    const providerSelfAssessment = cleanProviderSelfAssessment(body.providerSelfAssessment);

    if (
      !name
      || !email
      || services.length === 0
      || !serviceArea
      || !businessMunicipality
      || workLocations.length === 0
    ) {
      return Response.json({ error: "Please complete every required field." }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    if (services.some((service) => !ALLOWED_SERVICES.has(service))) {
      return Response.json({ error: "Choose only listed launch services." }, { status: 400 });
    }
    const areas = parseProviderAreas(serviceArea);
    if (areas.length === 0 || areas.some((area) => !ALLOWED_AREAS.has(area))) {
      return Response.json({ error: "Choose at least one listed service area." }, { status: 400 });
    }
    if (!providerAreasHaveReviewedCompliance(areas)) {
      return Response.json({
        error: "This service area cannot accept provider applications until its state and local requirements are reviewed.",
      }, { status: 409 });
    }
    if (workLocations.some((value) => !PROVIDER_WORK_LOCATION_OPTIONS.includes(
      value as (typeof PROVIDER_WORK_LOCATION_OPTIONS)[number],
    ))) {
      return Response.json({ error: "Choose only the listed meeting options." }, { status: 400 });
    }
    if (
      workLocations.includes(PROVIDER_WORK_LOCATION_OPTIONS[1])
      && !businessServiceAddress
    ) {
      return Response.json({
        error: "Enter the business meeting address when customers may come to you.",
      }, { status: 400 });
    }
    if (!rulesReviewed || !providerAttestation || !legalResponsibility) {
      return Response.json({
        error: "Review and confirm the legal requirements shown for your selections.",
      }, { status: 400 });
    }
    if (!acceptedTerms) {
      return Response.json({
        error: "You must be 18 or older and accept the Terms and Provider Agreement before applying.",
      }, { status: 400 });
    }
    const serviceEligibilityStatuses = evaluateProviderServices(
      services,
      areas,
      providerSelfAssessment,
    );

    await getDb().insert(providerApplications).values({
      id: crypto.randomUUID(),
      name,
      email,
      preferredLanguage,
      service: serializeProviderServices(services),
      serviceArea: serializeProviderAreas(areas),
      businessMunicipality,
      workLocations: serializeLocationOptions(
        workLocations,
        PROVIDER_WORK_LOCATION_OPTIONS,
      ),
      businessServiceAddress,
      experience,
      insuranceStatus,
      providerSelfAssessment: JSON.stringify(providerSelfAssessment),
      serviceEligibilityStatuses: JSON.stringify(serviceEligibilityStatuses),
      serviceRulesVersion: SERVICE_RULES_VERSION,
      serviceRulesAcknowledgedAt: new Date().toISOString(),
      termsAcceptedAt: new Date().toISOString(),
      termsVersion: PROVIDER_POLICY_BUNDLE_VERSION,
    });

    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("Unable to save provider application", error);
    return Response.json(
      { error: "We could not save your application. Please try again." },
      { status: 500 },
    );
  }
}
