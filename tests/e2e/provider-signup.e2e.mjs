// End-to-end provider signup, against a real dev server and a real local D1.
//
// Not part of `npm test`: that suite is static analysis and finishes in under a
// second, while this boots a server. Run it with `npm run test:e2e`.
//
// Isolation is the whole point. Everything happens inside a throwaway git
// worktree with its own .wrangler state and its own .dev.vars, so a second
// agent working in the checkout is neither disturbed nor able to disturb this.
// No production credential is used and no real email is sent: delivery is
// pointed at scripts/dev-mail-catcher.mjs, which is how the test learns the
// verification code it must echo back.

import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:net";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const APP_PORT = 3011; // deliberately not 3000-3003: those belong to other sessions
const wrangler = join(repoRoot, "node_modules", "wrangler", "bin", "wrangler.js");

const log = (msg) => console.log(`[e2e] ${msg}`);
// maxBuffer is raised well past Node's 1 MB default: `d1 migrations apply`
// prints a table row per migration, and the suite crossed that ceiling at
// sixty migrations with an ENOBUFS that looks nothing like the real cause.
const sh = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, {
    encoding: "utf8",
    stdio: "pipe",
    maxBuffer: 64 * 1024 * 1024,
    ...opts,
  });

const waitFor = async (label, probe, timeoutMs = 180_000, failure = () => null) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const fatal = failure();
    if (fatal) throw fatal;
    try {
      if (await probe()) return;
    } catch { /* not ready yet */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`timed out waiting for ${label}`);
};

const availableLoopbackPort = () => new Promise((resolve, reject) => {
  const server = createServer();
  server.once("error", reject);
  server.listen(0, "127.0.0.1", () => {
    const address = server.address();
    if (!address || typeof address === "string") {
      server.close(() => reject(new Error("could not allocate a loopback port")));
      return;
    }
    server.close((error) => (error ? reject(error) : resolve(address.port)));
  });
});

const cleanups = [];
const cleanUp = () => {
  while (cleanups.length) {
    try { cleanups.pop()(); } catch { /* best effort */ }
  }
};
process.on("exit", cleanUp);
process.on("SIGINT", () => { cleanUp(); process.exit(130); });

// --- the application fixture, mirroring what provider-signup-form.tsx posts ---
// Unique per run. The worktree's local D1 is reused between runs, and a repeat
// email is treated as an already-claimed application: the route returns early,
// before the certificate write, and the test would fail for the wrong reason.
const applicantEmail = `e2e-provider+${Date.now()}@tuveloz.invalid`;
const customerEmail = `e2e-customer+${Date.now()}@tuveloz.invalid`;
// Meets lib/account-auth.ts: length, an uppercase letter, and a special
// character. Local fixture only; it never leaves the throwaway worktree. Both
// the customer and the provider account below are created with it.
const fixturePassword = "E2e-Local-Fixture!7";

const buildPayload = (policy) => ({
  name: "E2E Mobile Mechanic",
  email: applicantEmail,
  phone: "",
  preferredLanguage: "English",
  services: ["provisional_12v_jump_start"],
  serviceCodes: ["provisional_12v_jump_start"],
  applicationPathway: "independent_startup",
  providerPathway: "independent_startup",
  providerLevel: "provisional_independent",
  learningAccountOnly: false,
  policyVersion: policy.version,
  policyStatus: policy.status,
  policyJurisdiction: policy.jurisdiction,
  serviceArea: "Montgomery County, Maryland",
  businessMunicipality: "Silver Spring",
  legalBusinessName: "E2E Mobile Mechanic",
  businessEntityType: "sole_proprietor",
  businessFormationState: "Maryland",
  workLocations: ["I travel to customers"],
  businessServiceAddress: "",
  experience: "",
  insuranceStatus: "",
  rulesReviewed: true,
  providerAttestation: true,
  legalResponsibility: true,
  signerName: "Local Testcase",
  signerTitle: "Owner",
  performingPersonFirstName: "Local",
  performingPersonLastName: "Testcase",
  performingPersonIdentityAcknowledged: true,
  adultAcknowledged: true,
  employmentWorkAuthorizationResponsibilityAcknowledged: true,
  termsBundleAccepted: true,
  privacyAcknowledged: true,
  providerSelfAssessment: {},
  // The point of the exercise: an optional certificate must survive the round
  // trip and land as an unverified, non-public row.
  optionalCertificates: [
    {
      category: "icar",
      title: "I-CAR Structural Technician",
      credentialIdentifier: "E2E-0001",
      issuingAuthority: "I-CAR",
    },
  ],
});

// The write routes demand a strict same-origin request, so these headers have
// to match whatever port the server actually claimed — see resolveOrigin.
const sameOriginHeaders = (origin) => ({
  "content-type": "application/json",
  origin,
  referer: `${origin}/join`,
});

const d1 = (workdir, sql) => {
  const out = sh("node", [wrangler, "d1", "execute", "tuveloz-db", "--local", "--json", "--command", sql], { cwd: workdir });
  const match = out.match(/\[[\s\S]*\]/);
  if (!match) throw new Error(`unparseable d1 output: ${out.slice(0, 300)}`);
  return JSON.parse(match[0])[0].results;
};

async function main() {
  const mailPort = await availableLoopbackPort();
  // 1. Throwaway worktree at HEAD -------------------------------------------
  // The path is stable, not a mkdtemp, and the worktree is kept between runs.
  //
  // Vite keys its dependency cache by absolute path, so a fresh directory each
  // time would miss the cache and — worse, if node_modules were shared with the
  // checkout — would rewrite entries the other dev server depends on. A fixed
  // location with its own node_modules keeps both sides stable: this run cannot
  // disturb a colleague's server, and the install cost is paid once.
  // realpath, not tmpdir() directly: on Windows tmpdir() can come back in 8.3
  // short form (TORTAP~1), and Vite's watcher resolves the long form. libuv
  // asserts on the mismatch and kills the dev server before it serves anything.
  // On CI the checkout is disposable and nobody else is working in it, so the
  // worktree — and a second npm ci — buys nothing. Guarded twice: only when CI
  // says so *and* there is no .dev.vars to overwrite, which is exactly the
  // shape of a fresh runner and never the shape of a developer's machine.
  const checkoutIsDisposable = process.env.CI === "true"
    && !existsSync(join(repoRoot, ".dev.vars"));

  // Namespaced by repository and branch, not a single shared path.
  //
  // A fixed directory made reruns fast but let two branches share one local D1.
  // Migration lineages that diverged — different files under the same 0055,
  // 0056 numbers — then applied on top of each other, and the second branch
  // failed with a duplicate column from the first branch's schema. Namespacing
  // keeps the speed (node_modules is still reused per branch) without letting
  // one lineage's database masquerade as another's.
  const repoKey = createHash("sha256")
    .update(realpathSync.native(repoRoot))
    .digest("hex")
    .slice(0, 8);
  const branchRef = (() => {
    const named = sh("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: repoRoot }).trim();
    // Detached HEAD reports "HEAD"; fall back to the commit so it is still stable.
    const ref = named === "HEAD"
      ? sh("git", ["rev-parse", "--short", "HEAD"], { cwd: repoRoot }).trim()
      : named;
    return ref.replace(/[^A-Za-z0-9._-]+/g, "-").slice(0, 40);
  })();
  const workdir = checkoutIsDisposable
    ? repoRoot
    : join(realpathSync.native(tmpdir()), `tuveloz-e2e-${repoKey}-${branchRef}`);
  const alreadyPrepared = checkoutIsDisposable
    || existsSync(join(workdir, "node_modules", "vinext"));

  if (checkoutIsDisposable) {
    log("CI runner: using the checkout directly");
  } else {
    // Never run a checkout in repoRoot: that is the developer's working branch.
    const head = sh("git", ["rev-parse", "HEAD"], { cwd: repoRoot }).trim();

    if (existsSync(join(workdir, ".git"))) {
      log(`reusing prepared worktree at ${head.slice(0, 7)}`);
      sh("git", ["-C", workdir, "checkout", "--detach", "--force", head], { cwd: repoRoot });
    } else {
      rmSync(workdir, { recursive: true, force: true });
      log(`creating worktree at ${workdir}`);
      sh("git", ["worktree", "add", "--detach", workdir, "HEAD"], { cwd: repoRoot });
    }

    // The worktree is a commit, so by default this proves HEAD works, not what
    // is about to be shipped. With E2E_OVERLAY_WORKING_TREE=1 the checkout's
    // uncommitted edits to tracked files are copied over the worktree after the
    // reset above, so a signup change can be exercised before it is committed.
    // Untracked new files are not copied — `git diff` does not list them. The
    // copy is one-way: nothing is ever written back into the checkout.
    if (process.env.E2E_OVERLAY_WORKING_TREE === "1") {
      const changed = sh("git", ["diff", "--name-only", "HEAD"], { cwd: repoRoot })
        .split("\n").map((line) => line.trim()).filter(Boolean);
      for (const relativePath of changed) {
        const from = join(repoRoot, relativePath);
        if (!existsSync(from)) continue;
        mkdirSync(dirname(join(workdir, relativePath)), { recursive: true });
        copyFileSync(from, join(workdir, relativePath));
      }
      log(`overlaid ${changed.length} uncommitted file(s) from the checkout`);
    }
  }

  if (!alreadyPrepared) {
    log("installing dependencies for the worktree (first run only, a few minutes)");
    sh("npm", ["ci", "--no-audit", "--no-fund"], {
      cwd: workdir, stdio: "inherit", shell: process.platform === "win32",
    });
  }

  // 2. Its own .dev.vars — the checkout's copy is read, never written --------
  const targetVars = join(workdir, ".dev.vars");
  // The fixture uses only dummy values; it never copies the checkout's .dev.vars.
  writeFileSync(targetVars, [
    `RESEND_BASE_URL=http://127.0.0.1:${mailPort}`,
    // Any non-empty pair satisfies the configured check; nothing reaches Resend.
    "RESEND_API_KEY=e2e-local-not-a-real-key",
    "RESEND_FROM_EMAIL=Tuveloz E2E <e2e@localhost>",
    "AUTH_CODE_SECRET=e2e-local-secret-value-32-chars-min",
    "",
  ].join("\n"));

  // 3. Schema -----------------------------------------------------------------
  // Same reset CI performs before migrating: migrations are additive and
  // assume an empty database, so replaying them over a previous run's schema
  // fails on already-present columns. Only .wrangler/state goes — node_modules
  // survives, which is what makes a rerun fast.
  rmSync(join(workdir, ".wrangler", "state"), { recursive: true, force: true });

  log("applying migrations to the worktree's local D1");
  sh("node", [wrangler, "d1", "migrations", "apply", "tuveloz-db", "--local"], {
    cwd: workdir, input: "y\n", stdio: ["pipe", "pipe", "pipe"],
  });

  // 4. Mail catcher ------------------------------------------------------------
  let catcherFailure = null;
  const catcher = spawn("node", [join(repoRoot, "scripts", "dev-mail-catcher.mjs"), "--port", String(mailPort)], { stdio: "ignore" });
  catcher.on("error", (error) => { catcherFailure = error; });
  catcher.on("exit", (code, signal) => {
    if (code !== 0 && signal !== "SIGTERM") {
      catcherFailure = new Error(`mail catcher exited code=${code} signal=${signal}`);
    }
  });
  cleanups.push(() => catcher.kill());
  await waitFor(
    "mail catcher",
    async () => (await fetch(`http://127.0.0.1:${mailPort}/messages`)).ok,
    180_000,
    () => catcherFailure,
  );
  log("mail catcher up");

  // 5. Dev server --------------------------------------------------------------
  // Keep the server's own output: when it fails to boot, the reason is in here
  // and nowhere else.
  // Inside the worktree, not the checkout: the checkout has another agent's
  // dev server watching it, and a stray file there is both noise and fragile.
  const serverLog = join(workdir, ".e2e-dev-server.log");
  // Pipes, not a file descriptor: a child writing to a file block-buffers, so
  // the "Local: http://localhost:NNNN/" line can sit unflushed for the whole
  // poll. Data events arrive immediately.
  //
  // Vite also colours its output, so the port arrives wrapped in escape
  // sequences; strip them or the port regex silently never matches.
  let serverOutput = "";
  const readServerLog = () => serverOutput;
  const server = spawn(process.execPath, [
    join(workdir, "node_modules", "vinext", "dist", "cli.js"),
    "dev", "--port", String(APP_PORT),
  ], { cwd: workdir, stdio: ["ignore", "pipe", "pipe"] });
  const collect = (chunk) => {
    serverOutput += String(chunk).replace(/[[0-9;]*m/g, "");
    try { writeFileSync(serverLog, serverOutput); } catch { /* log is a nicety */ }
  };
  server.stdout.on("data", collect);
  server.stderr.on("data", collect);
  let serverExit = null;
  server.on("exit", (code, signal) => { serverExit = `exited code=${code} signal=${signal}`; });
  server.on("error", (err) => { serverExit = `spawn error: ${err.message}`; });
  cleanups.push(() => server.kill());

  // vinext walks forward when a port is taken, and other sessions on this
  // machine routinely hold 3000-3012. Trust the server's own announcement
  // rather than the port that was requested.
  let origin = `http://localhost:${APP_PORT}`;
  try {
    await waitFor("dev server port", () => {
      const announced = readFileSync(serverLog, "utf8").match(/localhost:(\d{4,5})/);
      if (!announced) return false;
      origin = `http://localhost:${announced[1]}`;
      return true;
    }, 240_000);
    log(`dev server announced ${origin}`);
    await waitFor("dev server", async () => (await fetch(`${origin}/api/health`)).ok);
  } catch (error) {
    console.error(`[e2e] dev server never answered. Log at ${serverLog}:`);
    console.error(serverExit ? `server ` : "server still running");
    console.error(readServerLog().slice(-2000) || "(log empty)");
    throw error;
  }
  log("dev server ready");

  // 6. Request the code --------------------------------------------------------
  // Read the same matrix lib/provider-policy.ts reads, so the fixture cannot
  // drift out of step with the policy version the server expects.
  const matrix = JSON.parse(
    readFileSync(join(repoRoot, "config", "provider-eligibility-matrix.json"), "utf8"),
  );
  const policy = {
    version: matrix.schema_version,
    status: matrix.status,
    jurisdiction: matrix.jurisdiction,
  };
  assert.ok(policy.version, "provider eligibility matrix has no schema_version");

  const payload = buildPayload(policy);
  const challengeRes = await fetch(`${origin}/api/providers/challenge`, {
    method: "POST", headers: sameOriginHeaders(origin), body: JSON.stringify(payload),
  });
  const challengeBody = await challengeRes.json();
  assert.equal(challengeRes.status, 202, `challenge failed: ${JSON.stringify(challengeBody)}`);
  assert.ok(challengeBody.challengeId, "no challengeId returned");
  log("challenge issued");

  // 7. Read the code out of the catcher, not an inbox --------------------------
  const caught = await (await fetch(`http://127.0.0.1:${mailPort}/messages/latest`)).json();
  assert.equal(caught.to[0], applicantEmail, "code went to the wrong recipient");
  assert.match(caught.code, /^\d{6}$/, `no 6-digit code in: ${caught.text}`);
  log(`code captured: ${caught.code}`);

  // 8. Complete the application ------------------------------------------------
  const submitRes = await fetch(`${origin}/api/providers`, {
    method: "POST",
    headers: sameOriginHeaders(origin),
    body: JSON.stringify({
      ...payload,
      challengeId: challengeBody.challengeId,
      verificationCode: caught.code,
      analyticsAttribution: {
        utm_source: "e2e", utm_campaign: "provider_first_5", variants: { provider_hero: "A" },
        email: "must-not-enter-analytics@example.invalid",
      },
    }),
  });
  const submitBody = await submitRes.json();
  assert.ok(submitRes.ok, `submit failed (${submitRes.status}): ${JSON.stringify(submitBody)}`);
  log("application accepted");

  // 9. Assert against the database, not the response -------------------------
  const apps = d1(workdir, `SELECT id, email, status FROM provider_applications WHERE email='${applicantEmail}';`);
  assert.equal(apps.length, 1, "expected exactly one application row");

  const creds = d1(workdir, `SELECT category, status, public_display FROM provider_submitted_credentials WHERE provider_id='${apps[0].id}';`);
  assert.equal(creds.length, 1, "expected the declared certificate to be stored");
  assert.equal(creds[0].category, "icar", "certificate category did not round-trip");
  assert.equal(creds[0].status, "pending", "a declared certificate must start unverified");
  assert.equal(creds[0].public_display, "no", "a declared certificate must not be customer-visible");

  const challengesLeft = d1(workdir, `SELECT COUNT(*) AS n FROM provider_application_challenges WHERE used_at='';`);
  assert.equal(Number(challengesLeft[0].n), 0, "the challenge should be consumed");

  // Signing up proves email control and nothing else. Neither field may claim a
  // review that never happened: "new" is an application awaiting owner review,
  // and customer-facing surfaces key off verification_status === "verified"
  // (lib/provider-alerts.ts, lib/provider-eligibility-engine.ts).
  const enrolled = d1(workdir, `SELECT status, verification_status FROM provider_applications WHERE email='${applicantEmail}';`);
  assert.equal(
    enrolled[0].status,
    "new",
    "signup must not advance an application past owner review",
  );
  assert.notEqual(
    enrolled[0].verification_status,
    "verified",
    "signup must not stamp a provider as verified",
  );
  assert.equal(
    enrolled[0].verification_status,
    "not reviewed",
    "the schema default is what a fresh application should carry",
  );
  log("provider signup verified");

  // Saved applications, not a browser's success screen, determine completion.
  const completions = () => d1(workdir, "SELECT props FROM analytics_events WHERE event='provider_application_submitted';");
  assert.equal(completions().length, 1, "one new application must create one server completion");
  assert.deepEqual(JSON.parse(completions()[0].props), {
    utm_source: "e2e", utm_campaign: "provider_first_5", variants: { provider_hero: "A" },
  });
  const duplicateChallengeRes = await fetch(`${origin}/api/providers/challenge`, {
    method: "POST", headers: sameOriginHeaders(origin), body: JSON.stringify(payload),
  });
  assert.equal(duplicateChallengeRes.status, 202);
  const duplicateChallenge = await duplicateChallengeRes.json();
  const duplicateMail = await (await fetch(`http://127.0.0.1:${mailPort}/messages/latest`)).json();
  assert.equal(duplicateMail.to[0], applicantEmail);
  const duplicateSubmitRes = await fetch(`${origin}/api/providers`, {
    method: "POST", headers: sameOriginHeaders(origin), body: JSON.stringify({
      ...payload, challengeId: duplicateChallenge.challengeId, verificationCode: duplicateMail.code,
      analyticsAttribution: { utm_source: "duplicate" },
    }),
  });
  assert.equal(duplicateSubmitRes.status, 202, "repeat signup retains its privacy-preserving response");
  assert.equal(completions().length, 1, "repeat signup must not inflate recruitment totals");
  assert.equal(d1(workdir, `SELECT id FROM provider_applications WHERE email='${applicantEmail}';`).length, 1);
  for (const event of ["provider_application_submitted", "provider_signup_completed"]) {
    const forged = await fetch(`${origin}/api/analytics`, {
      method: "POST", headers: sameOriginHeaders(origin), body: JSON.stringify({ event }),
    });
    assert.equal(forged.status, 400, "public telemetry must reject claimed application completions");
  }
  const stage = await fetch(`${origin}/api/analytics`, {
    method: "POST", headers: sameOriginHeaders(origin), body: JSON.stringify({
      event: "provider_verification_requested", props: { utm_source: "e2e", email: applicantEmail },
    }),
  });
  assert.equal(stage.status, 202, "valid stage events must still work");
  const stageRows = d1(workdir, "SELECT props FROM analytics_events WHERE event='provider_verification_requested';");
  assert.deepEqual(JSON.parse(stageRows[0].props), { utm_source: "e2e" });
  log("server-confirmed campaign tracking, repeat signup and forged-event rejection verified");

  // 10. Customer account signup ------------------------------------------------
  // The other half of "can people actually sign up". A customer never touches
  // the provider application; they create a password account, which is open
  // while the marketplace itself is closed.
  const customerCodeRes = await fetch(`${origin}/api/auth/password/request`, {
    method: "POST",
    headers: sameOriginHeaders(origin),
    body: JSON.stringify({ email: customerEmail, role: "customer", purpose: "create" }),
  });
  assert.ok(customerCodeRes.ok, `customer code request failed (${customerCodeRes.status})`);

  const customerMail = await (await fetch(`http://127.0.0.1:${mailPort}/messages/latest`)).json();
  assert.equal(customerMail.to[0], customerEmail, "customer code went to the wrong recipient");
  assert.match(customerMail.code, /^\d{6}$/, `no 6-digit code in: ${customerMail.text}`);

  const customerCreateRes = await fetch(`${origin}/api/auth/password/complete`, {
    method: "POST",
    headers: sameOriginHeaders(origin),
    body: JSON.stringify({
      email: customerEmail,
      role: "customer",
      purpose: "create",
      code: customerMail.code,
      password: fixturePassword,
      termsAccepted: true,
      launchNotificationConsent: true,
    }),
  });
  const customerCreateBody = await customerCreateRes.json();
  assert.ok(
    customerCreateRes.ok,
    `customer signup failed (${customerCreateRes.status}): ${JSON.stringify(customerCreateBody)}`,
  );
  assert.ok(
    (customerCreateRes.headers.get("set-cookie") ?? "").length > 0,
    "a completed customer signup should return a session cookie",
  );

  const accounts = d1(workdir, `SELECT COUNT(*) AS n FROM account_credentials WHERE lower(email)='${customerEmail}';`);
  assert.equal(Number(accounts[0].n), 1, "expected exactly one customer credential row");
  log("customer signup verified");

  // 11. Both signups queue their notification ----------------------------------
  // Filtered here rather than in SQL: the command reaches wrangler through a
  // shell, and a LIKE pattern with % and colons does not survive the trip.
  const queued = d1(workdir, `SELECT event_key FROM email_notification_outbox;`);
  const alertKeys = queued.map((row) => row.event_key);
  assert.ok(
    alertKeys.some((key) => key.startsWith("marketplace:provider-onboarding:owner:application:")),
    `no owner alert for the provider application, saw: ${JSON.stringify(alertKeys)}`,
  );
  assert.ok(
    alertKeys.some((key) => key.startsWith("security:account_created:")),
    `no account-created notice for the customer signup, saw: ${JSON.stringify(alertKeys)}`,
  );

  // 12. The applicant can actually get into their provider workspace ----------
  // Applying is worthless if the applicant cannot then sign in. Provider role
  // eligibility comes from the application, not from a completed review, so a
  // brand-new applicant must be able to create a password account and land on
  // onboarding — never on the "no active exact-service access" error.
  const providerCodeRes = await fetch(`${origin}/api/auth/password/request`, {
    method: "POST",
    headers: sameOriginHeaders(origin),
    body: JSON.stringify({ email: applicantEmail, role: "provider", purpose: "create" }),
  });
  assert.ok(providerCodeRes.ok, `provider code request failed (${providerCodeRes.status})`);

  const providerMail = await (await fetch(`http://127.0.0.1:${mailPort}/messages/latest`)).json();
  assert.equal(providerMail.to[0], applicantEmail, "provider code went to the wrong recipient");

  const providerCreateRes = await fetch(`${origin}/api/auth/password/complete`, {
    method: "POST",
    headers: sameOriginHeaders(origin),
    body: JSON.stringify({
      email: applicantEmail,
      role: "provider",
      purpose: "create",
      code: providerMail.code,
      password: fixturePassword,
      termsAccepted: true,
    }),
  });
  const providerCreateBody = await providerCreateRes.json();
  assert.ok(
    providerCreateRes.ok,
    `provider account creation failed (${providerCreateRes.status}): ${JSON.stringify(providerCreateBody)}`,
  );

  const sessionCookie = (providerCreateRes.headers.get("set-cookie") ?? "").split(";")[0];
  assert.ok(sessionCookie, "provider signup returned no session cookie");
  const accountRes = await fetch(`${origin}/api/account`, {
    headers: { ...sameOriginHeaders(origin), cookie: sessionCookie },
  });
  const accountBody = await accountRes.json();
  assert.ok(
    accountRes.ok,
    `provider account load failed (${accountRes.status}): ${JSON.stringify(accountBody)}`,
  );
  assert.equal(accountBody.role, "provider", "the signed-in applicant is not a provider");
  assert.equal(
    accountBody.destination,
    "/provider-onboarding",
    "a self-enrolled applicant belongs in onboarding, not in the job workspace",
  );
  log("provider sign-in verified");

  log("PASS — provider application, provider sign-in, customer signup, and notifications all verified");
}

main().then(() => { cleanUp(); process.exit(0); })
  .catch((error) => { console.error("[e2e] FAIL", error); cleanUp(); process.exit(1); });
