import { env } from "cloudflare:workers";
import { isVerifiedOwnerRequest } from "../../../../lib/owner-auth";
import { isSameOriginRequest } from "../../../../lib/request-security";
import {
  marketplacePausedMessage,
} from "../../../../lib/launch-status";
import { runtimeMarketplaceActionAllowed } from "../../../../lib/runtime-marketplace-action";

type CredentialReviewRow = {
  id: string;
  providerId: string;
  providerName: string;
  providerEmail: string;
  category: string;
  credentialName: string;
  issuingAuthority: string;
  credentialIdentifier: string;
  jurisdiction: string;
  expiresAt: string;
  status: string;
  reviewNote: string;
  publicDisplay: string;
  createdAt: string;
};

type AppointmentAdminRow = {
  id: string;
  providerName: string;
  providerEmail: string;
  customerName: string;
  customerEmail: string;
  service: string;
  requestedByRole: string;
  startsAt: string;
  confirmedStartAt: string;
  status: string;
  createdAt: string;
};

function text(value: unknown, maximum: number) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

async function responseData() {
  const appointmentsAvailable = await runtimeMarketplaceActionAllowed("appointment");
  const appointmentFilter = appointmentsAvailable ? "" : "WHERE 1 = 0";
  const [credentialsResult, appointmentsResult, metricsResult] = await Promise.all([
    env.DB.prepare(
      `SELECT credential.id, credential.provider_id AS providerId,
              provider.name AS providerName, provider.email AS providerEmail,
              credential.category,
              credential.credential_name AS credentialName,
              credential.issuing_authority AS issuingAuthority,
              credential.credential_identifier AS credentialIdentifier,
              credential.jurisdiction, credential.expires_at AS expiresAt,
              credential.status, credential.review_note AS reviewNote,
              credential.public_display AS publicDisplay,
              credential.created_at AS createdAt
         FROM provider_submitted_credentials credential
         INNER JOIN provider_applications provider ON provider.id = credential.provider_id
        ORDER BY CASE credential.status WHEN 'pending' THEN 0 WHEN 'verified' THEN 1 ELSE 2 END,
                 datetime(credential.created_at) DESC
        LIMIT 500`,
    ).all<CredentialReviewRow>(),
    env.DB.prepare(
      `SELECT id, provider_name AS providerName, provider_email AS providerEmail,
              customer_name AS customerName, customer_email AS customerEmail,
              service, requested_by_role AS requestedByRole,
              starts_at AS startsAt, confirmed_start_at AS confirmedStartAt,
              status, created_at AS createdAt
         FROM appointments
        ${appointmentFilter}
        ORDER BY datetime(created_at) DESC
        LIMIT 500`,
    ).all<AppointmentAdminRow>(),
    env.DB.prepare(
      `SELECT
         (SELECT count(*) FROM provider_catalog_items WHERE active = 'yes') AS activeCatalogItems,
         ${appointmentsAvailable
           ? "(SELECT count(*) FROM appointments WHERE status = 'requested')"
           : "0"} AS pendingAppointments,
         (SELECT count(*) FROM provider_submitted_credentials WHERE status = 'pending') AS pendingCredentials,
         (SELECT count(*) FROM job_location_shares
           WHERE status = 'sharing' AND datetime(expires_at) > CURRENT_TIMESTAMP) AS activeLocationShares`,
    ).first<{
      activeCatalogItems: number;
      pendingAppointments: number;
      pendingCredentials: number;
      activeLocationShares: number;
    }>(),
  ]);
  return {
    credentials: credentialsResult.results,
    appointments: appointmentsResult.results,
    appointmentActionsAvailable: appointmentsAvailable,
    appointmentPausedMessage: appointmentsAvailable
      ? ""
      : marketplacePausedMessage("appointment"),
    metrics: metricsResult ?? {
      activeCatalogItems: 0,
      pendingAppointments: 0,
      pendingCredentials: 0,
      activeLocationShares: 0,
    },
  };
}

export async function GET(request: Request) {
  if (!(await isVerifiedOwnerRequest(request))) {
    return Response.json(
      { error: "Signed owner verification is required." },
      { status: 403, headers: { "cache-control": "no-store" } },
    );
  }
  return Response.json(await responseData(), { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "This admin action must come from Tuveloz." }, { status: 403 });
  }
  if (!(await isVerifiedOwnerRequest(request))) {
    return Response.json({ error: "Signed owner verification is required." }, { status: 403 });
  }

  try {
    const payload = await request.json() as Record<string, unknown>;
    const action = text(payload.action, 40);
    if (action !== "review-credential") {
      return Response.json({ error: "Unknown owner marketplace action." }, { status: 400 });
    }
    const id = text(payload.id, 80);
    const status = text(payload.status, 20);
    const reviewNote = text(payload.reviewNote, 600);
    const publicDisplay = payload.publicDisplay === true ? "yes" : "no";
    if (!new Set(["pending", "verified", "rejected"]).has(status)) {
      return Response.json({ error: "Choose pending, verified, or rejected." }, { status: 400 });
    }
    if (status === "verified" && !reviewNote) {
      return Response.json(
        { error: "Record how the optional credential was reviewed before verifying it." },
        { status: 400 },
      );
    }
    await env.DB.prepare(
      `UPDATE provider_submitted_credentials
          SET status = ?, review_note = ?,
              public_display = CASE WHEN ? = 'verified' THEN ? ELSE 'no' END,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
    ).bind(status, reviewNote, status, publicDisplay, id).run();
    return Response.json({ ok: true, ...(await responseData()) });
  } catch (error) {
    console.error("Unable to update owner marketplace tools", error);
    return Response.json({ error: "Owner marketplace tools could not be updated." }, { status: 503 });
  }
}
