import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { build } from "esbuild";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { exportJWK, generateKeyPair, SignJWT } from "jose";

// Real owner JWT verification, route, migrated database and Stripe SDK. Only
// network responses, Cloudflare bindings and the FUTURE release gate are fixtures.
// All participants, credentials and money exist only in this isolated process.
test("approved full refunds reserve once, include the fee and reconcile uncertain outcomes", async t => {
  const repo = resolve(import.meta.dirname, "..");
  const tempRoot = resolve(tmpdir()), scratch = mkdtempSync(join(tempRoot, "tuveloz-full-refund-"));
  const database = new DatabaseSync(":memory:"), originalFetch = globalThis.fetch;
  const issuer = "https://synthetic-refund.cloudflareaccess.com", email = "owner@example.invalid", audience = "synthetic-refund";
  const state = { db: null, open: false, beforeWrite: null, beforeExecutionWrite: null, beforeBatch: null, batchBarrier: null, failBatch: false, env: { OWNER_EMAIL: email, TEAM_DOMAIN: issuer,
    OWNER_ACCESS_AUD: audience, STRIPE_SECRET_KEY: "sk_test_synthetic_refund_fixture" } };
  globalThis.__fullRefund = state;
  const keys = await generateKeyPair("RS256");
  const jwk = { ...await exportJWK(keys.publicKey), kid: "synthetic", alg: "RS256", use: "sig" };
  const sign = (claims = {}) => new SignJWT({ email, ...claims }).setProtectedHeader({ alg: "RS256", kid: "synthetic" })
    .setIssuer(issuer).setAudience(audience).setIssuedAt().setExpirationTime("10m").sign(keys.privateKey);
  const seed = (table, values) => database.prepare(`INSERT INTO ${table} (${Object.keys(values).join(",")}) VALUES (${Object.keys(values).map(() => "?").join(",")})`).run(...Object.values(values));
  const row = () => database.prepare("SELECT * FROM stripe_payments WHERE id='payment-synthetic'").get();
  const execution = () => database.prepare("SELECT * FROM payment_adjustments WHERE adjustment_type='stripe_full_refund'").get();
  const now = new Date().toISOString();
  let remote, transfers, posts, getCount, postMode, nextStatus, beforePost, intentChange;
  const reset = () => {
    for (const table of ["stripe_payments", "payment_adjustments", "customer_requests", "provider_applications", "job_cancellations", "provider_job_records", "job_incidents", "email_notification_outbox", "account_notifications"]) database.exec(`DELETE FROM ${table}`);
    state.open = true; state.beforeWrite = null; state.beforeExecutionWrite = null; state.env.STRIPE_SECRET_KEY = "sk_test_synthetic_refund_fixture";
    state.beforeBatch = null; state.batchBarrier = null; state.failBatch = false;
    remote = []; transfers = []; posts = []; getCount = 0; postMode = "ok"; nextStatus = "succeeded"; beforePost = null; intentChange = null;
    seed("customer_requests", { id: "job-synthetic", name: "SYNTHETIC CUSTOMER", email: "customer@example.invalid", zip: "20910",
      vehicle: "Synthetic vehicle", service: "Synthetic service", details: "SYNTHETIC ONLY", status: "cancelled", is_test_job: "no",
      parts_source: "No parts needed — labor only", parts_preference: "No preference", labor_only_parts_acknowledged_at: now });
    seed("provider_applications", { id: "provider-synthetic", name: "SYNTHETIC PROVIDER", email: "provider@example.invalid",
      service: "Synthetic service", service_area: "Montgomery County", experience: "SYNTHETIC ONLY", insurance_status: "unverified", is_test_provider: "no" });
    const price = JSON.stringify({ totalAmountCents: 10000, customerFeeCents: 500, customerTotalCents: 10500 });
    seed("stripe_payments", { id: "payment-synthetic", payment_type: "quote", product_name: "SYNTHETIC ONLY",
      request_id: "job-synthetic", quote_id: "quote-synthetic", provider_application_id: "provider-synthetic", connected_account_id: "acct_synthetic",
      scope_version: 1, scope_authorization_decision_id: "scope-synthetic", authorized_price_snapshot: price,
      provider_amount_cents: 10000, application_fee_cents: 500, customer_total_cents: 10500, settlement_strategy: "separate_transfer",
      payment_intent_id: "pi_synthetic", charge_id: "ch_synthetic", transfer_group: "tuveloz_payment-synthetic", checkout_session_id: "cs_synthetic", paid_at: now, status: "paid_pending_completion" });
    const paymentSnapshot = { paymentId: "payment-synthetic", requestId: "job-synthetic", quoteId: "quote-synthetic", scopeVersion: 1,
      providerApplicationId: "provider-synthetic", connectedAccountId: "acct_synthetic", customerEmail: "",
      scopeAuthorizationDecisionId: "scope-synthetic", authorizedPriceSnapshot: price, paymentIntentId: "pi_synthetic", chargeId: "ch_synthetic", transferGroup: "tuveloz_payment-synthetic",
      currency: "usd", customerRefundCents: 10500, providerRefundCents: 10000, customerFeeRefundCents: 500 };
    seed("payment_adjustments", { id: "decision-synthetic", payment_id: "payment-synthetic", request_id: "job-synthetic", quote_id: "quote-synthetic",
      adjustment_type: "cancellation_refund", amount_cents: 10500, status: "approved", reason_code: "provider_no_show", details: JSON.stringify({ paymentSnapshot }),
      requested_by_role: "owner", requested_by_id: email, decided_by: email, decided_at: now,
      provider_impact_cents: -10000, customer_impact_cents: 10500, idempotency_key: "synthetic-approved-decision" });
    seed("job_cancellations", { id: "cancellation-synthetic", request_id: "job-synthetic", quote_id: "quote-synthetic", requested_by_role: "customer",
      requested_by_email: "customer@example.invalid", cancellation_type: "provider_no_show", reason: "SYNTHETIC ONLY", status: "approved",
      proposed_refund_cents: 10500, decision_by: email, decision_at: now, decision_reason: "SYNTHETIC ONLY", payment_adjustment_id: "decision-synthetic" });
  };
  const intent = () => {
    const value = { id: "pi_synthetic", status: "succeeded", amount: 10500, amount_received: 10500, currency: "usd", livemode: false,
      metadata: { tuveloz_payment_record_id: "payment-synthetic" }, transfer_data: null, transfer_group: "tuveloz_payment-synthetic",
      latest_charge: { id: "ch_synthetic", payment_intent: "pi_synthetic", paid: true, captured: true, status: "succeeded", currency: "usd",
        amount: 10500, amount_captured: 10500, livemode: false, refunded: false, amount_refunded: 0, disputed: false, transfer: null, transfer_data: null } };
    intentChange?.(value); return value;
  };
  try {
    globalThis.fetch = async (url, options = {}) => {
      const address = new URL(String(url));
      if (address.href === `${issuer}/cdn-cgi/access/certs`) return Response.json({ keys: [jwk] });
      assert.equal(address.origin, "https://api.stripe.com", "unexpected network destination");
      const method = options.method ?? "GET";
      if (method === "POST") {
        assert.equal(address.pathname, "/v1/refunds");
        const body = new URLSearchParams(String(options.body));
        posts.push({ params: Object.fromEntries(body), key: new Headers(options.headers).get("idempotency-key") });
        await beforePost?.();
        if (postMode === "reject") return Response.json({ error: { type: "invalid_request_error", message: "Synthetic rejection" } }, { status: 400 });
        const refund = { id: "re_synthetic", object: "refund", charge: "ch_synthetic", payment_intent: "pi_synthetic", amount: Number(body.get("amount")), currency: "usd", status: nextStatus,
          metadata: { tuveloz_refund_execution_id: body.get("metadata[tuveloz_refund_execution_id]"),
            tuveloz_payment_record_id: body.get("metadata[tuveloz_payment_record_id]") } };
        remote.push(refund);
        if (postMode === "lost") throw Error("SYNTHETIC: response lost after Stripe accepted the refund");
        if (postMode === "mismatch") return Response.json({ ...refund, amount: 10000 });
        return Response.json(refund);
      }
      assert.equal(method, "GET"); getCount++;
      if (address.pathname === "/v1/payment_intents/pi_synthetic") return Response.json(intent());
      if (address.pathname === "/v1/refunds") return Response.json({ object: "list", data: remote, has_more: false, url: "/v1/refunds" });
      if (address.pathname === "/v1/refunds/re_synthetic") return Response.json(remote[0]);
      if (address.pathname === "/v1/transfers") {
        assert.equal(address.searchParams.get("transfer_group"), "tuveloz_payment-synthetic");
        return Response.json({ object: "list", data: transfers, has_more: false, url: "/v1/transfers" });
      }
      if (address.pathname === "/v1/charges/ch_synthetic") return Response.json({ ...intent().latest_charge,
        amount_refunded: remote.some(item => item.status === "succeeded") ? 10500 : 0, refunded: remote.some(item => item.status === "succeeded") });
      throw Error(`Unexpected SDK request ${address.pathname}`);
    };
    for (const entry of JSON.parse(readFileSync(join(repo, "drizzle/meta/_journal.json"), "utf8")).entries) {
      for (const query of readFileSync(join(repo, "drizzle", entry.tag + ".sql"), "utf8").split("--> statement-breakpoint")) if (query.trim()) database.exec(query);
    }
    const querySql = (query, params, method) => {
      assert.ok(params.length <= 100, "every D1 statement must stay within its parameter limit");
      if (query.startsWith('update "stripe_payments"') && state.beforeWrite) { const change = state.beforeWrite; state.beforeWrite = null; change(); }
      if (query.startsWith('update "payment_adjustments"') && state.beforeExecutionWrite) { const change = state.beforeExecutionWrite; state.beforeExecutionWrite = null; change(); }
      if (method === "run") { database.prepare(query).run(...params); return { rows: [] }; }
      database.exec("PRAGMA short_column_names=OFF; PRAGMA full_column_names=ON;");
      try { const statement = database.prepare(query); return { rows: method === "get" ? Object.values(statement.get(...params) ?? {}) : statement.all(...params).map(row => Object.values(row)) }; }
      finally { database.exec("PRAGMA short_column_names=ON; PRAGMA full_column_names=OFF;"); }
    };
    state.db = drizzle(querySql, async queries => {
      await state.batchBarrier?.();
      state.beforeBatch?.(); state.beforeBatch = null;
      database.exec("BEGIN");
      try {
        const result = [];
        for (let i = 0; i < queries.length; i++) {
          const query = queries[i];
          assert.ok(query.params.length <= 100, "D1 statement must stay within its parameter limit");
          if (state.failBatch && i === 1) throw Error("Synthetic cancellation write failure");
          result.push(querySql(query.sql, query.params, query.method));
        }
        database.exec("COMMIT"); return result;
      } catch (error) { database.exec("ROLLBACK"); throw error; }
    });
    const bundle = join(scratch, "refund.cjs");
    await build({ absWorkingDir: repo, stdin: { contents: `export { POST, GET as refundStatus } from "./app/api/stripe/admin/refunds/route";
      export { GET as review, POST as approve } from "./app/api/stripe/admin/refund-reviews/route";
      export { runtimeMarketplaceActionAllowed as actualLaunchGate } from "./lib/runtime-marketplace-action";
      export { recordRefundStatus } from "./lib/stripe-payments"; export { getStripeClient } from "./lib/stripe";`, resolveDir: repo, loader: "ts" },
      bundle: true, platform: "node", format: "cjs", outfile: bundle, target: "node22", logLevel: "silent",
      plugins: [{ name: "isolated-refund-fixtures", setup(builder) {
        builder.onResolve({ filter: /^cloudflare:workers$/ }, () => ({ path: "env", namespace: "fixture" }));
        builder.onResolve({ filter: /(?:^|\/)db$/ }, args => args.path.startsWith(".") ? { path: "db", namespace: "fixture" } : null);
        builder.onResolve({ filter: /runtime-marketplace-action$/ }, args => /lib\/stripe-(full-refund|refund-review)\.ts$/.test(args.importer.replaceAll("\\", "/")) ? { path: "gate", namespace: "fixture" } : null);
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({ loader: "js", contents: {
          env: "export const env = globalThis.__fullRefund.env;", db: "export function getDb() { return globalThis.__fullRefund.db; }",
          gate: "export async function runtimeMarketplaceActionAllowed(action, options) { if (action !== 'payout' || options.testOnly !== false) throw Error('Unsafe gate usage'); return globalThis.__fullRefund.open; }",
        }[args.path] }));
      } }] });
    const api = createRequire(import.meta.url)(bundle), token = await sign();
    const reviewCall = async ({ method = "GET", body, jwt = token, query = "?cancellationId=cancellation-synthetic", origin = "https://tuveloz.invalid" } = {}) => {
      const response = await api[method === "GET" ? "review" : "approve"](new Request(`https://tuveloz.invalid/api/stripe/admin/refund-reviews${query}`, {
        method, headers: { origin, "content-type": "application/json", ...(jwt ? { "cf-access-jwt-assertion": jwt } : {}) },
        ...(method === "POST" ? { body: typeof body === "string" ? body : JSON.stringify(body) } : {}),
      }));
      assert.equal(response.headers.get("cache-control"), "no-store");
      return { status: response.status, body: await response.json() };
    };
    const pendingReview = () => {
      reset(); database.exec("DELETE FROM payment_adjustments; UPDATE customer_requests SET status='assigned'; UPDATE job_cancellations SET status='submitted',payment_adjustment_id='',decision_by='',decision_at='',decision_reason='',proposed_refund_cents=0;");
    };
    const approveBody = async () => ({ cancellationId: "cancellation-synthetic", reviewToken: (await reviewCall()).body.reviewToken,
      reason: "SYNTHETIC: no work started; full refund approved.", confirmed: true });
    const addIncident = () => seed("job_incidents", { id: "incident-synthetic", request_id: "job-synthetic", reporter_role: "customer",
      reporter_email: "customer@example.invalid", incident_type: "synthetic", severity: "review", summary: "SYNTHETIC ONLY", occurred_at: now });
    const post = async (body = { adjustmentId: "decision-synthetic" }, jwt = token, origin = "https://tuveloz.invalid") => {
      const response = await api.POST(new Request("https://tuveloz.invalid/api/stripe/admin/refunds", { method: "POST",
        headers: { origin, "content-type": "application/json", ...(jwt ? { "cf-access-jwt-assertion": jwt } : {}) }, body: typeof body === "string" ? body : JSON.stringify(body) }));
      assert.equal(response.headers.get("cache-control"), "no-store");
      return { status: response.status, body: await response.json() };
    };
    await t.test("review access requires the signed owner; approvals require origin, exact input and open gates", async () => {
      pendingReview(); const body = await approveBody();
      for (const jwt of ["", "forged", await sign({ email: "stranger@example.invalid" })]) {
        assert.equal((await reviewCall({ jwt })).status, 403);
        assert.equal((await reviewCall({ method: "POST", body, jwt })).status, 403);
      }
      assert.equal((await reviewCall({ method: "POST", body, origin: "https://other.invalid" })).status, 403);
      for (const bad of ["{", "null", "[]", {}, { ...body, confirmed: false }, { ...body, amount: 10500 }, { ...body, reason: "" }, { ...body, reviewToken: "bad" }]) {
        assert.equal((await reviewCall({ method: "POST", body: bad })).status, 400);
      }
      for (const query of ["?cancellationId=", "?cancellationId=a&cancellationId=b", "?amount=1"]) assert.equal((await reviewCall({ query })).status, 400);
      state.open = false; assert.equal((await reviewCall()).body.enabled, false);
      assert.equal((await reviewCall({ method: "POST", body })).status, 503);
      assert.equal(database.prepare("SELECT count(*) n FROM payment_adjustments").get().n, 0);
      assert.equal(posts.length + getCount, 0);
    });
    await t.test("real queue hides simulations and approval saves the exact full amount without a Stripe call", async () => {
      pendingReview(); assert.equal((await reviewCall({ query: "" })).body.cases.length, 1);
      database.exec("UPDATE customer_requests SET is_test_job='yes'");
      assert.equal((await reviewCall({ query: "" })).body.cases.length, 0); assert.equal((await reviewCall()).status, 404);
      database.exec("UPDATE customer_requests SET is_test_job='no'; UPDATE provider_applications SET is_test_provider='yes'");
      assert.equal((await reviewCall({ query: "" })).body.cases.length, 0); assert.equal((await reviewCall()).status, 404);
      pendingReview(); const body = await approveBody(); const saved = await reviewCall({ method: "POST", body });
      assert.equal(saved.status, 200, JSON.stringify(saved.body)); assert.equal(saved.body.refundSent, false);
      const decision = database.prepare("SELECT * FROM payment_adjustments").get();
      assert.equal(decision.amount_cents, 10500); assert.equal(decision.provider_impact_cents, -10000); assert.equal(decision.customer_impact_cents, 10500);
      assert.equal(JSON.parse(decision.details).paymentSnapshot.customerFeeRefundCents, 500);
      assert.equal(decision.decided_by, email);
      assert.equal(database.prepare("SELECT status FROM customer_requests").get().status, "cancelled");
      assert.equal(database.prepare("SELECT payment_adjustment_id FROM job_cancellations").get().payment_adjustment_id, decision.id);
      assert.equal(posts.length + getCount, 0, "approval cannot contact Stripe");
      assert.equal((await reviewCall({ method: "POST", body })).body.alreadySaved, true);
      assert.equal((await reviewCall({ method: "POST", body: { ...body, reason: "Different decision cannot replace the first." } })).status, 409);
      assert.equal(database.prepare("SELECT count(*) n FROM payment_adjustments").get().n, 1);
      const view = (await reviewCall()).body; assert.equal(view.approval.id, decision.id); assert.equal(view.execution, null);
      assert.equal((await post({ adjustmentId: decision.id })).body.refundSucceeded, true, "the saved approval must actually feed the existing executor");
      assert.equal(posts.length, 1); assert.equal((await reviewCall()).body.execution.status, "refund_succeeded");
    });
    await t.test("stale, ambiguous, unsafe and started-work reviews cannot be approved", async () => {
      const changes = [
        "UPDATE stripe_payments SET customer_total_cents=10600", "UPDATE stripe_payments SET transfer_id='tr_sent'",
        "UPDATE stripe_payments SET status='refunded',refund_amount_cents=10500", "UPDATE stripe_payments SET paid_at=''",
        "UPDATE stripe_payments SET dispute_status='needs_response'", "UPDATE stripe_payments SET authorized_price_snapshot='{}'",
        "UPDATE job_cancellations SET cancellation_type='customer_no_show'", "UPDATE job_cancellations SET retained_amount_cents=1",
        "UPDATE job_cancellations SET work_performed_cents=1",
        "UPDATE customer_requests SET status='completed'",
        "INSERT INTO provider_job_records (id,request_id,provider_email,job_start_decision_id) VALUES ('work','job-synthetic','provider@example.invalid','started')",
      ];
      for (const change of changes) {
        pendingReview(); const before = await approveBody(); database.exec(change);
        assert.equal((await reviewCall({ method: "POST", body: before })).status, 409, change);
        const current = await approveBody(); assert.equal((await reviewCall({ method: "POST", body: current })).status, 409, change);
        assert.equal(database.prepare("SELECT count(*) n FROM payment_adjustments").get().n, 0);
      }
      pendingReview(); addIncident(); assert.equal((await reviewCall({ method: "POST", body: await approveBody() })).status, 409);
      pendingReview(); const duplicate = { ...row(), id: "second-payment", checkout_session_id: "cs_second", payment_intent_id: "pi_second", charge_id: "ch_second" }; seed("stripe_payments", duplicate);
      assert.equal((await reviewCall({ method: "POST", body: await approveBody() })).status, 409); assert.equal(posts.length + getCount, 0);
    });
    await t.test("transaction rechecks changed evidence and never leaves a partial decision after a write failure", async () => {
      for (const change of [
        () => database.exec("UPDATE stripe_payments SET charge_id='ch_replaced'"),
        () => database.exec("UPDATE job_cancellations SET reason='A new fact arrived'"),
        () => database.exec("UPDATE customer_requests SET is_test_job='yes'"),
        () => database.exec("UPDATE provider_applications SET is_test_provider='yes'"),
        () => database.exec("INSERT INTO provider_job_records (id,request_id,provider_email,job_start_decision_id) VALUES ('work','job-synthetic','provider@example.invalid','started')"),
        addIncident,
      ]) {
        pendingReview(); const body = await approveBody(); state.beforeBatch = change;
        const reply = await reviewCall({ method: "POST", body }); assert.equal(reply.status, 409, change.toString() + JSON.stringify(reply));
        assert.equal(database.prepare("SELECT count(*) n FROM payment_adjustments").get().n, 0);
        assert.equal(database.prepare("SELECT status FROM job_cancellations").get().status, "submitted");
      }
      pendingReview(); const body = await approveBody(); state.failBatch = true;
      assert.equal((await reviewCall({ method: "POST", body })).status, 500);
      assert.equal(database.prepare("SELECT count(*) n FROM payment_adjustments").get().n, 0);
      assert.equal(database.prepare("SELECT status FROM customer_requests").get().status, "assigned");
      assert.equal(database.prepare("SELECT status FROM job_cancellations").get().status, "submitted");
    });
    await t.test("simultaneous approvals save one immutable decision and all three allowed reasons are usable", { timeout: 15000 }, async () => {
      for (const reason of ["customer_cancel", "provider_cancel", "provider_no_show"]) {
        pendingReview(); database.prepare("UPDATE job_cancellations SET cancellation_type=?").run(reason);
        // Force both requests past their reads before either transaction starts.
        // Merely Promise.all-ing JWT-authenticated routes can serialize on some
        // runtimes and legitimately return the saved idempotent result twice.
        let arrivals = 0, release;
        const barrier = new Promise(resolve => { release = resolve; });
        state.batchBarrier = async () => { if (++arrivals === 2) release(); await barrier; };
        const body = await approveBody(); const replies = await Promise.all([reviewCall({ method: "POST", body }), reviewCall({ method: "POST", body })]);
        assert.equal(arrivals, 2);
        assert.equal(replies.filter(reply => reply.status === 200).length, 1);
        assert.equal(replies.filter(reply => reply.status === 409).length, 1);
        assert.equal(database.prepare("SELECT count(*) n FROM payment_adjustments").get().n, 1);
        assert.equal(posts.length + getCount, 0);
      }
    });
    await t.test("status-only requests never initiate a refund, and new incident holds stop execution", async () => {
      reset();
      const status = async (jwt = token) => {
        const response = await api.refundStatus(new Request("https://tuveloz.invalid/api/stripe/admin/refunds?adjustmentId=decision-synthetic", { headers: jwt ? { "cf-access-jwt-assertion": jwt } : {} }));
        assert.equal(response.headers.get("cache-control"), "no-store"); return response;
      };
      assert.equal((await status("")).status, 403); assert.equal((await status()).status, 409); assert.equal(posts.length, 0);
      await post(); assert.equal((await status()).status, 200); assert.equal(posts.length, 1);
      reset(); addIncident(); assert.equal((await post()).status, 409); assert.equal(posts.length, 0);
      reset(); state.beforeWrite = addIncident; assert.equal((await post()).status, 409); assert.equal(posts.length, 0);
    });
    const statusCall = async (jwt = token) => {
      const response = await api.refundStatus(new Request("https://tuveloz.invalid/api/stripe/admin/refunds?adjustmentId=decision-synthetic", { headers: jwt ? { "cf-access-jwt-assertion": jwt } : {} }));
      return { status: response.status, body: await response.json() };
    };
    const retryUnsent = () => post({ adjustmentId: "decision-synthetic", action: "retry_not_sent" });
    const stopBeforeSend = async () => {
      reset(); state.beforeWrite = () => database.exec("UPDATE stripe_payments SET dispute_status='needs_response',status='disputed'");
      assert.equal((await post()).status, 409); assert.equal(posts.length, 0);
      assert.equal(execution().status, "refund_not_sent_review");
    };
    await t.test("paused marketplace permits only signed read-only recovery of an existing refund", async () => {
      reset(); postMode = "lost"; await post(); state.open = false;
      assert.equal((await statusCall("")).status, 403);
      assert.equal((await statusCall()).body.refundSucceeded, true);
      assert.equal(posts.length, 1); assert.equal((await post()).status, 503);
      reset(); state.open = false; assert.equal((await statusCall()).status, 409);
      assert.equal(posts.length + getCount, 0); assert.equal(execution(), undefined);
      reset(); await post(); state.open = false; state.env.STRIPE_SECRET_KEY = "sk_live_synthetic_locked";
      assert.equal((await statusCall()).status, 503); assert.equal(posts.length, 1);
    });
    await t.test("confirmed unsent attempts need explicit retry and fresh eligibility; the same reservation sends once", async () => {
      await stopBeforeSend(); const original = execution();
      assert.equal((await retryUnsent()).status, 409); assert.equal(posts.length, 0);
      database.exec("UPDATE stripe_payments SET dispute_status='',status='paid_pending_completion'");
      assert.equal((await post()).body.refundSucceeded, false); assert.equal(posts.length, 0);
      assert.equal((await statusCall()).body.recovery, "not_sent"); assert.equal(posts.length, 0);
      const resumed = await retryUnsent(); assert.equal(resumed.status, 200, JSON.stringify(resumed.body));
      assert.equal(resumed.body.refundSucceeded, true); assert.equal(posts.length, 1);
      assert.equal(execution().id, original.id); assert.equal(execution().idempotency_key, original.idempotency_key);
      assert.equal((await retryUnsent()).body.refundSucceeded, true); assert.equal(posts.length, 1);
    });
    await t.test("unknown submissions cannot be retried as unsent, even when Stripe lists no refund", async () => {
      reset(); postMode = "reject"; await post();
      const checked = await statusCall(); assert.equal(checked.body.recovery, "not_found");
      assert.equal(checked.body.refundSucceeded, false); assert.equal(posts.length, 1);
      assert.equal((await retryUnsent()).body.refundSucceeded, false); assert.equal(posts.length, 1);
      database.exec("UPDATE payment_adjustments SET status='refund_succeeded' WHERE adjustment_type='stripe_full_refund'");
      assert.equal((await statusCall()).status, 409, "a success label without a Stripe reference is not proof");
      reset(); assert.equal((await retryUnsent()).status, 409); assert.equal(posts.length + getCount, 0);
    });
    await t.test("unsent retries retain work, incident, transfer, prior refund, identity and snapshot safeguards", async () => {
      for (const change of [
        () => addIncident(),
        () => database.exec("UPDATE job_cancellations SET work_performed_cents=100"),
        () => database.exec("UPDATE provider_applications SET is_test_provider='yes'"),
        () => database.exec("UPDATE stripe_payments SET customer_email='changed@example.invalid'"),
        () => transfers.push({ id: "tr_prior" }),
        () => remote.push({ id: "re_prior", amount: 10500, status: "pending" }),
      ]) {
        await stopBeforeSend(); database.exec("UPDATE stripe_payments SET dispute_status='',status='paid_pending_completion'");
        change(); assert.equal((await retryUnsent()).status, 409); assert.equal(posts.length, 0);
        assert.equal(execution().status, "refund_not_sent_review");
      }
    });
    await t.test("concurrent unsent retries cannot reserve a second execution or override a changed reservation", async () => {
      await stopBeforeSend(); database.exec("UPDATE stripe_payments SET dispute_status='',status='paid_pending_completion'");
      const replies = await Promise.all([retryUnsent(), retryUnsent()]);
      assert.ok(replies.some(reply => reply.body.refundSucceeded)); assert.equal(posts.length, 1);
      assert.equal(database.prepare("SELECT count(*) n FROM payment_adjustments WHERE adjustment_type='stripe_full_refund'").get().n, 1);
      await stopBeforeSend(); database.exec("UPDATE stripe_payments SET dispute_status='',status='paid_pending_completion'");
      state.beforeExecutionWrite = () => database.exec("UPDATE payment_adjustments SET updated_at='2099-01-01' WHERE adjustment_type='stripe_full_refund'");
      assert.equal((await retryUnsent()).status, 409); assert.equal(posts.length, 0);
      await stopBeforeSend(); state.open = false; assert.equal((await retryUnsent()).status, 503); assert.equal(posts.length, 0);
    });
    await t.test("owner signatures, origin, exact input and the closed release gate fail before Stripe or writes", async () => {
      reset();
      for (const jwt of ["", "forged", await sign({ email: "stranger@example.invalid" })]) assert.equal((await post(undefined, jwt)).status, 403);
      assert.equal((await post(undefined, token, "https://other.invalid")).status, 403);
      for (const body of ["{", "null", "[]", {}, { adjustmentId: 1 }, { adjustmentId: "decision-synthetic", amount: 10500 },
        { adjustmentId: "decision-synthetic", action: null }, { adjustmentId: "decision-synthetic", action: "resend" }]) assert.equal((await post(body)).status, 400);
      state.open = false; assert.equal((await post()).status, 503); assert.equal(await api.actualLaunchGate("payout", { testOnly: false }), false);
      assert.equal(posts.length + getCount, 0); assert.equal(execution(), undefined);
    });
    await t.test("full payment is sent once and saved separately from the provider's accounting portion", async () => {
      reset(); const response = await post(); assert.equal(response.status, 200, JSON.stringify(response.body));
      assert.equal(response.body.refundSucceeded, true); assert.equal(posts.length, 1);
      assert.equal(posts[0].params.amount, "10500"); assert.equal(posts[0].params.charge, "ch_synthetic");
      assert.equal(posts[0].key, "tuveloz-full-refund-payment-synthetic");
      assert.equal(posts[0].params.reverse_transfer, undefined); assert.equal(posts[0].params.refund_application_fee, undefined);
      const saved = execution(), details = JSON.parse(saved.details);
      assert.equal(details.providerRefundCents, 10000); assert.equal(details.customerFeeRefundCents, 500);
      assert.equal(saved.provider_impact_cents, 0, "execution must not double-book the original accounting decision");
      assert.equal(row().status, "refund_status_review", "payment aggregate waits for Stripe reconciliation");
      await api.recordRefundStatus(api.getStripeClient(), { id: "re_synthetic" }, "evt_synthetic_refund", 1800000000);
      assert.equal(row().status, "refunded"); assert.equal(row().refund_amount_cents, 10500);
      assert.equal((await post()).body.refundSucceeded, true); assert.equal(posts.length, 1);
      assert.equal(database.prepare("SELECT count(*) n FROM email_notification_outbox").get().n, 0);
    });
    await t.test("pending, action-needed and failed outcomes never claim a successful refund", async () => {
      for (const status of ["pending", "requires_action", "failed", "canceled", "unknown"]) {
        reset(); nextStatus = status; const result = await post(); assert.equal(result.status, 202); assert.equal(result.body.refundSucceeded, false);
        assert.equal(row().status, "refund_status_review"); assert.equal(posts.length, 1);
        remote[0].status = "succeeded";
        assert.equal((await post()).body.refundSucceeded, true); assert.equal(posts.length, 1);
      }
    });
    await t.test("lost responses and late retries recover by metadata without a second mutation", async () => {
      reset(); postMode = "lost";
      const uncertain = await post(); assert.equal(uncertain.status, 202); assert.equal(uncertain.body.refundSucceeded, false);
      assert.equal(execution().status, "refund_submission_unconfirmed"); assert.equal(posts.length, 1);
      database.exec("UPDATE payment_adjustments SET created_at='2020-01-01' WHERE adjustment_type='stripe_full_refund'");
      assert.equal((await post()).body.refundSucceeded, true); assert.equal(posts.length, 1);
      reset(); postMode = "reject"; assert.equal((await post()).status, 202);
      assert.equal((await post()).body.refundSucceeded, false); assert.equal(posts.length, 1);
    });
    await t.test("a simultaneous second click cannot reserve or submit a second refund", async () => {
      reset(); let second;
      beforePost = async () => { beforePost = null; second = await post(); };
      assert.equal((await post()).status, 200); assert.equal(second.status, 202); assert.equal(second.body.refundSucceeded, false);
      assert.equal(posts.length, 1); assert.equal(database.prepare("SELECT count(*) n FROM payment_adjustments WHERE adjustment_type='stripe_full_refund'").get().n, 1);
    });
    await t.test("simulation, unpaid, partial, stale and post-work cases cannot initiate a Stripe refund", async () => {
      for (const change of [
        "UPDATE payment_adjustments SET status='approved_test_only'", "UPDATE payment_adjustments SET details='{}'",
        "UPDATE payment_adjustments SET provider_impact_cents=-10500", "UPDATE payment_adjustments SET amount_cents=10000",
        "UPDATE stripe_payments SET paid_at=''", "UPDATE stripe_payments SET customer_total_cents=11000",
        "UPDATE stripe_payments SET connected_account_id='acct_changed'", "UPDATE stripe_payments SET customer_email='different@example.invalid'",
        "UPDATE stripe_payments SET transfer_id='tr_already_sent'", "UPDATE stripe_payments SET refund_amount_cents=1",
        "UPDATE stripe_payments SET dispute_status='needs_response'", "UPDATE stripe_payments SET status='payment_failed'",
        "UPDATE customer_requests SET is_test_job='yes'", "UPDATE provider_applications SET is_test_provider='yes'",
        "UPDATE job_cancellations SET status='approved_test_only'", "UPDATE job_cancellations SET work_performed_cents=100",
        "UPDATE job_cancellations SET cancellation_type='customer_no_show'", "UPDATE job_cancellations SET retained_amount_cents=1",
        "INSERT INTO provider_job_records (id,request_id,provider_email,job_start_decision_id) VALUES ('started','job-synthetic','provider@example.invalid','start-decision')",
      ]) { reset(); database.exec(change); const response = await post(); assert.equal(response.status, 409, `${change}: ${JSON.stringify(response.body)}`); assert.equal(posts.length, 0); assert.equal(execution(), undefined); }
    });
    await t.test("current Stripe amount, identity, mode, refunds and transfers must match", async () => {
      for (const change of [i => i.amount_received--, i => i.metadata.tuveloz_payment_record_id = "other", i => i.latest_charge.amount_refunded = 1,
        i => i.latest_charge.transfer = "tr_previous", i => i.latest_charge.disputed = true, i => i.currency = "eur", i => i.livemode = true,
        i => i.latest_charge.id = "ch_other", i => i.latest_charge.captured = false, i => i.latest_charge.amount_captured--]) {
        reset(); intentChange = change; assert.equal((await post()).status, 409); assert.equal(posts.length, 0); assert.equal(execution(), undefined);
      }
      reset(); remote.push({ id: "re_other", amount: 1, status: "pending" }); assert.equal((await post()).status, 409); assert.equal(posts.length, 0);
      reset(); transfers.push({ id: "tr_lost_local_write" }); assert.equal((await post()).status, 409); assert.equal(posts.length, 0);
      reset(); postMode = "mismatch"; assert.equal((await post()).body.refundSucceeded, false); assert.equal(execution().stripe_refund_id, "");
    });
    await t.test("payment and job changes during verification stop the money mutation", async () => {
      for (const change of ["UPDATE stripe_payments SET dispute_status='needs_response',status='disputed'", "UPDATE stripe_payments SET transfer_id='tr_concurrent'",
        "UPDATE stripe_payments SET connected_account_id='acct_concurrent'", "UPDATE stripe_payments SET customer_email='changed@example.invalid'",
        "UPDATE payment_adjustments SET status='denied' WHERE id='decision-synthetic'", "UPDATE customer_requests SET status='completed'",
        "UPDATE job_cancellations SET work_performed_cents=100", "UPDATE provider_applications SET is_test_provider='yes'"]) {
        reset(); state.beforeWrite = () => database.exec(change); assert.equal((await post()).status, 409); assert.equal(posts.length, 0);
        assert.equal(execution().status, "refund_not_sent_review");
      }
    });
    await t.test("a different approval for the same payment cannot duplicate its refund", async () => {
      reset(); await post();
      database.exec("UPDATE payment_adjustments SET id='different-decision',idempotency_key='different-key' WHERE id='decision-synthetic'");
      assert.equal((await post({ adjustmentId: "different-decision" })).status, 409); assert.equal(posts.length, 1);
    });
    await t.test("both approved cancellation roles use the same full-total rule before work", async () => {
      for (const reason of ["customer_cancel", "provider_cancel"]) {
        reset(); database.prepare("UPDATE job_cancellations SET cancellation_type=?").run(reason);
        database.prepare("UPDATE payment_adjustments SET reason_code=?").run(reason);
        assert.equal((await post()).status, 200); assert.equal(posts[0].params.amount, "10500");
      }
    });
    await t.test("concurrent reconciliation cannot overwrite a newer saved result", async () => {
      reset(); nextStatus = "pending"; await post(); remote[0].status = "succeeded";
      state.beforeExecutionWrite = () => database.exec("UPDATE payment_adjustments SET status='refund_failed',updated_at='2099-01-01T00:00:00.000Z' WHERE adjustment_type='stripe_full_refund'");
      const result = await post(); assert.equal(result.body.refundSucceeded, false); assert.equal(result.body.status, "refund_failed");
      assert.equal(execution().status, "refund_failed"); assert.equal(posts.length, 1);
    });
  } finally {
    globalThis.fetch = originalFetch; database.close(); delete globalThis.__fullRefund;
    assert.equal(dirname(resolve(scratch)), tempRoot); rmSync(scratch, { recursive: true, force: true });
  }
});
