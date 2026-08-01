import { env } from "cloudflare:workers";
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
import {
  CUSTOMER_SERVICE_LOCATION_OPTIONS,
  parseCustomerServiceLocations,
} from "../../../lib/service-matching";
import {
  cleanServiceAreaText,
  normalizeCustomerServiceLocations,
  normalizeMontgomeryCountyZip,
} from "../../../lib/service-area-settings";

function textValue(value: unknown, maximum: number) {
  return String(value ?? "").trim().slice(0, maximum);
}

type StoredServiceArea = {
  municipality: string;
  zip: string;
  service_locations: string;
  service_address: string;
};

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

async function storedCustomerArea(email: string) {
  const result = await env.DB.prepare(
    `SELECT municipality, zip, service_locations, service_address
       FROM account_service_area_settings
      WHERE lower(email) = lower(?) AND role = 'customer'
      LIMIT 1`,
  ).bind(email).first<StoredServiceArea>();
  return result ?? null;
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
    const [latestRequest] = await db.select({
      name: customerRequests.name,
      municipality: customerRequests.municipality,
      zip: customerRequests.zip,
      serviceLocations: customerRequests.serviceLocations,
      serviceAddress: customerRequests.serviceAddress,
    }).from(customerRequests)
      .where(sql`lower(${customerRequests.email}) = ${session.email.toLowerCase()}`)
      .orderBy(desc(customerRequests.createdAt))
      .limit(1);
    const storedArea = await storedCustomerArea(session.email);
    const choices = await customerProviderChoices(session.email);
    const saved = await db.select({ providerId: savedProviders.providerId })
      .from(savedProviders)
      .where(sql`lower(${savedProviders.customerEmail}) = ${session.email.toLowerCase()}`);
    const savedIds = new Set(saved.map((item) => item.providerId));
    const locationSource = storedArea?.service_locations
      || latestRequest?.serviceLocations
      || CUSTOMER_SERVICE_LOCATION_OPTIONS[0];

    return Response.json({
      profile: {
        email: session.email,
        displayName: profile?.displayName || latestRequest?.name || "",
        municipality: storedArea?.municipality || latestRequest?.municipality || "",
        zip: storedArea?.zip || latestRequest?.zip || "",
        serviceLocations: parseCustomerServiceLocations(locationSource),
        serviceAddress: storedArea?.service_address || latestRequest?.serviceAddress || "",
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
      const municipality = cleanServiceAreaText(payload.municipality, 100);
      const zip = normalizeMontgomeryCountyZip(payload.zip);
      const serviceLocations = normalizeCustomerServiceLocations(payload.serviceLocations);
      const serviceAddress = cleanServiceAreaText(payload.serviceAddress, 240);
      if (!displayName) {
        return Response.json(
          { error: "Enter the name you want Tuveloz to use." },
          { status: 400, headers: { "cache-control": "no-store" } },
        );
      }
      if (!municipality) {
        return Response.json(
          { error: "Enter your city, town, or municipality." },
          { status: 400, headers: { "cache-control": "no-store" } },
        );
      }
      if (
        serviceLocations.includes(CUSTOMER_SERVICE_LOCATION_OPTIONS[0])
        && !serviceAddress
      ) {
        return Response.json(
          { error: "Enter the address where a provider may come to you." },
          { status: 400, headers: { "cache-control": "no-store" } },
        );
      }
      await db.insert(customerProfiles).values({
        email: session.email.toLowerCase(),
        displayName,
      }).onConflictDoUpdate({
        target: customerProfiles.email,
        set: {
          displayName,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        },
      });
      await env.DB.prepare(
        `INSERT INTO account_service_area_settings (
           email, role, municipality, zip, service_locations, service_address, updated_at
         ) VALUES (?, 'customer', ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(email, role) DO UPDATE SET
           municipality = excluded.municipality,
           zip = excluded.zip,
           service_locations = excluded.service_locations,
           service_address = excluded.service_address,
           updated_at = CURRENT_TIMESTAMP`,
      ).bind(
        session.email.toLowerCase(),
        municipality,
        zip,
        serviceLocations,
        serviceAddress,
      ).run();
      return Response.json({
        profile: {
          email: session.email,
          displayName,
          municipality,
          zip,
          serviceLocations: parseCustomerServiceLocations(serviceLocations),
          serviceAddress,
        },
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
            { error: "Only providers from your Tuveloz quote history can be saved." },
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
    const message = error instanceof Error ? error.message : "Customer settings could not be saved.";
    console.error("Unable to update customer tools", error);
    return Response.json(
      { error: message },
      { status: message.startsWith("Enter") || message.startsWith("Choose") || message.startsWith("Service-area") ? 400 : 503, headers: { "cache-control": "no-store" } },
    );
  }
}
