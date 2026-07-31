import { env } from "cloudflare:workers";
import { getAccountSession, providerAccountFor } from "../../../lib/account-auth";
import { isSameOriginRequest } from "../../../lib/request-security";
import { parseProviderServices } from "../../../lib/service-matching";

const PRICE_TYPES = new Set(["starting_at", "fixed", "range", "hourly", "quote"]);

function text(value: unknown, maximum: number) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

async function activeProvider(request: Request) {
  const session = await getAccountSession(request);
  if (!session || session.role !== "provider") return null;
  return providerAccountFor(session.email);
}

async function responseData(provider: NonNullable<Awaited<ReturnType<typeof activeProvider>>>) {
  const [catalogResult, credentialsResult] = await Promise.all([
    env.DB.prepare(
      `SELECT id, service, price_type AS priceType,
              starting_price_cents AS startingPriceCents,
              maximum_price_cents AS maximumPriceCents,
              description, duration_minutes AS durationMinutes,
              active, created_at AS createdAt, updated_at AS updatedAt
         FROM provider_catalog_items
        WHERE provider_id = ?
        ORDER BY active DESC, service ASC`,
    ).bind(provider.id).all(),
    env.DB.prepare(
      `SELECT id, credential_name AS credentialName,
              issuing_authority AS issuingAuthority,
              credential_identifier AS credentialIdentifier,
              jurisdiction, expires_at AS expiresAt,
              status, review_note AS reviewNote,
              public_display AS publicDisplay,
              created_at AS createdAt, updated_at AS updatedAt
         FROM provider_submitted_credentials
        WHERE provider_id = ?
        ORDER BY created_at DESC`,
    ).bind(provider.id).all(),
  ]);
  return {
    provider: {
      id: provider.id,
      name: provider.name,
      approvedServices: parseProviderServices(provider.approvedServices),
      verificationStatus: provider.verificationStatus,
    },
    priceTypes: [
      { value: "starting_at", label: "Starting at" },
      { value: "fixed", label: "Fixed price" },
      { value: "range", label: "Typical price range" },
      { value: "hourly", label: "Hourly rate" },
      { value: "quote", label: "Custom quote" },
    ],
    catalogItems: catalogResult.results,
    credentials: credentialsResult.results,
    credentialNotice: "Adding a credential here is optional unless a law or Tuveloz service rule requires it. Provider-entered information does not replace Tuveloz's official verification of any legally required credential.",
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
  return Response.json(await responseData(provider), {
    headers: { "cache-control": "no-store" },
  });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "This provider update must come from Tuveloz." }, { status: 403 });
  }
  const provider = await activeProvider(request);
  if (!provider) {
    return Response.json({ error: "Sign in to your verified provider workspace." }, { status: 401 });
  }

  try {
    const payload = await request.json() as Record<string, unknown>;
    const action = text(payload.action, 40);

    if (action === "save-catalog-item") {
      const approvedServices = parseProviderServices(provider.approvedServices);
      const service = text(payload.service, 120);
      const priceType = text(payload.priceType, 30);
      const amount = Number(payload.startingPrice);
      const maximumAmount = Number(payload.maximumPrice);
      const durationMinutes = Math.round(Number(payload.durationMinutes) || 0);
      const description = text(payload.description, 500);
      const active = payload.active === false ? "no" : "yes";
      if (!approvedServices.includes(service)) {
        return Response.json({ error: "Choose one of your approved services." }, { status: 400 });
      }
      if (!PRICE_TYPES.has(priceType)) {
        return Response.json({ error: "Choose a listed price type." }, { status: 400 });
      }
      if (
        priceType !== "quote"
        && (!Number.isFinite(amount) || amount < 0 || amount > 100_000)
      ) {
        return Response.json({ error: "Enter a valid provider price or range minimum." }, { status: 400 });
      }
      if (
        priceType === "range"
        && (!Number.isFinite(maximumAmount)
          || maximumAmount < amount
          || maximumAmount > 100_000)
      ) {
        return Response.json(
          { error: "Enter a range maximum that is at least the minimum price." },
          { status: 400 },
        );
      }
      if (durationMinutes < 0 || durationMinutes > 7 * 24 * 60) {
        return Response.json({ error: "Enter a valid estimated duration." }, { status: 400 });
      }
      await env.DB.prepare(
        `INSERT INTO provider_catalog_items
           (id, provider_id, service, price_type, starting_price_cents,
            maximum_price_cents, description, duration_minutes, active,
            created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT(provider_id, service) DO UPDATE SET
           price_type = excluded.price_type,
           starting_price_cents = excluded.starting_price_cents,
           maximum_price_cents = excluded.maximum_price_cents,
           description = excluded.description,
           duration_minutes = excluded.duration_minutes,
           active = excluded.active,
           updated_at = CURRENT_TIMESTAMP`,
      ).bind(
        crypto.randomUUID(),
        provider.id,
        service,
        priceType,
        priceType === "quote" ? 0 : Math.round(amount * 100),
        priceType === "range" ? Math.round(maximumAmount * 100) : 0,
        description,
        durationMinutes,
        active,
      ).run();
      return Response.json({ ok: true, ...(await responseData(provider)) });
    }

    if (action === "remove-catalog-item") {
      const id = text(payload.id, 80);
      await env.DB.prepare(
        "DELETE FROM provider_catalog_items WHERE id = ? AND provider_id = ?",
      ).bind(id, provider.id).run();
      return Response.json({ ok: true, ...(await responseData(provider)) });
    }

    if (action === "add-credential") {
      const credentialName = text(payload.credentialName, 140);
      const issuingAuthority = text(payload.issuingAuthority, 160);
      const credentialIdentifier = text(payload.credentialIdentifier, 120);
      const jurisdiction = text(payload.jurisdiction, 120);
      const expiresAt = text(payload.expiresAt, 20);
      if (!credentialName) {
        return Response.json({ error: "Enter the credential or license name." }, { status: 400 });
      }
      if (expiresAt && !/^\d{4}-\d{2}-\d{2}$/.test(expiresAt)) {
        return Response.json({ error: "Enter a valid expiration date or leave it blank." }, { status: 400 });
      }
      await env.DB.prepare(
        `INSERT INTO provider_submitted_credentials
           (id, provider_id, credential_name, issuing_authority,
            credential_identifier, jurisdiction, expires_at,
            status, review_note, public_display, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', '', 'no', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      ).bind(
        crypto.randomUUID(),
        provider.id,
        credentialName,
        issuingAuthority,
        credentialIdentifier,
        jurisdiction,
        expiresAt,
      ).run();
      return Response.json({ ok: true, ...(await responseData(provider)) }, { status: 201 });
    }

    if (action === "remove-credential") {
      const id = text(payload.id, 80);
      await env.DB.prepare(
        `DELETE FROM provider_submitted_credentials
          WHERE id = ? AND provider_id = ? AND status <> 'verified'`,
      ).bind(id, provider.id).run();
      return Response.json({ ok: true, ...(await responseData(provider)) });
    }

    return Response.json({ error: "Unknown provider tool action." }, { status: 400 });
  } catch (error) {
    console.error("Unable to update provider marketplace tools", error);
    return Response.json(
      { error: "Provider services, prices, or credentials could not be saved." },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
