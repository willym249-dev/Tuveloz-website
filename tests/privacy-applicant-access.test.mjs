import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  ownedProviderApplicationForPrivacy,
  parsePrivacyScope,
  privacyAccountAccessFor,
} from "../lib/privacy-account-access.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("pending blocked and declined application owners retain privacy access", () => {
  const session = { email: "Applicant@Example.com", role: "provider" };
  for (const status of ["pending", "blocked", "declined"]) {
    const ownership = ownedProviderApplicationForPrivacy(session, {
      id: `provider-${status}`,
      email: " applicant@example.com ",
      status,
      verificationStatus: status === "blocked" ? "blocked" : "pending",
    });
    assert.deepEqual(ownership, {
      email: "applicant@example.com",
      providerId: `provider-${status}`,
    });
  }
});

test("privacy application ownership rejects unrelated and unauthenticated callers", () => {
  const application = {
    id: "provider-1",
    email: "owner@example.com",
    status: "declined",
  };
  assert.equal(ownedProviderApplicationForPrivacy(null, application), null);
  assert.equal(ownedProviderApplicationForPrivacy(
    { email: "other@example.com", role: "provider" },
    application,
  ), null);
  assert.deepEqual(ownedProviderApplicationForPrivacy(
    { email: "owner@example.com", role: "customer" },
    application,
  ), { email: "owner@example.com", providerId: "provider-1" });
});

test("fresh customer reauthentication can select owned declined provider privacy data", () => {
  const freshCustomerSession = {
    email: "owner@example.com",
    role: "customer",
    availableRoles: ["customer"],
  };
  const declinedApplication = {
    id: "declined-provider-id",
    email: "owner@example.com",
    status: "declined",
    verificationStatus: "blocked",
  };

  assert.deepEqual(
    privacyAccountAccessFor(freshCustomerSession, declinedApplication, "provider"),
    {
      email: "owner@example.com",
      providerId: "declined-provider-id",
      role: "provider",
      availablePrivacyScopes: ["customer", "provider"],
    },
  );
  assert.equal(freshCustomerSession.role, "customer");
  assert.equal(
    privacyAccountAccessFor(
      freshCustomerSession,
      { ...declinedApplication, email: "unrelated@example.com" },
      "provider",
    ),
    null,
  );
  assert.equal(privacyAccountAccessFor(freshCustomerSession, null, "provider"), null);
});

test("privacy scope parser rejects malformed or repeated scope requests", () => {
  assert.equal(parsePrivacyScope([]), undefined);
  assert.equal(parsePrivacyScope(["customer"]), "customer");
  assert.equal(parsePrivacyScope(["provider"]), "provider");
  assert.equal(parsePrivacyScope(["admin"]), null);
  assert.equal(parsePrivacyScope(["provider", "customer"]), null);
});

test("privacy APIs use application ownership without weakening scope or write protections", async () => {
  const [center, exportRoute, privacyPage, accountPage, accountRoute, auth] = await Promise.all([
    read("app/api/privacy-center/route.ts"),
    read("app/api/privacy-center/export/route.ts"),
    read("app/privacy-center/page.tsx"),
    read("app/account/page.tsx"),
    read("app/api/account/route.ts"),
    read("lib/account-auth.ts"),
  ]);
  for (const route of [center, exportRoute]) {
    assert.match(route, /getPrivacyAccountSession\(request\)/);
    assert.match(route, /providerApplicationOwnershipFor\(session\.email\)/);
    assert.match(route, /privacyAccountAccessFor\(session, application, requestedScope\)/);
    assert.match(route, /parsePrivacyScope\(new URL\(request\.url\)\.searchParams\.getAll\("scope"\)\)/);
    assert.doesNotMatch(route, /providerAccountFor/);
  }
  assert.match(center, /isSameOriginRequest\(request\)/);
  assert.match(center, /lower\(email\) = lower\(\?\) AND role = \?/);
  assert.match(exportRoute, /providerExport\(account\.email, account\.providerId\)/);
  assert.match(exportRoute, /providerOnboardingExport\(providerId\)/);
  assert.match(exportRoute, /cache-control": "private, no-store"/);
  assert.match(center, /dataExport: `\/api\/privacy-center\/export\?scope=\$\{role\}`/);
  assert.match(privacyPage, /availablePrivacyScopes/);
  assert.match(privacyPage, /Provider application data/);
  assert.match(privacyPage, /fetch\(`\/api\/privacy-center\?scope=\$\{data\?\.role \?\? "customer"\}`/);
  assert.match(accountPage, /same verified email used on your/);
  assert.match(accountPage, /privacy-only access does not approve provider work or grant/);
  assert.match(accountPage, /destinationAfterSignIn/);
  assert.doesNotMatch(accountRoute, /privacyAccountAccessFor|getPrivacyAccountSession/);

  const ownershipStart = auth.indexOf("export async function providerApplicationOwnershipFor");
  const ownershipEnd = auth.indexOf("async function providerDestinationFor", ownershipStart);
  const ownershipHelper = auth.slice(ownershipStart, ownershipEnd);
  assert.ok(ownershipStart >= 0 && ownershipEnd > ownershipStart);
  assert.match(ownershipHelper, /lower\(trim\(/);
  assert.doesNotMatch(ownershipHelper, /status|verificationStatus|providerAccountFor|verifiedProviderFor/);

  const privacySessionStart = auth.indexOf("export async function getPrivacyAccountSession");
  const privacySessionEnd = auth.indexOf("export async function switchAccountRole", privacySessionStart);
  const privacySessionHelper = auth.slice(privacySessionStart, privacySessionEnd);
  assert.ok(privacySessionStart >= 0 && privacySessionEnd > privacySessionStart);
  assert.match(privacySessionHelper, /authenticatedStoredAccountSession\(request\)/);
  assert.match(privacySessionHelper, /providerApplicationOwnershipFor\(session\.email\)/);
  assert.match(privacySessionHelper, /roles\.push\("provider"\)/);

  const regularSessionStart = auth.indexOf("export async function getAccountSession");
  const regularSessionEnd = auth.indexOf(
    "export async function getPrivacyAccountSession",
    regularSessionStart,
  );
  const regularSessionHelper = auth.slice(regularSessionStart, regularSessionEnd);
  assert.ok(regularSessionStart >= 0 && regularSessionEnd > regularSessionStart);
  assert.match(regularSessionHelper, /eligibleAccountRoles\(session\.email\)/);
  assert.doesNotMatch(regularSessionHelper, /providerApplicationOwnershipFor/);
});
