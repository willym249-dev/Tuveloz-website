import { and, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { customerRequests, providerApplications, providerQuotes } from "../../../db/schema";
import { sendNewCustomerRequestAlert } from "../../../lib/email-notifications";
import {
  deleteJobImage,
  ImageValidationError,
  storeJobImage,
  validateJobImage,
} from "../../../lib/job-images";
import {
  CUSTOMER_JOB_POSTING_PAUSED,
  CUSTOMER_JOB_POSTING_PAUSED_DETAIL,
  CUSTOMER_JOB_POSTING_PAUSED_MESSAGE,
} from "../../../lib/launch-status";
import {
  areaForZip,
  CUSTOMER_JOB_SERVICE_OPTIONS,
  CUSTOMER_SERVICE_LOCATION_OPTIONS,
  effectiveProviderServices,
  PARTS_PREFERENCE_OPTIONS,
  PARTS_SOURCE_OPTIONS,
  providerMatchesArea,
  providerMatchesJob,
  providerMatchesServiceLocation,
  serializeJobServices,
  serializeLocationOptions,
  SUPPORTED_LAUNCH_AREAS,
} from "../../../lib/service-matching";
import {
  CUSTOMER_POLICY_BUNDLE_VERSION,
  policyAccepted,
} from "../../../lib/policies";

const GUEST_CONSENT_VERSION = "guest-request-2026-07-30";
const GUEST_PROFILE_CONSENT_TEXT =
  "Create a reusable guest profile so Tuveloz can match this request to a future account after I verify this email.";
const MARKETING_CONSENT_TEXT =
  "Email me occasional Tuveloz promotions and service updates. Optional; I can unsubscribe anytime.";

const ALLOWED_SERVICES = new Set<string>([
  ...CUSTOMER_JOB_SERVICE_OPTIONS,
  // Keep accepting existing launch-form values saved before multi-service requests.
  "Minor dent repair quote",
  "Scratch or paintwork quote",
  "Car wash — waterless is okay",
  "Car wash — water only",
  "Exterior and interior — waterless is okay",
  "Exterior and interior — water only",
  "Car washing",
]);

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function pausedCustomerRequestResponse() {
  return Response.json(
    {
      error: CUSTOMER_JOB_POSTING_PAUSED_MESSAGE,
      detail: CUSTOMER_JOB_POSTING_PAUSED_DETAIL,
      code: "CUSTOMER_JOB_POSTING_PAUSED",
      customerAccountSignupAvailable: true,
      providerSignupAvailable: true,
    },
    {
      status: 503,
      headers: {
        "cache-control": "no-store",
        "retry-after": "86400",
      },
    },
  );
}

export async function POST(request: Request) {
  if (CUSTOMER_JOB_POSTING_PAUSED) {
    return pausedCustomerRequestResponse();
  }

  try {
    const contentType = request.headers.get("content-type") ?? "";
    let body: Record<string, unknown>;
    let issuePhoto: unknown;
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      body = {
        name: formData.get("name"),
        email: formData.get("email"),
        vehicle: formData.get("vehicle"),
        zip: formData.get("zip"),
        launchArea: formData.get("launch-area"),
        municipality: formData.get("municipality"),
        services: formData.getAll("service"),
        partsSource: formData.get("parts-source"),
        partsPreference: formData.get("parts-preference"),
        serviceLocations: formData.getAll("service-location"),
        serviceAddress: formData.get("service-address"),
        details: formData.get("job-details"),
        rebookToken: formData.get("rebook-token"),
        termsAccepted: formData.get("terms-accepted"),
        rememberEmailConsent: formData.get("remember-email-consent"),
        marketingConsent: formData.get("marketing-consent"),
      };
      issuePhoto = formData.get("issue-photo");
    } else {
      body = (await request.json()) as Record<string, unknown>;
    }
    const name = clean(body.name, 100);
    const email = clean(body.email, 180).toLowerCase();
    const zip = clean(body.zip, 10);
    const launchArea = clean(body.launchArea, 80);
    const municipality = clean(body.municipality, 100);
    const vehicle = clean(body.vehicle, 320);
    const services = Array.isArray(body.services)
      ? body.services.map((value) => clean(value, 80)).filter(Boolean)
      : Array.isArray(body.service)
        ? body.service.map((value) => clean(value, 80)).filter(Boolean)
        : [clean(body.service, 80)].filter(Boolean);
    const partsSource = clean(body.partsSource, 80) || "Either is okay";
    const partsPreference = clean(body.partsPreference, 80) || "No preference";
    const budgetRange = "Not provided";
    const serviceLocations = Array.isArray(body.serviceLocations)
      ? body.serviceLocations.map((value) => clean(value, 80)).filter(Boolean)
      : [clean(body.serviceLocations, 80)].filter(Boolean);
    const serviceAddress = clean(body.serviceAddress, 240);
    const details = clean(body.details, 1500);
    const rebookToken = clean(body.rebookToken, 120);
    const acceptedTerms = policyAccepted(body.termsAccepted);
    const rememberEmailConsent = policyAccepted(body.rememberEmailConsent);
    const marketingConsent = policyAccepted(body.marketingConsent);

    if (
      !name
      || !email
      || !zip
      || !launchArea
      || !municipality
      || !vehicle
      || services.length === 0
      || !partsSource
      || !partsPreference
      || serviceLocations.length === 0
      || !details
    ) {
      return Response.json({ error: "Please complete every field." }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    if (!/^\d{5}(?:-\d{4})?$/.test(zip)) {
      return Response.json({ error: "Enter a valid ZIP code." }, { status: 400 });
    }
    if (!acceptedTerms) {
      return Response.json({
        error: "You must be 18 or older and accept the Terms and Customer Agreement before posting a request.",
      }, { status: 400 });
    }
    if (services.some((service) => !ALLOWED_SERVICES.has(service))) {
      return Response.json({ error: "Choose only listed launch services." }, { status: 400 });
    }
    if (!PARTS_SOURCE_OPTIONS.includes(
      partsSource as (typeof PARTS_SOURCE_OPTIONS)[number],
    )) {
      return Response.json({ error: "Choose who will supply any needed parts." }, { status: 400 });
    }
    if (!PARTS_PREFERENCE_OPTIONS.includes(
      partsPreference as (typeof PARTS_PREFERENCE_OPTIONS)[number],
    )) {
      return Response.json({ error: "Choose a listed parts preference." }, { status: 400 });
    }
    if (serviceLocations.some((value) => !CUSTOMER_SERVICE_LOCATION_OPTIONS.includes(
      value as (typeof CUSTOMER_SERVICE_LOCATION_OPTIONS)[number],
    ))) {
      return Response.json({ error: "Choose only the listed service-location options." }, { status: 400 });
    }
    if (
      serviceLocations.includes(CUSTOMER_SERVICE_LOCATION_OPTIONS[0])
      && !serviceAddress
    ) {
      return Response.json({
        error: "Enter the service address when a provider may come to you.",
      }, { status: 400 });
    }
    if (!SUPPORTED_LAUNCH_AREAS.includes(
      launchArea as (typeof SUPPORTED_LAUNCH_AREAS)[number],
    )) {
      return Response.json({
        error: "Tuveloz currently accepts service requests only in Montgomery County, Maryland.",
      }, { status: 400 });
    }
    if (areaForZip(zip) !== "Montgomery County") {
      return Response.json({
        error: "Enter a Montgomery County ZIP code, or request your area for future expansion.",
      }, { status: 400 });
    }

    let preferredProviderEmail = "";
    let preferredProviderName = "";
    let repeatOfRequestId = "";
    if (rebookToken) {
      const db = getDb();
      const [previousJob] = await db.select({
        id: customerRequests.id,
        status: customerRequests.status,
        isTestJob: customerRequests.isTestJob,
      }).from(customerRequests)
        .where(eq(customerRequests.accessToken, rebookToken))
        .limit(1);
      if (
        !previousJob
        || previousJob.status !== "completed"
        || previousJob.isTestJob === "yes"
      ) {
        return Response.json({
          error: "That repeat-booking link is not available for a completed real job.",
        }, { status: 400 });
      }

      const [acceptedProvider] = await db.select({
        email: providerApplications.email,
        name: providerApplications.name,
        service: providerApplications.service,
        approvedServices: providerApplications.approvedServices,
        serviceArea: providerApplications.serviceArea,
        workLocations: providerApplications.workLocations,
        isTestProvider: providerApplications.isTestProvider,
      }).from(providerQuotes)
        .innerJoin(providerApplications, and(
          eq(providerApplications.email, providerQuotes.providerEmail),
          eq(providerApplications.status, "approved"),
          eq(providerApplications.verificationStatus, "verified"),
          eq(providerApplications.isTestProvider, "no"),
        ))
        .where(and(
          eq(providerQuotes.requestId, previousJob.id),
          eq(providerQuotes.status, "accepted"),
        ))
        .limit(1);
      if (!acceptedProvider) {
        return Response.json({
          error: "The previous provider is not currently available for verified repeat booking.",
        }, { status: 400 });
      }
      const serializedServices = serializeJobServices(services);
      const serializedLocations = serializeLocationOptions(
        serviceLocations,
        CUSTOMER_SERVICE_LOCATION_OPTIONS,
      );
      if (
        !providerMatchesJob(
          effectiveProviderServices(
            acceptedProvider.service,
            acceptedProvider.approvedServices,
            acceptedProvider.isTestProvider,
          ),
          serializedServices,
        )
        || !providerMatchesArea(acceptedProvider.serviceArea, launchArea)
        || !providerMatchesServiceLocation(
          acceptedProvider.workLocations,
          serializedLocations,
        )
      ) {
        return Response.json({
          error: "That provider is not currently approved for this service, area, and meeting option. Compare all matching providers instead.",
        }, { status: 400 });
      }
      preferredProviderEmail = acceptedProvider.email;
      preferredProviderName = acceptedProvider.name;
      repeatOfRequestId = previousJob.id;
    }

    const id = crypto.randomUUID();
    const accessToken = crypto.randomUUID();
    const image = await validateJobImage(issuePhoto, false);
    const issueImageKey = image ? await storeJobImage(id, "issue", image) : "";
    const recordedAt = new Date().toISOString();
    try {
      await getDb().insert(customerRequests).values({
        id,
        name,
        email,
        zip,
        launchArea,
        municipality,
        vehicle,
        service: serializeJobServices(services),
        partsSource,
        partsPreference,
        budgetRange,
        serviceLocations: serializeLocationOptions(
          serviceLocations,
          CUSTOMER_SERVICE_LOCATION_OPTIONS,
        ),
        serviceAddress,
        details,
        preferredProviderEmail,
        preferredProviderName,
        repeatOfRequestId,
        accessToken,
        issueImageKey,
        issueImageType: image?.contentType ?? "",
        termsAcceptedAt: recordedAt,
        termsVersion: CUSTOMER_POLICY_BUNDLE_VERSION,
        rememberEmailConsent: rememberEmailConsent ? "yes" : "no",
        rememberEmailConsentText: GUEST_PROFILE_CONSENT_TEXT,
        marketingConsent: marketingConsent ? "yes" : "no",
        marketingConsentText: MARKETING_CONSENT_TEXT,
        consentVersion: GUEST_CONSENT_VERSION,
        consentSource: "post-a-job",
        consentRecordedAt: recordedAt,
      });
    } catch (error) {
      if (issueImageKey) await deleteJobImage(issueImageKey);
      throw error;
    }

    await sendNewCustomerRequestAlert(id);

    return Response.json({ ok: true, accessToken, requestId: id }, { status: 201 });
  } catch (error) {
    if (error instanceof ImageValidationError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error("Unable to save customer request", error);
    return Response.json(
      { error: "We could not save your request. Please try again." },
      { status: 500 },
    );
  }
}
