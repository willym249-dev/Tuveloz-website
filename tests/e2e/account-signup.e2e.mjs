// End-to-end customer and provider account signup, against a real dev server,
// a real local D1, and a real browser.
//
// Not part of `npm test`: that suite is static analysis and finishes in under a
// second, while this boots a server and a browser. Run it with
// `npm run test:e2e:account`.
//
// The property this exists to protect
// -----------------------------------
// Emailed-code requests are throttled to three per fifteen minutes, and the
// fourth answers 429. That 429 is only safe because the throttle is consumed
// *before* the eligibility lookup. Consume it after, and the throttle can only
// count rows it wrote for addresses that resolve to an account — so a 429 would
// itself confirm that an address is real, which is precisely the account
// enumeration the generic "if that email is eligible" wording exists to
// prevent.
//
// tests/account-code-delivery.test.mjs asserts that ordering in the source.
// This test asserts the behaviour it is supposed to produce: an eligible and an
// ineligible address must be indistinguishable across all four requests — same
// statuses, same response text — while the mail catcher proves the two paths
// genuinely did different things underneath.
//
// Environment safety
// ------------------
// Nothing here may touch production. Delivery is pointed at
// scripts/dev-mail-catcher.mjs on loopback, the fixture writes its own
// .dev.vars with dummy values and never reads the checkout's, and the whole run
// happens inside a throwaway git worktree with its own .wrangler state. Those
// are asserted at startup rather than assumed, and lib/resend-endpoint.ts
// independently refuses any non-loopback RESEND_BASE_URL.

import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { existsSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { assertSpanishRendering } from "./spanish-rendering-checks.mjs";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const APP_PORT = 3013; // not 3011: that belongs to provider-signup.e2e.mjs
const wrangler = join(repoRoot, "node_modules", "wrangler", "bin", "wrangler.js");

// Dummy by construction. If either of these ever looks like a real credential
// the run aborts before a server starts — see assertEnvironmentIsSafe.
const LOCAL_API_KEY = "account-e2e-local-not-a-real-key";
const LOCAL_FROM_EMAIL = "Tuveloz Account E2E <account-e2e@localhost>";
const LOCAL_AUTH_SECRET = "account-e2e-local-secret-value-32-chars";
const PASSWORD = "LocalVerify!2026";

const log = (msg) => console.log(`[e2e] ${msg}`);
const sh = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { encoding: "utf8", stdio: "pipe", maxBuffer: 64 * 1024 * 1024, ...opts });

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

/**
 * Refuses to run against anything that could reach a real inbox or a real
 * database. Checked before a server exists, so a misconfigured run fails
 * without having sent anything.
 */
function assertEnvironmentIsSafe(mailPort) {
  const mailBase = `http://127.0.0.1:${mailPort}`;
  assert.equal(
    new URL(mailBase).hostname,
    "127.0.0.1",
    "delivery must be pointed at loopback, never a reachable host",
  );
  assert.ok(
    !/^re_/.test(LOCAL_API_KEY),
    "the fixture API key must not look like a real Resend key",
  );
  assert.ok(
    LOCAL_FROM_EMAIL.includes("localhost"),
    "the fixture sender must be a localhost address, never a live sending domain",
  );
  for (const name of ["RESEND_API_KEY", "RESEND_FROM_EMAIL"]) {
    assert.ok(
      !process.env[name],
      `${name} is set in this shell; unset it so the run cannot inherit a real credential`,
    );
  }
}

/**
 * Launches Chromium, tolerating an image that ships browsers Playwright did not
 * install itself.
 *
 * The normal path is `npx playwright install chromium`, and the default launch
 * finds that. Containers that preinstall browsers under PLAYWRIGHT_BROWSERS_PATH
 * can carry a build number Playwright does not expect — it then looks for a
 * headless shell that was never unpacked and fails, even though a perfectly
 * usable chrome binary is sitting next to it. Falling back to whatever chrome is
 * actually on disk keeps this test runnable in both places instead of passing
 * only on a developer's laptop.
 */
async function launchChromium() {
  // --no-proxy-server: an environment proxy must not intercept loopback.
  const args = ["--no-proxy-server"];
  try {
    return await chromium.launch({ args });
  } catch (defaultLaunchError) {
    const root = process.env.PLAYWRIGHT_BROWSERS_PATH;
    const candidates = [];
    if (root && existsSync(root)) {
      for (const entry of readdirSync(root)) {
        if (!entry.startsWith("chromium-")) continue;
        candidates.push(
          join(root, entry, "chrome-linux", "chrome"),
          join(root, entry, "chrome-mac", "Chromium.app", "Contents", "MacOS", "Chromium"),
          join(root, entry, "chrome-win", "chrome.exe"),
        );
      }
    }
    const executablePath = candidates.find((candidate) => existsSync(candidate));
    if (!executablePath) {
      throw new Error(
        `could not launch Chromium (${defaultLaunchError.message}). `
        + 'Run "npx playwright install chromium" first.',
      );
    }
    log(`default Chromium unavailable; using ${executablePath}`);
    return chromium.launch({ args, executablePath });
  }
}

const captured = async (mailPort, path = "/messages", init) =>
  (await fetch(`http://127.0.0.1:${mailPort}${path}`, init)).json().catch(() => []);

const countCaptured = (payload) =>
  (Array.isArray(payload) ? payload : payload?.messages ?? []).length;

async function main() {
  const mailPort = await availableLoopbackPort();
  assertEnvironmentIsSafe(mailPort);
  log("environment safety checks passed");

  // 1. Throwaway worktree, namespaced by repository and branch ---------------
  // Same reasoning as provider-signup.e2e.mjs: a fixed shared directory let two
  // branches share one local D1 and their migration lineages collided. The boot
  // sequence is duplicated rather than shared with that test on purpose — it is
  // working, and extracting a common fixture is a refactor of its own.
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
    : join(realpathSync.native(tmpdir()), `tuveloz-e2e-account-${repoKey}-${branchRef}`);
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
    log("installing dependencies for the worktree (first run only, a few minutes)");
    sh("npm", ["ci", "--no-audit", "--no-fund"], {
      cwd: workdir, stdio: "inherit", shell: process.platform === "win32",
    });
  }

  // 2. Its own .dev.vars — the checkout's copy is never read -----------------
  writeFileSync(join(workdir, ".dev.vars"), [
    `RESEND_BASE_URL=http://127.0.0.1:${mailPort}`,
    `RESEND_API_KEY=${LOCAL_API_KEY}`,
    `RESEND_FROM_EMAIL=${LOCAL_FROM_EMAIL}`,
    `AUTH_CODE_SECRET=${LOCAL_AUTH_SECRET}`,
    "",
  ].join("\n"));

  // 3. Schema ----------------------------------------------------------------
  // Migrations are additive and assume an empty database, so replaying them
  // over a previous run's schema fails on already-present columns.
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
  log("mail catcher up — no message can leave this machine");

  // 5. Dev server ------------------------------------------------------------
  const serverLog = join(workdir, ".e2e-account-dev-server.log");
  let serverOutput = "";
  const server = spawn(process.execPath, [
    join(workdir, "node_modules", "vinext", "dist", "cli.js"),
    "dev", "--port", String(APP_PORT),
  ], { cwd: workdir, stdio: ["ignore", "pipe", "pipe"] });
  const collect = (chunk) => {
    // Vite colours its output; strip escapes or the port regex never matches.
    serverOutput += String(chunk).replace(/\[[0-9;]*m/g, "");
    try { writeFileSync(serverLog, serverOutput); } catch { /* log is a nicety */ }
  };
  server.stdout.on("data", collect);
  server.stderr.on("data", collect);
  let serverExit = null;
  server.on("exit", (code, signal) => { serverExit = `exited code=${code} signal=${signal}`; });
  server.on("error", (err) => { serverExit = `spawn error: ${err.message}`; });
  cleanups.push(() => server.kill());

  // vinext walks forward when a port is taken, so trust its announcement.
  let origin = `http://localhost:${APP_PORT}`;
  await waitFor("dev server port", () => {
    const announced = serverOutput.match(/localhost:(\d{4,5})/);
    if (!announced) return false;
    origin = `http://localhost:${announced[1]}`;
    return true;
  }, 180_000, () => (serverExit ? new Error(`dev server ${serverExit}\n${serverOutput.slice(-2000)}`) : null));
  await waitFor(
    "dev server ready",
    async () => (await fetch(`${origin}/account`)).ok,
    180_000,
    () => (serverExit ? new Error(`dev server ${serverExit}\n${serverOutput.slice(-2000)}`) : null),
  );
  log(`dev server up at ${origin}`);

  const stamp = Date.now();
  const post = async (path, body) => {
    // The write routes demand a strict same-origin request.
    const response = await fetch(`${origin}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin,
        referer: `${origin}/account`,
      },
      body: JSON.stringify(body),
    });
    let payload = {};
    try { payload = await response.json(); } catch { /* non-JSON */ }
    return { status: response.status, body: payload };
  };

  // Four requests, capturing what a caller can actually observe.
  const fourRequests = async (path, body) => {
    await fetch(`http://127.0.0.1:${mailPort}/reset`, { method: "POST" });
    const statuses = [];
    const texts = [];
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      const result = await post(path, body);
      statuses.push(result.status);
      texts.push(result.body.message ?? result.body.error ?? "");
    }
    return { statuses, texts, sent: countCaptured(await captured(mailPort)) };
  };

  // 6. THE REGRESSION PROPERTY ----------------------------------------------
  // A customer create is actionable for any address, so the server really
  // sends. A provider create is refused unless an application row exists, so
  // nothing is sent. The two must still look identical from outside.
  log("checking 429 parity between an eligible and an ineligible address");
  const eligible = await fourRequests("/api/auth/password/request", {
    email: `e2e-eligible+${stamp}@tuveloz.invalid`,
    role: "customer",
    purpose: "create",
  });
  const ineligible = await fourRequests("/api/auth/password/request", {
    email: `e2e-ineligible+${stamp}@tuveloz.invalid`,
    role: "provider",
    purpose: "create",
  });

  assert.deepEqual(
    eligible.statuses,
    [200, 200, 200, 429],
    "an eligible address must be throttled on the fourth request",
  );
  assert.deepEqual(
    ineligible.statuses,
    eligible.statuses,
    "status sequences differ, so the 429 leaks whether an address is eligible",
  );
  assert.deepEqual(
    ineligible.texts,
    eligible.texts,
    "response text differs, so the responses leak whether an address is eligible",
  );
  // Same observable behaviour, genuinely different work underneath. Without
  // this pair the assertions above would also pass if nothing ever sent.
  assert.equal(eligible.sent, 3, "the eligible path should have sent three codes");
  assert.equal(ineligible.sent, 0, "the ineligible path must send nothing");
  log("PASS — eligible and ineligible are indistinguishable across all four requests");

  // The passwordless sign-in route shares the shape and the same reasoning.
  const unknownAddress = await fourRequests("/api/auth/request-code", {
    email: `e2e-unknown+${stamp}@tuveloz.invalid`,
    role: "customer",
  });
  assert.deepEqual(
    unknownAddress.statuses,
    [200, 200, 200, 429],
    "the sign-in code route must throttle an unknown address too",
  );
  assert.equal(unknownAddress.sent, 0, "an unknown address must not receive mail");
  log("PASS — the passwordless sign-in route throttles identically");

  // 7. What a person actually sees ------------------------------------------
  // Rendered in a browser, not asserted against source: the guidance and the
  // delivery hint are conditional on client state, so server HTML never
  // contains them and a source-level check cannot prove they reach anyone.
  const browser = await launchChromium();
  cleanups.push(() => browser.close());
  let page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const browserErrors = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));

  // The form is disabled while the page checks for an existing session.
  // Clicking before that resolves hits an unhydrated button and is dropped.
  const waitForInteractive = async () => {
    await page.waitForSelector(".account-role-tabs", { timeout: 60_000 });
    await page.waitForSelector('input[name="email"]:not([disabled])', { timeout: 60_000 });
  };
  const selectRole = async (label) => {
    await page.locator(".account-role-tabs button", { hasText: label }).click();
    await page.waitForFunction((text) => {
      const pressed = document.querySelector('.account-role-tabs button[aria-pressed="true"]');
      return Boolean(pressed && pressed.textContent.includes(text));
    }, label, { timeout: 15_000 });
  };
  const selectMode = async (label) => {
    await page.locator(".account-auth-modes button", { hasText: label }).click();
    await page.waitForTimeout(400);
  };

  await page.goto(`${origin}/`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-language-control]", { timeout: 60_000 });
  await page.getByRole("button", { name: "Open main menu", exact: true }).click();
  await page.waitForSelector('.menu-button[aria-expanded="true"]');
  assert.ok(await page.locator('#main-navigation a[href="/faq"]').isVisible(), "the mobile menu must expose navigation links");
  await page.getByRole("button", { name: "Close main menu", exact: true }).click();
  await page.waitForSelector('.menu-button[aria-expanded="false"]');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "the mobile homepage must not overflow horizontally");
  await page.locator(".hero .button.primary").click();
  await page.waitForURL((url) => url.pathname === "/account" && url.searchParams.get("mode") === "create" && url.searchParams.get("role") === "customer");
  await waitForInteractive();
  log("PASS — mobile menu works and the homepage account button opens signup directly");

  const authOptions = await (await fetch(`${origin}/api/auth/options`)).json();
  assert.deepEqual(authOptions, { phoneSignIn: false }, "the SMS launch lock must be reflected by available sign-in methods");
  await selectMode("Sign in");
  assert.equal(await page.getByRole("button", { name: "Text me a one-time code instead", exact: true }).count(), 0, "unavailable text-message sign-in must not be offered");
  assert.ok(await page.getByRole("button", { name: "Email me a one-time code instead", exact: true }).isVisible(), "email sign-in must stay available");
  log("PASS — unavailable SMS is hidden while email sign-in remains available");

  // Provider guidance: without it the server's refusal reads as success and the
  // applicant waits on an email that is never sent.
  await selectRole("Provider");
  await selectMode("Create account");
  const panel = page.locator(".account-value-prop");
  await panel.waitFor({ timeout: 15_000 });
  const providerText = (await panel.innerText()).replace(/\s+/g, " ").trim();
  assert.match(providerText, /Providers apply first/i, "provider create mode must say applications come first");
  assert.match(providerText, /same email address you applied with/i, "returning applicants need the email-reuse instruction");
  assert.equal(
    await page.locator('.account-value-prop a[href="/join"]').count(),
    1,
    "provider guidance must link to the application form",
  );
  assert.doesNotMatch(
    providerText,
    /compare local quotes/i,
    "the provider panel must not inherit the customer booking promise",
  );
  log("PASS — provider guidance is visible and points at /join");

  await selectRole("Customer");
  await selectMode("Create account");
  assert.match(
    (await panel.innerText()).replace(/\s+/g, " "),
    /At launch/i,
    "the customer panel must keep naming the pre-launch gate",
  );

  // 8. Full customer signup, using the code that was really delivered --------
  await fetch(`http://127.0.0.1:${mailPort}/reset`, { method: "POST" });
  const signupEmail = `e2e-signup+${stamp}@tuveloz.invalid`;
  await page.fill('input[name="email"]', signupEmail);
  await page.fill('input[name="password"]', PASSWORD);
  await page.fill('input[name="confirm-password"]', PASSWORD);
  await page.waitForTimeout(300);
  assert.equal(
    await page.locator(".password-rules li:not(.met)").count(),
    0,
    "the live checklist should show every rule met for a valid password",
  );
  await page.check('input[name="policy-consent"]');
  await page.locator("button[type=submit]", { hasText: /Send verification code/i }).click();
  await page.waitForSelector(".account-code-hint", { timeout: 30_000 });

  // Delivery expectations. Without these three facts a visitor whose code went
  // to spam spends all three attempts before the throttle stops them.
  const hint = (await page.locator(".account-code-hint").innerText()).replace(/\s+/g, " ").trim();
  assert.match(hint, /spam or junk folder/i, "the code step must name the spam folder");
  assert.match(hint, /expires after 10 minutes/i, "the code step must state the expiry");
  assert.match(hint, /3 codes.*every 15 minutes/i, "the code step must state the send limit");
  log("PASS — the code step states delivery, expiry, and the send limit");

  const messages = await captured(mailPort);
  const list = Array.isArray(messages) ? messages : messages?.messages ?? [];
  const code = (String(list.at(-1)?.text ?? "").match(/\b(\d{6})\b/) ?? [])[1] ?? "";
  assert.match(code, /^\d{6}$/, "a six-digit code should have been delivered to the catcher");

  await page.fill('input[autocomplete="one-time-code"]', code);
  await page.locator("button[type=submit]", { hasText: /^Create account$/ }).click();
  await page.waitForTimeout(5000);

  // purpose=create routes to the /welcome confirmation page; /customer is the
  // sign-in destination. A passkey-capable browser is offered enrolment first.
  const landedOn = new URL(page.url()).pathname;
  const offeredPasskey = await page.locator("text=Sign in faster next time").count();
  assert.ok(
    landedOn === "/welcome" || landedOn === "/customer" || offeredPasskey > 0,
    `expected the post-creation confirmation, landed on ${landedOn}`,
  );
  // Proof the confirmation page is not lying, without reaching into the
  // database: createAccountSession only issues a session when
  // eligibleAccountRoles() already found a credential row for the address, and
  // this address has no customer request to qualify on instead. A session
  // therefore cannot exist unless the account was really written.
  const session = (await page.context().cookies())
    .find((cookie) => cookie.name.includes("tuveloz_session"));
  assert.ok(session, "creating an account must establish a session");
  log("PASS — a customer account was created and signed in");

  await page.goto(`${origin}/`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('.hero .button.primary[href="/customer"]', { timeout: 60_000 });
  await page.locator(".hero .button.primary").click();
  await page.waitForURL((url) => url.pathname === "/customer");
  log("PASS — the signed-in homepage account button returns to the customer workspace");

  // 9. The throttle is legible to the person, not only to the API -----------
  // End the authenticated page before starting the signed-out scenario.
  // Clearing its cookies during the workspace's in-flight session check can
  // trigger a redirect that aborts the next page.goto with ERR_ABORTED.
  // browser.newPage creates a separate context, with no inherited cookies.
  await page.close();
  page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on("pageerror", (error) => browserErrors.push(error.message));
  await page.goto(`${origin}/account?mode=create&role=customer`, { waitUntil: "domcontentloaded" });
  await waitForInteractive();
  const throttledEmail = `e2e-throttle+${stamp}@tuveloz.invalid`;
  let shown = "";
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    await page.fill('input[name="email"]', throttledEmail);
    await page.fill('input[name="password"]', PASSWORD);
    await page.fill('input[name="confirm-password"]', PASSWORD);
    await page.check('input[name="policy-consent"]');
    await page.locator("button[type=submit]", { hasText: /Send verification code/i }).click();
    await page.waitForTimeout(2500);
    if (await page.locator(".form-error").count()) {
      shown = (await page.locator(".form-error").innerText()).replace(/\s+/g, " ").trim();
    }
    if (attempt < 4) {
      const startOver = page.locator("button", { hasText: /Start over/i });
      if (await startOver.count()) await startOver.click();
      await page.waitForTimeout(400);
    }
  }
  assert.match(
    shown,
    /Too many codes/i,
    "the fourth attempt must tell the visitor they are throttled, not look like success",
  );
  log("PASS — the throttle message reaches the visitor");

  assert.deepEqual(browserErrors, [], "account scenarios must not produce browser errors");
  await assertSpanishRendering(browser, origin, log);

  // Delivery staying local is established by assertEnvironmentIsSafe before a
  // server exists, and by the exact send counts in the parity check above. A
  // closing "at least one message was captured" would restate that without
  // being able to fail.
  log("PASS — account signup verified end to end, no message left this machine");
}

main().then(() => { cleanUp(); process.exit(0); })
  .catch((error) => { console.error("[e2e] FAIL", error); cleanUp(); process.exit(1); });
