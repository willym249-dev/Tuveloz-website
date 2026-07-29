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
      paymentOwners,
    ] = await Promise.all([
      db.select({ email: customerRequests.email })
        .from(customerRequests)
        .limit(2000),
      db.select({
        id: providerApplications.id,
        email: providerApplications.email,
        status: providerApplications.status,
        verificationStatus: providerApplications.verificationStatus,
        isTestProvider: providerApplications.isTestProvider,
      }).from(providerApplications)
        .limit(1000),
      db.select({ providerEmail: providerQuotes.providerEmail })
        .from(providerQuotes)
        .limit(5000),
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
      }).from(customerProfiles)
        .limit(1000),
      db.select({
        id: stripePayments.id,
        customerEmail: stripePayments.customerEmail,
        providerApplicationId: stripePayments.providerApplicationId,
      }).from(stripePayments)
        .orderBy(desc(stripePayments.createdAt))
        .limit(2000),
    ]);

    const requestCounts = new Map<string, number>();
    for (const item of requests) increment(requestCounts, item.email);

    const quoteCounts = new Map<string, number>();
    for (const quote of quotes) increment(quoteCounts, quote.providerEmail);

    const profileByEmail = new Map(
      profiles.map((profile) => [normalizedEmail(profile.email), profile]),
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
      return {
        email,
        displayName: profileByEmail.get(email)?.displayName ?? "",
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
        requestCount: requestCounts.get(email) ?? 0,
        providerQuoteCount: quoteCounts.get(email) ?? 0,
        paymentCount: paymentIdsByEmail.get(email)?.size ?? 0,
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
