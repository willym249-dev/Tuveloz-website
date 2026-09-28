import { env } from "cloudflare:workers";
import type { RecipientAccountStatus } from "./stripe";
import { stripeAccountNeedsAttention } from "./stripe-account-attention";

/** Persist the notice before acknowledging Stripe, so storage failures retry.
 * Test events and test providers never create real account notices or mail.
 * Only current API status is used; event payloads never supply the recipient.
 */
export async function queueStripeAccountAttention(input: {
  eventId: string;
  livemode: boolean;
  status: RecipientAccountStatus;
}) {
  const runtime = env as unknown as Record<string, string | undefined>;
  if (runtime.APP_ENVIRONMENT === "staging" || !input.livemode
    || !input.status.livemode || !stripeAccountNeedsAttention(input.status)) return;

  const { results } = await env.DB.prepare(
    `SELECT id, email, preferred_language FROM provider_applications
     WHERE stripe_account_id = ? AND is_test_provider = 'no' LIMIT 2`,
  ).bind(input.status.accountId).all<{
    id: string; email: string; preferred_language: string;
  }>();
  if (!results.length) return;
  if (results.length !== 1) throw new Error("Stripe account has ambiguous provider ownership.");
  const provider = results[0];
  const email = provider.email.trim().toLowerCase();
  if (!email) throw new Error("Stripe account notice has no provider recipient.");

  const spanish = provider.preferred_language === "Spanish";
  const title = spanish ? "Revisa tu cuenta de Stripe" : "Review your Stripe account";
  const body = spanish
    ? "Stripe actualizó tu cuenta de pagos. Inicia sesión para revisar los requisitos actuales y continuar con Stripe si necesitas enviar más información."
    : "Stripe updated your payment account. Sign in to review the current requirements and continue with Stripe if more information is needed.";
  const href = "/provider-jobs#stripe-payouts";
  const siteUrl = (runtime.SITE_URL || "https://tuveloz.com").replace(/\/+$/, "");
  const lines = [body, "", `${siteUrl}${href}`, "", spanish
    ? "No envíes documentos de identidad ni datos bancarios por correo. Usa el formulario seguro de Stripe."
    : "Use Stripe's secure form for identity documents and bank details. Do not send them by email."];
  const eventKey = `provider-compliance:stripe-account:${input.eventId}:${provider.id}`;
  const now = new Date().toISOString();

  // Recheck ownership inside the atomic writes. A reassigned or removed
  // account must not notify the previous provider. Event keys deduplicate
  // retries even if the Worker stops after this batch but before its receipt.
  const ownership = `FROM provider_applications WHERE id = ?
    AND stripe_account_id = ? AND lower(trim(email)) = ? AND is_test_provider = 'no'`;
  await env.DB.batch([
    env.DB.prepare(`INSERT OR IGNORE INTO account_notifications
      (id, event_key, email, role, title, body, href, created_at)
      SELECT ?, ?, ?, 'provider', ?, ?, ?, ? ${ownership}`)
      .bind(crypto.randomUUID(), eventKey, email, title, body, href, now,
        provider.id, input.status.accountId, email),
    env.DB.prepare(`INSERT OR IGNORE INTO email_notification_outbox
      (id, event_key, recipient_email, subject, text_body, status, attempts,
       last_error, created_at, updated_at, sent_at)
      SELECT ?, ?, ?, ?, ?, 'pending', 0, '', ?, ?, '' ${ownership}`)
      .bind(crypto.randomUUID(), `marketplace:${eventKey}`, email,
        `Tuveloz: ${title}`, lines.join("\n"), now, now,
        provider.id, input.status.accountId, email),
  ]);
  // The existing outbox worker handles delivery, retries and failure alerts.
}
