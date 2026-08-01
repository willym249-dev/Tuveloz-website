import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("manual Cloudflare migrations add service areas and marketplace tools", async () => {
  const [serviceAreaMigration, marketplaceMigration, retirementMigration] = await Promise.all([
    source("drizzle/0031_service_area_settings.sql"),
    source("drizzle/0032_marketplace_tools.sql"),
    source("drizzle/0036_retire_first_oil_change_promotion.sql"),
  ]);

  assert.ok(serviceAreaMigration.includes("account_service_area_settings"));
  for (const table of [
    "provider_catalog_items",
    "provider_submitted_credentials",
    "appointments",
    "account_notifications",
    "job_location_shares",
    "account_promotions",
  ]) {
    assert.ok(marketplaceMigration.includes(`CREATE TABLE \`${table}\``));
  }
  assert.ok(marketplaceMigration.includes("customer_requests_job_status_notifications"));
  assert.ok(marketplaceMigration.includes("Your vehicle is ready"));
  assert.ok(marketplaceMigration.includes("latitude` = NULL"));
  assert.ok(marketplaceMigration.includes("longitude` = NULL"));
  assert.ok(retirementMigration.includes("DROP TRIGGER IF EXISTS `provider_quotes_first_oil_change_promo`"));
  assert.ok(retirementMigration.includes("DROP TRIGGER IF EXISTS `account_credentials_first_oil_change_promo`"));
  assert.ok(retirementMigration.includes("`status` = 'retired'"));
  assert.ok(retirementMigration.includes("DELETE FROM `account_notifications`"));
  assert.ok(!retirementMigration.includes("UPDATE `provider_quotes`"));
  assert.ok(!retirementMigration.includes("UPDATE `stripe_payments`"));
});

test("providers control approved services prices and optional credential submissions", async () => {
  const [api, page, publicApi, publicActions] = await Promise.all([
    source("app/api/provider-marketplace-tools/route.ts"),
    source("app/provider-services/page.tsx"),
    source("app/api/public-provider/route.ts"),
    source("app/components/provider-public-actions.tsx"),
  ]);

  assert.ok(api.includes("parseProviderServices(provider.approvedServices)"));
  assert.ok(api.includes("Choose one of your approved services."));
  assert.ok(api.includes("Provider-entered information does not replace"));
  assert.ok(api.includes("status, review_note"));
  assert.ok(page.includes("Services, prices, and credentials."));
  assert.ok(page.includes("Submit credential for review"));
  assert.ok(page.includes("This is your provider price"));
  assert.ok(publicApi.includes("provider_catalog_items"));
  assert.ok(publicApi.includes("public_display = 'yes'"));
  assert.ok(publicActions.includes("Request an appointment"));
  assert.ok(publicActions.includes("Provider-published prices may be starting estimates"));
});

test("customers and providers can request appointments with participant checks", async () => {
  const [api, page] = await Promise.all([
    source("app/api/appointments/route.ts"),
    source("app/appointments/page.tsx"),
  ]);

  assert.ok(api.includes("getAccountSession(request)"));
  assert.ok(api.includes("isSameOriginRequest(request)"));
  assert.ok(api.includes("quote.status = 'accepted'"));
  assert.ok(api.includes("currentAccount: await providerAccountFor(provider.email)"));
  assert.ok(api.includes("currentProvider.id !== providerId"));
  assert.ok(api.includes("currentPlatformActiveServiceCodes(POLICY_JURISDICTION)"));
  assert.match(api, /currentPlatformActiveServiceCodes\(\s*appointmentJurisdiction/);
  assert.ok(api.includes("parseExactServiceCodes(ownedRequest.serviceCodes)"));
  assert.ok(api.includes("requestServiceCodes[0] !== service"));
  assert.ok(api.includes("activePlatformServiceCodes.has(service)"));
  assert.ok(!api.includes("parseProviderServices(provider.approvedServices).includes(service)"));
  assert.ok(api.includes("requested_by_role"));
  assert.ok(api.includes("The person who received the request must confirm or decline it."));
  assert.ok(api.includes("notifyMarketplaceAccount"));
  assert.ok(page.includes("Either the customer or selected provider may send an appointment request."));
  assert.ok(page.includes("Send appointment request"));
  assert.ok(page.includes("Confirm"));
  assert.ok(page.includes("Decline"));
});

test("trip tracking is opt in latest point only and expires", async () => {
  const [api, page] = await Promise.all([
    source("app/api/tracking/route.ts"),
    source("app/tracking/page.tsx"),
  ]);

  assert.ok(api.includes('session.role !== "provider"'));
  assert.ok(api.includes("Only the selected provider can share location"));
  assert.ok(api.includes('job.requestStatus !== "on my way"'));
  assert.ok(api.includes("payload.permissionAccepted !== true"));
  assert.ok(api.includes("5 * 60 * 1000"));
  assert.ok(api.includes("latitude = NULL, longitude = NULL"));
  assert.ok(api.includes("latest point, not a location history"));
  assert.ok(page.includes("I choose to share my current location"));
  assert.ok(page.includes("navigator.geolocation.watchPosition"));
  assert.ok(page.includes("Vehicle ready · view completion"));
  assert.ok(page.includes("This is not a guaranteed route or arrival time."));
});

test("owner tools stay protected and are discoverable only to the owner", async () => {
  const [layout, dock, adminApi, adminPage] = await Promise.all([
    source("app/layout.tsx"),
    source("app/components/account-tools-dock.tsx"),
    source("app/api/admin/marketplace-tools/route.ts"),
    source("app/admin/marketplace-tools/page.tsx"),
  ]);

  assert.ok(layout.includes("<AccountToolsDock />"));
  assert.ok(dock.includes('fetch("/api/owner-access"'));
  assert.ok(dock.includes("(isOwner || ownerEntryAvailable)"));
  assert.ok(dock.includes('href="/admin"'));
  assert.ok(dock.includes('href="/admin/marketplace-tools"'));
  assert.ok(adminApi.includes("await isVerifiedOwnerRequest(request)"));
  assert.ok(adminApi.includes("isSameOriginRequest(request)"));
  assert.ok(adminPage.includes("Owner-only tools"));
  assert.ok(adminPage.includes("Optional submissions"));
});

test("new accounts keep the welcome experience without the retired oil-change promotion", async () => {
  const [
    welcomePage,
    passwordComplete,
    emailNotifications,
    notificationsPage,
    notificationsApi,
    dock,
    adminPage,
    adminApi,
  ] = await Promise.all([
    source("app/welcome/page.tsx"),
    source("app/api/auth/password/complete/route.ts"),
    source("lib/email-notifications.ts"),
    source("app/notifications/page.tsx"),
    source("app/api/notifications/route.ts"),
    source("app/components/account-tools-dock.tsx"),
    source("app/admin/marketplace-tools/page.tsx"),
    source("app/api/admin/marketplace-tools/route.ts"),
  ]);

  assert.ok(passwordComplete.includes("/welcome?role="));
  assert.ok(welcomePage.includes("Thank you for joining Tuveloz."));
  assert.ok(welcomePage.includes("Tuveloz is an online marketplace"));
  assert.ok(welcomePage.includes("Start with your customer workspace"));
  assert.ok(emailNotifications.includes("Thank you for signing up with Tuveloz."));
  assert.ok(emailNotifications.includes("Thank you for joining Tuveloz as an independent provider."));

  for (const currentSource of [
    welcomePage,
    emailNotifications,
    notificationsPage,
    notificationsApi,
    dock,
    adminPage,
    adminApi,
  ]) {
    assert.ok(!currentSource.includes("first-oil-change"));
    assert.ok(!currentSource.includes("first qualifying oil-change"));
    assert.ok(!currentSource.includes("redeemedOilChangeOffers"));
  }

  await assert.rejects(
    access(new URL("../app/first-oil-change/page.tsx", import.meta.url)),
  );
});

test("service area and marketplace work do not change Stripe setup", async () => {
  const [checkout, stripeClient, migration] = await Promise.all([
    source("app/api/stripe/checkout/route.ts"),
    source("lib/stripe.ts"),
    source("drizzle/0032_marketplace_tools.sql"),
  ]);

  assert.ok(checkout.includes("stripeClient.checkout.sessions.create"));
  assert.ok(stripeClient.includes("return new Stripe(secretKey"));
  assert.ok(!migration.includes("STRIPE_SECRET_KEY"));
  assert.ok(!migration.includes("stripe_account_id"));
  assert.ok(!migration.includes("webhook"));
});
