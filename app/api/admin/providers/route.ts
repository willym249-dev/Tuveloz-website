import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import {
  providerApplications,
  providerGalleryItems,
  providerProfiles,
} from "../../../../db/schema";
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
import { recordProviderAuditEvent } from "../../../../lib/provider-audit";
import {
  prohibitedProviderProfileClaims,
  prohibitedProviderWrittenClaims,
  providerProfileClaimsFingerprint,
  PROVIDER_PROFILE_REVIEW_EVENT,
} from "../../../../lib/provider-profile-claims";
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
    profileReviewDecision?: string;
    profileReviewNotes?: string;
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

  if (body.action === "review-profile") {
    const decision = body.profileReviewDecision === "approve"
      ? "approve"
      : body.profileReviewDecision === "reject"
        ? "reject"
        : "";
    if (!decision) {
      return Response.json({ error: "Choose approve or reject for this profile review." }, { status: 400 });
    }
    const [profile] = await db.select().from(providerProfiles)
      .where(eq(providerProfiles.providerId, provider.id)).limit(1);
    if (!profile) {
      return Response.json({ error: "Provider profile not found." }, { status: 404 });
    }
    if (profile.publicStatus !== "pending_review") {
      return Response.json({
        error: "Only the current pending profile version can be reviewed.",
        code: "PROFILE_REVIEW_STATE_CHANGED",
      }, { status: 409, headers: { "cache-control": "no-store" } });
    }
    const gallery = await db.select({
      id: providerGalleryItems.id,
      caption: providerGalleryItems.caption,
      service: providerGalleryItems.service,
      imageKey: providerGalleryItems.imageKey,
    }).from(providerGalleryItems)
      .where(eq(providerGalleryItems.providerId, provider.id));
    const prohibitedClaims = [
      ...prohibitedProviderProfileClaims(profile),
      ...prohibitedProviderWrittenClaims(gallery.map((item) => item.caption)),
    ];
    if (decision === "approve" && prohibitedClaims.length) {
      return Response.json({
        error: "This profile contains provider-written claims that cannot be approved for publication. Reject it with correction instructions.",
        code: "PROVIDER_PROFILE_PROHIBITED_CLAIM",
        prohibitedClaims: [...new Set(prohibitedClaims)],
      }, { status: 409, headers: { "cache-control": "no-store" } });
    }
    const contentFingerprint = await providerProfileClaimsFingerprint(profile, gallery);
    const reviewNotes = typeof body.profileReviewNotes === "string"
      ? body.profileReviewNotes.trim().slice(0, 1000)
      : "";
    if (decision === "reject" && !reviewNotes) {
      return Response.json({
        error: "Add correction instructions before rejecting provider profile content.",
      }, { status: 400, headers: { "cache-control": "no-store" } });
    }
    await recordProviderAuditEvent({
      providerId: provider.id,
      eventType: PROVIDER_PROFILE_REVIEW_EVENT,
      entityType: "provider_profile",
      entityId: profile.id,
      actorType: "owner",
      actorId: "verified-owner",
      outcome: decision === "approve" ? "approved" : "rejected",
      reasonCodes: decision === "approve"
        ? ["provider_written_claims_reviewed"]
        : ["provider_profile_corrections_required"],
      metadata: {
        contentFingerprint,
        reviewNotes,
        reviewedProfileUpdatedAt: profile.updatedAt,
        galleryItemIds: gallery.map((item) => item.id).sort(),
      },
    });
    const updated = await db.update(providerProfiles).set({
      publicStatus: decision === "approve" ? "published" : "draft",
      updatedAt: new Date().toISOString(),
    }).where(and(
      eq(providerProfiles.id, profile.id),
      eq(providerProfiles.publicStatus, "pending_review"),
      eq(providerProfiles.updatedAt, profile.updatedAt),
    )).returning({ id: providerProfiles.id });
    if (!updated.length) {
      return Response.json({
        error: "The provider changed this profile during review. Review the new version before publishing.",
        code: "PROFILE_REVIEW_STATE_CHANGED",
      }, { status: 409, headers: { "cache-control": "no-store" } });
    }
    return Response.json({
      ok: true,
      profileId: profile.id,
      publicStatus: decision === "approve" ? "published" : "draft",
      contentFingerprint,
    }, { headers: { "cache-control": "no-store" } });
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
