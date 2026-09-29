// Actual owner component and CSS. Every API response is synthetic and loopback;
// stripe-full-refund.test.mjs separately runs signed owner auth, SQL and SDK.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, webkit } from "playwright";
import { build } from "vite";

const root = fileURLToPath(new URL("../..", import.meta.url));
const builds = await build({ root, configFile: false, envFile: false, logLevel: "error",
  define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" },
  build: { write: false, lib: { entry: resolve(root, "tests/e2e/fixtures/refund-review.tsx"), name: "RefundReviewFixture", formats: ["iife"] } },
});
const bundle = Array.isArray(builds) ? builds[0] : builds;
const assets = new Map(bundle.output.map(asset => ["/" + asset.fileName, asset.type === "chunk" ? asset.code : asset.source]));
const js = bundle.output.find(asset => asset.type === "chunk").fileName;
const css = bundle.output.find(asset => asset.fileName.endsWith(".css")).fileName;
const server = createServer((request, response) => {
  const path = request.url.split("?")[0];
  if (assets.has(path)) { response.writeHead(200, { "content-type": path.endsWith(".css") ? "text/css" : "text/javascript" }); response.end(assets.get(path)); }
  else if (request.method === "GET" && path === "/refund-review") {
    response.writeHead(200, { "content-type": "text/html" });
    response.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/${css}"></head><body><div id="root"></div><script src="/${js}"></script></body></html>`);
  } else { response.writeHead(404); response.end(); }
});
await new Promise(done => server.listen(0, "127.0.0.1", done));
const origin = `http://127.0.0.1:${server.address().port}`;
try {
  for (const browserType of [chromium, webkit]) {
    const browser = await browserType.launch({ headless: true });
    try {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "en-US" });
      const page = await context.newPage();
      const errors = []; page.on("pageerror", error => errors.push(error.message));
      const writes = []; let statusReads = 0, enabled = false, approved = false, execution = null, expired = false;
      let rejectApproval = false, loseSend = false, malformed = false, malformedQueue = false, malformedApproval = false;
      let brokenDetails = false, recoveryMissing = false, revision = "a".repeat(64), detailRequests = 0;
      const snapshot = () => ({ cancellationId: "synthetic-cancel", requestId: "synthetic-job", cancellationType: "provider_no_show",
        reason: "Synthetic provider did not arrive.", requestedAt: "2026-09-28T10:00:00Z", customerName: "SYNTHETIC CUSTOMER",
        providerName: "SYNTHETIC PROVIDER", jobStatus: approved ? "cancelled" : "assigned", providerTravelStarted: false, workRecorded: false,
        enabled, blockers: [], reviewToken: revision,
        payment: { id: "synthetic-payment", stripePaymentIntentId: "pi_synthetic", currency: "usd", providerAmountCents: 10000, customerFeeCents: 500, customerTotalCents: 10500,
          paidAt: "2026-09-28T09:00:00Z", status: execution && execution.status !== "refund_not_sent_review" ? "refund_status_review" : "paid_pending_completion" },
        approval: approved ? { id: "synthetic-approval", status: "approved", decidedAt: "2026-09-28T11:00:00Z", reason: "Synthetic owner review.", amountCents: 10500 } : null,
        execution,
      });
      await context.route("**/*", async route => {
        const request = route.request(), url = new URL(request.url());
        assert.equal(url.origin, origin, "no real service or browser account may be contacted");
        if (!url.pathname.startsWith("/api/")) return route.continue();
        if (expired) return route.fulfill({ status: 200, contentType: "text/html", body: "<h1>Owner sign-in required</h1>" });
        if (url.pathname === "/api/stripe/admin/refund-reviews") {
          if (request.method() === "GET") {
            if (!url.searchParams.has("cancellationId")) return route.fulfill({ json: malformedQueue ? { cases: [{ id: "synthetic-cancel" }], hasMore: false } : { cases: [{ id: "synthetic-cancel", requestId: "synthetic-job",
              customerName: "SYNTHETIC CUSTOMER", cancellationType: "provider_no_show", status: approved ? "approved" : "submitted", requestedAt: "2026-09-28T10:00:00Z" }], hasMore: false } });
            detailRequests++;
            return route.fulfill({ json: malformed ? { bad: true } : brokenDetails ? { ...snapshot(), approval: { id: "synthetic-approval" } } : snapshot() });
          }
          const body = request.postDataJSON(); writes.push({ path: url.pathname, body });
          if (rejectApproval) { rejectApproval = false; revision = "b".repeat(64); return route.fulfill({ status: 409, json: { error: "The records changed. Refresh the review and confirm the updated details." } }); }
          if (malformedApproval) { malformedApproval = false; return route.fulfill({ json: {} }); }
          assert.equal(body.reviewToken, revision); assert.equal(body.confirmed, true);
          assert.deepEqual(Object.keys(body).sort(), ["cancellationId", "confirmed", "reason", "reviewToken"]);
          approved = true; return route.fulfill({ json: { adjustmentId: "synthetic-approval", refundSent: false } });
        }
        assert.equal(url.pathname, "/api/stripe/admin/refunds");
        if (request.method() === "GET") {
          statusReads++; assert.equal(url.searchParams.get("adjustmentId"), "synthetic-approval");
          if (recoveryMissing) return route.fulfill({ status: 202, json: { status: execution.status, refundSucceeded: false, recovery: "not_found" } });
          execution = { status: "refund_succeeded", stripeRefundId: "re_synthetic" };
          return route.fulfill({ json: { status: execution.status, refundSucceeded: true } });
        }
        const body = request.postDataJSON(); writes.push({ path: url.pathname, body });
        assert.deepEqual(body, { adjustmentId: "synthetic-approval", ...(execution?.status === "refund_not_sent_review" ? { action: "retry_not_sent" } : {}) });
        execution = { status: "refund_submission_unconfirmed", stripeRefundId: null };
        if (loseSend) { loseSend = false; return route.abort("failed"); }
        return route.fulfill({ status: 202, json: { status: execution.status, refundSucceeded: false } });
      });
      try {
        await page.goto(origin + "/refund-review");
        await page.getByLabel("Choose a cancellation").selectOption("synthetic-cancel");
        const review = page.getByRole("article", { name: "Cancellation refund review" });
        await review.getByText("$105.00", { exact: true }).waitFor();
        assert.equal(await review.getByText("$100.00", { exact: true }).count(), 1);
        assert.equal(await review.getByText("$5.00", { exact: true }).count(), 1);
        const save = review.getByRole("button", { name: "Save refund approval", exact: true });
        const reason = review.getByLabel("Reason for approving this refund", { exact: true });
        const check = review.getByRole("checkbox");
        const refresh = review.getByRole("button", { name: "Refresh saved review", exact: true });
        assert.equal(await save.isDisabled(), true); assert.equal(writes.length, 0);
        enabled = true; await refresh.click(); await check.waitFor({ state: "visible" });
        await reason.fill("Synthetic owner confirms no work started.");
        assert.equal(await save.isDisabled(), true, "a reason without confirmation cannot approve");
        if (process.env.TUVELOZ_REFUND_SCREENSHOT_DIR) await page.screenshot({ path: resolve(process.env.TUVELOZ_REFUND_SCREENSHOT_DIR, `refund-review-${browserType.name()}.png`), fullPage: true });
        await check.check(); rejectApproval = true; await save.click();
        await review.getByRole("alert").waitFor();
        assert.equal(await reason.inputValue(), "Synthetic owner confirms no work started.");
        assert.equal(await check.isChecked(), false); assert.equal(await save.isDisabled(), true);
        await refresh.click(); await check.check();
        malformedApproval = true; await save.click();
        await review.getByRole("alert").waitFor();
        assert.match(await review.getByRole("alert").textContent(), /approval could not be confirmed/i);
        assert.equal(await review.getByText("Approval saved. No refund has been sent to Stripe.", { exact: true }).count(), 0);
        assert.equal(await reason.inputValue(), "Synthetic owner confirms no work started.");
        assert.equal(await check.isChecked(), false); assert.equal(await save.isDisabled(), true);
        assert.equal(writes.filter(row => row.path.endsWith("/refunds")).length, 0);
        await refresh.click(); await check.check();
        await save.click(); await review.getByText("Approval saved. No refund has been sent to Stripe.", { exact: true }).waitFor();
        assert.equal(writes.length, 3); assert.equal(writes.filter(row => row.path.endsWith("/refunds")).length, 0);
        const send = review.getByRole("button", { name: "Send refund to Stripe", exact: true });
        await send.click();
        await review.getByRole("group", { name: "Send this refund?" }).waitFor();
        assert.match(await review.getByRole("group").textContent(), /\$105\.00/);
        assert.equal(writes.length, 3, "opening the confirmation must not send money");
        await review.getByRole("button", { name: "Go back", exact: true }).click(); assert.equal(writes.length, 3);
        await send.click(); loseSend = true;
        await review.getByRole("button", { name: "Confirm and send refund", exact: true }).click();
        await review.getByRole("alert").waitFor(); assert.equal(await send.isDisabled(), true);
        assert.equal(writes.filter(row => row.path.endsWith("/refunds")).length, 1);
        await refresh.click(); await review.getByRole("button", { name: "Check Stripe refund status" }).waitFor();
        assert.equal(await send.count(), 0, "unknown submissions must never offer a new send");
        enabled = false; recoveryMissing = true;
        await page.reload(); await page.getByLabel("Choose a cancellation").selectOption("synthetic-cancel");
        const statusCheck = review.getByRole("button", { name: "Check Stripe refund status" });
        await statusCheck.click();
        await review.getByText(/Stripe has no matching refund confirmation yet/).waitFor();
        await review.getByText("Stripe payment: pi_synthetic", { exact: true }).waitFor();
        assert.equal(await send.count(), 0, "a missing Stripe result must never offer a resend");
        assert.equal(writes.filter(row => row.path.endsWith("/refunds")).length, 1);
        recoveryMissing = false; await statusCheck.click();
        await review.getByText("Stripe confirmed the refund.", { exact: true }).first().waitFor();
        assert.equal(statusReads, 2); assert.equal(writes.filter(row => row.path.endsWith("/refunds")).length, 1);
        execution = { status: "refund_not_sent_review", stripeRefundId: null };
        await refresh.click();
        const retry = review.getByRole("button", { name: "Review and retry refund", exact: true });
        await retry.waitFor(); assert.equal(await retry.isDisabled(), true, "a pause still blocks money submission");
        enabled = true; await refresh.click(); await retry.click();
        await review.getByRole("group", { name: "Retry this unsent refund?" }).waitFor();
        assert.equal(writes.filter(row => row.path.endsWith("/refunds")).length, 1, "opening retry confirmation sends nothing");
        await review.getByRole("button", { name: "Go back", exact: true }).click();
        await retry.click();
        if (process.env.TUVELOZ_REFUND_SCREENSHOT_DIR) await page.screenshot({ path: resolve(process.env.TUVELOZ_REFUND_SCREENSHOT_DIR, `refund-retry-${browserType.name()}.png`), fullPage: true });
        await review.getByRole("button", { name: "Confirm and send refund", exact: true }).click();
        await review.getByText("The refund result is not confirmed. Check its status; do not send another refund.", { exact: true }).waitFor();
        assert.equal(writes.filter(row => row.path.endsWith("/refunds")).length, 2);
        assert.equal(await retry.count(), 0, "an attempted retry becomes status-only");
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "mobile review must not overflow horizontally");
        // A stale sign-in or malformed response must never become an empty/successful review.
        expired = true; await refresh.click(); await review.getByRole("alert").waitFor();
        assert.match(await review.getByRole("alert").textContent(), /sign-in may have expired/);
        expired = false; malformed = true; await refresh.click();
        await review.getByText("The saved review could not be read. Refresh before approving anything.", { exact: true }).waitFor();
        malformed = false; brokenDetails = true; await refresh.click();
        await review.getByText("The saved review could not be read. Refresh before approving anything.", { exact: true }).waitFor();
        brokenDetails = false; await refresh.click();
        await review.getByText("The refund result is not confirmed. Check its status; do not send another refund.", { exact: true }).waitFor();
        malformedQueue = true; await page.getByRole("button", { name: "Refresh list", exact: true }).click();
        await page.getByText("Unable to read the refund review list. Refresh the list to try again.", { exact: true }).waitFor();
        assert.equal(await page.getByLabel("Choose a cancellation").inputValue(), "synthetic-cancel", "a bad list refresh preserves the current selection");
        if (process.env.TUVELOZ_REFUND_SCREENSHOT_DIR) await page.screenshot({ path: resolve(process.env.TUVELOZ_REFUND_SCREENSHOT_DIR, `refund-recovery-${browserType.name()}.png`), fullPage: true });
        malformedQueue = false; await page.getByRole("button", { name: "Refresh list", exact: true }).click();
        await page.getByText("Unable to read the refund review list. Refresh the list to try again.", { exact: true }).waitFor({ state: "hidden" });
        assert.equal(writes.length, 5); assert.ok(detailRequests >= 5); assert.deepEqual(errors, []);
        console.log(`PASS ${browserType.name()}: closed submission gates, paused recovery, explicit retry, exact amounts, valid approval confirmation, malformed nested review/list recovery, retained selection and draft, sign-in recovery, mobile layout`);
      } finally { await context.close(); }
    } finally { await browser.close(); }
  }
} finally { await new Promise(done => server.close(done)); }
