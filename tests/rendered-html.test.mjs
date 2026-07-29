import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

async function builtFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? builtFiles(path) : [path];
  }));
  return nested.flat();
}

test("every recorded database migration is included in the project", async () => {
  const journal = JSON.parse(await readFile(
    new URL("../drizzle/meta/_journal.json", import.meta.url),
    "utf8",
  ));
  await Promise.all(journal.entries.map((entry) => (
    readFile(
      new URL(`../drizzle/${entry.tag}.sql`, import.meta.url),
      "utf8",
    )
  )));
  assert.equal(journal.entries.length, 25);
});

test("build contains separate tint, rain-guard, and sunshade services", async () => {
  const distDirectory = fileURLToPath(new URL("../dist", import.meta.url));
  const files = (await builtFiles(distDirectory))
    .filter((path) => [".js", ".html"].includes(extname(path)));
  const contents = (await Promise.all(files.map((path) => readFile(path, "utf8")))).join("\n");

  assert.ok(contents.includes("Window tint installation quote"));
  assert.ok(contents.includes("Rain guard / vent visor installation"));
  assert.ok(contents.includes("Vehicle sunshade installation"));
});

test("build contains permanent provider QR controls and privacy-safe scan totals", async () => {
  const distDirectory = fileURLToPath(new URL("../dist", import.meta.url));
  const files = (await builtFiles(distDirectory))
    .filter((path) => [".js", ".html"].includes(extname(path)));
  const contents = (await Promise.all(files.map((path) => readFile(path, "utf8")))).join("\n");

  assert.ok(contents.includes("Your permanent provider QR"));
  assert.ok(contents.includes("Total QR scans"));
  assert.ok(contents.includes("no customer or device tracking"));
});

test("build contains editable provider previews and printable QR business cards", async () => {
  const distDirectory = fileURLToPath(new URL("../dist", import.meta.url));
  const files = (await builtFiles(distDirectory))
    .filter((path) => [".js", ".html"].includes(extname(path)));
  const contents = (await Promise.all(files.map((path) => readFile(path, "utf8")))).join("\n");

  assert.ok(contents.includes("Live customer preview"));
  assert.ok(contents.includes("Tuveloz keeps every page clean, consistent, and professional."));
  assert.ok(contents.includes("Printable business cards"));
  assert.ok(contents.includes("Print 10 business cards"));
  assert.ok(contents.includes("provider-card-print-sheet"));
});

test("build clearly explains customer choice and provider freedom", async () => {
  const distDirectory = fileURLToPath(new URL("../dist", import.meta.url));
  const files = (await builtFiles(distDirectory))
    .filter((path) => [".js", ".html"].includes(extname(path)));
  const contents = (await Promise.all(files.map((path) => readFile(path, "utf8")))).join("\n");

  assert.ok(contents.includes("Choice for customers. Freedom for providers."));
  assert.ok(contents.includes("Compare providers and quotes"));
  assert.ok(contents.includes("Use one simple job workspace"));
  assert.ok(contents.includes("Request tools that help you grow"));
  assert.ok(contents.includes("Get approved. Review matching jobs. Run your business your way."));
});

test("build contains a simple, protected quote choice and factual private analytics", async () => {
  const distDirectory = fileURLToPath(new URL("../dist", import.meta.url));
  const files = (await builtFiles(distDirectory))
    .filter((path) => [".js", ".html"].includes(extname(path)));
  const contents = (await Promise.all(files.map((path) => readFile(path, "utf8")))).join("\n");

  assert.ok(contents.includes("Choose provider"));
  assert.ok(contents.includes("Not this one"));
  assert.ok(contents.includes("Confirm this quote?"));
  assert.ok(contents.includes("Confirm quote"));
  assert.ok(contents.includes("Go back"));
  assert.ok(contents.includes("View provider details"));
  assert.ok(contents.includes("Pass without sharing a reason"));
  assert.ok(contents.includes("Private analytics"));
  assert.ok(contents.includes("Accepted among decided quotes"));
  assert.ok(contents.includes("Optional feedback shown only as combined totals"));
});

test("build prefers confirmed vehicle choices and never invents motor data", async () => {
  const distDirectory = fileURLToPath(new URL("../dist", import.meta.url));
  const files = (await builtFiles(distDirectory))
    .filter((path) => [".js", ".html"].includes(extname(path)));
  const contents = (await Promise.all(files.map((path) => readFile(path, "utf8")))).join("\n");
  const vehicleSelectorSource = await readFile(
    new URL("../app/components/vehicle-selector.tsx", import.meta.url),
    "utf8",
  );

  assert.ok(contents.includes("My make is not listed"));
  assert.ok(contents.includes("My model is not listed"));
  assert.ok(contents.includes("Start with the year, make, and model. Use the VIN lookup if needed."));
  assert.ok(vehicleSelectorSource.includes('useState<"search" | "vin">("search")'));
  assert.ok(vehicleSelectorSource.includes("Can&apos;t find your vehicle?"));
  assert.ok(contents.includes("No confirmed motor / engine choice was returned."));
  assert.ok(contents.includes("Tuveloz does not guess motor or engine details."));
  assert.ok(contents.includes("customer entered; provider must verify"));
  assert.ok(contents.includes("Motor/engine not provided"));
  assert.ok(contents.includes("Choose an official option above or type the engine here"));
  assert.ok(contents.includes("This typed value overrides the VIN or official choice"));
  assert.ok(contents.includes("Compare parts before you decide"));
  assert.ok(contents.includes("before choosing whether you or the provider should supply the parts"));
  assert.ok(contents.includes("Any special equipment or rental cost must be disclosed in the quote."));
});

test("build contains global language, optional budget details, repeat booking, and honest price guidance", async () => {
  const distDirectory = fileURLToPath(new URL("../dist", import.meta.url));
  const files = (await builtFiles(distDirectory))
    .filter((path) => [".js", ".html"].includes(extname(path)));
  const contents = (await Promise.all(files.map((path) => readFile(path, "utf8")))).join("\n");

  assert.ok(contents.includes("Change the whole page to English"));
  assert.ok(!contents.includes("About how much is your budget?"));
  assert.ok(contents.includes("Include a budget here only if you want providers to see one."));
  assert.ok(contents.includes("Compare all matching providers instead"));
  assert.ok(contents.includes("Request") && contents.includes("again"));
  assert.ok(contents.includes("Observed Tuveloz price guide"));
  assert.ok(contents.includes("Not enough real completed jobs yet to publish a trustworthy price."));
  assert.ok(contents.includes("at least 3 real, non-test, completed"));
});

test("build itemizes provider-supplied parts separately from labor", async () => {
  const distDirectory = fileURLToPath(new URL("../dist", import.meta.url));
  const files = (await builtFiles(distDirectory))
    .filter((path) => [".js", ".html"].includes(extname(path)));
  const contents = (await Promise.all(files.map((path) => readFile(path, "utf8")))).join("\n");

  assert.ok(contents.includes("If the provider supplies parts, the quote will show separate labor"));
  assert.ok(contents.includes("Labor ($)"));
  assert.ok(contents.includes("Parts price ($)"));
  assert.ok(contents.includes("laborPriceCents"));
  assert.ok(contents.includes("partsPriceCents"));
});

test("build protects every important submission with a second confirmation", async () => {
  const distDirectory = fileURLToPath(new URL("../dist", import.meta.url));
  const files = (await builtFiles(distDirectory))
    .filter((path) => [".js", ".html"].includes(extname(path)));
  const contents = (await Promise.all(files.map((path) => readFile(path, "utf8")))).join("\n");

  assert.ok(contents.includes("Confirm and post"));
  assert.ok(contents.includes("Confirm and apply"));
  assert.ok(contents.includes("Confirm and send"));
  assert.ok(contents.includes("Confirm quote"));
  assert.ok(contents.includes("Yes, submit quote"));
  assert.ok(contents.includes("Yes, update status"));
  assert.ok(contents.includes("Yes, publish review"));
  assert.ok(contents.includes("Confirm and save checklist"));
  assert.ok(contents.includes("Confirm and save record"));
  assert.ok(contents.includes("Confirm and publish"));
  assert.ok(contents.includes("Confirm upload"));
  assert.ok(contents.includes("Confirm removal"));
  assert.ok(contents.includes("Go back"));
});

test("build limits active service to Montgomery County and collects expansion demand", async () => {
  const distDirectory = fileURLToPath(new URL("../dist", import.meta.url));
  const files = (await builtFiles(distDirectory))
    .filter((path) => [".js", ".html"].includes(extname(path)));
  const contents = (await Promise.all(files.map((path) => readFile(path, "utf8")))).join("\n");

  assert.ok(contents.includes("Local vehicle-service marketplace"));
  assert.ok(contents.includes("Operating now in Montgomery County, Maryland"));
  assert.ok(contents.includes("Tuveloz currently operates only in Montgomery County, Maryland."));
  assert.ok(contents.includes("Bring Tuveloz to your area."));
  assert.ok(contents.includes("Request my area"));
  assert.ok(contents.includes("Enter a Montgomery County ZIP code"));
  assert.ok(contents.includes("Expansion demand"));
});

test("build gives mobile mechanics and service-truck operators clear prominence", async () => {
  const distDirectory = fileURLToPath(new URL("../dist", import.meta.url));
  const files = (await builtFiles(distDirectory))
    .filter((path) => [".js", ".html"].includes(extname(path)));
  const contents = (await Promise.all(files.map((path) => readFile(path, "utf8")))).join("\n");

  assert.ok(contents.includes("Mobile mechanics, service-truck operators, and shop-based"));
  assert.ok(contents.includes("Mobile mechanics & service trucks"));
  assert.ok(contents.includes("Mobile mechanic or service truck"));
  assert.ok(contents.includes("mobile mechanic/service-truck interest"));
});

test("layout uses the enlarged drop favicon with a cache-busting filename", async () => {
  const favicon = await readFile(
    new URL("../public/tuveloz-favicon-v2.svg", import.meta.url),
    "utf8",
  );
  const layout = await readFile(
    new URL("../app/layout.tsx", import.meta.url),
    "utf8",
  );

  assert.ok(layout.includes("/tuveloz-favicon-v2.svg"));
  assert.ok(favicon.includes("M16 21.4"));
  assert.ok(favicon.includes("#FF6A00"));
});

test("provider approval requires applicable state and local proof without requesting unnecessary documents", async () => {
  const distDirectory = fileURLToPath(new URL("../dist", import.meta.url));
  const files = (await builtFiles(distDirectory))
    .filter((path) => [".js", ".html"].includes(extname(path)));
  const contents = (await Promise.all(files.map((path) => readFile(path, "utf8")))).join("\n");

  assert.ok(contents.includes("Tuveloz must receive and verify proof before approval"));
  assert.ok(contents.includes("If none applies, no document is needed."));
  assert.ok(contents.includes("repair-registration proof received and verified"));
  assert.ok(contents.includes("cannot be verified until the state and local requirements"));
});

test("build provides secure password sign-in with verified email setup and a code backup", async () => {
  const distDirectory = fileURLToPath(new URL("../dist", import.meta.url));
  const files = (await builtFiles(distDirectory))
    .filter((path) => [".js", ".html"].includes(extname(path)));
  const contents = (await Promise.all(files.map((path) => readFile(path, "utf8")))).join("\n");
  const homeSource = await readFile(
    new URL("../app/page.tsx", import.meta.url),
    "utf8",
  );
  const authSource = await readFile(
    new URL("../lib/account-auth.ts", import.meta.url),
    "utf8",
  );
  const schemaSource = await readFile(
    new URL("../db/schema.ts", import.meta.url),
    "utf8",
  );

  assert.ok(contents.includes("Welcome to Tuveloz."));
  assert.ok(contents.includes("Create account"));
  assert.ok(contents.includes("Forgot password?"));
  assert.ok(contents.includes("Email me a one-time code instead"));
  assert.ok(contents.includes("We know 15 characters can feel long."));
  assert.ok(contents.includes("Verified provider workspace"));
  assert.ok(contents.includes("Customer workspace"));
  assert.ok(contents.includes("Email codes expire in 10 minutes"));
  assert.ok(contents.includes("Save this private link."));
  assert.ok(homeSource.includes("header-sign-in"));
  assert.ok(homeSource.includes('fetch("/api/account"'));
  assert.ok(homeSource.includes('"signed-out"'));
  assert.ok(homeSource.includes('"Customer account"'));
  assert.ok(homeSource.includes('"Provider account"'));
  assert.ok(homeSource.includes('href={accountHref}'));
  assert.ok(homeSource.includes("<Link href={accountHref}>{accountLabel}</Link>"));
  assert.ok(authSource.includes('"Path=/"'));
  assert.ok(authSource.includes('eq(providerApplications.status, "approved")'));
  assert.ok(authSource.includes('eq(providerApplications.verificationStatus, "verified")'));
  assert.ok(authSource.includes('eq(providerApplications.isTestProvider, "no")'));
  assert.ok(authSource.includes('"HttpOnly"'));
  assert.ok(authSource.includes('"SameSite=Lax"'));
  assert.ok(authSource.includes("LOGIN_MAX_ATTEMPTS = 5"));
  assert.ok(authSource.includes("PASSWORD_LOGIN_MAX_ATTEMPTS = 5"));
  assert.ok(authSource.includes("PASSWORD_HASH_ITERATIONS = 100_000"));
  assert.ok(authSource.includes("`password:${password.normalize(\"NFKC\")}`"));
  assert.ok(authSource.includes('"PBKDF2"'));
  assert.ok(authSource.includes('hash: "SHA-256"'));
  assert.ok(authSource.includes("credentialRows.length > 0 || customerRows.length > 0"));
  assert.ok(authSource.includes('role === "customer" || roles.includes(role)'));
  assert.ok(schemaSource.includes('"account_credentials"'));
  assert.ok(schemaSource.includes('"password_verification_codes"'));
  assert.ok(authSource.includes('{ name: "HMAC", hash: "SHA-256" }'));
});

test("build records policy consent and publishes legal, privacy, payment, and security controls", async () => {
  const distDirectory = fileURLToPath(new URL("../dist", import.meta.url));
  const files = (await builtFiles(distDirectory))
    .filter((path) => [".js", ".html"].includes(extname(path)));
  const contents = (await Promise.all(files.map((path) => readFile(path, "utf8")))).join("\n");
  const requestSource = await readFile(
    new URL("../app/api/requests/route.ts", import.meta.url),
    "utf8",
  );
  const providerSource = await readFile(
    new URL("../app/api/providers/route.ts", import.meta.url),
    "utf8",
  );
  const checkoutSource = await readFile(
    new URL("../app/api/stripe/checkout/route.ts", import.meta.url),
    "utf8",
  );
  const termsSource = await readFile(
    new URL("../app/terms/page.tsx", import.meta.url),
    "utf8",
  );
  const workerSource = await readFile(
    new URL("../worker/index.ts", import.meta.url),
    "utf8",
  );

  assert.ok(contents.includes("Terms of Use"));
  assert.ok(contents.includes("Customer Agreement"));
  assert.ok(contents.includes("Provider Agreement"));
  assert.ok(contents.includes("Privacy Policy"));
  assert.ok(contents.includes("Payment, Cancellation, and Refund Policy"));
  assert.ok(contents.includes("I am 18 or older and agree to the"));
  assert.ok(contents.includes("TUVELOZ LLC"));
  assert.ok(contents.includes("merchant of record"));
  assert.ok(contents.includes("does not sell personal information"));
  assert.ok(contents.includes("customer and provider form a separate service agreement"));
  assert.ok(termsSource.includes("do not require private"));
  assert.ok(termsSource.includes("arbitration"));
  assert.ok(contents.includes("If no applicable law requires the credential, Tuveloz does not require one."));
  assert.ok(requestSource.includes("termsAcceptedAt"));
  assert.ok(requestSource.includes("CUSTOMER_POLICY_BUNDLE_VERSION"));
  assert.ok(providerSource.includes("termsAcceptedAt"));
  assert.ok(providerSource.includes("PROVIDER_POLICY_BUNDLE_VERSION"));
  assert.ok(checkoutSource.includes("policyAcceptedAt"));
  assert.ok(checkoutSource.includes("CHECKOUT_POLICY_BUNDLE_VERSION"));
  assert.ok(workerSource.includes("Content-Security-Policy"));
  assert.ok(workerSource.includes("Strict-Transport-Security"));
  assert.ok(workerSource.includes("X-Content-Type-Options"));
  assert.ok(workerSource.includes("private, no-store"));
});

test("customer and provider pages keep role-specific actions separate", async () => {
  const customerSource = await readFile(
    new URL("../app/customer/page.tsx", import.meta.url),
    "utf8",
  );
  const providerSource = await readFile(
    new URL("../app/provider-jobs/page.tsx", import.meta.url),
    "utf8",
  );
  const accountApiSource = await readFile(
    new URL("../app/api/account/route.ts", import.meta.url),
    "utf8",
  );
  const customerQuotesSource = await readFile(
    new URL("../app/api/customer-quotes/route.ts", import.meta.url),
    "utf8",
  );
  const providerAlertsSource = await readFile(
    new URL("../lib/provider-alerts.ts", import.meta.url),
    "utf8",
  );

  assert.ok(customerSource.includes("Post a job"));
  assert.ok(customerSource.includes("My jobs"));
  assert.ok(customerSource.includes("How customer privacy works"));
  assert.ok(customerSource.includes("workspace-tools"));
  assert.ok(customerSource.includes("/my-request?request="));
  assert.ok(!customerSource.includes("/my-request?token="));
  assert.ok(!customerSource.includes("Submit quote"));
  assert.ok(!customerSource.includes("Open Jobs"));
  assert.ok(!customerSource.includes("Provider sign in"));
  assert.ok(providerSource.includes("Yes, submit quote"));
  assert.ok(providerSource.includes("Open jobs"));
  assert.ok(providerSource.includes("Payments and business page"));
  assert.ok(providerSource.includes("History and private totals"));
  assert.ok(providerSource.includes("provider-dashboard-nav"));
  assert.ok(providerSource.includes("Available jobs"));
  assert.ok(providerSource.includes("Business profile"));
  assert.ok(customerSource.includes("customer-workspace-nav"));
  assert.ok(customerSource.includes("Quotes received"));
  assert.ok(!providerSource.includes("Post a job"));
  assert.ok(!providerSource.includes("My jobs"));
  assert.ok(accountApiSource.includes('if (session.role === "customer")'));
  assert.ok(accountApiSource.includes('role: "provider"'));
  assert.ok(customerQuotesSource.includes("eq(customerRequests.email, session.email)"));
  assert.ok(providerAlertsSource.includes("/account?role=provider"));
  assert.ok(!providerAlertsSource.includes("/provider-jobs?token="));
});

test("build itemizes and snapshots the 10 percent customer service fee", async () => {
  const distDirectory = fileURLToPath(new URL("../dist", import.meta.url));
  const files = (await builtFiles(distDirectory))
    .filter((path) => [".js", ".html"].includes(extname(path)));
  const contents = (await Promise.all(files.map((path) => readFile(path, "utf8")))).join("\n");
  const feeSource = await readFile(
    new URL("../lib/customer-fee.ts", import.meta.url),
    "utf8",
  );
  const migration = await readFile(
    new URL("../drizzle/0020_kind_rick_jones.sql", import.meta.url),
    "utf8",
  );

  assert.ok(contents.includes("Provider quote subtotal"));
  assert.ok(contents.includes("Tuveloz service fee (10%)"));
  assert.ok(contents.includes("Customer total"));
  assert.ok(contents.includes("Your provider quote remains your full subtotal."));
  assert.ok(contents.includes("A 10% customer service fee is shown before you confirm"));
  assert.ok(contents.includes("Accepted service fees"));
  assert.ok(feeSource.includes("CUSTOMER_SERVICE_FEE_RATE_BPS = 1000"));
  assert.ok(feeSource.includes("Math.round((safeQuoteCents * safeRateBps) / 10_000)"));
  assert.ok(migration.includes("customer_fee_rate_bps"));
  assert.ok(migration.includes("customer_fee_cents"));
  assert.ok(migration.includes("customer_total_cents"));
  assert.ok(migration.includes("CREATE TABLE `login_codes`"));
  assert.ok(migration.includes("CREATE TABLE `auth_sessions`"));
});

test("build groups the expanded service catalog and shows automatic provider modes", async () => {
  const distDirectory = fileURLToPath(new URL("../dist", import.meta.url));
  const files = (await builtFiles(distDirectory))
    .filter((path) => [".js", ".html"].includes(extname(path)));
  const contents = (await Promise.all(files.map((path) => readFile(path, "utf8")))).join("\n");
  const matchingSource = await readFile(
    new URL("../lib/service-matching.ts", import.meta.url),
    "utf8",
  );
  const complianceSource = await readFile(
    new URL("../lib/provider-compliance.ts", import.meta.url),
    "utf8",
  );

  assert.ok(contents.includes("Mobile services"));
  assert.ok(contents.includes("Shop services"));
  assert.ok(contents.includes("Specialty services"));
  assert.ok(contents.includes("Mobile mechanic"));
  assert.ok(contents.includes("Auto repair"));
  assert.ok(contents.includes("Pre-purchase inspection"));
  assert.ok(contents.includes("Hybrid or EV service"));
  assert.ok(contents.includes("Classic car restoration"));
  assert.ok(contents.includes("Profile badge"));
  assert.ok(matchingSource.includes('export type ProviderMode = "Mobile" | "Shop" | "Both"'));
  assert.ok(matchingSource.includes('if (mobile && shop) return "Both"'));
  assert.ok(complianceSource.includes("Require a credential only if an applicable law requires it."));
});

test("Stripe Connect uses a single SDK client, V2 recipient accounts, and direct status checks", async () => {
  const stripeSource = await readFile(
    new URL("../lib/stripe.ts", import.meta.url),
    "utf8",
  );
  const providerSource = await readFile(
    new URL("../lib/stripe-provider.ts", import.meta.url),
    "utf8",
  );
  const connectWebhookSource = await readFile(
    new URL("../app/api/stripe/webhooks/connect/route.ts", import.meta.url),
    "utf8",
  );
  const packageJson = JSON.parse(await readFile(
    new URL("../package.json", import.meta.url),
    "utf8",
  ));

  const accountCreateStart = providerSource.indexOf(
    "stripeClient.v2.core.accounts.create",
  );
  const accountCreateEnd = providerSource.indexOf(
    "idempotencyKey:",
    accountCreateStart,
  );
  const accountCreateSource = providerSource.slice(
    accountCreateStart,
    accountCreateEnd,
  );

  assert.equal(packageJson.dependencies.stripe, "^22.3.2");
  assert.ok(stripeSource.includes("return new Stripe(secretKey"));
  assert.ok(!stripeSource.includes("apiVersion:"));
  assert.ok(stripeSource.includes('secretKey.startsWith("sk_live_")'));
  assert.ok(stripeSource.includes("STRIPE_ALLOW_LIVE_MODE"));
  assert.ok(accountCreateStart > -1);
  assert.ok(accountCreateEnd > accountCreateStart);
  assert.ok(accountCreateSource.includes('dashboard: "express"'));
  assert.ok(accountCreateSource.includes('fees_collector: "application"'));
  assert.ok(accountCreateSource.includes('losses_collector: "application"'));
  assert.ok(accountCreateSource.includes("stripe_transfers"));
  assert.ok(!/\btype\s*:/.test(accountCreateSource));
  assert.ok(providerSource.includes("stripeClient.v2.core.accountLinks.create"));
  assert.ok(providerSource.includes('configurations: ["recipient"]'));
  assert.ok(stripeSource.includes("stripeClient.v2.core.accounts.retrieve"));
  assert.ok(stripeSource.includes('include: ["configuration.recipient", "requirements"]'));
  assert.ok(connectWebhookSource.includes("parseEventNotificationAsync"));
  assert.ok(connectWebhookSource.includes("stripeClient.v2.core.events.retrieve"));
  assert.ok(connectWebhookSource.includes("v2.core.account[requirements].updated"));
  assert.ok(connectWebhookSource.includes(
    "v2.core.account[configuration.recipient].capability_status_updated",
  ));
});

test("Stripe storefront and job payments preserve server-calculated marketplace settlement rules", async () => {
  const distDirectory = fileURLToPath(new URL("../dist", import.meta.url));
  const files = (await builtFiles(distDirectory))
    .filter((path) => [".js", ".html"].includes(extname(path)));
  const contents = (await Promise.all(
    files.map((path) => readFile(path, "utf8")),
  )).join("\n");
  const productsSource = await readFile(
    new URL("../app/api/stripe/products/route.ts", import.meta.url),
    "utf8",
  );
  const checkoutSource = await readFile(
    new URL("../app/api/stripe/checkout/route.ts", import.meta.url),
    "utf8",
  );
  const releaseSource = await readFile(
    new URL("../app/api/stripe/admin/payments/route.ts", import.meta.url),
    "utf8",
  );
  const migration = await readFile(
    new URL("../drizzle/0021_romantic_pepper_potts.sql", import.meta.url),
    "utf8",
  );

  assert.ok(contents.includes("Connected accounts"));
  assert.ok(contents.includes("Available offerings"));
  assert.ok(contents.includes("Onboard to collect payments"));
  assert.ok(contents.includes("Create a storefront offering"));
  assert.ok(productsSource.includes("stripeClient.products.create"));
  assert.ok(productsSource.includes("default_price_data"));
  assert.ok(productsSource.includes("tuveloz_connected_account_id"));
  assert.ok(!productsSource.includes("stripeAccount:"));
  assert.ok(checkoutSource.includes("stripeClient.checkout.sessions.create"));
  assert.ok(checkoutSource.includes("application_fee_amount: applicationFeeCents"));
  assert.ok(checkoutSource.includes("transfer_data:"));
  assert.ok(checkoutSource.includes('settlementStrategy = "separate_transfer"'));
  assert.ok(checkoutSource.includes("Price and destination data"));
  assert.ok(releaseSource.includes('job?.status !== "completed"'));
  assert.ok(releaseSource.includes("source_transaction: chargeId"));
  assert.ok(releaseSource.includes("stripeClient.transfers.create"));
  assert.ok(migration.includes("CREATE TABLE `stripe_payments`"));
  assert.ok(migration.includes("stripe_account_id"));
});

test("Stripe webhooks quarantine refunds and disputes before provider release", async () => {
  const webhookSource = await readFile(
    new URL("../app/api/stripe/webhooks/payments/route.ts", import.meta.url),
    "utf8",
  );
  const paymentSource = await readFile(
    new URL("../lib/stripe-payments.ts", import.meta.url),
    "utf8",
  );
  const checkoutSource = await readFile(
    new URL("../app/api/stripe/checkout/route.ts", import.meta.url),
    "utf8",
  );
  const releaseSource = await readFile(
    new URL("../app/api/stripe/admin/payments/route.ts", import.meta.url),
    "utf8",
  );

  assert.ok(webhookSource.includes('case "charge.refunded"'));
  assert.ok(webhookSource.includes('case "charge.dispute.created"'));
  assert.ok(webhookSource.includes('case "charge.dispute.closed"'));
  assert.ok(paymentSource.includes("recordRefundedCharge"));
  assert.ok(paymentSource.includes("recordDisputeStatus"));
  assert.ok(checkoutSource.includes("REVIEW_PAYMENT_STATUSES"));
  assert.ok(releaseSource.includes("payment.refundAmountCents > 0"));
  assert.ok(releaseSource.includes("charge.amount_refunded > 0"));
  assert.ok(releaseSource.includes("charge.disputed"));
});

test("focused public pages and private workspaces expose only accurate UI", async () => {
  const publicSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const customerSource = await readFile(new URL("../app/customer/page.tsx", import.meta.url), "utf8");
  const accountSource = await readFile(new URL("../app/api/account/route.ts", import.meta.url), "utf8");
  const adminSource = await readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8");

  assert.ok(publicSource.includes('view === "about" ? ('));
  assert.ok(publicSource.includes('view === "request" ? ('));
  assert.ok(publicSource.includes('view === "provider" ? ('));
  assert.ok(!customerSource.includes("<summary>More tools</summary>"));
  assert.ok(!customerSource.includes('<a href="#my-requests">'));
  assert.ok(customerSource.includes('setActiveView("quotes")'));
  assert.ok(customerSource.includes('setActiveView("active")'));
  assert.ok(customerSource.includes('setActiveView("history")'));
  assert.ok(customerSource.includes('request.quoteCount > 0'));
  assert.ok(customerSource.includes("Payment policy"));
  assert.ok(accountSource.includes("inArray(providerQuotes.requestId"));
  assert.ok(accountSource.includes("quoteCount: quoteCounts[item.id] ?? 0"));
  assert.ok(adminSource.includes("response.status === 401 || response.status === 403"));
  assert.ok(adminSource.includes('window.location.replace("/")'));
  assert.ok(adminSource.includes("if (!accessGranted && !error) return null;"));
});

test("customer payment history is private and uses stored payment facts", async () => {
  const customerSource = await readFile(
    new URL("../app/customer/page.tsx", import.meta.url),
    "utf8",
  );
  const accountSource = await readFile(
    new URL("../app/api/account/route.ts", import.meta.url),
    "utf8",
  );

  assert.ok(customerSource.includes('setActiveView("payments")'));
  assert.ok(customerSource.includes("Customer account:"));
  assert.ok(customerSource.includes("account.payments.map"));
  assert.ok(customerSource.includes("Provider subtotal:"));
  assert.ok(customerSource.includes("Tuveloz fee:"));
  assert.ok(customerSource.includes("Refund recorded:"));
  assert.ok(customerSource.includes("Dispute status:"));
  assert.ok(customerSource.includes('href="/payments"'));
  assert.ok(accountSource.includes("stripePayments.customerEmail"));
  assert.ok(accountSource.includes("session.email.toLowerCase()"));
  assert.ok(accountSource.includes("customerTotalCents: stripePayments.customerTotalCents"));
  assert.ok(accountSource.includes("refundAmountCents: stripePayments.refundAmountCents"));
  assert.ok(accountSource.includes("disputeStatus: stripePayments.disputeStatus"));
  assert.ok(accountSource.includes("payments,"));
});
