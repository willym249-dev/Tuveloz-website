import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("owner authentication accepts only cryptographically verified Cloudflare Access tokens", async () => {
  const source = await read("lib/owner-auth.ts");

  assert.match(source, /cf-access-jwt-assertion/);
  assert.match(source, /CF_Authorization/);
  assert.match(source, /__Host-tuveloz_owner_access/);
  assert.match(source, /source: "access-header"/);
  assert.match(source, /source: "access-cookie"/);
  assert.match(source, /source: "owner-bridge"/);
  assert.match(source, /jwtVerify\(access\.token/);
  assert.match(source, /algorithms: \["RS256"\]/);
  assert.match(source, /issuer: teamDomain/);
  assert.match(source, /audience/);
  assert.match(source, /tokenEmail !== ownerEmail/);
  assert.match(source, /HttpOnly/);
  assert.match(source, /Secure/);
  assert.match(source, /SameSite=Strict/);
  assert.doesNotMatch(source, /getAccountSession|accountCredentials|customer.*role|provider.*role/);
});

test("protected admin status route verifies access and the exact owner data schema before rendering", async () => {
  const route = await read("app/admin/access-status/route.ts");

  assert.match(route, /verifyOwnerRequest\(request\)/);
  assert.match(route, /ownerVerificationFailureResponse/);
  assert.match(route, /sqlite_master/);
  assert.match(route, /REQUIRED_OWNER_TABLES/);
  for (const table of [
    "account_credentials",
    "account_notifications",
    "account_service_area_settings",
    "appointments",
    "auth_sessions",
    "customer_profiles",
    "customer_requests",
    "email_notification_outbox",
    "launch_feedback",
    "provider_applications",
    "provider_credential_verifications",
    "provider_quotes",
    "saved_providers",
    "stripe_payments",
  ]) {
    assert.ok(route.includes(`"${table}"`), table);
  }
  assert.match(route, /ownerBridgeCookie\(verification\.token\)/);
  assert.match(route, /access: "verified"/);
  assert.match(route, /database: "ready"/);
  assert.match(route, /schema: "ready"/);
  assert.doesNotMatch(route, /password|verification code|session token|payment intent|card number/i);
});

test("owner APIs distinguish access, configuration, schema, database, and temporary failures", async () => {
  const [helper, adminApi] = await Promise.all([
    read("lib/owner-api-response.ts"),
    read("app/api/admin/route.ts"),
  ]);

  for (const code of [
    "OWNER_ACCESS_CONFIGURATION_MISSING",
    "OWNER_SESSION_REQUIRED",
    "OWNER_SESSION_INVALID",
    "OWNER_ACCOUNT_NOT_ALLOWED",
    "OWNER_SCHEMA_MIGRATION_REQUIRED",
    "OWNER_DATABASE_UNAVAILABLE",
    "OWNER_DATA_TEMPORARILY_UNAVAILABLE",
  ]) {
    assert.ok(helper.includes(code), code);
  }
  assert.match(helper, /private, no-store, max-age=0/);
  assert.match(helper, /no such table\|no such column/);
  assert.match(helper, /console\.error/);
  assert.match(adminApi, /ownerVerificationFailureResponse/);
  assert.match(adminApi, /ownerDataFailureResponse/);
  assert.doesNotMatch(adminApi, /Unable to load submissions\./);
});

test("mobile owner gate blocks private children until access and schema checks pass", async () => {
  const [gate, layout, styles] = await Promise.all([
    read("app/admin/owner-dashboard-gate.tsx"),
    read("app/admin/layout.tsx"),
    read("app/admin/owner-dashboard-gate.css"),
  ]);

  assert.match(layout, /<OwnerDashboardGate>\{children\}<\/OwnerDashboardGate>/);
  assert.match(layout, /owner-dashboard-gate\.css/);
  assert.match(gate, /fetch\("\/admin\/access-status"/);
  assert.match(gate, /credentials: "same-origin"/);
  assert.match(gate, /redirect: "manual"/);
  assert.match(gate, /AbortController/);
  assert.match(gate, /15_000/);
  assert.match(gate, /response\.type === "opaqueredirect"/);
  assert.match(gate, /Checking protected access/);
  assert.match(gate, /Owner Tools remain locked/);
  assert.match(gate, />Try again</);
  assert.match(gate, /Owner sign in again/);
  assert.match(gate, /Customer and provider passwords, sessions, or role selections never satisfy Owner Access/);
  assert.match(gate, /MutationObserver/);
  assert.match(gate, /No customer,\s+provider, payment, or launch decision was changed/);
  assert.match(styles, /@media \(max-width: 700px\)/);
  assert.match(styles, /flex-direction: column/);
  assert.match(styles, /width: 100%/);
  assert.match(styles, /has-child-failure/);
});

test("owner recovery changes no customer provider payment or launch records", async () => {
  const [gate, status, auth] = await Promise.all([
    read("app/admin/owner-dashboard-gate.tsx"),
    read("app/admin/access-status/route.ts"),
    read("lib/owner-auth.ts"),
  ]);

  assert.doesNotMatch(gate, /method: "POST"|method: "PUT"|method: "DELETE"/);
  assert.doesNotMatch(status, /INSERT INTO|UPDATE |DELETE FROM/);
  assert.doesNotMatch(auth, /INSERT INTO|UPDATE |DELETE FROM/);
  assert.doesNotMatch(gate, /api\/auth|role=owner|role: "owner"/);
});
