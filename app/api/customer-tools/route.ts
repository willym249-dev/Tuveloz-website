import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  customerProfiles,
  customerRequests,
  providerApplications,
  providerProfiles,
  providerQuotes,
  savedProviders,
} from "../../../db/schema";
import { getAccountSession } from "../../../lib/account-auth";

const notificationOptions = new Set(["important", "all", "none"]);

function textValue(value: unknown, maximum: number) {
  return String(value ?? "").trim().slice(0, maximum);
}

async function customerProviderChoices(email: string) {
  const db = getDb();
  const requests = await db.select({ id: customerRequests.id })
    .from(customerRequests)
    .where(sql`lower(${customerRequests.email}) = ${email.toLowerCase()}`)
    .limit(200);
  if (requests.length === 0) return [];

  const quotes = await db.select({ providerEmail: providerQuotes.providerEmail })
    .from(providerQuotes)
    .where(inArray(providerQuotes.requestId, requests.map((request) => request.id)));
  const providerEmails = [...new Set(quotes.map((quote) => quote.providerEmail.toLowerCase()))];
  if (providerEmails.length === 0) return [];

  const providers = await db.select({
    id: providerApplications.id,
    name: providerApplications.name,
    email: providerApplications.email,
    service: providerApplications.service,
    serviceArea: providerApplications.serviceArea,
  }).from(providerApplications)
    .where(and(
      inArray(sql`lower(${providerApplications.email})`, providerEmails),
      eq(providerApplications.status, "approved"),
      eq(providerApplications.verificationStatus, "verified"),
      eq(providerApplications.isTestProvider, "no"),
    ));
  if (providers.length === 0) return [];

  const profiles = await db.select({
    providerId: providerProfiles.providerId,
    slug: providerProfiles.slug,
    publicStatus: providerProfiles.publicStatus,
  }).from(providerProfiles)
    .where(inArray(providerProfiles.providerId, providers.map((provider) => provider.id)));
  const profileByProvider = new Map(profiles.map((profile) => [profile.providerId, profile]));

  return providers.map((provider) => {
    const profile = profileByProvider.get(provider.id);
    return {
      id: provider.id,
      name: provider.name,
      service: provider.service,
      serviceArea: provider.serviceArea,
      publicSlug: profile?.publicStatus === "public" ? profile.slug : "",
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

async function customerSession(request: Request) {
  const session = await getAccountSession(request);
  if (!session) return null;
  return session.role === "customer" ? session : false;
}

export async function GET(request: Request) {
  try {
    const session = await customerSession(request);
    if (session === null) {
      return Response.json(
        { error: "Sign in to open customer settings." },
        { status: 401, headers: { "cache-control": "no-store" } },
      );
    }
    if (session === false) {
      return Response.json(
        { error: "Customer access required." },
        { status: 403, headers: { "cache-control": "no-store" } },
      );
    }

    const db = getDb();
    const [profile] = await db.select().from(customerProfiles)
      .where(sql`lower(${customerProfiles.email}) = ${session.email.toLowerCase()}`)
      .limit(1);
    const [latestRequest] = await db.select({ name: customerRequests.name })
      .from(customerRequests)
      .where(sql`lower(${customerRequests.email}) = ${session.email.toLowerCase()}`)
      .orderBy(desc(customerRequests.createdAt))
      .limit(1);
    const choices = await customerProviderChoices(session.email);
    const saved = await db.select({ providerId: savedProviders.providerId })
      .from(savedProviders)
      .where(sql`lower(${savedProviders.customerEmail}) = ${session.email.toLowerCase()}`);
    const savedIds = new Set(saved.map((item) => item.providerId));

    return Response.json({
      profile: {
        email: session.email,
        displayName: profile?.displayName || latestRequest?.name || "",
        phone: profile?.phone || "",
        emailNotifications: profile?.emailNotifications || "important",
      },
      providerChoices: choices,
      savedProviders: choices.filter((provider) => savedIds.has(provider.id)),
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("Unable to load customer tools", error);
    return Response.json(
      { error: "Customer tools are temporarily unavailable." },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await customerSession(request);
    if (session === null) {
      return Response.json(
        { error: "Sign in to update customer settings." },
        { status: 401, headers: { "cache-control": "no-store" } },
      );
    }
    if (session === false) {
      return Response.json(
        { error: "Customer access required." },
        { status: 403, headers: { "cache-control": "no-store" } },
      );
    }

    const payload = await request.json() as Record<string, unknown>;
    const action = textValue(payload.action, 40);
    const db = getDb();

    if (action === "save-profile") {
      const displayName = textValue(payload.displayName, 80);
      const phone = textValue(payload.phone, 30);
      const requestedNotifications = textValue(payload.emailNotifications, 20);
      const emailNotifications = notificationOptions.has(requestedNotifications)
        ? requestedNotifications
        : "important";
      if (!displayName) {
        return Response.json(
          { error: "Enter the name you want Tuveloz to use." },
          { status: 400, headers: { "cache-control": "no-store" } },
        );
      }
      await db.insert(customerProfiles).values({
        email: session.email.toLowerCase(),
        displayName,
        phone,
        emailNotifications,
      }).onConflictDoUpdate({
        target: customerProfiles.email,
        set: {
          displayName,
          phone,
          emailNotifications,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        },
      });
      return Response.json({
        profile: { email: session.email, displayName, phone, emailNotifications },
      }, { headers: { "cache-control": "no-store" } });
    }

    if (action === "save-provider" || action === "remove-provider") {
      const providerId = textValue(payload.providerId, 100);
      if (!providerId) {
        return Response.json(
          { error: "Choose a provider." },
          { status: 400, headers: { "cache-control": "no-store" } },
        );
      }
      if (action === "save-provider") {
        const eligible = await customerProviderChoices(session.email);
        if (!eligible.some((provider) => provider.id === providerId)) {
          return Response.json(
            { error: "Only verified providers from your Tuveloz quotes can be saved." },
            { status: 403, headers: { "cache-control": "no-store" } },
          );
        }
        await db.insert(savedProviders).values({
          id: crypto.randomUUID(),
          customerEmail: session.email.toLowerCase(),
          providerId,
        }).onConflictDoNothing();
      } else {
        await db.delete(savedProviders).where(and(
          sql`lower(${savedProviders.customerEmail}) = ${session.email.toLowerCase()}`,
          eq(savedProviders.providerId, providerId),
        ));
      }
      return Response.json({ ok: true }, { headers: { "cache-control": "no-store" } });
    }

    return Response.json(
      { error: "Unsupported customer action." },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    console.error("Unable to update customer tools", error);
    return Response.json(
      { error: "Customer settings could not be saved." },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
