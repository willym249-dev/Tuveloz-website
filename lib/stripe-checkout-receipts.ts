import type Stripe from "stripe";
import type { PaymentLanguage } from "./payment-merchant";
import { StripeConfigurationError } from "./stripe";
import { runtimeMarketplaceActionAllowed } from "./runtime-marketplace-action";

async function requirePaymentSetup() {
  if (!(await runtimeMarketplaceActionAllowed("checkout"))) {
    throw new StripeConfigurationError(
      "Customer payment setup is disabled until every runtime launch-readiness gate is current.",
    );
  }
}

// Checkout.locale controls the form; Customer.preferred_locales controls
// Stripe-generated emails/PDFs. Prepare it before opening the payment session.
// https://docs.stripe.com/billing/customer#localization
export async function prepareCheckoutReceiptCustomer(
  stripeClient: Stripe,
  input: {
    accountCustomerId: string;
    customerEmail: string;
    paymentId: string;
    language: PaymentLanguage;
  },
) {
  if (input.language !== "en" && input.language !== "es") {
    throw new Error("A supported receipt language is required.");
  }
  let customerId = input.accountCustomerId;
  if (!customerId) {
    // A valid request token is not an account sign-in. Give this payment its
    // own Customer rather than looking up saved cards by an unverified email.
    // Keep mutable language out of the stable creation payload so a retry can
    // recover the same Customer even if the preference update was interrupted.
    await requirePaymentSetup();
    const customer = await stripeClient.customers.create({
      email: input.customerEmail.trim().toLowerCase(),
      metadata: { tuveloz_payment_record_id: input.paymentId },
    }, { idempotencyKey: `tuveloz-checkout-customer-${input.paymentId}` });
    customerId = customer.id;
  }
  await requirePaymentSetup();
  const updated = await stripeClient.customers.update(customerId, {
    preferred_locales: [input.language],
  });
  if (updated.id !== customerId || updated.preferred_locales?.[0] !== input.language) {
    throw new Error("Stripe did not confirm the requested receipt language.");
  }
  return customerId;
}
