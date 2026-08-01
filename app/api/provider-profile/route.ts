import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  jobReviews,
  providerGalleryItems,
  providerProfiles,
  providerQuotes,
} from "../../../db/schema";
import {
  deleteProviderImage,
  ProviderImageValidationError,
  storeProviderImage,
  validateProviderImage,
} from "../../../lib/provider-media";
import { parseProviderServices } from "../../../lib/service-matching";
import { QUOTE_DECLINE_REASONS } from "../../../lib/quote-feedback";
import { getAccountSession, providerAccountFor } from "../../../lib/account-auth";
import { marketplacePausedMessage } from "../../../lib/launch-status";
import { currentPlatformActiveServiceCodes } from "../../../lib/platform-service-activation";
import { POLICY_JURISDICTION } from "../../../lib/provider-policy";
import { isSameOriginRequest } from "../../../lib/request-security";
import { runtimeMarketplaceActionAllowed } from "../../../lib/runtime-marketplace-action";

const AVAILABILITY_STATUSES = new Set(["Available now", "Busy", "Off duty"]);
const MAX_GALLERY_ITEMS = 12;
const NO_STORE_HEADERS = { "cache-control": "no-store" };

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function profileSlug(name: string, providerId: string) {
  const base = name.toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "provider";
  return `${base}-${providerId.replace(/[^a-z0-9]/gi, "").slice(0, 8).toLowerCase()}`;
}

async function activeProvider(request: Request) {
  const session = await getAccountSession(request);
  if (!session || session.role !== "provider") return null;
  return providerAccountFor(session.email);
}

async function providerPublicDiscoveryAllowed(
  provider: NonNullable<Awaited<ReturnType<typeof activeProvider>>>,
) {
  try {
    if (!(await runtimeMarketplaceActionAllowed("discovery"))) return false;
    const activeServiceCodes = await currentPlatformActiveServiceCodes(
      POLICY_JURISDICTION,
    );
    return parseProviderServices(provider.approvedServices)
      .some((serviceCode) => activeServiceCodes.has(serviceCode));
  } catch {
    return false;
  }
}

async function profileFor(providerId: string) {
  const [profile] = await getDb().select().from(providerProfiles)
    .where(eq(providerProfiles.providerId, providerId))
    .limit(1);
  return profile ?? null;
}

async function ensureProfile(
  provider: NonNullable<Awaited<ReturnType<typeof activeProvider>>>,
) {
  const existing = await profileFor(provider.id);
  if (existing) return existing;
  const now = new Date().toISOString();
  const draft = {
    id: crypto.randomUUID(),
    providerId: provider.id,
    slug: profileSlug(provider.name, provider.id),
    businessName: provider.name,
    headline: "",
    about: "",
    yearsExperience: "",
    availabilityStatus: "Available now",
    availabilityNote: "",
    businessHours: "",
    logoImageKey: "",
    logoImageType: "",
    publicStatus: "draft",
    createdAt: now,
    updatedAt: now,
  };
  await getDb().insert(providerProfiles).values(draft)
    .onConflictDoNothing({ target: providerProfiles.providerId });
  return (await profileFor(provider.id)) ?? draft;
}

function profileHealth(
  profile: {
    headline: string;
    about: string;
    yearsExperience: string;
    availabilityNote: string;
    businessHours: string;
    publicStatus: string;
    hasLogo: boolean;
  },
  galleryCount: number,
  canPublish: boolean,
) {
  const checks = [
    {
      complete: Boolean(profile.headline),
      points: 15,
      improvement: "Add a short headline that tells customers what you do.",
    },
    {
      complete: Boolean(profile.about),
      points: 20,
      improvement: "Explain your specialties and what customers can expect.",
    },
    {
      complete: Boolean(profile.yearsExperience),
      points: 10,
      improvement: "Add your years of experience.",
    },
    {
      complete: Boolean(profile.availabilityNote),
      points: 10,
      improvement: "Add a current availability note.",
    },
    {
      complete: Boolean(profile.businessHours),
      points: 10,
      improvement: "List your normal business hours.",
    },
    {
      complete: profile.hasLogo,
      points: 15,
      improvement: "Add a logo or clear business image.",
    },
    {
      complete: galleryCount > 0,
      points: 20,
      improvement: "Add at least one genuine work photo.",
    },
  ];
  const improvements = checks
    .filter((check) => !check.complete)
    .map((check) => check.improvement);
  if (canPublish && profile.publicStatus !== "published") {
    improvements.unshift("Publish your profile when the details are ready.");
  }
  return {
    score: checks.reduce(
      (total, check) => total + (check.complete ? check.points : 0),
      0,
    ),
    improvements: improvements.length
      ? improvements.slice(0, 3)
      : ["Your profile is complete. Keep your availability and work photos current."],
  };
}

async function responseData(
  provider: NonNullable<Awaited<ReturnType<typeof activeProvider>>>,
) {
  const storedProfile = await profileFor(provider.id);
  const gallery = await getDb().select({
    id: providerGalleryItems.id,
    caption: providerGalleryItems.caption,
    service: providerGalleryItems.service,
    createdAt: providerGalleryItems.createdAt,
  }).from(providerGalleryItems)
    .where(eq(providerGalleryItems.providerId, provider.id))
    .orderBy(desc(providerGalleryItems.createdAt));
  const reviews = await getDb().select({
    id: jobReviews.id,
    customerDisplayName: jobReviews.customerDisplayName,
    service: jobReviews.service,
    rating: jobReviews.rating,
    comment: jobReviews.comment,
    createdAt: jobReviews.createdAt,
  }).from(jobReviews).where(and(
    eq(jobReviews.providerEmail, provider.email),
    eq(jobReviews.status, "published"),
  )).orderBy(desc(jobReviews.createdAt));
  const averageRating = reviews.length
    ? Number((reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1))
    : 0;
  const quotes = await getDb().select({
    declineReason: providerQuotes.declineReason,
    status: providerQuotes.status,
  }).from(providerQuotes).where(eq(providerQuotes.providerEmail, provider.email));
  const acceptedQuotes = quotes.filter((quote) => quote.status === "accepted").length;
  const declinedQuotes = quotes.filter((quote) => quote.status === "declined");
  const decidedQuotes = quotes.filter((quote) => (
    quote.status === "accepted"
    || quote.status === "declined"
    || quote.status === "not selected"
  )).length;
  const declineFeedback: Array<{ value: string; label: string; count: number }> = QUOTE_DECLINE_REASONS.map((reason) => ({
    ...reason,
    count: declinedQuotes.filter((quote) => quote.declineReason === reason.value).length,
  })).filter((reason) => reason.count > 0);
  const noReasonCount = declinedQuotes.filter((quote) => !quote.declineReason).length;
  if (noReasonCount > 0) {
    declineFeedback.push({
      value: "no-reason",
      label: "No reason shared",
      count: noReasonCount,
    });
  }
  const defaultProfile = {
    id: "",
    slug: profileSlug(provider.name, provider.id),
    businessName: provider.name,
    headline: "",
    about: "",
    yearsExperience: "",
    availabilityStatus: "Available now",
    availabilityNote: "",
    businessHours: "",
    publicStatus: "draft",
    hasLogo: false,
  };
  const profile = storedProfile ? {
    id: storedProfile.id,
    slug: storedProfile.slug,
    businessName: storedProfile.businessName,
    headline: storedProfile.headline,
    about: storedProfile.about,
    yearsExperience: storedProfile.yearsExperience,
    availabilityStatus: storedProfile.availabilityStatus,
    availabilityNote: storedProfile.availabilityNote,
    businessHours: storedProfile.businessHours,
    publicStatus: storedProfile.publicStatus,
    hasLogo: Boolean(storedProfile.logoImageKey),
  } : defaultProfile;
  const canPublish = provider.verificationStatus === "verified"
    && provider.isTestProvider === "no"
    && await providerPublicDiscoveryAllowed(provider);
  return {
    profile,
    gallery,
    services: parseProviderServices(provider.approvedServices),
    serviceArea: provider.serviceArea,
    workLocations: provider.workLocations,
    businessMunicipality: provider.businessMunicipality,
    canPublish,
    testProvider: provider.isTestProvider === "yes",
    reviewSummary: { average: averageRating, count: reviews.length },
    reviews,
    profileHealth: profileHealth(profile, gallery.length, canPublish),
    analytics: {
      profileViews: storedProfile?.profileViewCount ?? 0,
      qrScans: storedProfile?.qrScanCount ?? 0,
      quotesSent: quotes.length,
      acceptedQuotes,
      decidedQuotes,
      pendingQuotes: quotes.filter((quote) => quote.status === "submitted").length,
      quoteWinRate: decidedQuotes
        ? Math.round((acceptedQuotes / decidedQuotes) * 100)
        : null,
      declineFeedback,
    },
  };
}

export async function GET(request: Request) {
  const provider = await activeProvider(request);
  if (!provider) {
    return Response.json(
      { error: "Sign in to your active provider workspace." },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  }
  return Response.json(await responseData(provider), {
    headers: { "cache-control": "no-store" },
  });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json(
      { error: "This business-profile action must come from Tuveloz." },
      { status: 403, headers: { "cache-control": "no-store" } },
    );
  }
  const provider = await activeProvider(request);
  if (!provider) {
    return Response.json(
      { error: "Sign in to your active provider workspace." },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  }

  const contentType = request.headers.get("content-type") ?? "";
  const isMultipart = contentType.includes("multipart/form-data");
  const payload = isMultipart
    ? Object.fromEntries((await request.formData()).entries())
    : await request.json() as Record<string, unknown>;
  const db = getDb();
  const action = clean(payload.action, 40) || "save-profile";

  if (action === "save-profile") {
    const businessName = clean(payload.businessName, 120);
    const headline = clean(payload.headline, 120);
    const about = clean(payload.about, 900);
    const yearsExperience = clean(payload.yearsExperience, 80);
    const availabilityStatus = clean(payload.availabilityStatus, 40);
    const availabilityNote = clean(payload.availabilityNote, 160);
    const businessHours = clean(payload.businessHours, 220);
    const publicStatus = payload.publicStatus === "published" ? "published" : "draft";
    if (!businessName) {
      return Response.json({ error: "Add your public business name." }, { status: 400 });
    }
    if (!AVAILABILITY_STATUSES.has(availabilityStatus)) {
      return Response.json({ error: "Choose a listed availability status." }, { status: 400 });
    }
    if (publicStatus === "published") {
      if (provider.verificationStatus !== "verified" || provider.isTestProvider === "yes") {
        return Response.json(
          { error: "Only approved real providers can publish a public business page." },
          { status: 403, headers: NO_STORE_HEADERS },
        );
      }
      if (!headline || !about) {
        return Response.json(
          { error: "Add a short headline and About description before publishing." },
          { status: 400, headers: NO_STORE_HEADERS },
        );
      }
      if (!(await providerPublicDiscoveryAllowed(provider))) {
        return Response.json(
          {
            error: marketplacePausedMessage("discovery"),
            code: "MARKETPLACE_ONBOARDING_ONLY",
          },
          {
            status: 503,
            headers: { ...NO_STORE_HEADERS, "retry-after": "86400" },
          },
        );
      }
    }
    const existing = await profileFor(provider.id);
    const now = new Date().toISOString();
    await db.insert(providerProfiles).values({
      id: existing?.id || crypto.randomUUID(),
      providerId: provider.id,
      slug: existing?.slug || profileSlug(businessName, provider.id),
      businessName,
      headline,
      about,
      yearsExperience,
      availabilityStatus,
      availabilityNote,
      businessHours,
      logoImageKey: existing?.logoImageKey || "",
      logoImageType: existing?.logoImageType || "",
      publicStatus,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: providerProfiles.providerId,
      set: {
        businessName,
        headline,
        about,
        yearsExperience,
        availabilityStatus,
        availabilityNote,
        businessHours,
        publicStatus,
        updatedAt: now,
      },
    });
    return Response.json({ ok: true, ...(await responseData(provider)) });
  }

  if (action === "upload-logo" || action === "upload-gallery") {
    let image;
    try {
      image = await validateProviderImage(payload.image);
    } catch (error) {
      if (error instanceof ProviderImageValidationError) {
        return Response.json({ error: error.message }, { status: 400 });
      }
      throw error;
    }
    const profile = await ensureProfile(provider);
    if (action === "upload-logo") {
      const key = await storeProviderImage(provider.id, "logo", image);
      try {
        await db.update(providerProfiles).set({
          logoImageKey: key,
          logoImageType: image.contentType,
          updatedAt: new Date().toISOString(),
        }).where(eq(providerProfiles.id, profile.id));
      } catch (error) {
        await deleteProviderImage(key);
        throw error;
      }
      if (profile.logoImageKey) {
        try {
          await deleteProviderImage(profile.logoImageKey);
        } catch (error) {
          console.error("Unable to remove the previous provider logo", error);
        }
      }
      return Response.json({ ok: true, ...(await responseData(provider)) });
    }

    const galleryCount = await db.select({ id: providerGalleryItems.id })
      .from(providerGalleryItems)
      .where(eq(providerGalleryItems.providerId, provider.id));
    if (galleryCount.length >= MAX_GALLERY_ITEMS) {
      return Response.json(
        { error: `The launch gallery supports up to ${MAX_GALLERY_ITEMS} photos.` },
        { status: 409 },
      );
    }
    const caption = clean(payload.caption, 180);
    const service = clean(payload.service, 100);
    const approvedServices = parseProviderServices(provider.approvedServices);
    if (service && !approvedServices.includes(service)) {
      return Response.json({ error: "Choose one of your approved services." }, { status: 400 });
    }
    const key = await storeProviderImage(provider.id, "gallery", image);
    try {
      await db.insert(providerGalleryItems).values({
        id: crypto.randomUUID(),
        providerId: provider.id,
        imageKey: key,
        imageType: image.contentType,
        caption,
        service,
      });
    } catch (error) {
      await deleteProviderImage(key);
      throw error;
    }
    return Response.json({ ok: true, ...(await responseData(provider)) }, { status: 201 });
  }

  if (action === "remove-gallery") {
    const galleryId = clean(payload.galleryId, 80);
    const [item] = await db.select().from(providerGalleryItems).where(and(
      eq(providerGalleryItems.id, galleryId),
      eq(providerGalleryItems.providerId, provider.id),
    )).limit(1);
    if (!item) return Response.json({ error: "Gallery photo not found." }, { status: 404 });
    await db.delete(providerGalleryItems).where(eq(providerGalleryItems.id, item.id));
    try {
      await deleteProviderImage(item.imageKey);
    } catch (error) {
      console.error("Unable to remove the provider gallery object", error);
    }
    return Response.json({ ok: true, ...(await responseData(provider)) });
  }

  return Response.json({ error: "Unknown profile action." }, { status: 400 });
}
