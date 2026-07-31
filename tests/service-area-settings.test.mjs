import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("customer settings persist reusable private location defaults", async () => {
  const [route, component, migration] = await Promise.all([
    read("app/api/customer-tools/route.ts"),
    read("app/components/customer-account-tools.tsx"),
    read("drizzle/0031_service_area_settings.sql"),
  ]);
  assert.match(route, /account_service_area_settings/);
  assert.match(route, /normalizeMontgomeryCountyZip/);
  assert.match(route, /serviceLocations/);
  assert.match(component, /Default service location/);
  assert.match(component, /This stays private until you select a provider/);
  assert.match(migration, /PRIMARY KEY\(`email`, `role`\)/);
});

test("provider settings update the fields used by live job matching", async () => {
  const [route, page, jobs, alerts] = await Promise.all([
    read("app/api/provider-service-area/route.ts"),
    read("app/provider-service-area/page.tsx"),
    read("app/api/jobs/route.ts"),
    read("lib/provider-alerts.ts"),
  ]);
  assert.match(route, /update\(providerApplications\)/);
  assert.match(route, /serviceArea/);
  assert.match(route, /workLocations/);
  assert.match(page, /These choices immediately affect which jobs appear/);
  assert.match(jobs, /providerMatchesArea\(provider\.serviceArea/);
  assert.match(jobs, /providerMatchesServiceLocation\(provider\.workLocations/);
  assert.match(alerts, /providerMatchesArea\(provider\.serviceArea/);
  assert.match(alerts, /providerMatchesServiceLocation\(provider\.workLocations/);
});

test("service-area work does not modify Stripe setup", async () => {
  const route = await read("app/api/provider-service-area/route.ts");
  const customerRoute = await read("app/api/customer-tools/route.ts");
  assert.doesNotMatch(route, /stripe/i);
  assert.doesNotMatch(customerRoute, /stripe/i);
});
