import { and, desc, eq, ne } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  agreementAcceptances,
  providerApplications,
  providerPathwayProfiles,
  providerPersonnel,
} from "../../../db/schema";
import {
  cleanProviderSelfAssessment,
  providerAreasHaveReviewedCompliance,
} from "../../../lib/provider-compliance";
import { recordProviderAuditEvent } from "../../../lib/provider-audit";
import {
  PROVIDER_ACCEPTANCE_DOCUMENTS,
  providerAgreementEvidenceText,
  sha256Text,
} from "../../../lib/provider-policy-acceptance";
import {
  isPathwayLevelCompatible,
  isProviderLevel,
  isServiceCode,
  POLICY_JURISDICTION,
  POLICY_STATUS,
  POLICY_VERSION,
  PROVIDER_POLICY_MATRIX,
  SERVICE_POLICY_CATALOG,
  type ProviderLevel,
  type ProviderPathway,
  type ServiceCode,
} from "../../../lib/provider-policy";
import {
  parseProviderAreas,
  PROVIDER_AREA_OPTIONS,
  PROVIDER_WORK_LOCATION_OPTIONS,
  serializeLocationOptions,
  serializeProviderAreas,
  serializeProviderServices,
} from "../../../lib/service-matching";
import { policyAccepted, PROVIDER_POLICY_BUNDLE_VERSION } from "../../../lib/policies";

type ApplicationPathway = "learning_account" | ProviderPathway;

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

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
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

function allowedLevelForApplication(
  pathway: ApplicationPathway,
  serviceCodes: readonly ServiceCode[],
  requestedLevel: unknown,
): ProviderLevel | null {
  if (pathway === "learning_account") return "learning_account";
  const compatibleLevels = PROVIDER_POLICY_MATRIX.pathway_level_compatibility[pathway];
  const candidates = LEVEL_PRIORITY.filter((level) => (
    compatibleLevels.includes(level)
    && serviceCodes.every((serviceCode) => (
      SERVICE_POLICY_CATALOG[serviceCode].allowedPathways.includes(pathway)
      && SERVICE_POLICY_CATALOG[serviceCode].allowedProviderLevels.includes(level)
      && PROVIDER_POLICY_MATRIX.provider_levels[level].allowed_service_codes.includes(serviceCode)
    ))
  ));
  if (!candidates.length) return null;
  if (
    isProviderLevel(requestedLevel)
    && candidates.includes(requestedLevel)
    && isPathwayLevelCompatible(pathway, requestedLevel)
  ) {
    return requestedLevel;
  }
  return candidates[0] ?? null;
}

function applicationRelationship(pathway: ApplicationPathway) {
  if (pathway === "independent_startup") return "owner_operator";
  if (pathway === "sponsored_trainee_employee") return "trainee";
  if (pathway === "provider_business_employee") return "employee";
  return "learner";
}

function requestIp(request: Request) {
  return clean(
    request.headers.get("cf-connecting-ip")
      || request.headers.get("x-forwarded-for")?.split(",")[0]
      || "",
    128,
  );
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return Response.json({ error: "This application must be submitted from TUVELOZ." }, { status: 403 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const name = clean(body.name, 120);
    const email = clean(body.email, 180).toLowerCase();
    const preferredLanguage = clean(body.preferredLanguage, 60) || "English";
    const applicationPathwayValue = clean(body.applicationPathway, 80);
    const applicationPathway = APPLICATION_PATHWAYS.has(applicationPathwayValue as ApplicationPathway)
      ? applicationPathwayValue as ApplicationPathway
      : null;
    const rawServiceCodes = requestedServiceCodes(body);
    const serviceCodes = rawServiceCodes.filter(isServiceCode);
    const serviceArea = clean(body.serviceArea, 240);
    const businessMunicipality = clean(body.businessMunicipality, 100);
    const workLocations = Array.isArray(body.workLocations)
      ? body.workLocations.map((value) => clean(value, 100)).filter(Boolean)
      : [clean(body.workLocations, 100)].filter(Boolean);
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
    const rulesReviewed = body.rulesReviewed === true;
    const adultAcknowledged = body.adultAcknowledged === true;
    const employmentResponsibilityAcknowledged = (
      body.employmentWorkAuthorizationResponsibilityAcknowledged === true
    );
    const acceptedTerms = policyAccepted(body.termsBundleAccepted)
      || policyAccepted(body.termsAccepted);
    const privacyAcknowledged = policyAccepted(body.privacyAcknowledged);

    if (!name || !email || !applicationPathway || !signerName || !signerTitle) {
      return Response.json({ error: "Complete the applicant, pathway, and signer fields." }, { status: 400 });
    }
    if (!isEmail(email)) {
      return Response.json({ error: "Enter a valid applicant email address." }, { status: 400 });
    }
    if (!rawServiceCodes.length || rawServiceCodes.length !== serviceCodes.length) {
      return Response.json({ error: "Choose only exact services listed in the v0.11 review matrix." }, { status: 400 });
    }
    if (serviceCodes.includes("general_auto_repair")) {
      return Response.json({ error: "General auto repair is too broad. Choose exact service codes." }, { status: 400 });
    }

    const areas = parseProviderAreas(serviceArea);
    if (areas.length === 0 || areas.some((area) => !ALLOWED_AREAS.has(area))) {
      return Response.json({ error: "Choose at least one listed service area." }, { status: 400 });
    }
    if (!providerAreasHaveReviewedCompliance(areas)) {
      return Response.json({
        error: "This service area is not open for provider review yet.",
      }, { status: 409 });
    }
    if (!businessMunicipality) {
      return Response.json({ error: "Enter the municipality where the provider is based." }, { status: 400 });
    }
    if (
      workLocations.length === 0
      || workLocations.some((value) => !PROVIDER_WORK_LOCATION_OPTIONS.includes(
        value as (typeof PROVIDER_WORK_LOCATION_OPTIONS)[number],
      ))
    ) {
      return Response.json({ error: "Choose only the listed service-location options." }, { status: 400 });
    }
    if (workLocations.includes(PROVIDER_WORK_LOCATION_OPTIONS[1]) && !businessServiceAddress) {
      return Response.json({
        error: "Enter the business service address when customers may come to the business.",
      }, { status: 400 });
    }
    if (
      applicationPathway === "independent_startup"
      && (!legalBusinessName || !businessEntityType || !businessFormationState)
    ) {
      return Response.json({
        error: "The independent owner-operator pathway requires the provider business details.",
      }, { status: 400 });
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
      return Response.json({
        error: "Enter the sponsoring or employer provider business and its authorized contact.",
      }, { status: 400 });
    }
    if (
      !rulesReviewed
      || !adultAcknowledged
      || !employmentResponsibilityAcknowledged
      || !acceptedTerms
      || !privacyAcknowledged
    ) {
      return Response.json({
        error: "Complete every required legal acknowledgment. Privacy remains a separate acknowledgment.",
      }, { status: 400 });
    }

    const providerLevel = allowedLevelForApplication(
      applicationPathway,
      serviceCodes,
      body.providerLevel,
    );
    if (!providerLevel) {
      return Response.json({
        error: "Those services do not fit one lawful pathway and provider level. Choose services from one level, or use an applicant-only account while you prepare independently. TUVELOZ does not provide training.",
      }, { status: 400 });
    }

    const existing = await getDb().select({ id: providerApplications.id })
      .from(providerApplications)
      .where(and(
        eq(providerApplications.email, email),
        ne(providerApplications.status, "declined"),
      ))
      .orderBy(desc(providerApplications.createdAt))
      .limit(1);
    if (existing[0]) {
      return Response.json({
        error: "An application already exists for this email. Sign in to continue the provider onboarding checklist.",
        onboardingUrl: "/provider-onboarding",
      }, { status: 409 });
    }

    const now = new Date().toISOString();
    const providerId = crypto.randomUUID();
    const personId = crypto.randomUUID();
    const acceptanceSessionId = crypto.randomUUID();
    const legacyAssessment = cleanProviderSelfAssessment(body.providerSelfAssessment);
    const applicationMetadata = {
      ...legacyAssessment,
      onboarding: {
        applicationPathway,
        providerLevel,
        policyVersion: POLICY_VERSION,
        policyStatus: POLICY_STATUS,
        jurisdiction: POLICY_JURISDICTION,
        legalBusinessName,
        businessEntityType,
        businessFormationState,
        sponsoringProviderLegalName,
        sponsorContactName,
        sponsorContactEmail,
        sponsorContactTitle,
        signerName,
        signerTitle,
        adultAcknowledgedAt: now,
        employmentResponsibilityAcknowledgedAt: now,
      },
    };
    const eligibilityStatuses = Object.fromEntries(serviceCodes.map((serviceCode) => [
      serviceCode,
      {
        status: "blocked",
        reasons: [
          "Application review only: service access is disabled until the required evidence, mandatory legal and government requirements, and exact-operation insurance approval are recorded.",
        ],
      },
    ]));

    const db = getDb();
    await db.insert(providerApplications).values({
      id: providerId,
      name,
      email,
      preferredLanguage,
      service: serializeProviderServices(serviceCodes),
      serviceArea: serializeProviderAreas(areas),
      businessMunicipality,
      workLocations: serializeLocationOptions(workLocations, PROVIDER_WORK_LOCATION_OPTIONS),
      businessServiceAddress,
      experience: clean(body.experience, 1000),
      insuranceStatus: "pending-evidence",
      providerSelfAssessment: JSON.stringify(applicationMetadata),
      serviceEligibilityStatuses: JSON.stringify(eligibilityStatuses),
      approvedServices: "",
      serviceRulesVersion: POLICY_VERSION,
      serviceRulesAcknowledgedAt: now,
      termsAcceptedAt: now,
      termsVersion: PROVIDER_POLICY_BUNDLE_VERSION,
      status: "new",
      verificationStatus: "not reviewed",
    });

    const holdReasonCodes = applicationPathway === "learning_account"
      ? ["learning_account_no_customer_jobs", "services_not_activated"]
      : [
          "pending_identity_and_evidence_review",
          "services_not_activated",
          ...(applicationPathway === "sponsored_trainee_employee"
            || applicationPathway === "provider_business_employee"
            ? ["sponsor_or_employer_confirmation_required"]
            : []),
        ];
    await db.insert(providerPathwayProfiles).values({
      id: crypto.randomUUID(),
      providerId,
      providerPersonId: personId,
      relationshipPath: applicationPathway,
      providerLevel,
      pathwayVersion: 1,
      status: applicationPathway === "learning_account" ? "learning_only" : "pending_review",
      policyVersion: POLICY_VERSION,
      holdReasonCodes: JSON.stringify(holdReasonCodes),
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(providerPersonnel).values({
      id: crypto.randomUUID(),
      providerId,
      personId,
      relationshipType: applicationRelationship(applicationPathway),
      personnelRole: "technician",
      providerLevel,
      rosterVersion: 1,
      status: applicationPathway === "learning_account" ? "learning_only" : "pending",
      createdAt: now,
      updatedAt: now,
    });

    const deviceContext = JSON.stringify({
      userAgent: clean(request.headers.get("user-agent"), 600),
      language: clean(request.headers.get("accept-language"), 200),
      country: clean(request.headers.get("cf-ipcountry"), 20),
      policyBundleVersion: PROVIDER_POLICY_BUNDLE_VERSION,
      policyStatus: POLICY_STATUS,
    });
    for (const document of PROVIDER_ACCEPTANCE_DOCUMENTS) {
      const agreementText = providerAgreementEvidenceText(document);
      await db.insert(agreementAcceptances).values({
        id: crypto.randomUUID(),
        providerId,
        personId,
        jurisdiction: POLICY_JURISDICTION,
        agreementKey: document.key,
        agreementVersion: document.version,
        agreementHash: await sha256Text(agreementText),
        agreementText,
        acceptedByName: signerName,
        acceptedByTitle: signerTitle,
        acceptanceAction: document.control === "privacy-acknowledgment"
          ? "affirmative-separate-privacy-checkbox"
          : "affirmative-provider-terms-bundle-checkbox",
        acceptedAt: now,
        ipAddress: requestIp(request),
        sessionId: acceptanceSessionId,
        deviceContext,
        createdAt: now,
      });
    }

    await recordProviderAuditEvent({
      providerId,
      personId,
      jurisdiction: POLICY_JURISDICTION,
      eventType: "provider_application_submitted",
      entityType: "provider_application",
      entityId: providerId,
      actorType: "applicant",
      actorId: email,
      outcome: "pending_review",
      reasonCodes: holdReasonCodes,
      metadata: {
        applicationPathway,
        providerLevel,
        serviceCodes,
        agreementVersions: Object.fromEntries(
          PROVIDER_ACCEPTANCE_DOCUMENTS.map((document) => [document.key, document.version]),
        ),
      },
    });

    return Response.json({
      ok: true,
      applicationId: providerId,
      onboardingUrl: "/provider-onboarding",
      status: applicationPathway === "learning_account" ? "learning_only" : "pending_review",
      message: "Application saved. Create or sign in to your provider account to upload the required evidence and follow the review checklist.",
    }, { status: 201 });
  } catch (error) {
    console.error("Unable to save provider application", error);
    return Response.json(
      { error: "We could not save your application. Please try again." },
      { status: 500 },
    );
  }
}
