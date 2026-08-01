import { env } from "cloudflare:workers";
import { sendMarketplaceUpdateEmail } from "./email-notifications";
import { notifyMarketplaceAccount } from "./marketplace-notifications";

type RuntimeEnv = Record<string, string | undefined>;

function runtimeEnv() {
  return env as unknown as RuntimeEnv;
}

function siteUrl() {
  return (runtimeEnv().SITE_URL ?? "https://tuveloz.com").replace(/\/+$/, "");
}

function ownerEmail() {
  return (runtimeEnv().OWNER_EMAIL ?? "").trim().toLowerCase();
}

async function safelyNotify(label: string, actions: Array<Promise<unknown>>) {
  const results = await Promise.allSettled(actions);
  for (const result of results) {
    if (result.status === "rejected") {
      console.error(`Unable to send ${label} notification`, result.reason);
    }
  }
}

function ownerAlert(input: {
  eventKey: string;
  subject: string;
  recordLabel: string;
  recordId: string;
  href: string;
}) {
  const recipientEmail = ownerEmail();
  if (!recipientEmail) return Promise.resolve();
  return sendMarketplaceUpdateEmail({
    eventKey: input.eventKey,
    recipientEmail,
    subject: input.subject,
    lines: [
      `${input.recordLabel} is ready in the protected TUVELOZ owner workspace.`,
      `Record ID: ${input.recordId}`,
      "",
      "For privacy, applicant and evidence details are not included in this email.",
      `${siteUrl()}${input.href}`,
    ],
  });
}

export async function notifyProviderApplicationReceived(input: {
  providerId: string;
  email: string;
}) {
  await safelyNotify("provider application", [
    notifyMarketplaceAccount({
      eventKey: `provider-onboarding:application-received:${input.providerId}`,
      email: input.email,
      role: "provider",
      title: "Provider application received",
      body: "TUVELOZ received your provider application for onboarding review. Applying does not activate services or create employment, jobs, or payment access. Sign in to complete the exact-service checklist.",
      href: "/provider-onboarding",
      emailSubject: "TUVELOZ provider application received",
      emailLines: [
        "TUVELOZ received your provider application for onboarding review.",
        "Applying does not activate services or create employment, jobs, or payment access.",
        `Continue securely: ${siteUrl()}/provider-onboarding`,
      ],
    }),
    ownerAlert({
      eventKey: `provider-onboarding:owner:application:${input.providerId}`,
      subject: "New TUVELOZ provider application",
      recordLabel: "A provider application",
      recordId: input.providerId,
      href: "/admin/provider-compliance",
    }),
  ]);
}

export async function notifyProviderEvidenceReceived(input: {
  providerId: string;
  evidenceId: string;
  email: string;
}) {
  await safelyNotify("provider evidence receipt", [
    notifyMarketplaceAccount({
      eventKey: `provider-evidence:received:${input.evidenceId}`,
      email: input.email,
      role: "provider",
      title: "Evidence received in private quarantine",
      body: "Your evidence was received. It remains blocked while the external malware scan and separate record review are pending; uploading it does not activate any service.",
      href: "/provider-onboarding",
      emailSubject: "TUVELOZ evidence received",
      emailLines: [
        "Your evidence was received in private quarantine.",
        "It remains blocked until the external malware scan is clean and TUVELOZ separately reviews the record.",
        `Check status securely: ${siteUrl()}/provider-onboarding`,
      ],
    }),
    ownerAlert({
      eventKey: `provider-evidence:owner:received:${input.evidenceId}`,
      subject: "TUVELOZ provider evidence received",
      recordLabel: "A provider evidence submission",
      recordId: input.evidenceId,
      href: "/admin/provider-compliance",
    }),
  ]);
}

export async function notifyProviderEvidenceDecision(input: {
  evidenceId: string;
  email: string;
  status: string;
}) {
  const statusLabel = input.status === "accepted"
    ? "accepted for its stated evidence scope"
    : input.status === "needs_correction"
      ? "needs correction"
      : "was not accepted";
  await safelyNotify("provider evidence decision", [
    notifyMarketplaceAccount({
      eventKey: `provider-compliance:evidence-decision:${input.evidenceId}:${input.status}`,
      email: input.email,
      role: "provider",
      title: `Evidence ${statusLabel}`,
      body: `The evidence review is complete and ${statusLabel}. This decision applies only to the listed record and exact service; it is not blanket provider approval. Sign in for the reason and next step.`,
      href: "/provider-onboarding",
      emailSubject: "TUVELOZ evidence review update",
      emailLines: [
        `Your evidence ${statusLabel}.`,
        "The decision applies only to that record and exact service; it is not blanket provider approval.",
        `Review the protected details: ${siteUrl()}/provider-onboarding`,
      ],
    }),
  ]);
}

export async function notifyProviderAppealReceived(input: {
  appealId: string;
  email: string;
}) {
  await safelyNotify("provider appeal", [
    notifyMarketplaceAccount({
      eventKey: `provider-compliance:appeal-received:${input.appealId}`,
      email: input.email,
      role: "provider",
      title: "Evidence appeal received",
      body: "TUVELOZ received your appeal. The affected service remains blocked during review. Sign in to track the protected record.",
      href: "/provider-onboarding",
      emailSubject: "TUVELOZ appeal received",
      emailLines: [
        "TUVELOZ received your evidence appeal.",
        "The affected service remains blocked while the appeal is reviewed.",
        `Track it securely: ${siteUrl()}/provider-onboarding`,
      ],
    }),
    ownerAlert({
      eventKey: `provider-compliance:owner:appeal:${input.appealId}`,
      subject: "TUVELOZ provider appeal received",
      recordLabel: "A provider evidence appeal",
      recordId: input.appealId,
      href: "/admin/provider-compliance",
    }),
  ]);
}

export async function notifyProviderPrivacyRequestReceived(input: {
  requestId: string;
  email: string;
}) {
  await safelyNotify("provider privacy request", [
    notifyMarketplaceAccount({
      eventKey: `privacy:provider-request-received:${input.requestId}`,
      email: input.email,
      role: "provider",
      title: "Privacy request received",
      body: "TUVELOZ received your privacy request. Identity, scope, lawful retention, and any legal hold must be reviewed before completion.",
      href: "/provider-onboarding",
      emailSubject: "TUVELOZ privacy request received",
      emailLines: [
        "TUVELOZ received your privacy request.",
        "We will verify identity and scope and apply lawful retention or legal-hold limits before completion.",
        `Track it securely: ${siteUrl()}/provider-onboarding`,
      ],
    }),
    ownerAlert({
      eventKey: `privacy:owner:provider-request:${input.requestId}`,
      subject: "TUVELOZ provider privacy request received",
      recordLabel: "A provider privacy request",
      recordId: input.requestId,
      href: "/admin/privacy",
    }),
  ]);
}
