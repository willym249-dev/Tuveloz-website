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
async function checkReadOnlyEstimate(browser, browserType) {
  const context = await browser.newContext({ viewport: { width: 320, height: 844 }, locale: "en-US" });
  const page = await context.newPage(), errors = [], writes = [];
  page.on("pageerror", error => errors.push(error.message));
  let reads = 0, failDetails = false, malformedList = false, heldResolve = null;
  const makeReview = (id = "estimate-cancel") => ({
    cancellationId: id, requestId: "estimate-job", cancellationType: id === "estimate-other" ? "customer_no_show" : "customer_cancel",
    reason: "Synthetic customer stopped work.", requestedAt: "2026-10-04T10:00:00Z", customerName: "SYNTHETIC ESTIMATE CUSTOMER",
    providerName: "SYNTHETIC ESTIMATE PROVIDER", jobStatus: "paused", providerTravelStarted: true, workRecorded: true,
    enabled: false, blockers: ["Recorded work needs a separate evidence review."], reviewToken: "c".repeat(64),
    estimateEligibility: { available: true, blockers: [] }, approval: null, execution: null,
    payment: { id: "estimate-payment", stripePaymentIntentId: "pi_estimate", currency: "usd", status: "paid_pending_completion",
      providerAmountCents: 10000, customerFeeCents: 500, customerTotalCents: 10500, paidAt: "2026-10-04T09:00:00Z" },
    evidence: {
      scope: { state: "matched", amountMatchesPayment: true, record: { id: "estimate-scope", scopeVersion: 1,
        authorizationDecisionId: "estimate-authorization", customerAuthorizedAt: "2026-10-04T08:00:00Z", serviceCodes: ["oil_change"],
        price: { laborAmountCents: 10000, partsAmountCents: 0, taxAmountCents: 0, otherAmountCents: 0, totalAmountCents: 10000,
          customerFeeRateBps: 500, customerFeeCents: 500, customerTotalCents: 10500 } } },
      invoice: { state: "missing", amountMatchesPayment: null, record: null },
      payment: { scopeVersion: 1, scopeAuthorizationDecisionId: "estimate-authorization", transferId: "", releasedAt: "",
        refundAmountCents: 0, refundStatus: "", disputeStatus: "", lastRefundId: "" },
      workRecords: [{ id: "estimate-work", workStatus: "paused", jobStartDecisionId: "estimate-start", completionDecisionId: "", trackedSeconds: 0, billableMinutes: 0 }],
      incidentHoldIds: [], adjustments: [],
    },
  });
  let current = makeReview();
  const holdNextDetail = () => new Promise(resolve => { heldResolve = resolve; });
  await context.route("**/*", async route => {
    const request = route.request(), url = new URL(request.url());
    assert.equal(url.origin, origin, "estimates must never contact a real service");
    if (!url.pathname.startsWith("/api/")) return route.continue();
    if (request.method() !== "GET") { writes.push(request.url()); return route.fulfill({ status: 500, json: { error: "Unexpected write" } }); }
    reads++;
    assert.equal(url.pathname, "/api/stripe/admin/refund-reviews", "estimates must not call a calculation or Stripe endpoint");
    if (!url.searchParams.has("cancellationId")) return route.fulfill({ json: malformedList ? {} : { hasMore: false,
      cases: ["estimate-cancel", "estimate-other"].map(id => ({ id, requestId: "estimate-job", customerName: "SYNTHETIC ESTIMATE CUSTOMER",
        cancellationType: id === "estimate-other" ? "customer_no_show" : "customer_cancel", status: "submitted", requestedAt: "2026-10-04T10:00:00Z" })) } });
    if (failDetails) return route.abort("failed");
    const body = structuredClone({ ...current, cancellationId: url.searchParams.get("cancellationId") });
    if (heldResolve) {
      const resolveHeld = heldResolve; heldResolve = null;
      return new Promise(done => resolveHeld({ respond: async () => { await route.fulfill({ json: body }); done(); } }));
    }
    return route.fulfill({ json: body });
  });
  try {
    await page.goto(origin + "/refund-review");
    const choose = page.getByLabel("Choose a cancellation"), review = page.getByRole("article", { name: "Cancellation refund review" });
    const refresh = review.getByRole("button", { name: "Refresh saved review", exact: true });
    const estimate = review.locator("details.refund-estimate"), input = estimate.getByLabel("Proposed labor refund (USD)");
    const calculate = estimate.getByRole("button", { name: "Calculate estimate", exact: true });
    const result = estimate.getByRole("status", { name: "Refund estimate", exact: true });
    const openEstimate = async () => { if (await estimate.getAttribute("open") === null) await estimate.locator("summary").click(); };
    const calculateForty = async () => { await openEstimate(); await input.fill("40"); await calculate.click(); await result.getByText("$42.00", { exact: true }).waitFor(); };

    // The slower initial read cannot replace a newer explicit refresh.
    const initialHeld = holdNextDetail(); await choose.selectOption("estimate-cancel"); const initial = await initialHeld;
    current = makeReview(); current.customerName = "REFRESHED SYNTHETIC CUSTOMER";
    current.estimateEligibility = { available: false, blockers: ["New evidence needs review."] };
    await refresh.click(); await review.getByText("REFRESHED SYNTHETIC CUSTOMER", { exact: true }).waitFor();
    const oldResponse = page.waitForResponse(response => response.url().includes("cancellationId=estimate-cancel"));
    await initial.respond(); await (await oldResponse).finished();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await review.getByText("REFRESHED SYNTHETIC CUSTOMER", { exact: true }).count(), 1, "a late initial response must not restore old eligibility");
    await openEstimate(); assert.equal(await calculate.isDisabled(), true);

    current = makeReview(); await refresh.click(); await review.getByText("SYNTHETIC ESTIMATE CUSTOMER", { exact: true }).waitFor();
    assert.equal(await estimate.getAttribute("open"), null, "the estimator starts collapsed");
    await estimate.locator("summary").focus(); await page.keyboard.press("Enter");
    await estimate.getByText("Estimate from saved records. Pending evidence review.", { exact: true }).waitFor();
    const beforeCalculation = reads;
    await calculateForty();
    for (const amount of ["$40.00", "$2.00", "$42.00"]) assert.equal(await result.getByText(amount, { exact: true }).count(), 1);
    assert.equal(reads, beforeCalculation, "calculating uses the saved snapshot without any API request");
    assert.equal(await review.getByRole("button", { name: "Save refund approval", exact: true }).isDisabled(), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "estimate fits a 320px phone");
    if (process.env.TUVELOZ_REFUND_SCREENSHOT_DIR) await page.screenshot({ path: resolve(process.env.TUVELOZ_REFUND_SCREENSHOT_DIR, `refund-estimate-${browserType.name()}.png`), fullPage: true });
    await input.fill("0.29"); assert.equal(await result.count(), 0, "editing the proposal clears the estimate");
    await input.press("Enter"); await result.getByText("$0.30", { exact: true }).waitFor();
    for (const bad of ["", "0", "-1", "1.001", "1e2", "40,00", "$40", "100.01"]) {
      await input.fill(bad); await calculate.click(); await estimate.getByRole("alert").waitFor();
      assert.equal(await input.getAttribute("aria-invalid"), "true"); assert.equal(await result.count(), 0, bad);
    }
    await calculateForty();
    const refreshHeld = holdNextDetail(); await refresh.click(); const pending = await refreshHeld;
    assert.equal(await result.count(), 0, "refresh clears the estimate before its response arrives");
    await openEstimate(); assert.equal(await calculate.isDisabled(), true);
    await pending.respond(); await refresh.waitFor({ state: "visible" }); await calculateForty();

    failDetails = true; await refresh.click(); await review.getByRole("alert").waitFor(); await openEstimate();
    assert.equal(await result.count(), 0); assert.equal(await calculate.isDisabled(), true, "a failed refresh cannot estimate from the last good snapshot");
    assert.equal(await review.getByText("SYNTHETIC ESTIMATE CUSTOMER", { exact: true }).count(), 1);
    failDetails = false;
    for (const corrupt of [value => { delete value.estimateEligibility; }, value => { value.estimateEligibility.available = "true"; },
      value => { value.evidence.incidentHoldIds = ["synthetic-hold"]; }]) {
      current = makeReview(); corrupt(current); await refresh.click();
      await review.getByText("The saved review could not be read. Refresh before approving anything.", { exact: true }).waitFor();
      await openEstimate(); assert.equal(await calculate.isDisabled(), true); assert.equal(await result.count(), 0);
    }
    current = makeReview(); await refresh.click(); await refresh.waitFor({ state: "visible" }); await calculateForty();
    current = makeReview(); current.reviewToken = "d".repeat(64);
    current.estimateEligibility = { available: false, blockers: ["A saved adjustment requires separate review."] };
    await refresh.click(); await refresh.waitFor({ state: "visible" }); await openEstimate();
    await estimate.getByText("A saved adjustment requires separate review.", { exact: true }).waitFor();
    assert.equal(await calculate.isDisabled(), true); assert.equal(await result.count(), 0);
    current = makeReview(); await refresh.click(); await refresh.waitFor({ state: "visible" }); await calculateForty();

    // List refresh invalidates the case estimate even though its last good details remain visible.
    malformedList = true; await page.getByRole("button", { name: "Refresh list", exact: true }).click();
    await page.getByText("Unable to read the refund review list. Refresh the list to try again.", { exact: true }).waitFor();
    await openEstimate(); assert.equal(await calculate.isDisabled(), true); assert.equal(await result.count(), 0);
    malformedList = false; await page.getByRole("button", { name: "Refresh list", exact: true }).click();
    await page.getByText("Unable to read the refund review list. Refresh the list to try again.", { exact: true }).waitFor({ state: "hidden" });
    await openEstimate(); assert.equal(await calculate.isDisabled(), true, "a list refresh cannot bless old case details");
    await refresh.click(); await refresh.waitFor({ state: "visible" }); await calculateForty();
    current = makeReview("estimate-other"); await choose.selectOption("estimate-other");
    await review.getByText("Customer did not arrive · Request estimate-job", { exact: true }).waitFor(); await openEstimate();
    assert.equal(await input.inputValue(), ""); assert.equal(await result.count(), 0, "case changes clear estimates");
    await calculateForty();
    assert.equal(writes.length, 0, "all estimates and recovery remain read-only"); assert.deepEqual(errors, []);
    console.log(`PASS ${browserType.name()}: read-only refund estimate, exact cents, invalid amount rejection, 320px layout, no API calculation or writes, refreshed/malformed/stale/case invalidation, delayed initial GET ordering`);
  } finally { await context.close(); }
}
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
      let detailedEvidence = false, malformedEvidence = false;
      let scopeState = "matched", invoiceState = "matched", draftInvoice = false, differingInvoice = false, malformedScopeReply = false;
      let misleadingAmountReply = false;
      const providerAmounts = { laborAmountCents: 10000, partsAmountCents: 0, taxAmountCents: 0, otherAmountCents: 0, totalAmountCents: 10000 };
      const snapshot = () => ({ cancellationId: "synthetic-cancel", requestId: "synthetic-job", cancellationType: "provider_no_show",
        reason: "Synthetic provider did not arrive.", requestedAt: "2026-09-28T10:00:00Z", customerName: "SYNTHETIC CUSTOMER",
        providerName: "SYNTHETIC PROVIDER", jobStatus: approved ? "cancelled" : "assigned", providerTravelStarted: false, workRecorded: false,
        enabled, blockers: detailedEvidence ? ["An incident still has a payment hold. Resolve that review first."] : [], reviewToken: revision,
        estimateEligibility: { available: false, blockers: ["Provider cancellations use the full-refund rule."] },
        payment: { id: "synthetic-payment", stripePaymentIntentId: "pi_synthetic", currency: "usd", providerAmountCents: 10000, customerFeeCents: 500, customerTotalCents: 10500,
          paidAt: "2026-09-28T09:00:00Z", status: execution && execution.status !== "refund_not_sent_review" ? "refund_status_review" : "paid_pending_completion" },
        approval: approved ? { id: "synthetic-approval", status: "approved", decidedAt: "2026-09-28T11:00:00Z", reason: "Synthetic owner review.", amountCents: 10500 } : null,
        execution,
        evidence: {
          scope: !detailedEvidence || scopeState !== "matched" ? { state: detailedEvidence ? scopeState : "missing", record: null, amountMatchesPayment: null } : {
            state: "matched", amountMatchesPayment: true, record: { id: "synthetic-scope-record", scopeVersion: 1,
              authorizationDecisionId: "synthetic-scope", serviceCodes: ["battery_replacement"], customerAuthorizedAt: "2026-09-28T08:00:00Z",
              price: { ...providerAmounts, customerFeeRateBps: 500, customerFeeCents: 500, customerTotalCents: malformedScopeReply ? "10500" : 10500,
                ...(misleadingAmountReply ? { laborAmountCents: 20000, totalAmountCents: 20000, customerFeeCents: 1000, customerTotalCents: 21000 } : {}) } },
          },
          invoice: !detailedEvidence || invoiceState !== "matched" ? { state: detailedEvidence ? invoiceState : "missing", record: null, amountMatchesPayment: null } : {
            state: "matched", amountMatchesPayment: !differingInvoice, record: { id: "synthetic-invoice", invoiceNumber: "TEST-" + "long".repeat(35),
              scopeVersion: 1, status: draftInvoice ? "draft" : "final", serviceCodes: ["battery_replacement"], ...providerAmounts,
              ...(differingInvoice ? { laborAmountCents: 12000, totalAmountCents: 12000 } : {}),
              issuedAt: draftInvoice ? "" : "2026-09-28T09:30:00Z", workSummary: '<img src=x onerror="alert(1)"> Synthetic summary, displayed as text.',
            },
          },
          workRecords: detailedEvidence ? [{ id: "synthetic-work", workStatus: "paused", jobStartDecisionId: "synthetic-start", completionDecisionId: "", trackedSeconds: 1200, billableMinutes: 20 }] : [],
          incidentHoldIds: detailedEvidence ? ["synthetic-incident-hold"] : [],
          payment: { scopeVersion: 1, scopeAuthorizationDecisionId: "synthetic-scope", transferId: detailedEvidence ? "tr_synthetic_" + "long".repeat(35) : "", releasedAt: detailedEvidence ? "2026-09-28T09:30:00Z" : "", refundAmountCents: detailedEvidence ? 4200 : 0, refundStatus: detailedEvidence ? "pending" : "", disputeStatus: detailedEvidence ? "under_review" : "", lastRefundId: detailedEvidence ? "re_synthetic_partial" : "" },
          adjustments: detailedEvidence ? [{ id: "synthetic-prior-adjustment", adjustmentType: "partial_refund_review", status: "pending", amountCents: malformedEvidence ? -4200 : 4200, currency: "usd", providerImpactCents: -4000, customerImpactCents: 4200, stripeRefundId: "re_synthetic_partial", transferReversalId: "trr_synthetic", requestedAt: "2026-09-28T10:00:00Z", decidedAt: "" }] : [],
        },
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
        const evidence = review.locator("details.refund-evidence:not(.refund-estimate)");
        const evidenceToggle = evidence.locator("summary");
        assert.equal(await evidence.getAttribute("open"), null, "evidence starts collapsed to keep the review simple");
        await evidenceToggle.focus(); await page.keyboard.press("Enter");
        await evidence.getByText("No work record is saved. Confirm what happened with the customer and provider.", { exact: true }).waitFor();
        await evidence.getByText("No agreed-work record is saved for this payment’s scope version.", { exact: true }).waitFor();
        await evidence.getByText("No provider invoice is saved for this payment’s scope version.", { exact: true }).waitFor();
        assert.equal(writes.length, 0, "opening saved evidence cannot approve or refund");
        detailedEvidence = true; enabled = true; await refresh.click();
        await evidence.getByText(/Provider transfer recorded:/).waitFor();
        await evidence.getByText(/Recorded refund amount: \$42.00. Refund status: pending/).waitFor();
        await evidence.getByText(/Recorded provider adjustment: -\$40.00/).waitFor();
        await evidence.getByText(/Incident payment hold:/).waitFor();
        await evidence.getByText("Final invoice", { exact: true }).waitFor();
        await evidence.getByText("These saved amounts match the payment’s approved price.", { exact: true }).waitFor();
        await evidence.getByText("The invoice amounts match the provider amounts approved for this payment.", { exact: true }).waitFor();
        await evidence.getByText(/Synthetic summary, displayed as text/).waitFor();
        assert.equal(await evidence.locator("img").count(), 0, "provider summary must render as text, never HTML");
        assert.equal(await save.isDisabled(), true, "displaying evidence must not clear a payment hold");
        await page.setViewportSize({ width: 320, height: 844 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "long evidence references must fit a narrow phone");
        if (process.env.TUVELOZ_REFUND_SCREENSHOT_DIR) await page.screenshot({ path: resolve(process.env.TUVELOZ_REFUND_SCREENSHOT_DIR, `refund-evidence-${browserType.name()}.png`), fullPage: true });
        draftInvoice = true; differingInvoice = true; await refresh.click();
        await evidence.getByText("Draft invoice — not final", { exact: true }).waitFor();
        await evidence.getByText(/Issued: not yet issued/).waitFor();
        await evidence.getByText("The invoice amounts differ from the provider amounts approved for this payment. Review the source records.", { exact: true }).waitFor();
        malformedScopeReply = true; await refresh.click();
        await review.getByText("The saved review could not be read. Refresh before approving anything.", { exact: true }).waitFor();
        await evidence.getByText("Draft invoice — not final", { exact: true }).waitFor();
        assert.equal(await save.isDisabled(), true, "an invalid scope response preserves the last review but cannot be approved");
        malformedScopeReply = false; misleadingAmountReply = true; await refresh.click();
        await review.getByText("The saved review could not be read. Refresh before approving anything.", { exact: true }).waitFor();
        assert.equal(await evidence.getByText("$200.00", { exact: true }).count(), 0, "a false match claim cannot replace saved evidence");
        assert.equal(await save.isDisabled(), true);
        misleadingAmountReply = false;
        for (const state of ["mismatched", "malformed", "unavailable", "missing"]) {
          scopeState = state; invoiceState = state; await refresh.click();
          const agreedWork = evidence.getByRole("region", { name: "Agreed work for this payment", exact: true });
          const invoiceRecord = evidence.getByRole("region", { name: "Provider invoice for this payment", exact: true });
          const expected = { mismatched: /does not belong to this payment/, malformed: /incomplete or invalid details/,
            unavailable: /single payment with a valid scope reference/, missing: /No .* is saved for this payment/ }[state];
          await agreedWork.getByText(expected).waitFor(); await invoiceRecord.getByText(expected).waitFor();
          assert.equal(await invoiceRecord.getByText(/Synthetic summary/).count(), 0, "unmatched records must not expose invoice details");
        }
        scopeState = "matched"; invoiceState = "matched"; draftInvoice = false; differingInvoice = false;
        malformedEvidence = true; await refresh.click();
        await review.getByText("The saved review could not be read. Refresh before approving anything.", { exact: true }).waitFor();
        await evidence.getByText(/Recorded refund amount: \$42.00. Refund status: pending/).waitFor();
        assert.equal(await save.isDisabled(), true, "malformed evidence must preserve the last record and block approval");
        assert.equal(writes.length, 0, "evidence viewing and malformed refreshes must not write");
        detailedEvidence = false; malformedEvidence = false; await refresh.click();
        await evidence.getByText("No adjustment is saved for this quote.", { exact: true }).waitFor();
        await evidenceToggle.click(); await page.setViewportSize({ width: 390, height: 844 });
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
        assert.match(await review.getByRole("group", { name: "Send this refund?" }).textContent(), /\$105\.00/);
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
        await retry.waitFor(); assert.equal(await retry.isDisabled(), true, "a closed refund release still blocks money submission");
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
        console.log(`PASS ${browserType.name()}: read-only evidence and retained malformed refresh, 320px evidence layout, closed submission gates, recovery during release closure, explicit retry, exact amounts, valid approval confirmation, malformed nested review/list recovery, retained selection and draft, sign-in recovery, mobile layout`);
      } finally { await context.close(); }
      await checkReadOnlyEstimate(browser, browserType);
    } finally { await browser.close(); }
  }
} finally { await new Promise(done => server.close(done)); }
