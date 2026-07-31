import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("customer service reminders are private customer-owned records", async () => {
  const [migration, api, page, dock, worker, health] = await Promise.all([
    source("drizzle/0037_provider_customer_feedback_gaps.sql"),
    source("app/api/service-reminders/route.ts"),
    source("app/service-reminders/page.tsx"),
    source("app/components/account-tools-dock.tsx"),
    source("worker/index.ts"),
    source("app/api/health/route.ts"),
  ]);

  assert.match(migration, /CREATE TABLE `customer_service_reminders`/);
  assert.match(migration, /trim\(`due_date`\) <> '' OR `due_mileage` > 0/);
  assert.match(api, /session\?\.role === "customer"/);
  assert.match(api, /isSameOriginRequest/);
  assert.match(api, /lower\(customer_email\) = lower\(\?\)/);
  assert.match(api, /The selected completed job is not available for this account/);
  assert.match(api, /Enter a due date, due mileage, or both/);
  assert.match(page, /Tuveloz does not choose the interval for you/);
  assert.match(page, /does not diagnose the vehicle/);
  assert.match(dock, /href="\/service-reminders"/);
  assert.match(worker, /"\/service-reminders"/);
  assert.match(health, /"customer_service_reminders"/);
});

test("requested routine services use exact provider matching and existing approval rules", async () => {
  const [matching, policy] = await Promise.all([
    source("lib/service-matching.ts"),
    source("lib/service-safety-policy.ts"),
  ]);

  assert.match(matching, /value: "Oil change service"/);
  assert.match(matching, /value: "Oil change", label: "Oil change"/);
  assert.match(matching, /value: "Minor repair and maintenance"/);
  assert.match(matching, /value: "Minor repairs and maintenance"/);
  assert.match(matching, /value: "Tire installation"/);
  assert.match(matching, /"Oil change"[\s\S]*"General auto repair"/);
  assert.match(matching, /"Tire installation"[\s\S]*"Tire repair and replacement"/);
  assert.match(policy, /key: "repair-and-shop-service"[\s\S]*"Oil change service"/);
  assert.match(policy, /key: "tire-service"[\s\S]*"Tire installation"/);
});

test("towing is visible only as a paused future category", async () => {
  const [matching, policy, requests] = await Promise.all([
    source("lib/service-matching.ts"),
    source("lib/service-safety-policy.ts"),
    source("app/api/requests/route.ts"),
  ]);

  assert.match(matching, /value: "Towing service"/);
  assert.match(matching, /Towing service — not available during launch/);
  assert.match(policy, /key: "towing-service"[\s\S]*availability: "paused"/);
  assert.match(policy, /dedicated legal, insurance, driver-and-vehicle, dispatch/);
  assert.match(requests, /pausedCustomerServices/);
  assert.match(requests, /SERVICE_REQUIRES_SEPARATE_REVIEW/);
});

test("provider catalog supports honest public price ranges", async () => {
  const [migration, providerApi, providerPage, publicApi, publicActions] = await Promise.all([
    source("drizzle/0037_provider_customer_feedback_gaps.sql"),
    source("app/api/provider-marketplace-tools/route.ts"),
    source("app/provider-services/page.tsx"),
    source("app/api/public-provider/route.ts"),
    source("app/components/provider-public-actions.tsx"),
  ]);

  assert.match(migration, /ADD COLUMN `maximum_price_cents`/);
  assert.match(providerApi, /"range", "hourly"/);
  assert.match(providerApi, /maximum_price_cents AS maximumPriceCents/);
  assert.match(providerApi, /range maximum that is at least the minimum price/);
  assert.match(providerPage, /Typical price range/);
  assert.match(providerPage, /Provider price or range minimum/);
  assert.match(publicApi, /maximum_price_cents AS maximumPriceCents/);
  assert.match(publicActions, /item\.priceType === "range"/);
  assert.match(publicActions, /The provider controls its pricing/);
});
