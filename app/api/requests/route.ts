import { and, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  customerAgreementAcceptances,
  customerRequests,
  providerApplications,
  providerQuotes,
} from "../../../db/schema";
import { decideAutomaticJobRouting } from "../../../lib/automatic-job-routing";
import {
  CUSTOMER_REQUEST_AGREEMENT_KEY,
  CUSTOMER_REQUEST_AGREEMENT_VERSION,
  CUSTOMER_REQUEST_PRIVACY_AGREEMENT_KEY,
  CUSTOMER_REQUEST_PRIVACY_AGREEMENT_VERSION,
  CUSTOMER_REQUEST_SCOPE_VERSION,
  customerAcceptanceDeviceContext,
  customerRequestAgreementEvidenceText,
  customerRequestAgreementHash,
  customerRequestPrivacyAgreementEvidenceText,
  customerRequestPrivacyAgreementHash,
  customerRequestScopedAgreementHash,
  customerRequestScopedPrivacyAgreementHash,
  customerRequestScopeSnapshot,
  normalizeScheduledFor,
  parseExactServiceCodes,
  requestIpAddress,
} from "../../../lib/customer-job-scope";
import { sendMarketplaceUpdateEmail } from "../../../lib/email-notifications";
import {
  deleteJobImage,
  ImageValidationError,
  storeJobImage,
  validateJobImage,
} from "../../../lib/job-images";
import {
  evaluateJobScopeFacts,
  JOB_SCOPE_COUNTY,
  JOB_SCOPE_STATE,
  jobScopeFactsFromInput,
} from "../../../lib/job-scope-facts";
import {
  CUSTOMER_JOB_POSTING_PAUSED,
  CUSTOMER_JOB_POSTING_PAUSED_DETAIL,
  marketplacePausedMessage,
} from "../../../lib/launch-status";
import { runtimeMarketplaceActionAllowed } from "../../../lib/runtime-marketplace-action";
import {
  areaForZip,
  CURRENT_LAUNCH_AREA,
  CUSTOMER_SERVICE_LOCATION_OPTIONS,
  PARTS_PREFERENCE_OPTIONS,
  PARTS_SOURCE_OPTIONS,
  providerMatchesArea,
  providerMatchesServiceLocation,
  serializeLocationOptions,
} from "../../../lib/service-matching";
import {
  CUSTOMER_POLICY_BUNDLE_VERSION,
  policyAccepted,
} from "../../../lib/policies";
import { customerAcceptanceBundleIsReleasedForPurpose } from "../../../lib/customer-policy-acceptance";
import {
  POLICY_JURISDICTION,
  POLICY_VERSION,
  SERVICE_POLICY_CATALOG,
} from "../../../lib/provider-policy";
import { isSameOriginRequest } from "../../../lib/request-security";

const GUEST_CONSENT_VERSION = "guest-request-2026-07-30";
const GUEST_PROFILE_CONSENT_TEXT =
  "Create a reusable guest profile so Tuveloz can match this request to a future account after I verify this email.";
const MARKETING_CONSENT_TEXT =
  "Email me occasional Tuveloz promotions and service updates. Optional; I can unsubscribe anytime.";

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function pausedCustomerRequestResponse() {
  return Response.json(
    {
      error: marketplacePausedMessage("request"),
      detail: CUSTOMER_JOB_POSTING_PAUSED_DETAIL,
      code: "MARKETPLACE_ONBOARDING_ONLY",
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

function customerValidationError(error: string, code?: string, status = 400) {
  return Response.json(
    { error, ...(code ? { code } : {}) },
    { status, headers: { "cache-control": "no-store" } },
  );
}

export async function POST(request: Request) {
  // Keep this gate ahead of origin checks, body parsing, account lookup, image
  // handling, and every database read. Public clients cannot manufacture a
  // test flag; only already-persisted fixtures may advance elsewhere.
  if (CUSTOMER_JOB_POSTING_PAUSED) {
    return pausedCustomerRequestResponse();
  }
  if (!(await runtimeMarketplaceActionAllowed("request"))) {
    return pausedCustomerRequestResponse();
  }
  if (!customerAcceptanceBundleIsReleasedForPurpose("request_scope")) {
    return customerValidationError(
      "Customer requests remain closed until every required customer policy has an active, effective, hash-verified release.",
      "CUSTOMER_POLICY_RELEASE_REQUIRED",
      503,
    );
  }
  if (!isSameOriginRequest(request)) {
    return customerValidationError(
      "This request must be submitted from TUVELOZ.",
      "SAME_ORIGIN_REQUIRED",
      403,
    );
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
        serviceCodes: formData.getAll("service-code"),
        jurisdiction: formData.get("jurisdiction"),
        scheduledFor: formData.get("scheduled-for"),
        scheduledTimeZone: formData.get("scheduled-time-zone"),
        partsSource: formData.get("parts-source"),
        partsPreference: formData.get("parts-preference"),
        serviceLocations: formData.getAll("service-location"),
        serviceAddress: formData.get("service-address"),
        requestedOperations: formData.getAll("requested-operation"),
        prohibitedOperationsAttestedAbsent: formData.getAll(
          "prohibited-operation-absent",
        ),
        jobLocationType: formData.get("job-location-type"),
        propertyPermission: formData.get("property-permission"),
        vehicleDriveability: formData.get("vehicle-driveability"),
        vehicleState: formData.get("vehicle-state"),
        highVoltageStatus: formData.get("high-voltage-status"),
        safetyAttestations: formData.getAll("safety-attestation"),
        details: formData.get("job-details"),
        rebookToken: formData.get("rebook-token"),
        termsAccepted: formData.get("terms-accepted"),
        privacyAcknowledged: formData.get("privacy-acknowledged"),
        customerAcceptanceKey: formData.get("customer-acceptance-key"),
        customerAcceptanceVersion: formData.get("customer-acceptance-version"),
        customerAcceptanceHash: formData.get("customer-acceptance-hash"),
        customerPrivacyKey: formData.get("customer-privacy-key"),
        customerPrivacyVersion: formData.get("customer-privacy-version"),
        customerPrivacyHash: formData.get("customer-privacy-hash"),
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
    const submittedLaunchArea = clean(body.launchArea, 80);
    const municipality = clean(body.municipality, 100);
    const vehicle = clean(body.vehicle, 320);
    const submittedServiceCodes = Array.isArray(body.serviceCodes)
      ? body.serviceCodes
      : [body.serviceCode];
    const serviceCodes = parseExactServiceCodes(submittedServiceCodes);
    const jurisdiction = clean(body.jurisdiction, 100);
    const scheduledTimeZone = clean(body.scheduledTimeZone, 80) || "America/New_York";
    const scheduledFor = normalizeScheduledFor(body.scheduledFor, scheduledTimeZone);
    const partsSource = clean(body.partsSource, 80);
    const partsPreference = clean(body.partsPreference, 80);
    const submittedLocations = Array.isArray(body.serviceLocations)
      ? body.serviceLocations
      : [body.serviceLocation ?? body.serviceLocations];
    const serviceLocations = submittedLocations
      .map((value) => clean(value, 80))
      .filter(Boolean);
    const serviceAddress = clean(body.serviceAddress, 240);
    const submittedOperations = Array.isArray(body.requestedOperations)
      ? body.requestedOperations
      : [body.requestedOperation];
    const submittedProhibitedAbsences = Array.isArray(
      body.prohibitedOperationsAttestedAbsent,
    )
      ? body.prohibitedOperationsAttestedAbsent
      : [body.prohibitedOperationAbsent];
    const submittedSafetyAttestations = Array.isArray(body.safetyAttestations)
      ? body.safetyAttestations
      : [body.safetyAttestation];
    const details = clean(body.details, 1500);
    const rebookToken = clean(body.rebookToken, 120);
    const acceptedTerms = policyAccepted(body.termsAccepted);
    const privacyAcknowledged = policyAccepted(body.privacyAcknowledged);
    const rememberEmailConsent = policyAccepted(body.rememberEmailConsent);
    const marketingConsent = policyAccepted(body.marketingConsent);

    if (!name || !email || !zip || !municipality || !vehicle || !details) {
      return customerValidationError("Please complete every required field.");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return customerValidationError("Enter a valid email address.");
    }
    if (!/^\d{5}(?:-\d{4})?$/.test(zip)) {
      return customerValidationError("Enter a valid ZIP code.");
    }
    if (submittedLaunchArea && submittedLaunchArea !== CURRENT_LAUNCH_AREA) {
      return customerValidationError(
        "TUVELOZ currently accepts service requests only in Montgomery County, Maryland.",
        "LAUNCH_AREA_NOT_SUPPORTED",
      );
    }
    if (areaForZip(zip) !== "Montgomery County") {
      return customerValidationError(
        "Enter a Montgomery County ZIP code, or request your area for future expansion.",
        "ZIP_NOT_SUPPORTED",
      );
    }
    if (jurisdiction !== POLICY_JURISDICTION) {
      return customerValidationError(
        "Choose the supported Montgomery County, Maryland jurisdiction.",
        "JURISDICTION_NOT_SUPPORTED",
      );
    }
    if (scheduledTimeZone !== "America/New_York" || !scheduledFor) {
      return customerValidationError(
        "Choose a valid service date and time in America/New_York time.",
        "SCHEDULE_REQUIRED",
      );
    }
    if (Date.parse(scheduledFor) <= Date.now()) {
      return customerValidationError(
        "Choose a requested service time in the future.",
        "SCHEDULE_MUST_BE_FUTURE",
      );
    }
    if (serviceCodes.length !== 1) {
      return customerValidationError(
        "Choose one recognized exact service code. Broad or combined categories are not accepted.",
        "EXACT_SERVICE_REQUIRED",
      );
    }
    const serviceCode = serviceCodes[0];
    const jobFacts = jobScopeFactsFromInput({
      serviceCode,
      operationCode: submittedOperations.length === 1
        ? submittedOperations[0]
        : "",
      prohibitedOperationsAttestedAbsent: submittedProhibitedAbsences,
      locationType: body.jobLocationType,
      address: serviceAddress,
      municipality,
      county: JOB_SCOPE_COUNTY,
      state: JOB_SCOPE_STATE,
      postalCode: zip,
      jurisdiction,
      propertyPermission: body.propertyPermission,
      vehicleDriveability: body.vehicleDriveability,
      vehicleState: body.vehicleState,
      highVoltageStatus: body.highVoltageStatus,
      safetyAttestations: submittedSafetyAttestations,
    });
    const jobFactsEvaluation = evaluateJobScopeFacts([serviceCode], jobFacts);
    if (!jobFactsEvaluation.allowed || !jobFactsEvaluation.facts) {
      return customerValidationError(
        jobFactsEvaluation.reasons[0]?.detail
          || "Complete the exact operation, location, vehicle, and safety facts.",
        jobFactsEvaluation.reasons[0]?.code || "JOB_FACTS_REQUIRED",
      );
    }
    if (
      !["customer_private_property", "public_roadside"]
        .includes(jobFactsEvaluation.facts.location.type)
    ) {
      return customerValidationError(
        "Customer intake can currently bind only a customer-authorized private location or a fully checked lawful roadside location. Facility services remain disabled.",
        "CUSTOMER_LOCATION_TYPE_NOT_OPEN",
      );
    }
    if (
      jobFactsEvaluation.facts.location.type === "customer_private_property"
      && (
        serviceLocations[0] !== CUSTOMER_SERVICE_LOCATION_OPTIONS[0]
        || jobFactsEvaluation.facts.location.propertyPermission
          !== "customer_confirmed_authority"
      )
    ) {
      return customerValidationError(
        "A customer-location request must use customer-controlled private property with confirmed authority.",
        "PROPERTY_PERMISSION_REQUIRED",
      );
    }
    if (
      jobFactsEvaluation.facts.location.type === "public_roadside"
      && (
        serviceLocations[0] !== CUSTOMER_SERVICE_LOCATION_OPTIONS[0]
        || jobFactsEvaluation.facts.location.propertyPermission
          !== "not_applicable_public_roadside"
      )
    ) {
      return customerValidationError(
        "A roadside request must use the public-roadside permission value and the provider-comes-to-me arrangement.",
        "ROADSIDE_LOCATION_FACTS_REQUIRED",
      );
    }
    if (!PARTS_SOURCE_OPTIONS.includes(
      partsSource as (typeof PARTS_SOURCE_OPTIONS)[number],
    )) {
      return customerValidationError("Choose who will supply any needed parts.");
    }
    if (!PARTS_PREFERENCE_OPTIONS.includes(
      partsPreference as (typeof PARTS_PREFERENCE_OPTIONS)[number],
    )) {
      return customerValidationError("Choose a listed parts preference.");
    }
    if (
      serviceLocations.length !== 1
      || !CUSTOMER_SERVICE_LOCATION_OPTIONS.includes(
        serviceLocations[0] as (typeof CUSTOMER_SERVICE_LOCATION_OPTIONS)[number],
      )
    ) {
      return customerValidationError("Choose one exact service-location arrangement.");
    }
    if (
      serviceLocations[0] === CUSTOMER_SERVICE_LOCATION_OPTIONS[0]
      && !serviceAddress
    ) {
      return customerValidationError(
        "Enter the exact service address when a provider may come to you.",
      );
    }
    if (!acceptedTerms || !privacyAcknowledged) {
      return customerValidationError(
        "Accept the request terms and separately acknowledge the Privacy Policy.",
        "CUSTOMER_ACCEPTANCE_REQUIRED",
      );
    }

    const [expectedAcceptanceHash, expectedPrivacyHash] = await Promise.all([
      customerRequestAgreementHash(),
      customerRequestPrivacyAgreementHash(),
    ]);
    if (
      clean(body.customerAcceptanceKey, 100) !== CUSTOMER_REQUEST_AGREEMENT_KEY
      || clean(body.customerAcceptanceVersion, 300) !== CUSTOMER_REQUEST_AGREEMENT_VERSION
      || clean(body.customerAcceptanceHash, 64).toLowerCase() !== expectedAcceptanceHash
      || clean(body.customerPrivacyKey, 100) !== CUSTOMER_REQUEST_PRIVACY_AGREEMENT_KEY
      || clean(body.customerPrivacyVersion, 300) !== CUSTOMER_REQUEST_PRIVACY_AGREEMENT_VERSION
      || clean(body.customerPrivacyHash, 64).toLowerCase() !== expectedPrivacyHash
    ) {
      return customerValidationError(
        "The customer agreements changed while this form was open. Refresh and review them again.",
        "CUSTOMER_AGREEMENT_REFRESH_REQUIRED",
        409,
      );
    }

    const serializedLocations = serializeLocationOptions(
      serviceLocations,
      CUSTOMER_SERVICE_LOCATION_OPTIONS,
    );
    let preferredProviderEmail = "";
    let preferredProviderName = "";
    let preferredProviderId = "";
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
        return customerValidationError(
          "That repeat-booking link is not available for a completed real job.",
        );
      }

      const [acceptedProvider] = await db.select({
        id: providerApplications.id,
        email: providerApplications.email,
        name: providerApplications.name,
        serviceArea: providerApplications.serviceArea,
        workLocations: providerApplications.workLocations,
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
        return customerValidationError(
          "The previous provider is not currently available for repeat booking.",
        );
      }
      if (
        !providerMatchesArea(acceptedProvider.serviceArea, CURRENT_LAUNCH_AREA)
        || !providerMatchesServiceLocation(
          acceptedProvider.workLocations,
          serializedLocations,
        )
      ) {
        return customerValidationError(
          "That provider is not currently approved for this area and service-location arrangement.",
        );
      }
      preferredProviderEmail = acceptedProvider.email;
      preferredProviderName = acceptedProvider.name;
      preferredProviderId = acceptedProvider.id;
      repeatOfRequestId = previousJob.id;
    }

    const automaticDecision = await decideAutomaticJobRouting({
      serviceCodes: [serviceCode],
      jurisdiction,
      scheduledFor,
      jobFacts: jobFactsEvaluation.facts,
      ...(preferredProviderId ? { requiredProviderId: preferredProviderId } : {}),
    });
    if (!automaticDecision.allowed) {
      return customerValidationError(
        automaticDecision.message,
        automaticDecision.code,
        automaticDecision.code === "EXACT_SERVICE_REQUIRED"
          || automaticDecision.code === "BROAD_SERVICE_PROHIBITED"
          || automaticDecision.code === "JURISDICTION_NOT_SUPPORTED"
          || automaticDecision.code === "SCHEDULE_REQUIRED"
          ? 400
          : 409,
      );
    }

    const id = crypto.randomUUID();
    const accessToken = crypto.randomUUID();
    const image = await validateJobImage(issuePhoto, false);
    const issueImageKey = image ? await storeJobImage(id, "issue", image) : "";
    const recordedAt = new Date().toISOString();
    const serviceLabel = SERVICE_POLICY_CATALOG[serviceCode].label;
    const scopeSnapshot = customerRequestScopeSnapshot({
      requestId: id,
      scopeVersion: CUSTOMER_REQUEST_SCOPE_VERSION,
      serviceCodes: automaticDecision.serviceCodes,
      jurisdiction: automaticDecision.jurisdiction,
      municipality,
      scheduledFor: automaticDecision.scheduledFor,
      vehicle,
      zip,
      launchArea: CURRENT_LAUNCH_AREA,
      serviceLocations: serializedLocations,
      serviceAddress,
      partsSource,
      partsPreference,
      details,
      hasIssueImage: Boolean(image),
      jobFacts: jobFactsEvaluation.facts,
      routingActivationDecisionIds: automaticDecision.activationDecisionIds,
      routingLaunchReadinessDecisionIds:
        automaticDecision.launchReadinessDecisionIds,
      routingLaunchReadinessCheckedAt:
        automaticDecision.launchReadinessCheckedAt,
    });
    const acceptanceSessionId = crypto.randomUUID();
    const deviceContext = customerAcceptanceDeviceContext(request);
    const [scopedAcceptanceHash, scopedPrivacyHash] = await Promise.all([
      customerRequestScopedAgreementHash(scopeSnapshot),
      customerRequestScopedPrivacyAgreementHash(scopeSnapshot),
    ]);
    const db = getDb();
    let requestInserted = false;
    try {
      await db.insert(customerRequests).values({
        id,
        name,
        email,
        zip,
        launchArea: CURRENT_LAUNCH_AREA,
        municipality,
        vehicle,
        service: serviceLabel,
        serviceCodes: JSON.stringify(automaticDecision.serviceCodes),
        jurisdiction: automaticDecision.jurisdiction,
        partsSource,
        partsPreference,
        budgetRange: "Not provided",
        serviceLocations: serializedLocations,
        serviceAddress,
        details,
        scheduledFor: automaticDecision.scheduledFor,
        preferredProviderEmail,
        preferredProviderName,
        repeatOfRequestId,
        accessToken,
        issueImageKey,
        issueImageType: image?.contentType ?? "",
        status: "approved",
        approvedAt: recordedAt,
        policyVersion: POLICY_VERSION,
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
      requestInserted = true;

      await db.insert(customerAgreementAcceptances).values({
        id: crypto.randomUUID(),
        customerEmail: email,
        requestId: id,
        quoteId: "",
        scopeVersion: CUSTOMER_REQUEST_SCOPE_VERSION,
        scopeSnapshot,
        agreementKey: CUSTOMER_REQUEST_AGREEMENT_KEY,
        agreementVersion: CUSTOMER_REQUEST_AGREEMENT_VERSION,
        agreementHash: scopedAcceptanceHash,
        agreementText: customerRequestAgreementEvidenceText(scopeSnapshot),
        acceptedByName: name,
        acceptanceAction: "affirmative-customer-request-scope-checkbox",
        acceptedAt: recordedAt,
        ipAddress: requestIpAddress(request),
        sessionId: acceptanceSessionId,
        deviceContext,
        createdAt: recordedAt,
      });
      await db.insert(customerAgreementAcceptances).values({
        id: crypto.randomUUID(),
        customerEmail: email,
        requestId: id,
        quoteId: "",
        scopeVersion: CUSTOMER_REQUEST_SCOPE_VERSION,
        scopeSnapshot,
        agreementKey: CUSTOMER_REQUEST_PRIVACY_AGREEMENT_KEY,
        agreementVersion: CUSTOMER_REQUEST_PRIVACY_AGREEMENT_VERSION,
        agreementHash: scopedPrivacyHash,
        agreementText: customerRequestPrivacyAgreementEvidenceText(scopeSnapshot),
        acceptedByName: name,
        acceptanceAction: "affirmative-separate-customer-privacy-checkbox",
        acceptedAt: recordedAt,
        ipAddress: requestIpAddress(request),
        sessionId: acceptanceSessionId,
        deviceContext,
        createdAt: recordedAt,
      });
    } catch (error) {
      const cleanup: Promise<unknown>[] = [];
      if (requestInserted) {
        cleanup.push(
          db.delete(customerAgreementAcceptances)
            .where(eq(customerAgreementAcceptances.requestId, id)),
          db.delete(customerRequests).where(eq(customerRequests.id, id)),
        );
      }
      if (issueImageKey) cleanup.push(deleteJobImage(issueImageKey));
      await Promise.allSettled(cleanup);
      throw error;
    }

    const notifications = await Promise.allSettled(
      automaticDecision.matchingProviders.map((provider) => (
        sendMarketplaceUpdateEmail({
          eventKey: `automatic-request:${id}:${provider.providerId}`,
          recipientEmail: provider.email,
          subject: "New eligible TUVELOZ job request",
          lines: [
            `Hello ${provider.name},`,
            "",
            `A customer request matches your approved exact service: ${serviceCode}.`,
            `Requested service time: ${automaticDecision.scheduledFor}.`,
            "",
            "Open your private provider workspace to review the exact scope and decide whether to quote:",
            "https://tuveloz.com/account?role=provider",
            "",
            "TUVELOZ routed this request because the service activation and provider eligibility records were current through the requested job time. You remain free to decline the opportunity.",
          ],
        })
      )),
    );
    const failedNotificationCount = notifications.filter(
      (notification) => notification.status === "rejected",
    ).length;
    if (failedNotificationCount) {
      console.error("Eligible-provider request notifications failed", {
        requestId: id,
        failedNotificationCount,
      });
    }

    return Response.json({
      ok: true,
      accessToken,
      requestId: id,
      scopeVersion: CUSTOMER_REQUEST_SCOPE_VERSION,
      automaticallyApproved: true,
      matchingProviderCount: automaticDecision.matchingProviders.length,
    }, { status: 201, headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof ImageValidationError) {
      return customerValidationError(error.message);
    }
    console.error("Unable to save customer request", error);
    return Response.json(
      { error: "We could not save your request. Please try again." },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
}
