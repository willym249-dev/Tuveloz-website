import { env } from "cloudflare:workers";
import { getAccountSession, providerAccountFor } from "../../../lib/account-auth";
import { notifyMarketplaceAccount } from "../../../lib/marketplace-notifications";
import { isSameOriginRequest } from "../../../lib/request-security";
import { parseProviderServices } from "../../../lib/service-matching";

type AppointmentRow = {
  id: string;
  requestId: string;
  providerId: string;
  providerEmail: string;
  providerName: string;
  customerEmail: string;
  customerName: string;
  service: string;
  requestedByRole: "customer" | "provider";
  startsAt: string;
  alternateAt: string;
  confirmedStartAt: string;
  note: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type PublicProviderRow = {
  id: string;
  name: string;
  approvedServices: string;
};

type RequestOptionRow = {
  id: string;
  vehicle: string;
  service: string;
  status: string;
  customerName: string;
  customerEmail: string;
};

function text(value: unknown, maximum: number) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function normalizeDate(value: unknown) {
  const raw = text(value, 40);
  const parsed = Date.parse(raw);
  if (!raw || !Number.isFinite(parsed)) throw new Error("Choose a valid appointment date and time.");
  if (parsed < Date.now() + 15 * 60 * 1000) {
    throw new Error("Choose an appointment time at least 15 minutes from now.");
  }
  if (parsed > Date.now() + 366 * 24 * 60 * 60 * 1000) {
    throw new Error("Choose an appointment within the next year.");
  }
  return new Date(parsed).toISOString();
}

async function appointmentRows(whereSql: string, value: string) {
  const result = await env.DB.prepare(
    `SELECT id, request_id AS requestId, provider_id AS providerId,
            provider_email AS providerEmail, provider_name AS providerName,
            customer_email AS customerEmail, customer_name AS customerName,
            service, requested_by_role AS requestedByRole,
            starts_at AS startsAt, alternate_at AS alternateAt,
            confirmed_start_at AS confirmedStartAt, note, status,
            created_at AS createdAt, updated_at AS updatedAt
       FROM appointments
      WHERE ${whereSql} = ?
      ORDER BY CASE WHEN status = 'confirmed' THEN 0 WHEN status = 'requested' THEN 1 ELSE 2 END,
               datetime(COALESCE(NULLIF(confirmed_start_at, ''), starts_at)) ASC`,
  ).bind(value).all<AppointmentRow>();
  return result.results;
}

async function customerDisplayName(email: string) {
  const profile = await env.DB.prepare(
    `SELECT display_name AS displayName
       FROM customer_profiles
      WHERE lower(email) = lower(?)
      LIMIT 1`,
  ).bind(email).first<{ displayName: string }>();
  if (profile?.displayName) return profile.displayName;
  const request = await env.DB.prepare(
    `SELECT name FROM customer_requests
      WHERE lower(email) = lower(?)
      ORDER BY datetime(created_at) DESC LIMIT 1`,
  ).bind(email).first<{ name: string }>();
  return request?.name || email.split("@")[0] || "Customer";
}

async function responseData(request: Request) {
  const session = await getAccountSession(request);
  if (!session) return null;

  if (session.role === "provider") {
    const provider = await providerAccountFor(session.email);
    if (!provider) return null;
    const [appointments, requestOptionsResult] = await Promise.all([
      appointmentRows("provider_id", provider.id),
      env.DB.prepare(
        `SELECT request.id, request.vehicle, request.service, request.status,
                request.name AS customerName, request.email AS customerEmail
           FROM customer_requests request
           INNER JOIN provider_quotes quote
             ON quote.request_id = request.id
            AND lower(quote.provider_email) = lower(?)
            AND quote.status = 'accepted'
          WHERE request.status IN ('quote accepted','on my way','arrived')
          ORDER BY datetime(request.created_at) DESC`,
      ).bind(provider.email).all<RequestOptionRow>(),
    ]);
    return {
      role: "provider" as const,
      email: session.email,
      provider: { id: provider.id, name: provider.name },
      appointments,
      requestOptions: requestOptionsResult.results,
      providers: [],
    };
  }

  const [appointments, providersResult, requestOptionsResult] = await Promise.all([
    appointmentRows("lower(customer_email)", session.email.toLowerCase()),
    env.DB.prepare(
      `SELECT provider.id,
              COALESCE(NULLIF(profile.business_name, ''), provider.name) AS name,
              provider.approved_services AS approvedServices
         FROM provider_applications provider
         INNER JOIN provider_profiles profile ON profile.provider_id = provider.id
        WHERE provider.status = 'approved'
          AND provider.verification_status = 'verified'
          AND provider.is_test_provider = 'no'
          AND profile.public_status = 'published'
        ORDER BY name ASC
        LIMIT 200`,
    ).all<PublicProviderRow>(),
    env.DB.prepare(
      `SELECT id, vehicle, service, status, name AS customerName, email AS customerEmail
         FROM customer_requests
        WHERE lower(email) = lower(?)
          AND status NOT IN ('completed','cancelled','canceled')
        ORDER BY datetime(created_at) DESC
        LIMIT 100`,
    ).bind(session.email).all<RequestOptionRow>(),
  ]);
  return {
    role: "customer" as const,
    email: session.email,
    appointments,
    requestOptions: requestOptionsResult.results,
    providers: providersResult.results.map((provider) => ({
      id: provider.id,
      name: provider.name,
      services: parseProviderServices(provider.approvedServices),
    })),
  };
}

export async function GET(request: Request) {
  const data = await responseData(request);
  if (!data) {
    return Response.json(
      { error: "Sign in to request or manage appointments." },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  }
  return Response.json(data, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "This appointment action must come from Tuveloz." }, { status: 403 });
  }
  const session = await getAccountSession(request);
  if (!session) return Response.json({ error: "Sign in to manage appointments." }, { status: 401 });

  try {
    const payload = await request.json() as Record<string, unknown>;
    const action = text(payload.action, 40);

    if (action === "create") {
      const startsAt = normalizeDate(payload.startsAt);
      const note = text(payload.note, 800);
      const appointmentId = crypto.randomUUID();
      let requestId = text(payload.requestId, 80);
      let providerId = "";
      let providerEmail = "";
      let providerName = "";
      let customerEmail = "";
      let customerName = "";
      let service = text(payload.service, 160);

      if (session.role === "provider") {
        const provider = await providerAccountFor(session.email);
        if (!provider) throw new Error("Verified provider access is required.");
        if (!requestId) throw new Error("Choose an accepted customer job.");
        const acceptedJob = await env.DB.prepare(
          `SELECT request.name AS customerName, request.email AS customerEmail,
                  request.service, request.status
             FROM customer_requests request
             INNER JOIN provider_quotes quote
               ON quote.request_id = request.id
              AND lower(quote.provider_email) = lower(?)
              AND quote.status = 'accepted'
            WHERE request.id = ?
              AND request.status IN ('quote accepted','on my way','arrived')
            LIMIT 1`,
        ).bind(provider.email, requestId).first<{
          customerName: string;
          customerEmail: string;
          service: string;
          status: string;
        }>();
        if (!acceptedJob) throw new Error("Only the selected provider can request this appointment.");
        providerId = provider.id;
        providerEmail = provider.email;
        providerName = provider.name;
        customerEmail = acceptedJob.customerEmail.toLowerCase();
        customerName = acceptedJob.customerName;
        service = acceptedJob.service;
      } else {
        providerId = text(payload.providerId, 80);
        if (!providerId || !service) throw new Error("Choose a provider and service.");
        const provider = await env.DB.prepare(
          `SELECT provider.email, provider.name,
                  COALESCE(NULLIF(profile.business_name, ''), provider.name) AS publicName,
                  provider.approved_services AS approvedServices
             FROM provider_applications provider
             INNER JOIN provider_profiles profile ON profile.provider_id = provider.id
            WHERE provider.id = ?
              AND provider.status = 'approved'
              AND provider.verification_status = 'verified'
              AND provider.is_test_provider = 'no'
              AND profile.public_status = 'published'
            LIMIT 1`,
        ).bind(providerId).first<{
          email: string;
          name: string;
          publicName: string;
          approvedServices: string;
        }>();
        if (!provider || !parseProviderServices(provider.approvedServices).includes(service)) {
          throw new Error("That provider is not available for the selected service.");
        }
        if (requestId) {
          const ownedRequest = await env.DB.prepare(
            `SELECT id FROM customer_requests
              WHERE id = ? AND lower(email) = lower(?) LIMIT 1`,
          ).bind(requestId, session.email).first<{ id: string }>();
          if (!ownedRequest) throw new Error("That customer request does not belong to this account.");
        }
        providerEmail = provider.email.toLowerCase();
        providerName = provider.publicName || provider.name;
        customerEmail = session.email.toLowerCase();
        customerName = await customerDisplayName(customerEmail);
      }

      await env.DB.prepare(
        `INSERT INTO appointments
           (id, request_id, provider_id, provider_email, provider_name,
            customer_email, customer_name, service, requested_by_role,
            starts_at, alternate_at, confirmed_start_at, note, status,
            created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', '', ?, 'requested',
                 CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      ).bind(
        appointmentId,
        requestId,
        providerId,
        providerEmail,
        providerName,
        customerEmail,
        customerName,
        service,
        session.role,
        startsAt,
        note,
      ).run();

      const recipientRole = session.role === "customer" ? "provider" : "customer";
      const recipientEmail = session.role === "customer" ? providerEmail : customerEmail;
      const requesterName = session.role === "customer" ? customerName : providerName;
      await notifyMarketplaceAccount({
        eventKey: `appointment-request:${appointmentId}:${recipientRole}`,
        email: recipientEmail,
        role: recipientRole,
        title: "New appointment request",
        body: `${requesterName} requested ${service} for ${new Date(startsAt).toLocaleString()}. Open Tuveloz to confirm or decline.`,
        href: "/appointments",
        emailSubject: "New Tuveloz appointment request",
        emailLines: [
          "A new appointment request is waiting in Tuveloz.",
          `Service: ${service}`,
          `Requested time: ${new Date(startsAt).toISOString()}`,
          `Open appointments: https://tuveloz.com/appointments`,
        ],
      });
      await notifyMarketplaceAccount({
        eventKey: `appointment-request:${appointmentId}:${session.role}`,
        email: session.email,
        role: session.role,
        title: "Appointment request sent",
        body: `Your ${service} appointment request was sent for ${new Date(startsAt).toLocaleString()}.`,
        href: "/appointments",
      });
      return Response.json({ ok: true, ...(await responseData(request)) }, { status: 201 });
    }

    if (action === "respond") {
      const id = text(payload.id, 80);
      const responseStatus = text(payload.status, 20);
      if (!new Set(["confirmed", "declined", "cancelled"]).has(responseStatus)) {
        throw new Error("Choose confirm, decline, or cancel.");
      }
      const appointment = await env.DB.prepare(
        `SELECT id, request_id AS requestId, provider_id AS providerId,
                provider_email AS providerEmail, provider_name AS providerName,
                customer_email AS customerEmail, customer_name AS customerName,
                service, requested_by_role AS requestedByRole,
                starts_at AS startsAt, status
           FROM appointments WHERE id = ? LIMIT 1`,
      ).bind(id).first<AppointmentRow>();
      if (!appointment) throw new Error("Appointment not found.");
      const participant = session.role === "customer"
        ? appointment.customerEmail.toLowerCase() === session.email.toLowerCase()
        : (await providerAccountFor(session.email))?.id === appointment.providerId;
      if (!participant) throw new Error("This appointment does not belong to your account.");
      if (appointment.status !== "requested") throw new Error("This appointment was already answered.");
      if (
        responseStatus !== "cancelled"
        && appointment.requestedByRole === session.role
      ) {
        throw new Error("The person who received the request must confirm or decline it.");
      }
      await env.DB.prepare(
        `UPDATE appointments
            SET status = ?,
                confirmed_start_at = CASE WHEN ? = 'confirmed' THEN starts_at ELSE '' END,
                updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND status = 'requested'`,
      ).bind(responseStatus, responseStatus, id).run();

      const otherRole = session.role === "customer" ? "provider" : "customer";
      const otherEmail = session.role === "customer"
        ? appointment.providerEmail
        : appointment.customerEmail;
      await notifyMarketplaceAccount({
        eventKey: `appointment-response:${id}:${responseStatus}:${otherRole}`,
        email: otherEmail,
        role: otherRole,
        title: `Appointment ${responseStatus}`,
        body: `The ${appointment.service} appointment for ${new Date(appointment.startsAt).toLocaleString()} was ${responseStatus}.`,
        href: "/appointments",
        emailSubject: `Tuveloz appointment ${responseStatus}`,
        emailLines: [
          `The ${appointment.service} appointment was ${responseStatus}.`,
          `Time: ${new Date(appointment.startsAt).toISOString()}`,
          "Open Tuveloz appointments: https://tuveloz.com/appointments",
        ],
      });
      return Response.json({ ok: true, ...(await responseData(request)) });
    }

    return Response.json({ error: "Unknown appointment action." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update appointments.";
    return Response.json(
      { error: message },
      { status: message.startsWith("Choose") || message.startsWith("That") || message.startsWith("Only") || message.startsWith("The person") ? 400 : 503 },
    );
  }
}