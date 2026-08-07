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
  const migrationFiles = (await readdir(
    fileURLToPath(new URL("../drizzle", import.meta.url)),
  )).filter((name) => name.endsWith(".sql")).sort();
  const recordedFiles = journal.entries
    .map((entry) => `${entry.tag}.sql`)
    .sort();
  assert.deepEqual(recordedFiles, migrationFiles);
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
  assert.ok(contents.includes("Your business. Your price. Your schedule."));
  assert.ok(contents.includes("Tuveloz doesn't employ, train, or assign work to providers"));
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

test("vehicle intake prefers confirmed choices and never invents motor data", async () => {
  const distDirectory = fileURLToPath(new URL("../dist", import.meta.url));
  const files = (await builtFiles(distDirectory))
    .filter((path) => [".js", ".html"].includes(extname(path)));
  const contents = (await Promise.all(files.map((path) => readFile(path, "utf8")))).join("\n");
  const vehicleSelectorSource = await readFile(
    new URL("../app/components/vehicle-selector.tsx", import.meta.url),
    "utf8",
  );

  assert.ok(vehicleSelectorSource.includes("My make is not listed"));
  assert.ok(vehicleSelectorSource.includes("My model is not listed"));
  assert.ok(vehicleSelectorSource.includes("Start with the year, make, and model. Use the VIN lookup if needed."));
  assert.ok(vehicleSelectorSource.includes('useState<"search" | "vin">("search")'));
  assert.ok(vehicleSelectorSource.includes("Can&apos;t find your vehicle?"));
  assert.ok(vehicleSelectorSource.includes("No confirmed motor / engine choice was returned."));
  assert.ok(vehicleSelectorSource.includes("Tuveloz does not guess motor or engine details."));
  assert.ok(vehicleSelectorSource.includes("customer entered; provider must verify"));
  assert.ok(vehicleSelectorSource.includes("Motor/engine not provided"));
  assert.ok(vehicleSelectorSource.includes("Choose an official option above or type the engine here"));
  assert.ok(vehicleSelectorSource.includes("This typed value overrides the VIN or official choice"));
  assert.ok(contents.includes("OEM and aftermarket are communication preferences only"));
  assert.ok(contents.includes("They do not add a parts charge to Tuveloz"));
  assert.ok(contents.includes("customer purchases separately"));
  assert.ok(contents.includes("Any required parts must be purchased separately by the customer and cannot be included in a Tuveloz quote or payment."));
});

test("build contains global language, optional budget details, repeat booking, and honest price guidance", async () => {
  const distDirectory = fileURLToPath(new URL("../dist", import.meta.url));
  const files = (await builtFiles(distDirectory))
    .filter((path) => [".js", ".html"].includes(extname(path)));
  const contents = (await Promise.all(files.map((path) => readFile(path, "utf8")))).join("\n");

  // The language toggle ships again now that the marketing pages have reviewed
  // Spanish. It is gated per path (see SPANISH_READY_PATHS) so it never appears
  // on a legal page, which is what it was previously removed for.
  assert.ok(contents.includes("Change the whole page to English"));
  assert.ok(contents.includes("SPANISH_READY_PATHS") || contents.includes("pathHasSpanish"));
  assert.ok(!contents.includes("About how much is your budget?"));
  assert.ok(contents.includes("Include a budget here only if you want providers to see one."));
  assert.ok(contents.includes("Compare all matching providers instead"));
  assert.ok(contents.includes("Request") && contents.includes("again"));
  assert.ok(contents.includes("Observed Tuveloz price guide"));
  assert.ok(contents.includes("Not enough real completed jobs yet to publish a trustworthy price."));
  assert.ok(contents.includes("at least 3 real, non-test, completed"));
});

test("build keeps OEM and aftermarket as communication-only preferences", async () => {
  const distDirectory = fileURLToPath(new URL("../dist", import.meta.url));
  const files = (await builtFiles(distDirectory))
    .filter((path) => [".js", ".html"].includes(extname(path)));
  const contents = (await Promise.all(files.map((path) => readFile(path, "utf8")))).join("\n");

  assert.ok(contents.includes("Parts arrangement for this labor-only request"));
  assert.ok(contents.includes("OEM and aftermarket are communication preferences only"));
  assert.ok(contents.includes("I confirm this quote is for labor only"));
  assert.ok(!contents.includes("If the provider supplies parts, the quote will show separate labor"));
  assert.ok(!contents.includes("Parts price ($)"));
});

test("build protects every important submission with a second confirmation", async () => {
  const distDirectory = fileURLToPath(new URL("../dist", import.meta.url));
  const files = (await builtFiles(distDirectory))
    .filter((path) => [".js", ".html"].includes(extname(path)));
  const contents = (await Promise.all(files.map((path) => readFile(path, "utf8")))).join("\n");

  assert.ok(contents.includes("Confirm and post"));
  assert.ok(contents.includes("Yes, send my code"));
  assert.ok(contents.includes("Last step: enter the code we emailed you"));
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

test("build limits provider onboarding to Montgomery County and collects expansion demand", async () => {
  const distDirectory = fileURLToPath(new URL("../dist", import.meta.url));
  const files = (await builtFiles(distDirectory))
    .filter((path) => [".js", ".html"].includes(extname(path)));
  const contents = (await Promise.all(files.map((path) => readFile(path, "utf8")))).join("\n");

  assert.ok(contents.includes("Local vehicle-service marketplace"));
  assert.ok(contents.includes("Provider onboarding now in Montgomery County, Maryland"));
  assert.ok(contents.includes("Tuveloz provider onboarding currently focuses on Montgomery County, Maryland."));
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

test("layout uses the brand badge favicon with a cache-busting reference", async () => {
  const favicon = await readFile(
    new URL("../public/tuveloz-favicon-v2.svg", import.meta.url),
    "utf8",
  );
  const layout = await readFile(
    new URL("../app/layout.tsx", import.meta.url),
    "utf8",
  );

  assert.ok(layout.includes("/tuveloz-favicon-v2.svg?v="));
  // The favicon embeds the exact social-kit badge art (navy fill, orange
  // keyline) rather than a hand-drawn approximation of it.
  assert.ok(favicon.includes("data:image/png;base64,"));
});

test("provider approval requires applicable state and local proof without requesting unnecessary documents", async () => {
  const distDirectory = fileURLToPath(new URL("../dist", import.meta.url));
  const files = (await builtFiles(distDirectory))
    .filter((path) => [".js", ".html"].includes(extname(path)));
  const contents = (await Promise.all(files.map((path) => readFile(path, "utf8")))).join("\n");

  assert.ok(contents.includes("Tuveloz must receive and verify proof before approval"));
  assert.ok(contents.includes("If no government license applies, Tuveloz will not request one for that reason; insurance, competency, business, or other service evidence may still be required."));
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
  const passwordRouteSource = await readFile(
    new URL("../app/api/auth/password/route.ts", import.meta.url),
    "utf8",
  );
  const passwordVerifySource = await readFile(
    new URL("../app/api/auth/password/verify/route.ts", import.meta.url),
    "utf8",
  );

  assert.ok(contents.includes("Welcome to Tuveloz."));
  assert.ok(contents.includes("Create account"));
  assert.ok(contents.includes("Forgot password?"));
  assert.ok(contents.includes("Email me a one-time code instead"));
  assert.ok(contents.includes("Use at least 10 characters"));
  assert.ok(contents.includes("Remember my email on this device"));
  assert.ok(contents.includes("Finish signing in"));
  assert.ok(contents.includes("Provider workspace"));
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
  assert.ok(authSource.includes("PASSWORD_MIN_LENGTH = 10"));
  assert.ok(authSource.includes('PasswordPurpose | "signin"'));
  assert.ok(authSource.includes("issuePasswordChallenge"));
  assert.ok(authSource.includes("verifyPasswordSignIn"));
  assert.ok(passwordRouteSource.includes("challengeRequired: true"));
  assert.ok(!passwordRouteSource.includes("sessionCookie"));
  assert.ok(passwordVerifySource.includes("sessionCookie"));
  assert.ok(passwordVerifySource.includes("verifyPasswordSignIn"));
  assert.ok(authSource.includes("`password:${password.normalize(\"NFKC\")}`"));
  assert.ok(authSource.includes('"PBKDF2"'));
  assert.ok(authSource.includes('hash: "SHA-256"'));
  assert.ok(authSource.includes("credentialRows.length > 0 || customerRows.length > 0"));
  assert.ok(authSource.includes('role === "customer" || roles.includes(role)'));
  assert.ok(schemaSource.includes('"account_credentials"'));
  assert.ok(schemaSource.includes('"password_verification_codes"'));
  assert.ok(authSource.includes('{ name: "HMAC", hash: "SHA-256" }'));
});

test("homepage prominently links to Tuveloz AI with clear boundaries", async () => {
  const homeSource = await readFile(
    new URL("../app/page.tsx", import.meta.url),
    "utf8",
  );

  assert.ok(homeSource.includes('href="/ai"'));
  assert.ok(homeSource.includes("A clearer way to describe what your vehicle needs."));
  assert.ok(homeSource.includes("It does not diagnose, dispatch"));
  assert.ok(homeSource.includes("guarantee pricing, or choose a provider."));
});

test("homepage uses clear launch language and keeps its service icons visible", async () => {
  const [homeSource, styles] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.ok(homeSource.includes('aria-label="What Tuveloz promises today"'));
  // The strip leads with what a visitor gets, and still says plainly that
  // requests are not live yet rather than implying they are.
  assert.ok(homeSource.includes("<b>Free</b> to ask and to compare prices"));
  assert.ok(homeSource.includes("<b>No pressure</b>"));
  assert.ok(homeSource.includes("post your first job when we open"));
  assert.ok(homeSource.includes("<b>Keep 100%</b> of the price you quote"));
  assert.ok(!styles.includes(".public-view-home > .services,"));
  assert.match(
    styles,
    /\.service-icon \.tuveloz-icon,[\s\S]*?\{[\s\S]*?height: 28px;[\s\S]*?width: 28px;/,
  );
});

test("passkeys are optional, verified on the server, and never store biometric data", async () => {
  const [
    accountSource,
    authSource,
    passkeySource,
    schemaSource,
    migrationSource,
    registerOptionsSource,
    registerVerifySource,
    authenticationOptionsSource,
    authenticationVerifySource,
  ] = await Promise.all([
    readFile(new URL("../app/account/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/account-auth.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/passkeys.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../drizzle/0026_ordinary_thunderbolts.sql", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../app/api/auth/passkeys/register/options/route.ts",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../app/api/auth/passkeys/register/verify/route.ts",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../app/api/auth/passkeys/authenticate/options/route.ts",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../app/api/auth/passkeys/authenticate/verify/route.ts",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  assert.ok(accountSource.includes("Use a passkey"));
  assert.ok(accountSource.includes("Set up a passkey"));
  assert.ok(accountSource.includes("Not now"));
  assert.ok(accountSource.includes("not your face or fingerprint"));
  assert.ok(accountSource.includes("password manager may securely sync the passkey"));
  assert.ok(accountSource.includes("platformAuthenticatorIsAvailable"));

  assert.ok(passkeySource.includes("generateRegistrationOptions"));
  assert.ok(passkeySource.includes("verifyRegistrationResponse"));
  assert.ok(passkeySource.includes("generateAuthenticationOptions"));
  assert.ok(passkeySource.includes("verifyAuthenticationResponse"));
  assert.ok(passkeySource.includes('userVerification: "required"'));
  assert.ok(passkeySource.includes("requireUserVerification: true"));
  assert.ok(passkeySource.includes('residentKey: "required"'));
  assert.ok(passkeySource.includes('attestationType: "none"'));
  assert.ok(passkeySource.includes("getAccountSession(request)"));
  assert.ok(passkeySource.includes("createAccountSession"));
  assert.ok(passkeySource.includes("credential.publicKey"));
  assert.ok(!passkeySource.includes("faceData"));
  assert.ok(!passkeySource.includes("fingerprintData"));

  for (const routeSource of [
    registerOptionsSource,
    registerVerifySource,
    authenticationOptionsSource,
    authenticationVerifySource,
  ]) {
    assert.ok(routeSource.includes("isSameOriginRequest(request)"));
    assert.ok(routeSource.includes('"cache-control": "no-store"'));
  }
  assert.ok(registerOptionsSource.includes("Sign in before setting up a passkey."));
  assert.ok(authenticationVerifySource.includes("finishPasskeyAuthentication"));
  assert.ok(authenticationVerifySource.includes("sessionCookie"));
  assert.ok(
    authenticationVerifySource.indexOf(
      "const result = await finishPasskeyAuthentication",
    )
      < authenticationVerifySource.indexOf(
        "sessionCookie(request, result.token)",
      ),
  );
  assert.ok(!authenticationOptionsSource.includes("sessionCookie"));
  assert.ok(!registerOptionsSource.includes("sessionCookie"));
  assert.ok(!registerVerifySource.includes("sessionCookie"));

  assert.ok(authSource.includes("export async function createAccountSession"));
  assert.ok(schemaSource.includes('export const passkeyCredentials = sqliteTable'));
  assert.ok(schemaSource.includes('"public_key"'));
  assert.ok(schemaSource.includes('"counter"'));
  assert.ok(schemaSource.includes('"transports"'));
  assert.ok(migrationSource.includes("CREATE TABLE `passkey_credentials`"));
  assert.ok(
    migrationSource.includes("passkey_credentials_email_role_idx"),
  );
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
  const layoutSource = await readFile(
    new URL("../app/layout.tsx", import.meta.url),
    "utf8",
  );
  const sitemapSource = await readFile(
    new URL("../app/sitemap.ts", import.meta.url),
    "utf8",
  );
  const manifest = JSON.parse(await readFile(
    new URL("../public/manifest.webmanifest", import.meta.url),
    "utf8",
  ));

  assert.ok(contents.includes("Terms of Use"));
  assert.ok(contents.includes("Customer Agreement"));
  assert.ok(contents.includes("Provider Agreement"));
  assert.ok(contents.includes("Privacy Policy"));
  assert.ok(contents.includes("Payment, Cancellation, and Refund Policy"));
  assert.ok(contents.includes("I am 18 or older and agree to the"));
  assert.ok(contents.includes("TUVELOZ LLC"));
  assert.ok(contents.includes("merchant of record"));
  assert.ok(contents.includes("Any charge, transfer, or connected-account configuration remains in testing"));
  assert.ok(contents.includes("technical labels or movement of funds do not by themselves determine who is merchant of record"));
  assert.ok(layoutSource.includes('metadataBase: new URL("https://tuveloz.com")'));
  assert.ok(layoutSource.includes('manifest: "/manifest.webmanifest"'));
  assert.ok(sitemapSource.includes('path: "/payments"'));
  assert.ok(!sitemapSource.includes('path: "/admin"'));
  assert.ok(!sitemapSource.includes('path: "/customer"'));
  assert.ok(!sitemapSource.includes('path: "/provider-jobs"'));
  assert.equal(manifest.name, "Tuveloz");
  assert.equal(manifest.start_url, "/");
  assert.equal(manifest.display, "standalone");
  assert.ok(contents.includes("does not sell personal information"));
  assert.ok(contents.includes("customer and provider form their own service agreement"));
  assert.ok(termsSource.includes("unnecessary identity documents"));
  assert.ok(termsSource.includes("arbitration"));
  assert.ok(contents.includes("Every exact service is disabled."));
  assert.ok(contents.includes("You can't borrow, rent, share, or rely on someone else's registration"));
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
  const providerBusinessSource = await readFile(
    new URL("../app/components/provider-business-page.tsx", import.meta.url),
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

  assert.ok(customerSource.includes("Customer launch status"));
  assert.ok(customerSource.includes("New customer requests and payments remain closed during provider onboarding."));
  assert.ok(customerSource.includes("My jobs"));
  assert.ok(customerSource.includes("How customer privacy works"));
  assert.ok(customerSource.includes("workspace-tools"));
  assert.ok(customerSource.includes("/my-request?request="));
  assert.ok(!customerSource.includes("/my-request?token="));
  assert.ok(!customerSource.includes("Submit quote"));
  assert.ok(!customerSource.includes("Open Jobs"));
  assert.ok(!customerSource.includes("Provider sign in"));
  assert.ok(providerSource.includes("Yes, submit quote"));
  assert.ok(providerSource.includes("Submitted quotes"));
  assert.ok(providerSource.includes('onClick={() => setActiveView("earnings")}'));
  assert.ok(providerSource.includes("Private totals"));
  assert.ok(providerSource.includes("Job value & hours"));
  assert.ok(providerSource.includes("not a Stripe payout or transfer status"));
  assert.ok(providerSource.includes("const workspaceReady = !loading && provider !== null;"));
  assert.ok(!providerSource.includes("!loading && !error"));
  assert.ok(providerSource.includes("provider-dashboard-nav"));
  assert.ok(providerBusinessSource.includes("Business tools could not load."));
  assert.ok(providerBusinessSource.includes("Try again"));
  assert.ok(providerBusinessSource.includes("provider-supplied work photos"));
  assert.ok(!providerBusinessSource.includes("real work photos"));
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

test("build preserves the proposed 5 percent test configuration and fee snapshots", async () => {
  const distDirectory = fileURLToPath(new URL("../dist", import.meta.url));
  const files = (await builtFiles(distDirectory))
    .filter((path) => [".js", ".html"].includes(extname(path)));
  const contents = (await Promise.all(files.map((path) => readFile(path, "utf8")))).join("\n");
  const feeSource = await readFile(
    new URL("../lib/customer-fee.ts", import.meta.url),
    "utf8",
  );
  const paymentPolicySource = await readFile(
    new URL("../app/payments/page.tsx", import.meta.url),
    "utf8",
  );
  const quotePaymentSource = await readFile(
    new URL("../app/components/quote-payment-card.tsx", import.meta.url),
    "utf8",
  );
  const migration = await readFile(
    new URL("../drizzle/0020_kind_rick_jones.sql", import.meta.url),
    "utf8",
  );

  assert.ok(contents.includes("Provider quote subtotal"));
  assert.ok(contents.includes("Customer total"));
  assert.ok(quotePaymentSource.includes("configured Tuveloz fee (currently 5% in test)"));
  assert.ok(paymentPolicySource.includes("configuration proposes a customer service fee equal to 5%"));
  assert.ok(paymentPolicySource.includes("remain subject to documented compliance with applicable law and final"));
  assert.ok(contents.includes("Accepted service fees"));
  assert.ok(feeSource.includes("CUSTOMER_SERVICE_FEE_RATE_BPS = 500"));
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

  assert.ok(contents.includes("Work you bring to the customer"));
  assert.ok(contents.includes("Work you do at your shop"));
  assert.ok(contents.includes("Special jobs (need extra review)"));
  assert.ok(contents.includes("Jump start a dead battery"));
  assert.ok(contents.includes("Check a car before someone buys it"));
  assert.ok(contents.includes("Deep cleaning and ceramic coating"));
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

  assert.ok(contents.includes("Customer payments are not open yet."));
  assert.ok(contents.includes("Appointments are not open yet."));
  assert.ok(contents.includes("Onboard to collect payments"));
  assert.ok(contents.includes("Storefront offerings open after customer launch"));
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
  assert.ok(paymentSource.includes("CHECKOUT_FAILURE_MUTABLE_STATUSES"));
  assert.ok(paymentSource.includes("Ignoring a late Checkout failure status"));
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
  assert.ok(customerSource.includes('["quotes", "Quotes received"]'));
  assert.ok(customerSource.includes('["active", "Active jobs"]'));
  assert.ok(customerSource.includes('["history", "Job history"]'));
  assert.ok(customerSource.includes("onClick={() => setActiveView(view)}"));
  assert.ok(customerSource.includes('request.quoteCount > 0'));
  assert.ok(customerSource.includes("Payment policy"));
  assert.ok(accountSource.includes("inArray(providerQuotes.requestId"));
  assert.ok(accountSource.includes("quoteCount: quoteCounts[item.id] ?? 0"));
  assert.ok(adminSource.includes('fetch("/api/admin", { cache: "no-store" })'));
  assert.ok(adminSource.includes('if (!response.ok) throw new Error(result.error || "Unable to load dashboard.");'));
  assert.ok(!adminSource.includes('window.location.replace("/")'));
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

  assert.ok(customerSource.includes('["payments", "Payments"]'));
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

test("customer payment methods use Stripe-hosted setup without storing card secrets", async () => {
  const [
    customerSource,
    componentSource,
    routeSource,
    checkoutSource,
    customerHelperSource,
    schemaSource,
    migrationSource,
  ] = await Promise.all([
    readFile(new URL("../app/customer/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/customer-payment-methods.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/stripe/customer/payment-methods/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/stripe/checkout/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/stripe-customers.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0028_customer_payment_methods.sql", import.meta.url), "utf8"),
  ]);

  assert.ok(customerSource.includes("<CustomerPaymentMethods />"));
  assert.ok(customerSource.includes('searchParams.get("view")'));
  assert.ok(componentSource.includes("Adding a payment method does not charge it."));
  assert.ok(componentSource.includes("Tuveloz never stores your full card number or CVC."));
  assert.ok(componentSource.includes("•••• {method.last4}"));
  assert.ok(componentSource.includes('method: "DELETE"'));

  assert.ok(routeSource.includes("getAccountSession(request)"));
  assert.ok(routeSource.includes('session?.role === "customer"'));
  assert.ok(routeSource.includes("isSameOriginRequest(request)"));
  assert.ok(routeSource.includes('mode: "setup"'));
  assert.ok(routeSource.includes("customer: stripeCustomerId"));
  assert.ok(routeSource.includes('allow_redisplay: "always"'));
  assert.ok(routeSource.includes('type: "card",'));
  assert.ok(routeSource.includes("paymentMethods.list"));
  assert.ok(routeSource.includes("paymentMethods.detach"));
  assert.ok(routeSource.includes('method.customer === "string"'));
  assert.ok(routeSource.includes('"cache-control": "no-store"'));
  const postSource = routeSource.slice(routeSource.indexOf("export async function POST"));
  const deleteSource = routeSource.slice(routeSource.indexOf("export async function DELETE"));
  assert.ok(postSource.indexOf("isSameOriginRequest(request)") < postSource.indexOf("customerSession(request)"));
  assert.ok(deleteSource.indexOf("isSameOriginRequest(request)") < deleteSource.indexOf("request.json()"));

  assert.ok(checkoutSource.includes("getOrCreateStripeCustomer"));
  assert.ok(checkoutSource.includes("saved_payment_method_options"));
  assert.ok(checkoutSource.includes('payment_method_save: "enabled"'));
  assert.ok(checkoutSource.includes("customer: stripeCustomerId"));
  assert.ok(customerHelperSource.includes("idempotencyKey"));
  assert.ok(customerHelperSource.includes("stripeCustomerIdForEmail"));
  assert.ok(schemaSource.includes("export const stripeCustomers = sqliteTable"));
  assert.ok(migrationSource.includes("CREATE TABLE `stripe_customers`"));

  for (const source of [customerHelperSource, schemaSource, migrationSource]) {
    assert.ok(!source.includes("card_number"));
    assert.ok(!source.includes("cardNumber"));
    assert.ok(!source.includes("cvc"));
  }
});

test("provider dashboard exposes focused, factual, provider-owned tools", async () => {
  const providerSource = await readFile(
    new URL("../app/provider-jobs/page.tsx", import.meta.url),
    "utf8",
  );
  const jobsApiSource = await readFile(
    new URL("../app/api/jobs/route.ts", import.meta.url),
    "utf8",
  );
  const businessSource = await readFile(
    new URL("../app/components/provider-business-page.tsx", import.meta.url),
    "utf8",
  );
  const profileApiSource = await readFile(
    new URL("../app/api/provider-profile/route.ts", import.meta.url),
    "utf8",
  );

  assert.ok(providerSource.includes("Accepted-job availability"));
  assert.ok(providerSource.includes("Only quotes submitted from this provider account appear here."));
  assert.ok(providerSource.includes("customer-visible status"));
  assert.ok(providerSource.includes("type ProviderView ="));
  assert.ok(providerSource.includes('aria-pressed={activeView === "available"}'));
  assert.ok(providerSource.includes('onClick={() => setActiveView("schedule")}'));
  assert.ok(providerSource.includes('onClick={() => setActiveView("messages")}'));
  assert.ok(providerSource.includes('onClick={() => setActiveView("reviews")}'));
  assert.ok(providerSource.includes('onClick={() => setActiveView("profile")}'));
  assert.ok(providerSource.includes('onClick={() => setActiveView("performance")}'));
  assert.ok(!providerSource.includes("openWorkspaceSection"));
  assert.ok(!providerSource.includes('href="#provider-reviews"'));
  assert.ok(providerSource.includes('<JobMessages audience="provider" />'));
  assert.ok(providerSource.includes('focus={activeView === "reviews" ? "reviews" : activeView === "performance" ? "performance" : "profile"}'));
  assert.ok(providerSource.includes("if (!response.ok)"));
  assert.ok(providerSource.includes("Your session is still active."));
  assert.ok(providerSource.includes("disabled={signingOut}"));
  assert.ok(jobsApiSource.includes("myQuotes: submittedQuotes"));
  assert.ok(jobsApiSource.includes("eq(providerQuotes.providerEmail, provider.email)"));
  assert.ok(jobsApiSource.includes('"cache-control": "no-store"'));
  assert.ok(businessSource.includes('type ProviderBusinessFocus = "profile" | "reviews" | "performance"'));
  assert.ok(businessSource.includes('{focus === "profile" && ('));
  assert.ok(businessSource.includes('{focus === "reviews" && ('));
  assert.ok(businessSource.includes('{focus === "performance" && ('));
  assert.ok(businessSource.includes("Completed-job customer feedback"));
  assert.ok(businessSource.includes("Only feedback from completed Tuveloz jobs appears here."));
  assert.ok(profileApiSource.includes('eq(jobReviews.status, "published")'));
  assert.ok(profileApiSource.includes('"cache-control": "no-store"'));
});

test("provider write routes reject cross-origin requests before reading request bodies", async () => {
  const routeSources = await Promise.all([
    readFile(new URL("../app/api/jobs/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/messages/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/provider-profile/route.ts", import.meta.url), "utf8"),
  ]);
  const securitySource = await readFile(
    new URL("../lib/request-security.ts", import.meta.url),
    "utf8",
  );

  for (const routeSource of routeSources) {
    assert.ok(routeSource.includes('import { isSameOriginRequest } from'));
    const postSource = routeSource.slice(routeSource.indexOf("export async function POST"));
    const guardIndex = postSource.indexOf("isSameOriginRequest(request)");
    const jsonIndex = postSource.indexOf("request.json()");
    const formIndex = postSource.indexOf("request.formData()");
    const bodyIndex = jsonIndex >= 0 ? jsonIndex : formIndex;
    assert.ok(guardIndex >= 0);
    assert.ok(bodyIndex >= 0);
    assert.ok(guardIndex < bodyIndex);
    assert.ok(postSource.includes('{ status: 403, headers: { "cache-control": "no-store" } }'));
  }

  const jobsPost = routeSources[0].slice(routeSources[0].indexOf("export async function POST"));
  const messagesPost = routeSources[1].slice(routeSources[1].indexOf("export async function POST"));
  const profilePost = routeSources[2].slice(routeSources[2].indexOf("export async function POST"));
  assert.ok(jobsPost.indexOf("providerForSession") < jobsPost.indexOf("request.formData()"));
  assert.ok(messagesPost.indexOf("getAccountSession") < messagesPost.indexOf("request.json()"));
  assert.ok(profilePost.indexOf("activeProvider") < profilePost.indexOf("request.formData()"));
  assert.ok(securitySource.includes("new URL(origin).origin === new URL(request.url).origin"));
  assert.ok(securitySource.includes('fetchSite === "same-origin"'));
  assert.ok(securitySource.includes('fetchSite === "none"'));
});


test("provider workspaces never expose long-lived provider access tokens", async () => {
  const [
    dashboardSource,
    jobsApiSource,
    accountApiSource,
    businessSource,
    profileApiSource,
    mediaApiSource,
    publicProviderApiSource,
    storefrontSource,
    jobImagesSource,
  ] = await Promise.all([
    readFile(new URL("../app/provider-jobs/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/jobs/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/account/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/components/provider-business-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/provider-profile/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/provider-media/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/public-provider/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/providers/[slug]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/job-images/route.ts", import.meta.url), "utf8"),
  ]);

  assert.ok(jobsApiSource.includes("getAccountSession(request)"));
  assert.ok(jobsApiSource.includes("providerAccountFor(session.email)"));
  assert.ok(profileApiSource.includes("getAccountSession(request)"));
  assert.ok(mediaApiSource.includes("getAccountSession(request)"));
  assert.ok(publicProviderApiSource.includes("getAccountSession(request)"));
  assert.ok(jobImagesSource.includes("providerAccountFor(session.email)"));
  assert.ok(!accountApiSource.includes("accessToken: provider.accessToken"));
  assert.ok(!dashboardSource.includes("providerToken"));
  assert.ok(!dashboardSource.includes("/api/jobs?token="));
  assert.ok(!businessSource.includes("?token="));
  assert.ok(!businessSource.includes('formData.set("token"'));
  assert.ok(!storefrontSource.includes("useSearchParams"));
  assert.ok(!mediaApiSource.includes('searchParams.get("token")'));
  assert.ok(!publicProviderApiSource.includes('searchParams.get("token")'));
  assert.ok(!jobImagesSource.includes("providerApplications.accessToken"));
});


test("customer account features are authenticated and backed by real records", async () => {
  const [
    customerSource,
    providerSource,
    accountSource,
    customerToolsSource,
    messagesSource,
    customerToolsComponent,
    messagesComponent,
    schemaSource,
    migrationSource,
  ] = await Promise.all([
    readFile(new URL("../app/customer/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/provider-jobs/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/account/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/customer-tools/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/messages/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/components/customer-account-tools.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/job-messages.tsx", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0025_legit_customer_workspace.sql", import.meta.url), "utf8"),
  ]);

  assert.ok(customerSource.includes('"messages"'));
  assert.ok(customerSource.includes('"saved"'));
  assert.ok(customerSource.includes('"settings"'));
  assert.ok(customerSource.includes('<JobMessages audience="customer" />'));
  assert.ok(customerSource.includes('activeView === "saved" || activeView === "settings"'));
  assert.ok(customerSource.includes("<CustomerAccountTools view={activeView} />"));
  assert.ok(providerSource.includes('onClick={() => setActiveView("messages")}'));
  assert.ok(providerSource.includes('<JobMessages audience="provider" />'));

  assert.ok(customerToolsSource.includes("getAccountSession(request)"));
  assert.ok(customerToolsSource.includes("inArray(providerQuotes.requestId"));
  assert.ok(customerToolsSource.includes('eq(providerApplications.status, "approved")'));
  assert.ok(customerToolsSource.includes('eq(providerApplications.verificationStatus, "verified")'));
  assert.ok(customerToolsSource.includes('eq(providerApplications.isTestProvider, "no")'));
  assert.ok(messagesSource.includes("getAccountSession(request)"));
  assert.ok(messagesSource.includes('eq(providerQuotes.status, "accepted")'));
  assert.ok(messagesSource.includes("conversations.find((item) => item.requestId === requestId)"));
  assert.ok(messagesSource.includes("recipientEmail: (session.role === \"customer\""));
  assert.ok(messagesComponent.includes("Do not share passwords, payment-card details"));
  assert.ok(messagesComponent.includes("Tuveloz stores messages and may review them"));
  assert.ok(customerToolsComponent.includes("Existing job requests keep the name originally submitted."));
  assert.ok(!providerSource.includes("Only you and that customer can view the conversation."));
  assert.ok(accountSource.includes('lower(${customerRequests.email}) = ${session.email.toLowerCase()}'));

  assert.ok(schemaSource.includes('export const customerProfiles = sqliteTable'));
  assert.ok(schemaSource.includes('export const savedProviders = sqliteTable'));
  assert.ok(schemaSource.includes('export const jobMessages = sqliteTable'));
  assert.ok(migrationSource.includes('CREATE TABLE `customer_profiles`'));
  assert.ok(migrationSource.includes('CREATE TABLE `saved_providers`'));
  assert.ok(migrationSource.includes('CREATE TABLE `job_messages`'));

  // The customer workspace itself still collects no phone number.
  for (const source of [customerToolsSource, customerToolsComponent, migrationSource]) {
    assert.ok(!/\bphone\b/i.test(source));
    assert.ok(!source.includes("emailNotifications"));
    assert.ok(!source.includes("email_notifications"));
  }
  assert.ok(!schemaSource.includes("emailNotifications"));
  assert.ok(!schemaSource.includes("email_notifications"));

  // db/schema.ts is no longer blanket phone-free: fleet_inquiries takes a
  // business contact number. The rule it carries is now stricter and specific
  // — any table storing a contact phone must store a marketing-consent basis
  // beside it, so a number can never be promoted to a marketing list by
  // existing. See tests/fleet-and-vehicles.test.mjs for the pairing check.
  assert.equal(
    schemaSource.includes('text("contact_phone")'),
    schemaSource.includes('text("sms_marketing_consent_version")'),
  );
});


test("owner control center uses signed access and exposes focused factual tools", async () => {
  const [
    pageSource,
    controlSource,
    accountSource,
    sessionSource,
    ownerAuthSource,
    legacyAdminSource,
    jobActionSource,
    providerActionSource,
    paymentSource,
    paymentUiSource,
  ] = await Promise.all([
    readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/owner-control-center.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/control-center/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/users/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/owner-auth.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/requests/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/providers/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/stripe/admin/payments/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/components/stripe-payment-admin.tsx", import.meta.url), "utf8"),
  ]);

  for (const label of [
    "User management",
    "Provider approvals",
    "Jobs",
    "Payments",
    "Reports",
    "Analytics",
    "Platform settings",
  ]) {
    assert.ok(controlSource.includes(label), `Missing owner tool: ${label}`);
  }

  assert.ok(pageSource.includes('fetch("/api/admin/control-center"'));
  assert.ok(pageSource.includes('hidden={activeAdminView !== "jobs"}'));
  assert.ok(pageSource.includes('hidden={activeAdminView !== "providers"}'));
  assert.ok(pageSource.includes('hidden={activeAdminView !== "reports"}'));
  assert.ok(pageSource.includes('activeAdminView === "payments"'));

  assert.ok(ownerAuthSource.includes("createRemoteJWKSet"));
  assert.ok(ownerAuthSource.includes("jwtVerify"));
  assert.ok(ownerAuthSource.includes('algorithms: ["RS256"]'));
  assert.ok(ownerAuthSource.includes("issuer: teamDomain"));
  assert.ok(ownerAuthSource.includes("audience"));
  assert.ok(ownerAuthSource.includes("cf-access-jwt-assertion"));
  assert.ok(ownerAuthSource.includes("OWNER_ACCESS_AUD"));
  assert.ok(ownerAuthSource.includes("POLICY_AUD"));
  assert.ok(pageSource.includes('fetch("/api/admin", { cache: "no-store" })'));
  assert.ok(!pageSource.includes('window.location.replace("/")'));
  for (const signedOwnerSource of [
    accountSource,
    sessionSource,
    jobActionSource,
    providerActionSource,
    paymentSource,
  ]) {
    assert.ok(signedOwnerSource.includes("await isVerifiedOwnerRequest(request)"));
    assert.ok(!signedOwnerSource.includes("isOwnerRequest(request)"));
  }
  assert.ok(legacyAdminSource.includes("await verifyOwnerRequest(request)"));
  assert.ok(sessionSource.includes("isSameOriginRequest(request)"));
  assert.ok(jobActionSource.includes("isSameOriginRequest(request)"));
  assert.ok(providerActionSource.includes("isSameOriginRequest(request)"));
  assert.ok(paymentSource.includes("isSameOriginRequest(request)"));

  assert.ok(!pageSource.includes("Copy customer link"));
  assert.ok(!pageSource.includes("Copy provider link"));
  assert.ok(!pageSource.includes("?token="));
  assert.ok(!jobActionSource.includes('"create-link"'));
  assert.ok(!providerActionSource.includes("crypto.randomUUID"));
  assert.ok(legacyAdminSource.includes("const safeRequests"));
  assert.ok(legacyAdminSource.includes("const safeProviders"));
  assert.ok(legacyAdminSource.includes('"cache-control": "no-store"'));

  for (const secretField of [
    "passwordHash",
    "passwordSalt",
    "passwordIterations",
    "tokenHash",
    "codeHash",
    "accessToken",
  ]) {
    assert.ok(!accountSource.includes(secretField), `Sensitive field selected: ${secretField}`);
  }

  assert.ok(accountSource.includes("activeSessionCount"));
  assert.ok(accountSource.includes("paymentCount"));
  assert.ok(paymentSource.includes("accountCredentials"));
  assert.ok(paymentSource.includes("customerProfiles"));
  assert.ok(paymentSource.includes("customerHasAccount"));
  assert.ok(paymentSource.includes("lower(${accountCredentials.email})"));
  assert.ok(paymentSource.includes("lower(${customerProfiles.email})"));
  assert.ok(paymentSource.includes("lower(${stripePayments.customerEmail})"));
  assert.ok(paymentUiSource.includes("Customer contact:"));
  assert.ok(paymentUiSource.includes("Tuveloz account:"));
  assert.ok(paymentUiSource.includes("No matching sign-in account"));
  assert.ok(accountSource.includes('verificationStatus === "verified"'));
  assert.ok(accountSource.includes('isTestProvider === "no"'));
  assert.ok(controlSource.includes("Read-only runtime facts"));
  assert.ok(controlSource.includes("exact counts from Tuveloz records"));
  assert.ok(controlSource.includes("does not pretend"));
  assert.ok(controlSource.includes("Live money must remain off"));
  assert.ok(!controlSource.includes("Enable live payments"));
});

test("public claims scope credential records while real provider auth requires exact v0.11 gates", async () => {
  const [
    requirementSource,
    schemaSource,
    migrationSource,
    adminActionSource,
    adminPageSource,
    publicApiSource,
    publicAccessSource,
    publicPageSource,
    accountAuthSource,
  ] = await Promise.all([
    readFile(new URL("../lib/provider-credentials.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0027_verified_provider_credentials.sql", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/providers/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/public-provider/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/public-provider-page.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/providers/[slug]/provider-storefront-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/account-auth.ts", import.meta.url), "utf8"),
  ]);

  assert.ok(schemaSource.includes("export const providerCredentialVerifications = sqliteTable"));
  assert.ok(schemaSource.includes('"provider_credential_verifications"'));
  assert.ok(migrationSource.includes("CREATE TABLE `provider_credential_verifications`"));
  assert.ok(migrationSource.includes("provider_requirement_unique"));

  assert.ok(requirementSource.includes("Montgomery County motor-vehicle repair registration"));
  assert.ok(requirementSource.includes("Maryland safety-inspection station license"));
  assert.ok(requirementSource.includes("Maryland safety-inspection mechanic registration"));
  assert.ok(requirementSource.includes("https://www.montgomerycountymd.gov/OCP/licensing/mvr_tow_main.html"));
  assert.ok(requirementSource.includes("https://egov.maryland.gov/msp/msis/Lookup"));
  assert.ok(requirementSource.includes('assessment.diagnosticsScope === "official-authorized"'));
  assert.ok(requirementSource.includes('record.status !== "verified"'));
  assert.ok(requirementSource.includes("record.expiresAt"));

  assert.ok(adminActionSource.includes("isVerifiedOwnerRequest(request)"));
  assert.ok(adminActionSource.includes("isSameOriginRequest(request)"));
  assert.ok(adminActionSource.includes('body.action === "save-credential"'));
  assert.ok(adminActionSource.includes('body.action === "verify"'));
  assert.ok(adminActionSource.includes("LEGACY_VERIFICATION_DISABLED"));
  assert.ok(adminActionSource.includes('verificationStatus: "test"'));
  assert.ok(adminActionSource.includes('isTestProvider: "yes"'));
  assert.ok(adminActionSource.includes('alertsEnabled: "no"'));
  assert.ok(!adminActionSource.includes("requiredProviderCredentialRequirements("));

  assert.ok(adminPageSource.includes("Official government credential checks"));
  assert.ok(adminPageSource.includes("Do not store Social Security numbers"));
  assert.ok(adminPageSource.includes("Official requirement"));
  assert.ok(adminPageSource.includes("Official lookup"));
  assert.ok(!adminPageSource.includes("Tuveloz verified badge"));

  assert.ok(publicAccessSource.includes("providerCredentialRecordIsCurrent"));
  assert.ok(publicAccessSource.includes("credentialRequirementsSatisfied"));
  assert.ok(publicApiSource.includes("evaluateProviderPublicAccess"));
  assert.ok(publicApiSource.includes("credentialRequirementsSatisfied"));
  assert.ok(publicApiSource.includes("noGovernmentCredentialTriggered"));
  assert.ok(!publicApiSource.includes("credentialIdentifier: record.credentialIdentifier"));
  assert.ok(!publicAccessSource.includes("credentialIdentifier: record.credentialIdentifier"));
  assert.ok(publicPageSource.includes("Confirmed for this service"));
  assert.ok(publicPageSource.includes("No credential record displayed for this scope"));
  assert.ok(publicPageSource.includes("not a blanket licensed-provider claim"));
  assert.ok(publicPageSource.includes("Provider-supplied profile"));
  assert.ok(publicPageSource.includes("Profile-listed services"));
  assert.ok(publicPageSource.includes("Status can change after the check; recheck the official lookup before work."));
  assert.ok(!publicPageSource.includes("Not legally triggered"));
  assert.ok(!publicPageSource.includes("Approved work"));
  assert.ok(!publicPageSource.includes("Verified reviews"));
  assert.ok(!publicPageSource.includes("✓ Tuveloz verified"));
  assert.ok(!publicPageSource.includes("Verified identity"));

  assert.ok(accountAuthSource.includes("providerCredentialRequirementsAreSatisfied"));
  assert.ok(accountAuthSource.includes("providerCredentialVerifications"));
  assert.ok(accountAuthSource.includes("providerServiceEligibility"));
  assert.ok(accountAuthSource.includes('profile.relationshipPath !== "independent_startup"'));
  assert.ok(accountAuthSource.includes("profile.policyVersion !== POLICY_VERSION"));
});

test("public review and payout copy does not overstate platform verification", async () => {
  const [homeSource, publicPageSource, paymentCardSource] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/providers/[slug]/provider-storefront-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/quote-payment-card.tsx", import.meta.url), "utf8"),
  ]);

  assert.ok(homeSource.includes("Reviews linked to a completed Tuveloz job"));
  assert.ok(homeSource.includes("does not independently verify"));
  assert.ok(!homeSource.includes("Verified customer reviews"));
  assert.ok(publicPageSource.includes("A completed-job link confirms a Tuveloz job record."));
  assert.ok(publicPageSource.includes("supplied by the provider unless specifically"));
  assert.ok(paymentCardSource.includes("administrative payment-control step only"));
  assert.ok(paymentCardSource.includes("inspection, endorsement, or certification of repairs"));
});

test("owner Access identifiers survive every Cloudflare deployment", async () => {
  const [wranglerSource, ownerAuthSource, adminApiSource, adminPageSource] = await Promise.all([
    readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8"),
    readFile(new URL("../lib/owner-auth.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.ok(wranglerSource.includes('"TEAM_DOMAIN": "https://old-violet-1b67.cloudflareaccess.com"'));
  assert.ok(wranglerSource.includes('"OWNER_ACCESS_AUD": "e440192c4dcff94d592a94c4661dddb4df210f07c10611a47dd308480149ed06"'));
  assert.ok(ownerAuthSource.includes("variables.OWNER_ACCESS_AUD?.trim()"));
  assert.ok(ownerAuthSource.includes("variables.POLICY_AUD?.trim()"));
  assert.ok(adminApiSource.includes("verification.reason"));
  assert.ok(adminApiSource.includes('"cache-control": "no-store"'));
  assert.ok(adminPageSource.includes('fetch("/api/admin", { cache: "no-store" })'));
  assert.ok(!adminPageSource.includes('window.location.replace("/")'));
});


test("browser assets never expose private build paths or broken generated fonts", async () => {
  const distDirectory = fileURLToPath(new URL("../dist", import.meta.url));
  const files = (await builtFiles(distDirectory))
    .filter((path) => [".css", ".html"].includes(extname(path)));
  const contents = (await Promise.all(
    files.map((path) => readFile(path, "utf8")),
  )).join("\n");
  const layout = await readFile(
    new URL("../app/layout.tsx", import.meta.url),
    "utf8",
  );

  assert.ok(!contents.includes("/workspace/"));
  assert.ok(!contents.includes(".vinext/fonts"));
  assert.ok(!layout.includes("next/font"));
  assert.ok(layout.includes('className="antialiased"'));
});

test("guest request consent choices are optional, explicit, and recorded", async () => {
  const [pageSource, routeSource, schemaSource] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/requests/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
  ]);

  assert.ok(pageSource.includes('name="remember-email-consent"'));
  assert.ok(pageSource.includes('name="marketing-consent"'));
  assert.ok(!pageSource.includes('required name="remember-email-consent"'));
  assert.ok(!pageSource.includes('required name="marketing-consent"'));
  assert.ok(pageSource.includes("Create a reusable guest profile"));
  assert.ok(pageSource.includes("Email me occasional Tuveloz promotions"));
  assert.ok(pageSource.includes("Promotions are sent only if you opt in."));
  assert.ok(pageSource.includes("Save these records in an account"));
  assert.ok(pageSource.includes("After you verify the same email"));

  assert.ok(routeSource.includes('formData.get("remember-email-consent")'));
  assert.ok(routeSource.includes('formData.get("marketing-consent")'));
  assert.ok(routeSource.includes('rememberEmailConsent: rememberEmailConsent ? "yes" : "no"'));
  assert.ok(routeSource.includes('marketingConsent: marketingConsent ? "yes" : "no"'));
  assert.ok(routeSource.includes('consentSource: "post-a-job"'));
  assert.ok(routeSource.includes("GUEST_PROFILE_CONSENT_TEXT"));
  assert.ok(routeSource.includes("MARKETING_CONSENT_TEXT"));

  assert.ok(schemaSource.includes('text("remember_email_consent")'));
  assert.ok(schemaSource.includes('text("marketing_consent")'));
  assert.ok(schemaSource.includes('text("consent_recorded_at")'));
});


test("automatic provider alerts, security notifications, and idle session expiry are wired", async () => {
  const [requestRoute, accountAuth, passkeys, notifications, schema, migration] =
    await Promise.all([
      readFile(new URL("../app/api/requests/route.ts", import.meta.url), "utf8"),
      readFile(new URL("../lib/account-auth.ts", import.meta.url), "utf8"),
      readFile(new URL("../lib/passkeys.ts", import.meta.url), "utf8"),
      readFile(new URL("../lib/email-notifications.ts", import.meta.url), "utf8"),
      readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
      readFile(new URL("../drizzle/0030_email_notification_outbox.sql", import.meta.url), "utf8"),
    ]);

  assert.ok(requestRoute.includes("decideAutomaticJobRouting"));
  assert.ok(requestRoute.includes("automaticDecision.matchingProviders.map"));
  assert.ok(requestRoute.includes("New eligible TUVELOZ job request"));
  assert.ok(!requestRoute.includes("sendNewCustomerRequestAlert(id)"));
  assert.ok(accountAuth.includes("SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000"));
  assert.ok(accountAuth.includes("SESSION_LIFETIME_SECONDS = 12 * 60 * 60"));
  assert.ok(accountAuth.includes("idleExpired"));
  assert.ok(accountAuth.includes('"password_reset"'));
  assert.ok(passkeys.includes('"passkey_added"'));
  assert.ok(notifications.includes("Idempotency-Key"));
  assert.ok(notifications.includes("emailNotificationOutbox"));
  assert.ok(notifications.includes("/admin"));
  assert.ok(schema.includes("email_notification_outbox"));
  assert.ok(migration.includes("email_notification_outbox_event_key_unique"));
});
