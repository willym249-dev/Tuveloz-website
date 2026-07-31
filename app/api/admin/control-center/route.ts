import { env } from "cloudflare:workers";
import { desc } from "drizzle-orm";
import { getDb } from "../../../../db";
import {
  accountCredentials,
  authSessions,
  customerProfiles,
  customerRequests,
  providerApplications,
  providerQuotes,
  savedProviders,
  stripePayments,
} from "../../../../db/schema";
import { CUSTOMER_SERVICE_FEE_PERCENT } from "../../../../lib/customer-fee";
import { isVerifiedOwnerRequest } from "../../../../lib/owner-auth";
import {
  CUSTOMER_AGREEMENT_VERSION,
  PAYMENT_POLICY_VERSION,
  PRIVACY_VERSION,
  PROVIDER_AGREEMENT_VERSION,
  TERMS_VERSION,
} from "../../../../lib/policies";

type RuntimeEnvironment = Record<string, string | undefined>;

type CustomerServiceAreaRow = {
  email: string;
  municipality: string;
  zip: string;
  serviceLocations: string;
  updatedAt: string;
};

type CustomerAppointmentRow = {
  customerEmail: string;
  status: string;
};

type CustomerNotificationRow = {
  email: string;
  readAt: string;
};

type CustomerEmailRow = {
  recipientEmail: string;
  status: string;
};

type CustomerRequestSummary = {
  total: number;
  active: number;
  completed: number;
  cancelled: number;
  latestAt: string;
  municipality: string;
  zip: string;
  serviceLocations: string;
};

type CountSummary = {
  total: number;
  secondary: number;
};

type EmailCountSummary = {
  sent: number;
  pending: number;
  failed: number;
};

function normalizedEmail(value: string) {
  return value.trim().toLowerCase();
}

function increment(counts: Map<string, number>, email: string) {
  const key = normalizedEmail(email);
  if (!key) return;
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

function latestDate(values: string[]) {
  return values.reduce((latest, value) => {
    if (!value) return latest;
    if (!latest) return value;
    const currentTime = Date.parse(value);
    const latestTime = Date.parse(latest);
    if (Number.isNaN(currentTime)) return latest;
    if (Number.isNaN(latestTime) || currentTime > latestTime) return value;
    return latest;
  }, "");
}

function senderDomain(value: string) {
  return value.match(/@([^>\s]+)/)?.[1]?.toLowerCase() ?? "";
}

function parsedServiceLocations(value: string) {
  return [...new Set(
    value
      .split(" | ")
      .map((item) => item.trim())
      .filter(Boolean),
  )];
}

function requestSummaryFor(
  summaries: Map<string, CustomerRequestSummary>,
  email: string,
) {
  const key = normalizedEmail(email);
  const current = summaries.get(key);
  if (current) return current;
  const created: CustomerRequestSummary = {
    total: 0,
    active: 0,
    completed: 0,
    cancelled: 0,
    latestAt: "",
    municipality: "",
    zip: "",
    serviceLocations: "",
  };
  summaries.set(key, created);
  return created;
}

function countSummaryFor(
  summaries: Map<string, CountSummary>,
  email: string,
) {
  const key = normalizedEmail(email);
  const current = summaries.get(key);
  if (current) return current;
  const created = { total: 0, secondary: 0 };
  summaries.set(key, created);
  return created;
}

function emailSummaryFor(
  summaries: Map<string, EmailCountSummary>,
  email: string,
) {
  const key = normalizedEmail(email);
  const current = summaries.get(key);
  if (current) return current;
  const created = { sent: 0, pending: 0, failed: 0 };
  summaries.set(key, created);
  return created;
}

export async function GET(request: Request) {
  if (!(await isVerifiedOwnerRequest(request))) {
    return Response.json(
      { error: "Signed owner verification is required for account management." },
      { status: 403, headers: { "cache-control": "no-store" } },
    );
  }

  try {
    const db = getDb();
    const [
      requests,
      providers,
      quotes,
      credentials,
      sessions,
      profiles,
      savedProviderRows,
      paymentOwners,
      serviceAreasResult,
      appointmentsResult,
      notificationsResult,
      emailResult,
    ] = await Promise.all([
      db.select({
        id: customerRequests.id,
        email: customerRequests.email,
        status: customerRequests.status,
        municipality: customerRequests.municipality,
        zip: customerRequests.zip,
        serviceLocations: customerRequests.serviceLocations,
        createdAt: customerRequests.createdAt,
      }).from(customerRequests)
        .orderBy(desc(customerRequests.createdAt))
        .limit(5000),
      db.select({
        id: providerApplications.id,
        email: providerApplications.email,
        status: providerApplications.status,
        verificationStatus: providerApplications.verificationStatus,
        isTestProvider: providerApplications.isTestProvider,
      }).from(providerApplications)
        .limit(1000),
      db.select({
        requestId: providerQuotes.requestId,
        providerEmail: providerQuotes.providerEmail,
        status: providerQuotes.status,
      }).from(providerQuotes)
        .limit(10_000),
      db.select({
        email: accountCredentials.email,
        verifiedAt: accountCredentials.verifiedAt,
        lockedUntil: accountCredentials.lockedUntil,
        termsAcceptedAt: accountCredentials.termsAcceptedAt,
        termsVersion: accountCredentials.termsVersion,
        createdAt: accountCredentials.createdAt,
        updatedAt: accountCredentials.updatedAt,
      }).from(accountCredentials)
        .orderBy(desc(accountCredentials.createdAt))
        .limit(1000),
      db.select({
        email: authSessions.email,
        expiresAt: authSessions.expiresAt,
        lastSeenAt: authSessions.lastSeenAt,
      }).from(authSessions)
        .orderBy(desc(authSessions.lastSeenAt))
        .limit(2000),
      db.select({
        email: customerProfiles.email,
        displayName: customerProfiles.displayName,
        updatedAt: customerProfiles.updatedAt,
      }).from(customerProfiles)
        .limit(1000),
      db.select({
        customerEmail: savedProviders.customerEmail,
      }).from(savedProviders)
        .limit(5000),
      db.select({
        id: stripePayments.id,
        customerEmail: stripePayments.customerEmail,
        providerApplicationId: stripePayments.providerApplicationId,
      }).from(stripePayments)
        .orderBy(desc(stripePayments.createdAt))
        .limit(5000),
      env.DB.prepare(
        `SELECT email, municipality, zip,
                service_locations AS serviceLocations,
                updated_at AS updatedAt
           FROM account_service_area_settings
          WHERE role = 'customer'
          LIMIT 2000`,
      ).all<CustomerServiceAreaRow>(),
      env.DB.prepare(
        `SELECT customer_email AS customerEmail, status
           FROM appointments
          LIMIT 5000`,
      ).all<CustomerAppointmentRow>(),
      env.DB.prepare(
        `SELECT email, read_at AS readAt
           FROM account_notifications
          WHERE role = 'customer'
          LIMIT 10000`,
      ).all<CustomerNotificationRow>(),
      env.DB.prepare(
        `SELECT recipient_email AS recipientEmail, status
           FROM email_notification_outbox
          LIMIT 10000`,
      ).all<CustomerEmailRow>(),
    ]);

    const requestSummaries = new Map<string, CustomerRequestSummary>();
    const requestOwnerById = new Map<string, string>();
    for (const item of requests) {
      const email = normalizedEmail(item.email);
      if (!email) continue;
      requestOwnerById.set(item.id, email);
      const summary = requestSummaryFor(requestSummaries, email);
      summary.total += 1;
      const status = item.status.trim().toLowerCase();
      if (["new", "approved", "quote accepted", "on my way", "arrived"].includes(status)) {
        summary.active += 1;
      } else if (status === "completed") {
        summary.completed += 1;
      } else if (["cancelled", "canceled", "declined"].includes(status)) {
        summary.cancelled += 1;
      }
      if (!summary.latestAt) {
        summary.latestAt = item.createdAt;
        summary.municipality = item.municipality;
        summary.zip = item.zip;
        summary.serviceLocations = item.serviceLocations;
      }
    }

    const providerQuoteCounts = new Map<string, number>();
    const customerQuoteSummaries = new Map<string, CountSummary>();
    for (const quote of quotes) {
      increment(providerQuoteCounts, quote.providerEmail);
      const customerEmail = requestOwnerById.get(quote.requestId);
      if (!customerEmail) continue;
      const summary = countSummaryFor(customerQuoteSummaries, customerEmail);
      summary.total += 1;
      if (quote.status === "accepted") summary.secondary += 1;
    }

    const profileByEmail = new Map(
      profiles.map((profile) => [normalizedEmail(profile.email), profile]),
    );
    const serviceAreaByEmail = new Map(
      (serviceAreasResult.results ?? []).map((area) => [
        normalizedEmail(area.email),
        area,
      ]),
    );
    const providerById = new Map(providers.map((provider) => [provider.id, provider]));
    const verifiedProviderEmails = new Set(
      providers
        .filter((provider) => (
          provider.status === "approved"
          && provider.verificationStatus === "verified"
          && provider.isTestProvider === "no"
        ))
        .map((provider) => normalizedEmail(provider.email)),
    );

    const savedProviderCounts = new Map<string, number>();
    for (const item of savedProviderRows) increment(savedProviderCounts, item.customerEmail);

    const appointmentSummaries = new Map<string, CountSummary>();
    for (const appointment of appointmentsResult.results ?? []) {
      const summary = countSummaryFor(
        appointmentSummaries,
        appointment.customerEmail,
      );
      summary.total += 1;
      if (appointment.status === "requested") summary.secondary += 1;
    }

    const notificationSummaries = new Map<string, CountSummary>();
    for (const notification of notificationsResult.results ?? []) {
      const summary = countSummaryFor(notificationSummaries, notification.email);
      summary.total += 1;
      if (!notification.readAt) summary.secondary += 1;
    }

    const emailSummaries = new Map<string, EmailCountSummary>();
    for (const emailRecord of emailResult.results ?? []) {
      const summary = emailSummaryFor(emailSummaries, emailRecord.recipientEmail);
      if (emailRecord.status === "sent") {
        summary.sent += 1;
      } else if (emailRecord.status === "failed") {
        summary.failed += 1;
      } else {
        summary.pending += 1;
      }
    }

    const paymentIdsByEmail = new Map<string, Set<string>>();
    function addPayment(email: string, paymentId: string) {
      const key = normalizedEmail(email);
      if (!key) return;
      const existing = paymentIdsByEmail.get(key) ?? new Set<string>();
      existing.add(paymentId);
      paymentIdsByEmail.set(key, existing);
    }
    for (const payment of paymentOwners) {
      addPayment(payment.customerEmail, payment.id);
      const provider = providerById.get(payment.providerApplicationId);
      if (provider) addPayment(provider.email, payment.id);
    }

    const now = Date.now();
    const sessionsByEmail = sessions.reduce<Map<string, typeof sessions>>((groups, session) => {
      const key = normalizedEmail(session.email);
      const current = groups.get(key) ?? [];
      current.push(session);
      groups.set(key, current);
      return groups;
    }, new Map());

    const users = credentials.map((credential) => {
      const email = normalizedEmail(credential.email);
      const accountSessions = sessionsByEmail.get(email) ?? [];
      const activeSessions = accountSessions.filter((session) => {
        const expiresAt = Date.parse(session.expiresAt);
        return !Number.isNaN(expiresAt) && expiresAt > now;
      });
      const lockedUntil = Date.parse(credential.lockedUntil);
      const profile = profileByEmail.get(email);
      const serviceArea = serviceAreaByEmail.get(email);
      const requestSummary = requestSummaries.get(email) ?? {
        total: 0,
        active: 0,
        completed: 0,
        cancelled: 0,
        latestAt: "",
        municipality: "",
        zip: "",
        serviceLocations: "",
      };
      const quoteSummary = customerQuoteSummaries.get(email) ?? {
        total: 0,
        secondary: 0,
      };
      const appointmentSummary = appointmentSummaries.get(email) ?? {
        total: 0,
        secondary: 0,
      };
      const notificationSummary = notificationSummaries.get(email) ?? {
        total: 0,
        secondary: 0,
      };
      const emailSummary = emailSummaries.get(email) ?? {
        sent: 0,
        pending: 0,
        failed: 0,
      };
      const municipality = serviceArea?.municipality || requestSummary.municipality;
      const zip = serviceArea?.zip || requestSummary.zip;
      const serviceLocations = parsedServiceLocations(
        serviceArea?.serviceLocations || requestSummary.serviceLocations,
      );
      const profileComplete = Boolean(
        profile?.displayName
        && municipality
        && zip
        && serviceLocations.length > 0,
      );

      return {
        email,
        displayName: profile?.displayName ?? "",
        roles: verifiedProviderEmails.has(email)
          ? ["customer", "provider"] as const
          : ["customer"] as const,
        status: !Number.isNaN(lockedUntil) && lockedUntil > now
          ? "temporarily locked" as const
          : "active" as const,
        verifiedAt: credential.verifiedAt,
        termsAcceptedAt: credential.termsAcceptedAt,
        termsVersion: credential.termsVersion,
        createdAt: credential.createdAt,
        updatedAt: credential.updatedAt,
        activeSessionCount: activeSessions.length,
        lastSeenAt: latestDate(accountSessions.map((session) => session.lastSeenAt)),
        requestCount: requestSummary.total,
        providerQuoteCount: providerQuoteCounts.get(email) ?? 0,
        paymentCount: paymentIdsByEmail.get(email)?.size ?? 0,
        customerProfile: {
          profileComplete,
          municipality,
          zip,
          serviceLocations,
          activeJobCount: requestSummary.active,
          completedJobCount: requestSummary.completed,
          cancelledJobCount: requestSummary.cancelled,
          quotesReceivedCount: quoteSummary.total,
          acceptedQuoteCount: quoteSummary.secondary,
          savedProviderCount: savedProviderCounts.get(email) ?? 0,
          appointmentCount: appointmentSummary.total,
          pendingAppointmentCount: appointmentSummary.secondary,
          notificationCount: notificationSummary.total,
          unreadNotificationCount: notificationSummary.secondary,
          emailSentCount: emailSummary.sent,
          emailPendingCount: emailSummary.pending,
          emailFailedCount: emailSummary.failed,
          lastRequestAt: requestSummary.latestAt,
          profileUpdatedAt: latestDate([
            profile?.updatedAt ?? "",
            serviceArea?.updatedAt ?? "",
          ]),
        },
      };
    });

    const runtime = env as unknown as RuntimeEnvironment;
    const stripeKey = runtime.STRIPE_SECRET_KEY?.trim() ?? "";
    const liveModeAllowed = runtime.STRIPE_ALLOW_LIVE_MODE === "true";
    const stripeMode = stripeKey.startsWith("sk_test_")
      ? "test"
      : stripeKey.startsWith("sk_live_")
        ? liveModeAllowed
          ? "live"
          : "live blocked"
        : "not configured";
    const fromEmail = runtime.RESEND_FROM_EMAIL?.trim() ?? "";

    const platform = {
      generatedAt: new Date().toISOString(),
      siteUrl: runtime.SITE_URL?.trim().replace(/\/+$/, "") || new URL(request.url).origin,
      serviceArea: "Montgomery County, Maryland",
      customerServiceFeePercent: CUSTOMER_SERVICE_FEE_PERCENT,
      ownerAccessProtected: true,
      emailDeliveryConfigured: Boolean(runtime.RESEND_API_KEY?.trim() && fromEmail),
      emailSenderDomain: senderDomain(fromEmail),
      stripeConfigured: Boolean(stripeKey),
      stripeMode,
      livePaymentsEnabled: stripeMode === "live",
      sessionProtection: "Server-side sessions with Secure, HttpOnly, SameSite=Lax cookies",
      policyVersions: {
        terms: TERMS_VERSION,
        customer: CUSTOMER_AGREEMENT_VERSION,
        provider: PROVIDER_AGREEMENT_VERSION,
        privacy: PRIVACY_VERSION,
        payments: PAYMENT_POLICY_VERSION,
      },
    };

    return Response.json(
      { users, platform },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    console.error("Unable to load the signed owner control center", error);
    return Response.json(
      { error: "Unable to load account management." },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
}
