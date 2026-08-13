// The vehicle-incident payment-hold rehearsal, against a real dev server and a
// real local D1.
//
// The `vehicle_incident_claims_and_stop_work` launch gate requires the plan to
// be TESTED, not written. tests/job-operations-controls.test.mjs only asserts
// that the route source contains the string `holdPayments: "yes"` — that would
// pass even if the hold never reached the database. This exercises the real
// route and then reads D1 to see what actually happened.
//
// Never runs against production. Everything happens in a throwaway git worktree
// with its own .wrangler state, its own .dev.vars, and a local D1 seeded with a
// test-flagged job. Run it with `npm run test:e2e:incident`.
//
// The property under test
// -----------------------
// A payment hold must be automatic and must stay protected. "Automatic" means
// the caller cannot decide it: the hold is written by the server whatever the
// request body says. "Protected" means the party who benefits from releasing it
// cannot release it.
//
// What this cannot prove locally, stated rather than faked: the owner's own
// resolve-incident and resolve-payment-hold calls. Owner authentication
// requires a Cloudflare Access JWT verified against a team domain key set
// (lib/owner-auth.ts) and has no local bypass — which is correct fail-closed
// design, not a gap here. What is proven instead is the half that matters more:
// that a customer and a provider are both refused.

import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const APP_PORT = 3013; // 3011 belongs to the provider-signup rehearsal.
const wrangler = join(repoRoot, "node_modules", "wrangler", "bin", "wrangler.js");

const log = (msg) => console.log(`[incident] ${msg}`);
const sh = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, {
    encoding: "utf8",
    stdio: "pipe",
    maxBuffer: 64 * 1024 * 1024,
    timeout: 30_000,
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

const d1 = (workdir, sql) => {
  const out = sh("node", [
    wrangler, "d1", "execute", "tuveloz-db", "--local", "--json", "--command", sql,
  ], { cwd: workdir });
  const match = out.match(/\[[\s\S]*\]/);
  if (!match) throw new Error(`unparseable d1 output: ${out.slice(0, 300)}`);
  return JSON.parse(match[0])[0].results;
};

const sameOriginHeaders = (origin) => ({
  "content-type": "application/json",
  origin,
  referer: `${origin}/account`,
});

// Unique per run: the worktree's D1 is reused between runs.
const stamp = Date.now();
const customerEmail = `e2e-incident-customer+${stamp}@tuveloz.invalid`;
const providerEmail = `e2e-incident-provider+${stamp}@tuveloz.invalid`;
// Meets lib/account-auth.ts. Local fixture only.
const fixturePassword = "E2e-Local-Fixture!7";

const requestId = `e2e-req-${stamp}`;
const quoteId = `e2e-quote-${stamp}`;
const providerId = `e2e-prov-${stamp}`;

async function createAccount(origin, mailPort, email, role) {
  const codeRes = await fetch(`${origin}/api/auth/password/request`, {
    method: "POST",
    headers: sameOriginHeaders(origin),
    body: JSON.stringify({ email, role, purpose: "create" }),
  });
  assert.ok(codeRes.ok, `${role} code request failed (${codeRes.status})`);

  const mail = await (await fetch(`http://127.0.0.1:${mailPort}/messages/latest`)).json();
  assert.equal(mail.to[0], email, `${role} code went to the wrong recipient`);

  const createRes = await fetch(`${origin}/api/auth/password/complete`, {
    method: "POST",
    headers: sameOriginHeaders(origin),
    body: JSON.stringify({
      email,
      role,
      purpose: "create",
      code: mail.code,
      password: fixturePassword,
      termsAccepted: true,
    }),
  });
  const body = await createRes.json();
  assert.ok(createRes.ok, `${role} signup failed (${createRes.status}): ${JSON.stringify(body)}`);
  const cookie = (createRes.headers.get("set-cookie") ?? "").split(";")[0];
  assert.ok(cookie, `${role} signup returned no session cookie`);
  return cookie;
}

/**
 * Seeds the assignment the incident hangs off. Setup is seeded rather than
 * driven through the UI on purpose: the assertions below are about the incident
 * lifecycle, and building a job through the full customer and provider flow
 * would test signup again rather than the hold.
 *
 * The job is flagged is_test_job = 'yes', which isolates it from real providers,
 * customers, alerts, payments, and public profiles.
 */
function seedProviderApplication(workdir) {
  const now = new Date().toISOString();
  d1(workdir, `INSERT INTO provider_applications
    (id, name, email, service, service_area, experience, insurance_status,
     status, verification_status, is_test_provider, created_at)
    VALUES ('${providerId}', 'E2E Incident Provider', '${providerEmail}',
     'provisional_12v_jump_start', 'Montgomery County, Maryland', '', '',
     'approved', 'verified', 'yes', '${now}');`);
}

function seedAssignment(workdir) {
  const now = new Date().toISOString();
  // parts_source, parts_preference, and labor_only_parts_acknowledged_at are
  // required by the customer_requests_labor_only_parts_insert trigger from
  // migration 0050. Tuveloz never supplies, sources, or prices parts, and the
  // database enforces that rather than trusting the form — a fixture that skips
  // these is rejected, which is how the first version of this seed failed.
  d1(workdir, `INSERT INTO customer_requests
    (id, name, email, zip, vehicle, service, details, status, is_test_job,
     service_codes, jurisdiction, parts_source, parts_preference,
     labor_only_parts_acknowledged_at, created_at)
    VALUES ('${requestId}', 'E2E Incident Customer', '${customerEmail}', '20910',
     '2019 Honda Civic', 'provisional_12v_jump_start', 'rehearsal fixture',
     'assigned', 'yes', '["provisional_12v_jump_start"]',
     'US-MD-MontgomeryCounty', 'No parts needed — labor only', 'No preference',
     '${now}', '${now}');`);

  // The same labor-only rule is mirrored on the quote by a trigger in 0050:
  // parts_price_cents must be 0, labor_price_cents must equal price_cents, and
  // part_type must be a customer-supplied option. The platform never prices a
  // part, and the database refuses a quote that says otherwise.
  d1(workdir, `INSERT INTO provider_quotes
    (id, request_id, provider_name, provider_email, price_cents,
     labor_price_cents, parts_price_cents, labor_only_parts_confirmed_at,
     part_type, availability, message, service_codes, status,
     customer_fee_rate_bps, customer_fee_cents, customer_total_cents, created_at)
    VALUES ('${quoteId}', '${requestId}', 'E2E Incident Provider',
     '${providerEmail}', '12000', '12000', '0', '${now}',
     'No parts needed', 'today', 'rehearsal quote',
     '["provisional_12v_jump_start"]', 'accepted', 500, '600', '12600',
     '${now}');`);
}

const incidentRow = (workdir) => d1(
  workdir,
  `SELECT id, hold_payments, work_stopped_at, status, injury_reported,
          evidence_references, resolution
     FROM job_incidents WHERE request_id='${requestId}' ORDER BY created_at DESC;`,
);

async function main() {
  const mailPort = await availableLoopbackPort();

  // 1. Throwaway worktree, namespaced by repo and branch --------------------
  const checkoutIsDisposable = process.env.CI === "true"
    && !existsSync(join(repoRoot, ".dev.vars"));
  const repoKey = createHash("sha256")
    .update(realpathSync.native(repoRoot))
    .digest("hex")
    .slice(0, 8);
  const branchRef = (() => {
    const named = sh("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: repoRoot }).trim();
    const ref = named === "HEAD"
      ? sh("git", ["rev-parse", "--short", "HEAD"], { cwd: repoRoot }).trim()
      : named;
    return ref.replace(/[^A-Za-z0-9._-]+/g, "-").slice(0, 40);
  })();
  const workdir = checkoutIsDisposable
    ? repoRoot
    : join(realpathSync.native(tmpdir()), `tuveloz-e2e-incident-${repoKey}-${branchRef}`);
  const alreadyPrepared = checkoutIsDisposable
    || existsSync(join(workdir, "node_modules", "vinext"));

  if (checkoutIsDisposable) {
    log("CI runner: using the checkout directly");
  } else {
    const head = sh("git", ["rev-parse", "HEAD"], { cwd: repoRoot }).trim();
    if (existsSync(join(workdir, ".git"))) {
      log(`reusing prepared worktree at ${head.slice(0, 7)}`);
      sh("git", ["-C", workdir, "checkout", "--detach", "--force", head], { cwd: repoRoot });
    } else {
      rmSync(workdir, { recursive: true, force: true });
      log(`creating worktree at ${workdir}`);
      sh("git", ["worktree", "add", "--detach", workdir, "HEAD"], { cwd: repoRoot });
    }
  }

  if (!alreadyPrepared) {
    log("installing dependencies (first run only, a few minutes)");
    sh("npm", ["ci", "--no-audit", "--no-fund"], {
      cwd: workdir, stdio: "inherit", shell: process.platform === "win32",
    });
  }

  // 2. Its own .dev.vars -----------------------------------------------------
  writeFileSync(join(workdir, ".dev.vars"), [
    `RESEND_BASE_URL=http://127.0.0.1:${mailPort}`,
    "RESEND_API_KEY=e2e-local-not-a-real-key",
    "RESEND_FROM_EMAIL=Tuveloz E2E <e2e@localhost>",
    "AUTH_CODE_SECRET=e2e-local-secret-value-32-chars-min",
    "",
  ].join("\n"));

  // 3. Schema ----------------------------------------------------------------
  rmSync(join(workdir, ".wrangler", "state"), { recursive: true, force: true });
  log("applying migrations to the worktree's local D1");
  sh("node", [wrangler, "d1", "migrations", "apply", "tuveloz-db", "--local"], {
    cwd: workdir, input: "y\n", stdio: ["pipe", "pipe", "pipe"],
  });

  // 4. Mail catcher ----------------------------------------------------------
  let catcherFailure = null;
  const catcher = spawn(
    "node",
    [join(repoRoot, "scripts", "dev-mail-catcher.mjs"), "--port", String(mailPort)],
    { stdio: "ignore" },
  );
  catcher.on("error", (error) => { catcherFailure = error; });
  cleanups.push(() => catcher.kill());
  await waitFor(
    "mail catcher",
    async () => (await fetch(`http://127.0.0.1:${mailPort}/messages`)).ok,
    180_000,
    () => catcherFailure,
  );

  // 5. Dev server ------------------------------------------------------------
  const serverLog = join(workdir, ".e2e-incident-server.log");
  let serverOutput = "";
  const server = spawn(process.execPath, [
    join(workdir, "node_modules", "vinext", "dist", "cli.js"),
    "dev", "--port", String(APP_PORT),
  ], { cwd: workdir, stdio: ["ignore", "pipe", "pipe"] });
  const collect = (chunk) => {
    serverOutput += String(chunk).replace(/\[[0-9;]*m/g, "");
    try { writeFileSync(serverLog, serverOutput); } catch { /* log is a nicety */ }
  };
  server.stdout.on("data", collect);
  server.stderr.on("data", collect);
  let serverExit = null;
  server.on("exit", (code, signal) => { serverExit = `exited code=${code} signal=${signal}`; });
  cleanups.push(() => server.kill());

  let origin = `http://localhost:${APP_PORT}`;
  try {
    await waitFor("dev server port", () => {
      const announced = readFileSync(serverLog, "utf8").match(/localhost:(\d{4,5})/);
      if (!announced) return false;
      origin = `http://localhost:${announced[1]}`;
      return true;
    }, 240_000);
    await waitFor("dev server", async () => (await fetch(`${origin}/api/health`)).ok);
  } catch (error) {
    console.error(`[incident] dev server never answered. Log at ${serverLog}:`);
    console.error(serverExit ?? "server still running");
    console.error(serverOutput.slice(-2000) || "(log empty)");
    throw error;
  }
  log(`dev server ready on ${origin}`);

  // 6. Accounts and the seeded assignment ------------------------------------
  const customerCookie = await createAccount(origin, mailPort, customerEmail, "customer");

  // The provider application is seeded BEFORE the provider account, because
  // that is the real order: eligibleAccountRoles() only returns "provider" once
  // an application row exists, so a code request for an unknown provider is
  // refused and no email is sent. The first run of this rehearsal failed here —
  // /messages/latest still held the customer's code — which is exactly the
  // silent dead end #125 fixed on the request side.
  seedProviderApplication(workdir);
  const providerCookie = await createAccount(origin, mailPort, providerEmail, "provider");

  seedAssignment(workdir);
  log("accounts created and test assignment seeded");

  const call = (cookie, body) => fetch(`${origin}/api/job-operations`, {
    method: "POST",
    headers: { ...sameOriginHeaders(origin), cookie },
    body: JSON.stringify({ requestId, ...body }),
  });

  // 7. The hold is automatic, and the caller cannot opt out ------------------
  // holdPayments is written server-side as "yes" and is not read from the body.
  // Sending the opposite is the test: if the caller could set it, a provider
  // could report an incident that never holds their own payment.
  const reportRes = await call(customerCookie, {
    action: "report-incident",
    incidentType: "property_damage",
    severity: "serious",
    summary: "Rehearsal: bumper scuffed during the jump start.",
    occurredAt: new Date(Date.now() - 60_000).toISOString(),
    holdPayments: "no",
    releasePaymentHold: true,
  });
  const reportBody = await reportRes.json();
  assert.equal(reportRes.status, 201, `report-incident failed: ${JSON.stringify(reportBody)}`);

  const [afterReport] = incidentRow(workdir);
  assert.ok(afterReport, "no incident row was written");
  assert.equal(
    afterReport.hold_payments,
    "yes",
    "the payment hold must be set by the server even when the caller asks for no hold",
  );
  assert.equal(afterReport.status, "open");
  assert.equal(afterReport.injury_reported, "no");
  log("payment hold is automatic and ignored the caller's request to skip it");

  // 8. Severity forced the work to stop --------------------------------------
  assert.notEqual(
    afterReport.work_stopped_at,
    "",
    "a serious property-damage incident must record a stop time",
  );
  const [jobRecord] = d1(
    workdir,
    `SELECT work_status FROM provider_job_records WHERE request_id='${requestId}';`,
  ) ?? [];
  if (jobRecord) {
    assert.equal(jobRecord.work_status, "stop work", "the job record must show stop work");
  }
  log("stop-work recorded from severity alone, without a separate call");

  // 9. Neither party may resolve the incident or release the hold ------------
  // This is the protection that matters: the provider whose payment is held,
  // and the customer who may want it released, are both refused. Only the owner
  // may, and owner auth is a Cloudflare Access JWT with no local bypass.
  for (const [who, cookie] of [["customer", customerCookie], ["provider", providerCookie]]) {
    const resolveRes = await call(cookie, {
      action: "resolve-incident",
      incidentId: afterReport.id,
      resolution: "Rehearsal: attempting to close this without owner authority.",
      releasePaymentHold: true,
      insurerNotified: true,
    });
    assert.ok(
      resolveRes.status === 401 || resolveRes.status === 403,
      `${who} must not be able to resolve an incident (got ${resolveRes.status})`,
    );

    const releaseRes = await call(cookie, {
      action: "resolve-payment-hold",
      incidentId: afterReport.id,
    });
    assert.ok(
      releaseRes.status === 401 || releaseRes.status === 403,
      `${who} must not be able to release a payment hold (got ${releaseRes.status})`,
    );
  }
  log("customer and provider are both refused resolution and hold release");

  // 10. The hold survived every one of those attempts ------------------------
  const [afterAttempts] = incidentRow(workdir);
  assert.equal(
    afterAttempts.hold_payments,
    "yes",
    "the hold must survive refused resolution and release attempts",
  );
  assert.equal(afterAttempts.status, "open", "the incident must still be open");
  assert.equal(afterAttempts.resolution, "", "no resolution may be recorded by a refused caller");
  log("hold and incident state unchanged after the refused attempts");

  // 11. An explicit stop-work call also holds --------------------------------
  const stopRes = await call(providerCookie, {
    action: "stop-work",
    severity: "moderate",
    summary: "Rehearsal: stopping work pending review of the scuff.",
    occurredAt: new Date().toISOString(),
    holdPayments: "no",
  });
  const stopBody = await stopRes.json();
  assert.equal(stopRes.status, 201, `stop-work failed: ${JSON.stringify(stopBody)}`);
  const rows = incidentRow(workdir);
  assert.equal(rows.length, 2, "stop-work must record its own incident");
  assert.ok(
    rows.every((row) => row.hold_payments === "yes"),
    "every incident must hold payment",
  );
  assert.notEqual(rows[0].work_stopped_at, "", "stop-work must record a stop time");
  log("explicit stop-work holds payment too");

  // 12. An open incident blocks payout --------------------------------------
  const helper = readFileSync(join(workdir, "lib", "job-operations.ts"), "utf8");
  assert.ok(
    helper.includes("open_incident"),
    "payout readiness must carry an open_incident blocker",
  );

  log("PASS — the payment hold is automatic, caller-proof, and survives refused release");
  log("NOT COVERED LOCALLY: the owner's own resolve and release calls. Owner auth");
  log("requires a Cloudflare Access JWT (lib/owner-auth.ts) with no local bypass.");
}

main().then(() => { cleanUp(); process.exit(0); })
  .catch((error) => { console.error("[incident] FAIL", error); cleanUp(); process.exit(1); });
