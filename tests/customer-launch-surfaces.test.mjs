import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("customer transaction entry pages choose closed launch views before live components", async () => {
  const [storefront, appointments, providerActions] = await Promise.all([
    source("app/storefront/page.tsx"),
    source("app/appointments/page.tsx"),
    source("app/components/provider-public-actions.tsx"),
  ]);

  assert.match(storefront, /CUSTOMER_JOB_POSTING_PAUSED[\s\S]*StorefrontClosedPage/);
  assert.match(storefront, /Customer payments are not open yet/);
  assert.ok(
    storefront.lastIndexOf("CUSTOMER_JOB_POSTING_PAUSED")
      < storefront.lastIndexOf("<LiveStripeStorefrontPage />"),
  );

  assert.match(appointments, /CUSTOMER_JOB_POSTING_PAUSED[\s\S]*AppointmentsClosedPage/);
  assert.match(appointments, /Appointments are not open yet/);
  assert.ok(
    appointments.lastIndexOf("CUSTOMER_JOB_POSTING_PAUSED")
      < appointments.lastIndexOf("<LiveAppointmentsPage />"),
  );

  assert.match(providerActions, /CUSTOMER_JOB_POSTING_PAUSED[\s\S]*ProviderPublicClosedActions/);
  assert.match(providerActions, /Requests and appointments are not open yet/);
  assert.ok(
    providerActions.lastIndexOf("CUSTOMER_JOB_POSTING_PAUSED")
      < providerActions.lastIndexOf("<LiveProviderPublicActions pathname={pathname} />"),
  );
});

test("payment widgets do not contact Stripe while customer payments are closed", async () => {
  const [methods, quotePayment, connect, success] = await Promise.all([
    source("app/components/customer-payment-methods.tsx"),
    source("app/components/quote-payment-card.tsx"),
    source("app/components/stripe-connect-panel.tsx"),
    source("app/success/page.tsx"),
  ]);

  assert.ok(
    methods.indexOf("if (CUSTOMER_JOB_POSTING_PAUSED)")
      < methods.indexOf("return <ActiveCustomerPaymentMethods />"),
  );
  assert.match(methods, /Payment setup is closed/);

  assert.ok(
    quotePayment.indexOf("if (CUSTOMER_JOB_POSTING_PAUSED)")
      < quotePayment.indexOf("return <ActiveQuotePaymentCard {...props} />"),
  );
  assert.match(quotePayment, /This panel does not contact Stripe or create a payment/);

  assert.match(connect, /readyToReceivePayments && CUSTOMER_JOB_POSTING_PAUSED/);
  assert.match(connect, /readyToReceivePayments && !CUSTOMER_JOB_POSTING_PAUSED/);
  assert.match(connect, /Storefront offerings open after customer launch/);
  assert.doesNotMatch(connect, /href="\/storefront"/);

  assert.match(success, /if \(sessionId\) setChecking\(true\)/);
  assert.match(success, /Customer payments are not open yet/);
  assert.doesNotMatch(success, /payment is being confirmed/);
  assert.doesNotMatch(success, /href="\/storefront"/);
});

test("account and private-request surfaces describe launch mode without active-job claims", async () => {
  const [account, welcome, customer, request, homepage, howItWorks, providerProfile] = await Promise.all([
    source("app/account/page.tsx"),
    source("app/welcome/page.tsx"),
    source("app/customer/page.tsx"),
    source("app/my-request/page.tsx"),
    source("app/page.tsx"),
    source("app/how-it-works/page.tsx"),
    source("app/providers/[slug]/provider-storefront-client.tsx"),
  ]);

  assert.match(account, /New job requests and payments are not open yet/);
  assert.doesNotMatch(account, /Use the same email address you entered when posting a job/);
  assert.match(welcome, /Your customer account is ready/);
  assert.doesNotMatch(welcome, />Post a vehicle-service request</);
  assert.match(customer, /<h1>Your customer account\.<\/h1>/);
  assert.match(customer, /After customer launch, your vehicle-service requests will appear here/);
  assert.match(request, /CUSTOMER_JOB_POSTING_PAUSED && !job\?\.isTestJob/);
  assert.match(request, /No live customer request was opened/);
  assert.doesNotMatch(homepage, /href="\/storefront"/);
  assert.match(account, /className="button secondary" href="\/join"/);
  assert.doesNotMatch(account, /href="\/#providers"/);
  assert.match(providerProfile, /className="button primary" href="\/post-job"/);
  assert.doesNotMatch(providerProfile, /href="\/#request"/);
  assert.match(howItWorks, /After launch: request an available service/);
  assert.match(howItWorks, /After launch: compare quotes/);
  assert.match(howItWorks, /After launch: choose and track/);
});

test("public discovery and bilingual launch copy stay aligned with onboarding-only mode", async () => {
  const [sitemap, language] = await Promise.all([
    source("app/sitemap.ts"),
    source("app/components/site-language.tsx"),
  ]);

  assert.doesNotMatch(sitemap, /\/storefront/);
  for (const phrase of [
    "Customer accounts are open. Job requests are not.",
    "Payment setup is closed",
    "Appointments are not open yet.",
    "Customer payments are not open yet.",
    "Customer requests and quote decisions are not open yet.",
  ]) {
    assert.match(language, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});
