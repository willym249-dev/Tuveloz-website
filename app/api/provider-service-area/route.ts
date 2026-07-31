import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { providerApplications } from "../../../db/schema";
import { getAccountSession, providerAccountFor } from "../../../lib/account-auth";
import { isSameOriginRequest } from "../../../lib/request-security";
import {
  CURRENT_LAUNCH_AREA,
  parseProviderWorkLocations,
  PROVIDER_WORK_LOCATION_OPTIONS,
} from "../../../lib/service-matching";
import {
  cleanServiceAreaText,
  currentProviderLaunchArea,
  normalizeMontgomeryCountyZip,
  normalizeProviderWorkLocations,
  normalizeTravelRadius,
} from "../../../lib/service-area-settings";

type StoredProviderArea = {
  zip: string;
  travel_radius_miles: number;
};

async function activeProvider(request: Request) {
  const session = await getAccountSession(request);
  if (!session || session.role !== "provider") return null;
  return providerAccountFor(session.email);
}

function responseSettings(
  provider: NonNullable<Awaited<ReturnType<typeof activeProvider>>>,
  stored: StoredProviderArea | null,
) {
  return {
    email: provider.email,
    serviceArea: provider.serviceArea || CURRENT_LAUNCH_AREA,
    baseZip: stored?.zip || "",
    travelRadiusMiles: stored?.travel_radius_miles || 10,
    workLocations: parseProviderWorkLocations(provider.workLocations),
    businessMunicipality: provider.businessMunicipality,
    businessServiceAddress: provider.businessServiceAddress,
  };
}

export async function GET(request: Request) {
  const provider = await activeProvider(request);
  if (!provider) {
    return Response.json(
      { error: "Sign in to your verified provider workspace." },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  }
  const stored = await env.DB.prepare(
    `SELECT zip, travel_radius_miles
       FROM account_service_area_settings
      WHERE lower(email) = lower(?) AND role = 'provider'
      LIMIT 1`,
  ).bind(provider.email).first<StoredProviderArea>();
  return Response.json({ settings: responseSettings(provider, stored ?? null) }, {
    headers: { "cache-control": "no-store" },
  });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json(
      { error: "This service-area update must come from Tuveloz." },
      { status: 403, headers: { "cache-control": "no-store" } },
    );
  }
  const provider = await activeProvider(request);
  if (!provider) {
    return Response.json(
      { error: "Sign in to your verified provider workspace." },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  }

  try {
    const payload = await request.json() as Record<string, unknown>;
    const serviceArea = currentProviderLaunchArea(payload.serviceArea);
    const baseZip = normalizeMontgomeryCountyZip(payload.baseZip);
    const travelRadiusMiles = normalizeTravelRadius(payload.travelRadiusMiles);
    const workLocations = normalizeProviderWorkLocations(payload.workLocations);
    const businessMunicipality = cleanServiceAreaText(payload.businessMunicipality, 100);
    const businessServiceAddress = cleanServiceAreaText(payload.businessServiceAddress, 240);
    if (!businessMunicipality) throw new Error("Enter your business city, town, or municipality.");
    if (
      workLocations.includes(PROVIDER_WORK_LOCATION_OPTIONS[1])
      && !businessServiceAddress
    ) {
      throw new Error("Enter the business address where customers may receive service.");
    }

    await getDb().update(providerApplications).set({
      serviceArea,
      workLocations,
      businessMunicipality,
      businessServiceAddress: workLocations.includes(PROVIDER_WORK_LOCATION_OPTIONS[1])
        ? businessServiceAddress
        : "",
    }).where(eq(providerApplications.id, provider.id));
    await env.DB.prepare(
      `INSERT INTO account_service_area_settings (
         email, role, zip, service_area, work_locations, travel_radius_miles, updated_at
       ) VALUES (?, 'provider', ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(email, role) DO UPDATE SET
         zip = excluded.zip,
         service_area = excluded.service_area,
         work_locations = excluded.work_locations,
         travel_radius_miles = excluded.travel_radius_miles,
         updated_at = CURRENT_TIMESTAMP`,
    ).bind(
      provider.email.toLowerCase(),
      baseZip,
      serviceArea,
      workLocations,
      travelRadiusMiles,
    ).run();

    const updated = {
      ...provider,
      serviceArea,
      workLocations,
      businessMunicipality,
      businessServiceAddress: workLocations.includes(PROVIDER_WORK_LOCATION_OPTIONS[1])
        ? businessServiceAddress
        : "",
    };
    return Response.json({
      settings: responseSettings(updated, {
        zip: baseZip,
        travel_radius_miles: travelRadiusMiles,
      }),
      note: "Job matching continues to require the selected launch county and compatible service-location choices. The travel distance is saved for provider preference and future finer-distance matching.",
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save service-area settings.";
    return Response.json(
      { error: message },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }
}
