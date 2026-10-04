// Real owner component, synthetic responses only; no Stripe, identity or browser account access.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, webkit } from "playwright";
import { build } from "vite";

const root = fileURLToPath(new URL("../..", import.meta.url));
const builds = await build({ root, configFile: false, envFile: false, logLevel: "error",
  define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" },
  build: { write: false, lib: { entry: resolve(root, "tests/e2e/fixtures/transfer-recovery.tsx"), name: "TransferRecoveryFixture", formats: ["iife"] } },
});
const bundle = Array.isArray(builds) ? builds[0] : builds;
const assets = new Map(bundle.output.map(asset => ["/" + asset.fileName, asset.type === "chunk" ? asset.code : asset.source]));
const js = bundle.output.find(asset => asset.type === "chunk").fileName, css = bundle.output.find(asset => asset.fileName.endsWith(".css")).fileName;
const server = createServer((request, response) => {
  const path = request.url.split("?")[0];
  if (assets.has(path)) { response.writeHead(200, { "content-type": path.endsWith(".css") ? "text/css" : "text/javascript" }); response.end(assets.get(path)); }
  else if (request.method === "GET" && path === "/transfer-recovery") {
    response.writeHead(200, { "content-type": "text/html" });
    response.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/${css}"></head><body><div id="root"></div><script src="/${js}"></script></body></html>`);
  } else { response.writeHead(404); response.end(); }
});
await new Promise(done => server.listen(0, "127.0.0.1", done));
const origin = `http://127.0.0.1:${server.address().port}`, report = [];
const json = (body, status = 200) => ({ status, contentType: "application/json", body: JSON.stringify(body) });
function payment(saved, mode, reversed = false) {
  return { id: "payment-synthetic", productName: "SYNTHETIC LABOR", paymentType: "quote", providerName: "SYNTHETIC PROVIDER",
    customerEmail: "customer@example.invalid", customerDisplayName: "SYNTHETIC CUSTOMER", customerHasAccount: true,
    providerAmountCents: 10000, applicationFeeCents: 500, customerTotalCents: 10500, settlementStrategy: "separate_transfer",
    status: saved ? ["saved-hold", "reversed-disputed"].includes(mode) ? "disputed" : "released" : "paid_pending_completion", jobStatus: "completed",
    transferId: saved ? "tr_synthetic" : null, transferAttemptStatus: saved ? "transfer_recorded" : null,
    transferReversalReviewRequired: reversed,
    canRelease: !saved && mode !== "closed", createdAt: "2026-10-01T00:00:00Z", paidAt: "2026-10-01T00:00:00Z", releasedAt: "", releasedBy: "",
    refundAmountCents: 0, refundedAt: "", refundStatus: "", refundUpdatedAt: "", refundFailureReason: "", disputeStatus: mode === "reversed-disputed" ? "needs_response" : "", disputeUpdatedAt: "",
    connectedAccountSnapshotId: "acct_synthetic", payoutFailureHold: 0, payoutHoldReason: "", externalAccountHold: 0,
    externalAccountHoldReason: "", lastPayoutStatus: null, lastExternalAccountStatus: null };
}
const reversalFailure = "Stripe's transfer has been fully or partially reversed. Keep this payment under review.";
async function assertReversalReview(page) {
  await page.getByText("Stripe reports a full or partial reversal of this provider transfer.", { exact: false }).waitFor();
  assert.equal(await page.getByText("Customer refunds are tracked separately.", { exact: false }).count(), 1);
  assert.equal((await page.locator(".admin-card-top > span").innerText()).toLowerCase(), "transfer reversal needs review", "marker overrides stale released status");
  assert.equal(await page.getByText("No release action is needed.").count(), 0);
  assert.equal(await page.getByText("A transfer has been recorded with Stripe.").count(), 0);
  assert.equal(await page.getByRole("button", { name: "Review provider release" }).count(), 0);
  assert.equal(await page.getByRole("button", { name: "Confirm provider transfer" }).count(), 0);
  assert.equal(await page.getByRole("status").count(), 0);
  assert.equal(await page.getByText(/^Refunded:/).count(), 0);
}
try {
  for (const browserType of [chromium, webkit]) {
    const browser = await browserType.launch({ headless: true });
    try {
      for (const mode of ["success", "lost", "malformed", "wrong-payment", "timeout", "pending", "saved-hold", "refresh-malformed", "initial-malformed", "refresh-network", "closed", "check-missing",
        "initial-marker-missing", "initial-marker-string", "refresh-marker-missing", "refresh-marker-null", "refresh-marker-string", "refresh-marker-number", "refresh-recorded-marker-missing",
        "reversed-recorded", "reversed-disputed", "reversed-releasable", "check-reversed", "check-reversed-refresh-malformed", "check-reversed-refresh-network", "success-refresh-reversed"]) {
        const context = await browser.newContext({ viewport: { width: browserType === webkit ? 320 : 390, height: 844 } });
        const page = await context.newPage(); page.setDefaultTimeout(5000);
        const errors = [], unexpected = [], posts = [];
        let saved = (mode.startsWith("reversed-") && mode !== "reversed-releasable") || mode === "refresh-recorded-marker-missing" || mode.startsWith("check-reversed");
        let reversed = mode.startsWith("reversed-"), reads = 0;
        page.on("pageerror", error => errors.push(error.message));
        await page.addInitScript(() => {
          const original = window.setTimeout;
          window.setTimeout = (handler, timeout, ...args) => original(handler, timeout === 45000 ? 80 : timeout, ...args);
        });
        const confirmed = () => ({ ok: true, transferConfirmed: true, paymentId: "payment-synthetic", transferId: "tr_synthetic",
          releasedAt: "2026-10-01T00:00:00Z", transferReviewRequired: mode === "saved-hold", paymentStatus: mode === "saved-hold" ? "disputed" : "released" });
        await context.route("**/*", async route => {
          const request = route.request(), url = new URL(request.url());
          if (url.origin !== origin) { unexpected.push(url.href); return route.abort(); }
          if (!url.pathname.startsWith("/api/")) return route.continue();
          if (url.pathname !== "/api/stripe/admin/payments") { unexpected.push(url.pathname); return route.abort(); }
          if (request.method() === "GET") {
            reads++;
            if ((mode === "initial-malformed" && reads === 1) || (mode === "refresh-malformed" && reads === 2)) return route.fulfill(json({ payments: [{}] }));
            if (["refresh-network", "check-reversed-refresh-network"].includes(mode) && reads === 2) return route.abort("failed");
            const row = payment(saved, mode, reversed);
            if ((mode.startsWith("initial-marker-") && reads === 1)
              || ((mode.startsWith("refresh-marker-") || mode === "refresh-recorded-marker-missing" || mode === "check-reversed-refresh-malformed") && reads === 2)) {
              if (mode.endsWith("null")) row.transferReversalReviewRequired = null;
              else if (mode.endsWith("string")) row.transferReversalReviewRequired = "false";
              else if (mode.endsWith("number")) row.transferReversalReviewRequired = 1;
              else delete row.transferReversalReviewRequired;
            }
            return route.fulfill(json({ payments: [row] }));
          }
          const body = request.postDataJSON(); posts.push(body);
          if (body.action === "check_transfer") {
            if (mode.startsWith("check-reversed")) {
              reversed = true;
              return route.fulfill(json({ error: reversalFailure }, 409));
            }
            if (mode === "check-missing") return route.fulfill(json({ ok: false, transferConfirmed: false, error: "No matching transfer is confirmed. Keep this payment under review." }, 202));
            saved = true; return route.fulfill(json(confirmed()));
          }
          assert.equal(body.action, "release");
          if (mode === "timeout") return;
          if (mode === "lost") { saved = true; return route.abort("failed"); }
          if (mode === "malformed" || mode === "check-missing") return route.fulfill(json({ ok: true }));
          if (mode === "wrong-payment") return route.fulfill(json({ ...confirmed(), paymentId: "wrong" }));
          if (mode === "pending") return route.fulfill(json({ ok: false, transferConfirmed: false }, 202));
          saved = true;
          if (mode === "success-refresh-reversed") reversed = true;
          return route.fulfill(json(confirmed()));
        });
        try {
          await page.goto(`${origin}/transfer-recovery`);
          if (mode === "initial-malformed" || mode.startsWith("initial-marker-")) {
            await page.getByRole("alert").waitFor(); assert.equal(await page.getByText("No Stripe Checkout sessions have been created yet.").count(), 0);
            assert.equal(await page.getByRole("button", { name: "Review provider release" }).count(), 0);
            assert.equal(await page.getByRole("button", { name: "Check transfer status" }).count(), 0);
            await page.getByRole("button", { name: "Refresh payments" }).click(); await page.getByRole("heading", { name: "SYNTHETIC LABOR" }).waitFor();
          } else {
            await page.getByRole("heading", { name: "SYNTHETIC LABOR" }).waitFor();
            if (mode.startsWith("reversed-")) {
              await assertReversalReview(page);
              if (mode === "reversed-disputed") await page.getByText("Dispute: needs response").waitFor();
              if (saved) await page.getByText("Transfer: tr_synthetic", { exact: true }).waitFor();
              assert.deepEqual(posts, [], "viewing a reversal never sends a payment");
            } else if (mode.startsWith("check-reversed")) {
              await page.getByRole("button", { name: "Check transfer status" }).evaluate(button => { button.click(); button.click(); });
              await page.getByRole("alert").filter({ hasText: reversalFailure }).waitFor();
              assert.equal(reads, 2, "a failed status check refreshes newly persisted evidence");
              assert.equal(await page.getByRole("status").count(), 0, "409 must never produce a success claim");
              assert.equal(await page.getByText("A transfer has been recorded with Stripe.").count(), 0, "uncertain state survives the failed check refresh");
              assert.equal(await page.getByText("No release action is needed.").count(), 0, "failed checks must not leave a normal-release conclusion");
              if (mode !== "check-reversed") {
                assert.equal(await page.getByRole("heading", { name: "SYNTHETIC LABOR" }).count(), 1, "last good view survives a bad refresh");
                assert.equal(await page.getByRole("button", { name: "Check transfer status" }).isDisabled(), true);
                assert.ok((await page.getByRole("alert").innerText()).includes("Unable to refresh payment records"));
                await page.getByRole("button", { name: "Refresh payments" }).click();
              }
              await assertReversalReview(page);
              if (mode === "check-reversed") assert.equal(await page.getByRole("alert").filter({ hasText: reversalFailure }).count(), 1, "original failure remains visible after good refresh");
              assert.deepEqual(posts.map(item => item.action), ["check_transfer"], "no release or repeated check");
            } else if (mode.startsWith("refresh-")) {
              await page.getByRole("button", { name: "Refresh payments" }).click(); await page.getByRole("alert").waitFor();
              assert.equal(await page.getByRole("heading", { name: "SYNTHETIC LABOR" }).count(), 1);
              const actionName = saved ? "Check transfer status" : "Review provider release";
              assert.equal(await page.getByRole("button", { name: actionName }).isDisabled(), true);
              await page.getByRole("button", { name: "Refresh payments" }).click();
              await page.getByRole("alert").waitFor({ state: "detached" });
              assert.equal(await page.getByRole("button", { name: actionName }).isDisabled(), false);
              assert.deepEqual(posts, []);
            } else if (mode === "closed") {
              assert.equal(await page.getByRole("button", { name: "Review provider release" }).count(), 0);
            } else {
              await page.getByRole("button", { name: "Review provider release" }).click();
              await page.getByRole("button", { name: "Confirm provider transfer" }).evaluate(button => { button.click(); button.click(); });
              if (mode === "success-refresh-reversed") {
                await assertReversalReview(page);
              } else if (["success", "saved-hold"].includes(mode)) {
                await page.getByRole("status").waitFor();
                assert.ok((await page.getByRole("status").innerText()).includes(mode === "saved-hold" ? "still has a hold" : "bank is not confirmed"));
              } else {
                await page.getByRole("alert").waitFor(); assert.equal(await page.getByRole("status").count(), 0);
                assert.equal(await page.getByRole("button", { name: "Review provider release" }).count(), 0);
                await page.getByRole("button", { name: "Check transfer status" }).click();
                if (mode === "check-missing") await page.getByText("No matching transfer is confirmed. Keep this payment under review.").waitFor();
                else await page.getByRole("status").waitFor();
                assert.equal(posts.filter(item => item.action === "check_transfer").length, 1);
              }
              assert.equal(posts.filter(item => item.action === "release").length, 1, "no repeated money instruction");
            }
          }
          assert.deepEqual(errors, []); assert.deepEqual(unexpected, []);
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true, "no horizontal overflow");
          report.push({ browser: browserType.name(), mode, passed: true }); console.log(`PASS ${browserType.name()} ${mode}`);
        } catch (error) { report.push({ browser: browserType.name(), mode, passed: false, error: error.message }); console.error(`FAIL ${browserType.name()} ${mode}: ${error.message}`); }
        finally { await context.close(); }
      }
    } finally { await browser.close(); }
  }
} finally { await new Promise(done => server.close(done)); }
await mkdir(resolve(root, "outputs"), { recursive: true });
await writeFile(resolve(root, "outputs/transfer-recovery-browser.json"), JSON.stringify(report, null, 2));
console.log(`${report.filter(item => item.passed).length}/${report.length} cases passed`);
if (report.some(item => !item.passed)) process.exitCode = 1;
