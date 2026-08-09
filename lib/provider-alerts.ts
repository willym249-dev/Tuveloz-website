import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { getDb } from "../db";
import { customerRequests, providerApplications, providerQuotes } from "../db/schema";
import {
  effectiveProviderServices,
  parseCustomerServiceLocations,
  providerMatchesArea,
  providerMatchesJob,
  providerMatchesServiceLocation,
} from "./service-matching";
import {
  marketplacePausedMessage,
} from "./launch-status";
import { runtimeMarketplaceActionAllowed } from "./runtime-marketplace-action";
import { resendEmailsUrl } from "./resend-endpoint";

type AlertResult = {
  configured: boolean;
  attempted: number;
  sent: number;
  failures: string[];
};

type AcceptedAlertResult = {
  configured: boolean;
  sent: boolean;
  failure?: string;
};

function siteUrl() {
  const runtimeEnv = env as unknown as Record<string, string | undefined>;
  return runtimeEnv.SITE_URL?.replace(/\/+$/, "") || "https://tuveloz.com";
}

export async function sendMatchingProviderAlerts(requestId: string): Promise<AlertResult> {
  return sendProviderJobAlert(requestId, "new");
}

export async function sendMatchingProviderReminder(requestId: string): Promise<AlertResult> {
  return sendProviderJobAlert(requestId, "reminder");
}

async function sendProviderJobAlert(
  requestId: string,
  alertKind: "new" | "reminder",
): Promise<AlertResult> {
  const db = getDb();
  const [job] = await db.select().from(customerRequests)
    .where(eq(customerRequests.id, requestId)).limit(1);
  if (!job || job.status !== "approved") {
    return { configured: true, attempted: 0, sent: 0, failures: [] };
  }
  if (!(await runtimeMarketplaceActionAllowed("discovery", { testOnly: job.isTestJob === "yes" }))) {
    return {
      configured: true,
      attempted: 0,
      sent: 0,
      failures: [marketplacePausedMessage("discovery")],
    };
  }
  if (job.isTestJob === "yes") {
    return { configured: true, attempted: 0, sent: 0, failures: [] };
  }

  const runtimeEnv = env as unknown as Record<string, string | undefined>;
  const apiKey = runtimeEnv.RESEND_API_KEY;
  const from = runtimeEnv.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    return { configured: false, attempted: 0, sent: 0, failures: [] };
  }

  const approvedProviders = await db.select().from(providerApplications)
    .where(and(
      eq(providerApplications.status, "approved"),
      eq(providerApplications.verificationStatus, "verified"),
      eq(providerApplications.isTestProvider, "no"),
      eq(providerApplications.alertsEnabled, "yes"),
    ));
  const matches = approvedProviders.filter((provider) => (
    provider.accessToken
    && (!job.preferredProviderEmail || provider.email === job.preferredProviderEmail)
    && providerMatchesJob(
      effectiveProviderServices(provider.service, provider.approvedServices, provider.isTestProvider),
      job.service,
    )
    && providerMatchesArea(provider.serviceArea, job.launchArea || job.zip)
    && providerMatchesServiceLocation(provider.workLocations, job.serviceLocations)
  ));

  const results = await Promise.all(matches.map(async (provider) => {
    const workspaceUrl = `${siteUrl()}/account?role=provider`;
    const response = await fetch(resendEmailsUrl(runtimeEnv().RESEND_BASE_URL), {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [provider.email],
        subject: alertKind === "reminder"
          ? job.preferredProviderEmail
            ? `Reminder: a Tuveloz customer requested you again`
            : `Reminder: open Tuveloz ${job.service} request`
          : job.preferredProviderEmail
            ? `A Tuveloz customer requested you again`
            : `New Tuveloz ${job.service} request`,
        text: [
          `Hello ${provider.name},`,
          "",
          alertKind === "reminder"
            ? job.preferredProviderEmail
              ? `A repeat customer request for ${job.service} on ${job.vehicle} is still waiting for your quote.`
              : `This ${job.service} request for ${job.vehicle} is still open and has not received a quote yet.`
            : job.preferredProviderEmail
              ? `A customer who previously completed a Tuveloz job with you requested you again for ${job.service} on ${job.vehicle}.`
              : `A new ${job.service} request for ${job.vehicle} is available in ${job.launchArea || `ZIP ${job.zip.slice(0, 5)}`}.`,
          alertKind === "reminder"
            ? `If you are available in ${job.launchArea || `ZIP ${job.zip.slice(0, 5)}`}, review the request and submit your price.`
            : "",
          `Service-location options: ${parseCustomerServiceLocations(job.serviceLocations).join(" or ")}.`,
          "",
          "Review the request and submit a quote through your private provider workspace:",
          workspaceUrl,
          "",
          "Customer contact details and the exact location remain private until a quote is selected.",
          "",
          job.preferredProviderEmail
            ? "You are receiving this because the customer selected the repeat-booking option and the request still matches your approved service, job area, and meeting settings."
            : "You are receiving this because the job matches your approved service, job area, and meeting settings.",
        ].filter(Boolean).join("\n"),
      }),
    });
    if (response.ok) return { ok: true, status: response.status };

    const responseBody = await response.text();
    console.error("Resend rejected a provider alert", {
      status: response.status,
      responseBody,
    });
    return { ok: false, status: response.status };
  }));

  return {
    configured: true,
    attempted: matches.length,
    sent: results.filter((result) => result.ok).length,
    failures: results
      .filter((result) => !result.ok)
      .map((result) => `Email service rejected the alert (HTTP ${result.status}).`),
  };
}

export async function sendAcceptedQuoteAlert(
  requestId: string,
  quoteId: string,
): Promise<AcceptedAlertResult> {
  const db = getDb();
  const [job] = await db.select().from(customerRequests)
    .where(eq(customerRequests.id, requestId)).limit(1);
  const [quote] = await db.select().from(providerQuotes)
    .where(and(
      eq(providerQuotes.id, quoteId),
      eq(providerQuotes.requestId, requestId),
      eq(providerQuotes.status, "accepted"),
    )).limit(1);
  if (!job || !quote) {
    return { configured: true, sent: false, failure: "Accepted job details were not found." };
  }
  if (!(await runtimeMarketplaceActionAllowed("booking", { testOnly: job.isTestJob === "yes" }))) {
    return {
      configured: true,
      sent: false,
      failure: marketplacePausedMessage("booking"),
    };
  }
  if (job.isTestJob === "yes") {
    return { configured: true, sent: false };
  }

  const runtimeEnv = env as unknown as Record<string, string | undefined>;
  const apiKey = runtimeEnv.RESEND_API_KEY;
  const from = runtimeEnv.RESEND_FROM_EMAIL;
  if (!apiKey || !from) return { configured: false, sent: false };

  const [provider] = await db.select().from(providerApplications)
    .where(and(
      eq(providerApplications.email, quote.providerEmail),
      eq(providerApplications.status, "approved"),
      eq(providerApplications.verificationStatus, "verified"),
      eq(providerApplications.isTestProvider, "no"),
    )).limit(1);
  if (!provider?.accessToken) {
    return { configured: true, sent: false, failure: "The selected provider has no active private workspace." };
  }

  const workspaceUrl = `${siteUrl()}/account?role=provider`;
  const response = await fetch(resendEmailsUrl(runtimeEnv().RESEND_BASE_URL), {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [quote.providerEmail],
      subject: `Your Tuveloz quote was accepted`,
      text: [
        `Hello ${quote.providerName},`,
        "",
        `Your $${(Number(quote.priceCents) / 100).toFixed(2)} quote for the ${job.service} request (${job.vehicle}) was accepted.`,
        "",
        "Open your private provider workspace to view the customer's contact information and update the job status:",
        workspaceUrl,
        "",
        "For account security, keep every sign-in code private.",
      ].join("\n"),
    }),
  });

  if (response.ok) return { configured: true, sent: true };

  console.error("Resend rejected an accepted-quote alert", {
    status: response.status,
    responseBody: await response.text(),
  });
  return {
    configured: true,
    sent: false,
    failure: `Email service rejected the alert (HTTP ${response.status}).`,
  };
}
