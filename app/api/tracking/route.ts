import { env } from "cloudflare:workers";
import { getAccountSession, providerAccountFor } from "../../../lib/account-auth";
import { notifyMarketplaceAccount } from "../../../lib/marketplace-notifications";
import { isSameOriginRequest } from "../../../lib/request-security";
import {
  marketplacePausedMessage,
} from "../../../lib/launch-status";
import { runtimeMarketplaceActionAllowed } from "../../../lib/runtime-marketplace-action";

function marketplacePausedResponse() {
  return Response.json(
    {
      error: marketplacePausedMessage("job_start"),
      code: "MARKETPLACE_ONBOARDING_ONLY",
    },
    {
      status: 503,
      headers: { "cache-control": "no-store", "retry-after": "86400" },
    },
  );
}

type TrackingJob = {
  requestId: string;
  vehicle: string;
  service: string;
  requestStatus: string;
  providerEmail: string;
  providerName: string;
  customerEmail: string;
  customerName: string;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  shareStatus: string | null;
  sharedAt: string | null;
  expiresAt: string | null;
  updatedAt: string | null;
};

function text(value: unknown, maximum: number) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function liveShare(job: TrackingJob) {
  const expires = job.expiresAt ? Date.parse(job.expiresAt) : 0;
  return job.requestStatus === "on my way"
    && job.shareStatus === "sharing"
    && job.latitude !== null
    && job.longitude !== null
    && expires > Date.now();
}

function publicJob(job: TrackingJob, role: "customer" | "provider") {
  const sharing = liveShare(job);
  return {
    requestId: job.requestId,
    vehicle: job.vehicle,
    service: job.service,
    requestStatus: job.requestStatus,
    providerName: job.providerName,
    customerName: job.customerName,
    sharing,
    latitude: role === "customer" && sharing ? job.latitude : null,
    longitude: role === "customer" && sharing ? job.longitude : null,
    accuracy: role === "customer" && sharing ? job.accuracy : null,
    sharedAt: sharing ? job.sharedAt : "",
    expiresAt: sharing ? job.expiresAt : "",
    updatedAt: job.updatedAt || "",
  };
}

async function responseData(request: Request) {
  const session = await getAccountSession(request);
  if (!session) return null;

  if (session.role === "provider") {
    const provider = await providerAccountFor(session.email);
    if (!provider) return null;
    const result = await env.DB.prepare(
      `SELECT request.id AS requestId, request.vehicle, request.service,
              request.status AS requestStatus,
              quote.provider_email AS providerEmail,
              quote.provider_name AS providerName,
              request.email AS customerEmail,
              request.name AS customerName,
              share.latitude, share.longitude, share.accuracy,
              share.status AS shareStatus, share.shared_at AS sharedAt,
              share.expires_at AS expiresAt, share.updated_at AS updatedAt
         FROM customer_requests request
         INNER JOIN provider_quotes quote
           ON quote.request_id = request.id
          AND lower(quote.provider_email) = lower(?)
          AND quote.status = 'accepted'
         LEFT JOIN job_location_shares share ON share.request_id = request.id
         WHERE request.status IN ('quote accepted','on my way','arrived','completed')
           AND request.is_test_job = ?
         ORDER BY datetime(request.created_at) DESC
         LIMIT 50`,
    ).bind(provider.email, provider.isTestProvider).all<TrackingJob>();
    return {
      role: "provider" as const,
      email: session.email,
      jobs: result.results.map((job) => publicJob(job, "provider")),
      privacy: "Tuveloz stores only the latest location while you deliberately share it. Sharing works only while this page is open, expires after five minutes without an update, and stops when you arrive, complete the job, or press Stop.",
    };
  }

  const result = await env.DB.prepare(
    `SELECT request.id AS requestId, request.vehicle, request.service,
            request.status AS requestStatus,
            quote.provider_email AS providerEmail,
            quote.provider_name AS providerName,
            request.email AS customerEmail,
            request.name AS customerName,
            share.latitude, share.longitude, share.accuracy,
            share.status AS shareStatus, share.shared_at AS sharedAt,
            share.expires_at AS expiresAt, share.updated_at AS updatedAt
       FROM customer_requests request
       INNER JOIN provider_quotes quote
         ON quote.request_id = request.id
        AND quote.status = 'accepted'
       LEFT JOIN job_location_shares share ON share.request_id = request.id
      WHERE lower(request.email) = lower(?)
        AND request.status IN ('quote accepted','on my way','arrived','completed')
      ORDER BY datetime(request.created_at) DESC
      LIMIT 50`,
  ).bind(session.email).all<TrackingJob>();
  return {
    role: "customer" as const,
    email: session.email,
    jobs: result.results.map((job) => publicJob(job, "customer")),
    privacy: "A provider location appears only when the selected provider voluntarily shares it for an on-the-way job. Tuveloz shows the latest point, not a location history, and removes precise coordinates when sharing stops or expires.",
  };
}

export async function GET(request: Request) {
  const session = await getAccountSession(request);
  if (!session) {
    return Response.json(
      { error: "Sign in to use Tuveloz trip tracking." },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  }
  const provider = session.role === "provider"
    ? await providerAccountFor(session.email)
    : null;
  if (!(await runtimeMarketplaceActionAllowed("job_start", {
    testOnly: provider?.isTestProvider === "yes",
  }))) {
    return marketplacePausedResponse();
  }
  const data = await responseData(request);
  if (!data) {
    return Response.json(
      { error: "Sign in to use Tuveloz trip tracking." },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  }
  return Response.json(data, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "This tracking action must come from Tuveloz." }, { status: 403 });
  }
  const session = await getAccountSession(request);
  if (!session || session.role !== "provider") {
    return Response.json({ error: "Only the selected provider can share trip location." }, { status: 401 });
  }
  const provider = await providerAccountFor(session.email);
  if (!provider) return Response.json({ error: "An active provider account is required." }, { status: 403 });

  try {
    const payload = await request.json() as Record<string, unknown>;
    const action = text(payload.action, 20);
    const requestId = text(payload.requestId, 80);
    if (!requestId) throw new Error("Choose an accepted job.");
    const job = await env.DB.prepare(
      `SELECT request.id AS requestId, request.status AS requestStatus,
              request.email AS customerEmail, request.name AS customerName,
              request.vehicle, request.service, request.is_test_job AS isTestJob,
              quote.provider_name AS providerName
         FROM customer_requests request
         INNER JOIN provider_quotes quote
           ON quote.request_id = request.id
          AND lower(quote.provider_email) = lower(?)
          AND quote.status = 'accepted'
        WHERE request.id = ? LIMIT 1`,
    ).bind(provider.email, requestId).first<{
      requestId: string;
      requestStatus: string;
      customerEmail: string;
      customerName: string;
      vehicle: string;
      service: string;
      providerName: string;
      isTestJob: string;
    }>();
    if (!job) throw new Error("Only the selected provider can share location for this job.");

    if (action === "stop") {
      await env.DB.prepare(
        `UPDATE job_location_shares
            SET latitude = NULL, longitude = NULL, accuracy = NULL,
                status = 'stopped', expires_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
          WHERE request_id = ? AND lower(provider_email) = lower(?)`,
      ).bind(requestId, provider.email).run();
      await notifyMarketplaceAccount({
        eventKey: `tracking-stopped:${requestId}`,
        email: job.customerEmail,
        role: "customer",
        title: "Provider location sharing stopped",
        body: "The provider stopped sharing a live trip location. Your job status remains available in Tuveloz.",
        href: `/my-request?request=${encodeURIComponent(requestId)}`,
      });
      if (await runtimeMarketplaceActionAllowed("job_start", {
        testOnly: provider.isTestProvider === "yes" && job.isTestJob === "yes",
      })) {
        return Response.json({ ok: true, ...(await responseData(request)) });
      }
      return Response.json({ ok: true, sharing: false });
    }

    if (action !== "share") throw new Error("Choose start sharing or stop sharing.");
    if (!(await runtimeMarketplaceActionAllowed("job_start", {
      testOnly: provider.isTestProvider === "yes" && job.isTestJob === "yes",
    }))) {
      return marketplacePausedResponse();
    }
    if (payload.permissionAccepted !== true) {
      throw new Error("Confirm that you choose to share your current location for this trip.");
    }
    if (job.requestStatus !== "on my way") {
      throw new Error("Mark the job as on my way before sharing trip location.");
    }
    const latitude = Number(payload.latitude);
    const longitude = Number(payload.longitude);
    const accuracy = Math.max(0, Math.min(100_000, Number(payload.accuracy) || 0));
    if (
      !Number.isFinite(latitude)
      || !Number.isFinite(longitude)
      || latitude < -90
      || latitude > 90
      || longitude < -180
      || longitude > 180
    ) {
      throw new Error("Your device did not return a valid GPS location.");
    }
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 5 * 60 * 1000).toISOString();
    await env.DB.prepare(
      `INSERT INTO job_location_shares
         (request_id, provider_email, customer_email, latitude, longitude,
          accuracy, status, permission_recorded_at, shared_at, expires_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'sharing', ?, ?, ?, ?)
       ON CONFLICT(request_id) DO UPDATE SET
         provider_email = excluded.provider_email,
         customer_email = excluded.customer_email,
         latitude = excluded.latitude,
         longitude = excluded.longitude,
         accuracy = excluded.accuracy,
         status = 'sharing',
         permission_recorded_at = CASE
           WHEN job_location_shares.permission_recorded_at = ''
           THEN excluded.permission_recorded_at
           ELSE job_location_shares.permission_recorded_at
         END,
         shared_at = excluded.shared_at,
         expires_at = excluded.expires_at,
         updated_at = excluded.updated_at`,
    ).bind(
      requestId,
      provider.email.toLowerCase(),
      job.customerEmail.toLowerCase(),
      latitude,
      longitude,
      accuracy,
      now.toISOString(),
      now.toISOString(),
      expiresAt,
      now.toISOString(),
    ).run();
    await notifyMarketplaceAccount({
      eventKey: `tracking-started:${requestId}`,
      email: job.customerEmail,
      role: "customer",
      title: "Live provider trip location is available",
      body: `${job.providerName} chose to share a current location while traveling for ${job.service}. Open tracking to view the latest point.`,
      href: "/tracking",
      emailSubject: "Your Tuveloz provider is sharing trip location",
      emailLines: [
        `${job.providerName} chose to share a current location while traveling for ${job.service}.`,
        "Tuveloz stores only the latest point. Sharing expires automatically when updates stop.",
        "Open tracking: https://tuveloz.com/tracking",
      ],
    });
    return Response.json({ ok: true, ...(await responseData(request)) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update trip tracking.";
    return Response.json({ error: message }, { status: 400 });
  }
}
