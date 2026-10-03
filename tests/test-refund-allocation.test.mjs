import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { build } from "esbuild";
import { drizzle } from "drizzle-orm/sqlite-proxy";

// Actual route, assignment checks, migrated SQL and audit writes. Authentication
// identities and Cloudflare bindings are fixtures; every network call fails.
test("test refunds include the saved fee without assigning it to the provider", async t => {
  const repo = resolve(import.meta.dirname, "..");
  const tempRoot = resolve(tmpdir());
  const scratch = mkdtempSync(join(tempRoot, "tuveloz-test-refund-"));
  const database = new DatabaseSync(":memory:");
  const originalFetch = globalThis.fetch;
  const state = { db: null, role: "customer", email: "customer@example.invalid", env: {}, beforeWrite: null, failWrite: "" };
  globalThis.__testRefundReview = state;
  let networkCalls = 0;
  const seed = (table, values) => {
    const columns = Object.keys(values);
    database.prepare(`INSERT INTO ${table} (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})`)
      .run(...Object.values(values));
  };
  const now = new Date().toISOString();
  const seedJob = (id, extra = {}) => {
    seed("customer_requests", { id, name: "SYNTHETIC CUSTOMER", email: "customer@example.invalid", zip: "20910",
      vehicle: "Synthetic vehicle", service: "provisional_12v_jump_start", details: "Local refund rehearsal",
      status: "assigned", is_test_job: "yes", service_codes: '["provisional_12v_jump_start"]',
      jurisdiction: "US-MD-MontgomeryCounty", parts_source: "No parts needed — labor only", parts_preference: "No preference",
      labor_only_parts_acknowledged_at: now });
    seed("provider_quotes", { id: `${id}-quote`, request_id: id, provider_name: "SYNTHETIC PROVIDER",
      provider_email: "provider@example.invalid", price_cents: "10000", labor_price_cents: "10000", parts_price_cents: "0",
      part_type: "No parts needed", availability: "today", message: "Synthetic quote", status: "accepted", labor_only_parts_confirmed_at: now,
      customer_fee_rate_bps: 500, customer_fee_cents: "500", customer_total_cents: "10500", scope_version: 1, ...extra });
  };
  const adjustment = id => database.prepare("SELECT * FROM payment_adjustments WHERE id=?").get(id);
  try {
    globalThis.fetch = async () => { networkCalls++; throw Error("Network forbidden in refund rehearsal"); };
    for (const entry of JSON.parse(readFileSync(join(repo, "drizzle/meta/_journal.json"), "utf8")).entries) {
      for (const sql of readFileSync(join(repo, "drizzle", entry.tag + ".sql"), "utf8").split("--> statement-breakpoint")) {
        if (sql.trim()) database.exec(sql);
      }
    }
    const querySql = (query, params, method) => {
      assert.ok(params.length <= 100, "D1 bind limit");
      if (/^(insert|update)/i.test(query) && state.beforeWrite) {
        const change = state.beforeWrite; state.beforeWrite = null; change();
      }
      if (state.failWrite && query.startsWith(state.failWrite)) throw Error("Synthetic write failure");
      if (method === "run") { database.prepare(query).run(...params); return { rows: [] }; }
      database.exec("PRAGMA short_column_names=OFF; PRAGMA full_column_names=ON;");
      try {
        const statement = database.prepare(query);
        return { rows: method === "get" ? Object.values(statement.get(...params) ?? {})
          : statement.all(...params).map(row => Object.values(row)) };
      } finally { database.exec("PRAGMA short_column_names=ON; PRAGMA full_column_names=OFF;"); }
    };
    state.db = drizzle(querySql, async queries => {
      await state.batchBarrier?.();
      // Inject competing committed work before this batch's transaction.
      if (state.beforeWrite) { const change = state.beforeWrite; state.beforeWrite = null; change(); }
      database.exec("BEGIN");
      try {
        const result = queries.map(query => querySql(query.sql, query.params, query.method));
        database.exec("COMMIT");
        if (state.loseBatchResponse) { state.loseBatchResponse = false; throw Error("Synthetic lost committed response"); }
        return result;
      } catch (error) { if (database.isTransaction) database.exec("ROLLBACK"); throw error; }
    });
    const bundle = join(scratch, "route.cjs");
    await build({ absWorkingDir: repo, entryPoints: ["app/api/job-operations/route.ts"], bundle: true,
      platform: "node", format: "cjs", outfile: bundle, target: "node22", logLevel: "silent",
      plugins: [{ name: "refund-local-bindings", setup(builder) {
        builder.onResolve({ filter: /^cloudflare:workers$/ }, () => ({ path: "env", namespace: "fixture" }));
        builder.onResolve({ filter: /(?:^|\/)db$/ }, args => args.path.startsWith(".") ? { path: "db", namespace: "fixture" } : null);
        builder.onResolve({ filter: /lib\/(account-auth|owner-auth)$/ }, args =>
          args.importer.replaceAll("\\", "/").endsWith("app/api/job-operations/route.ts")
            ? { path: args.path.endsWith("/owner-auth") ? "owner" : "account", namespace: "fixture" } : null);
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({ loader: "js", contents: {
          env: "export const env = globalThis.__testRefundReview.env;",
          db: "export function getDb() { return globalThis.__testRefundReview.db; }",
          owner: "export async function verifyOwnerRequest() { const s=globalThis.__testRefundReview; return {ok:s.role==='owner',email:s.email}; }",
          account: "export async function getAccountSession() { const s=globalThis.__testRefundReview; return s.role ? {role:s.role,email:s.email,id:'synthetic-session'} : null; } export function isSameOriginRequest(r) {return r.headers.get('origin')===new URL(r.url).origin;}",
        }[args.path] }));
      } }],
    });
    const api = createRequire(import.meta.url)(bundle);
    seed("provider_applications", { id: "synthetic-provider", name: "SYNTHETIC PROVIDER", email: "provider@example.invalid",
      service: "provisional_12v_jump_start", service_area: "Montgomery County, Maryland", experience: "Synthetic only",
      insurance_status: "unverified", is_test_provider: "yes", status: "approved", verification_status: "verified" });
    const post = async (requestId, body, role = "customer", email = `${role}@example.invalid`) => {
      state.role = role; state.email = email;
      const response = await api.POST(new Request("https://tuveloz.invalid/api/job-operations", {
        method: "POST", headers: { origin: "https://tuveloz.invalid", "content-type": "application/json" },
        body: JSON.stringify({ requestId, ...body }),
      }));
      assert.equal(response.headers.get("cache-control"), "no-store");
      return { status: response.status, body: await response.json() };
    };
    const request = (id, amountCents = 10500) => post(id, {
      action: "request-refund", amountCents, reasonCode: "provider_no_show", explanation: "SYNTHETIC: provider did not arrive.",
    });
    const decide = (id, adjustmentId, extra = {}) => post(id, {
      action: "decide-refund", adjustmentId, decision: "approve", decisionReason: "SYNTHETIC: full cancellation refund reviewed.", ...extra,
    }, "owner");
    await t.test("full $105 request and approval return $100 provider plus $5 fee, without money movement", async () => {
      seedJob("full"); const result = await request("full"); assert.equal(result.status, 201, JSON.stringify(result.body));
      const requested = adjustment(result.body.adjustmentId);
      assert.equal(JSON.parse(requested.details).priceSnapshot.customerTotalCents, 10500);
      assert.equal((await request("full")).body.adjustmentId, requested.id);
      const approved = await decide("full", requested.id, { customerFeeRefundCents: null }); assert.equal(approved.status, 200);
      assert.equal(approved.body.stripeRefundCreated, false);
      const saved = adjustment(requested.id), details = JSON.parse(saved.details);
      assert.equal(saved.status, "approved_test_only"); assert.equal(saved.provider_impact_cents, -10000);
      assert.equal(saved.customer_impact_cents, 10500); assert.equal(details.allocation.customerFeeRefundCents, 500);
      assert.equal(details.allocation.platformImpactCents, -500); assert.equal(saved.stripe_refund_id, "");
      const listed = await api.GET(new Request("https://tuveloz.invalid/api/job-operations?requestId=full"));
      const list = await listed.json();
      assert.equal(list.paymentAdjustments[0].refundAllocation.customerFeeRefundCents, 500);
      assert.equal((await decide("full", requested.id)).status, 409);
      assert.deepEqual(adjustment(requested.id), saved);
    });
    await t.test("full cancellation includes the fee and cannot retain a second amount", async () => {
      seedJob("cancel");
      seed("job_cancellations", { id: "cancel-review", request_id: "cancel", quote_id: "cancel-quote", requested_by_role: "customer",
        requested_by_email: "customer@example.invalid", cancellation_type: "provider_no_show", reason: "SYNTHETIC: absent provider" });
      const payload = { action: "decide-cancellation", cancellationId: "cancel-review", decision: "approve",
        proposedRefundCents: 10500, retainedAmountCents: 1, decisionReason: "SYNTHETIC: full refund approved." };
      assert.equal((await post("cancel", payload, "owner")).status, 400);
      payload.retainedAmountCents = 0;
      const result = await post("cancel", payload, "owner"); assert.equal(result.status, 200, JSON.stringify(result.body));
      const saved = database.prepare("SELECT * FROM payment_adjustments WHERE request_id='cancel'").get();
      assert.equal(saved.provider_impact_cents, -10000); assert.equal(saved.customer_impact_cents, 10500);
      assert.equal(JSON.parse(saved.details).allocation.customerFeeRefundCents, 500);
      assert.equal(result.body.stripeRefundCreated, false); assert.equal((await post("cancel", payload, "owner")).status, 409);
    });
    const cancellationPayload = id => ({ action: "decide-cancellation", cancellationId: `${id}-review`, decision: "approve",
      proposedRefundCents: 10500, retainedAmountCents: 0, decisionReason: "SYNTHETIC: full refund approved." });
    const seedCancellation = id => {
      seedJob(id);
      seed("job_cancellations", { id: `${id}-review`, request_id: id, quote_id: `${id}-quote`, requested_by_role: "customer",
        requested_by_email: "customer@example.invalid", cancellation_type: "provider_no_show", reason: "SYNTHETIC: absent provider" });
    };
    const cancellationState = id => ({
      decision: database.prepare("SELECT * FROM job_cancellations WHERE request_id=?").get(id),
      job: database.prepare("SELECT status FROM customer_requests WHERE id=?").get(id),
      adjustments: database.prepare("SELECT * FROM payment_adjustments WHERE request_id=?").all(id),
      events: database.prepare("SELECT * FROM job_lifecycle_events WHERE request_id=?").all(id),
    });
    await t.test("a competing cancellation decision cannot be overwritten or create an orphan refund", async () => {
      seedCancellation("race");
      let winner;
      state.beforeWrite = () => {
        database.exec("UPDATE job_cancellations SET status='denied',decision_reason='SYNTHETIC: existing decision',decision_by='owner@example.invalid' WHERE id='race-review'");
        winner = cancellationState("race");
      };
      assert.equal((await post("race", cancellationPayload("race"), "owner")).status, 409);
      assert.deepEqual(cancellationState("race"), winner);
    });
    await t.test("failed cancellation writes roll back decision, refund, job and audit together", async () => {
      for (const [index, target] of ['update "job_cancellations"', 'insert into "payment_adjustments"', 'update "customer_requests"', 'insert into "job_lifecycle_events"'].entries()) {
        const id = `rollback-${index}`; seedCancellation(id);
        const before = cancellationState(id); state.failWrite = target;
        try {
          const outcome = await post(id, cancellationPayload(id), "owner").catch(() => ({ status: 503 }));
          assert.ok(outcome.status >= 500);
          assert.deepEqual(cancellationState(id), before);
        } finally { state.failWrite = ""; }
      }
    });
    await t.test("a lost committed response can be read back without repeating the decision", async () => {
      seedCancellation("lost"); state.loseBatchResponse = true;
      assert.equal((await post("lost", cancellationPayload("lost"), "owner")).status, 503);
      const saved = cancellationState("lost");
      assert.equal(saved.decision.status, "approved_test_only");
      assert.equal(saved.adjustments.length, 1); assert.equal(saved.events.length, 1);
      assert.equal(saved.decision.payment_adjustment_id, saved.adjustments[0].id);
      const loaded = await api.GET(new Request("https://tuveloz.invalid/api/job-operations?requestId=lost"));
      assert.equal(loaded.status, 200);
      assert.equal((await loaded.json()).cancellations[0].status, "approved_test_only");
      assert.equal((await post("lost", cancellationPayload("lost"), "owner")).status, 409);
      assert.deepEqual(cancellationState("lost"), saved);
    });
    await t.test("simultaneous approval and denial commit exactly one complete decision", async () => {
      seedCancellation("concurrent"); let release; let arrivals = 0;
      const barrier = new Promise(done => { release = done; });
      state.batchBarrier = () => { if (++arrivals === 2) release(); return barrier; };
      try {
        const replies = await Promise.all([
          post("concurrent", cancellationPayload("concurrent"), "owner"),
          post("concurrent", { ...cancellationPayload("concurrent"), decision: "deny" }, "owner"),
        ]);
        assert.deepEqual(replies.map(item => item.status).sort(), [200, 409]);
        const saved = cancellationState("concurrent"), approved = saved.decision.status === "approved_test_only";
        assert.equal(saved.events.length, 1); assert.equal(saved.adjustments.length, approved ? 1 : 0);
        assert.equal(saved.job.status, approved ? "cancelled" : "assigned");
        assert.equal(saved.events[0].event_type, approved ? "test_cancellation_approved" : "cancellation_denied");
      } finally { state.batchBarrier = null; }
    });
    await t.test("denial and a zero-refund cancellation save one audit without a refund record", async () => {
      for (const decision of ["approve", "deny"]) {
        const id = `zero-${decision}`; seedCancellation(id);
        const result = await post(id, { ...cancellationPayload(id), decision, proposedRefundCents: 0, retainedAmountCents: 0 }, "owner");
        assert.equal(result.status, 200, JSON.stringify(result.body)); assert.equal(result.body.stripeRefundCreated, false);
        const saved = cancellationState(id);
        assert.equal(saved.adjustments.length, 0); assert.equal(saved.events.length, 1);
        assert.equal(saved.decision.payment_adjustment_id, "");
        assert.equal(saved.job.status, decision === "approve" ? "cancelled" : "assigned");
      }
    });
    await t.test("changed price, assignment and test flags stop the entire cancellation batch", async () => {
      const changes = [
        id => database.prepare("UPDATE provider_quotes SET customer_total_cents='20000' WHERE request_id=?").run(id),
        id => database.prepare("UPDATE provider_quotes SET status='declined' WHERE request_id=?").run(id),
        id => database.prepare("UPDATE customer_requests SET assignment_version=assignment_version+1 WHERE id=?").run(id),
        id => database.prepare("UPDATE customer_requests SET is_test_job='no' WHERE id=?").run(id),
        () => database.exec("UPDATE provider_applications SET is_test_provider='no' WHERE id='synthetic-provider'"),
        id => seed("stripe_payments", { id: `${id}-payment`, request_id: id, quote_id: `${id}-quote`, checkout_session_id: `${id}-checkout`,
          payment_type: "quote", status: "created", product_name: "SYNTHETIC", provider_application_id: "synthetic-provider",
          connected_account_id: "acct_synthetic", provider_amount_cents: 10000, application_fee_cents: 500,
          customer_total_cents: 10500, settlement_strategy: "separate_transfer" }),
        id => seed("job_lifecycle_events", { id: `${id}-other-event`, request_id: id, actor_role: "owner", actor_id: "owner@example.invalid", event_type: "synthetic_concurrent_event", event_hash: `${id}-hash`, occurred_at: "2099-01-01T00:00:00Z" }),
      ];
      for (const [index, change] of changes.entries()) {
        const id = `stale-cancel-${index}`; seedCancellation(id); let afterChange;
        state.beforeWrite = () => { change(id); afterChange = cancellationState(id); };
        try {
          assert.equal((await post(id, cancellationPayload(id), "owner")).status, 409, id);
          assert.deepEqual(cancellationState(id), afterChange);
        } finally {
          database.exec("UPDATE provider_applications SET is_test_provider='yes' WHERE id='synthetic-provider'");
          database.prepare("DELETE FROM stripe_payments WHERE id=?").run(`${id}-payment`);
        }
      }
    });
    await t.test("partial allocation is explicit and cannot overdraw either portion", async () => {
      seedJob("partial"); const result = await request("partial", 5250); assert.equal(result.status, 201);
      const id = result.body.adjustmentId;
      for (const value of [undefined, "", " ", null, true, -1, 501, 0.5]) {
        assert.equal((await decide("partial", id, { customerFeeRefundCents: value })).status, 400);
        assert.equal(adjustment(id).status, "requested");
      }
      assert.equal((await decide("partial", id, { customerFeeRefundCents: 250 })).status, 200);
      assert.equal(adjustment(id).provider_impact_cents, -5000);
      assert.equal(JSON.parse(adjustment(id).details).allocation.customerFeeRefundCents, 250);
      seedJob("fee-only"); const feeOnly = await request("fee-only", 500);
      assert.equal((await decide("fee-only", feeOnly.body.adjustmentId, { customerFeeRefundCents: 500 })).status, 200);
      assert.equal(adjustment(feeOnly.body.adjustmentId).provider_impact_cents, 0);
    });
    await t.test("bounds, full-fee tampering and stale saved prices fail closed", async () => {
      seedJob("bounds");
      for (const amount of [0, -1, 10501, 10500.5]) assert.equal((await request("bounds", amount)).status, 400);
      const result = await request("bounds"); assert.equal(result.status, 201);
      assert.equal((await decide("bounds", result.body.adjustmentId, { customerFeeRefundCents: 0 })).status, 400);
      database.prepare("UPDATE provider_quotes SET customer_total_cents='10600' WHERE id='bounds-quote'").run();
      assert.equal((await decide("bounds", result.body.adjustmentId)).status, 409);
      assert.equal(adjustment(result.body.adjustmentId).status, "requested");
      seedJob("missing-price", { customer_fee_cents: "", customer_total_cents: "" });
      assert.equal((await request("missing-price", 10000)).status, 409);
    });
    await t.test("a legacy request can be denied but cannot be approved without its price snapshot", async () => {
      seedJob("legacy"); seed("payment_adjustments", { id: "legacy-refund", request_id: "legacy", quote_id: "legacy-quote",
        adjustment_type: "refund_request", amount_cents: 10000, status: "requested", reason_code: "cancellation",
        requested_by_role: "customer", requested_by_id: "customer@example.invalid", idempotency_key: "synthetic-legacy" });
      assert.equal((await decide("legacy", "legacy-refund")).status, 409);
      assert.equal((await decide("legacy", "legacy-refund", { decision: "deny" })).status, 200);
      assert.equal(adjustment("legacy-refund").provider_impact_cents, 0);
    });
    await t.test("authorized changes use their exact saved price and cannot fall back to the original quote", async () => {
      seedJob("changed", { scope_version: 2 });
      const price = { laborAmountCents: 20000, partsAmountCents: 0, taxAmountCents: 0, otherAmountCents: 0,
        totalAmountCents: 20000, customerFeeRateBps: 500, customerFeeCents: 1000, customerTotalCents: 21000 };
      seed("job_change_orders", { id: "changed-order", request_id: "changed", quote_id: "changed-quote", prior_scope_version: 1,
        proposed_scope_version: 2, price_breakdown: JSON.stringify(price), status: "authorized", reason: "Synthetic scope change",
        requested_by_provider_id: "synthetic-provider", customer_authorized_at: now });
      const result = await request("changed", 21000); assert.equal(result.status, 201);
      assert.equal((await decide("changed", result.body.adjustmentId)).status, 200);
      assert.equal(adjustment(result.body.adjustmentId).provider_impact_cents, -20000);
      assert.equal(JSON.parse(adjustment(result.body.adjustmentId).details).allocation.customerFeeRefundCents, 1000);
      database.prepare("UPDATE job_change_orders SET price_breakdown='{}' WHERE id='changed-order'").run();
      assert.equal((await request("changed", 10500)).status, 409);
      seedJob("missing-change", { scope_version: 2 }); assert.equal((await request("missing-change")).status, 409);
    });
    await t.test("rounding and the maximum provider subtotal preserve the full customer amount", async () => {
      for (const [id, provider, fee] of [["rounding", 11, 1], ["maximum", 10000000, 500000]]) {
        seedJob(id, { price_cents: String(provider), labor_price_cents: String(provider),
          customer_fee_cents: String(fee), customer_total_cents: String(provider + fee) });
        const result = await request(id, provider + fee); assert.equal(result.status, 201);
        assert.equal((await decide(id, result.body.adjustmentId)).status, 200);
        assert.equal(adjustment(result.body.adjustmentId).provider_impact_cents, -provider);
        assert.equal(JSON.parse(adjustment(result.body.adjustmentId).details).allocation.customerFeeRefundCents, fee);
      }
    });
    await t.test("persisted test flags and assignment access still govern every operation", async () => {
      seedJob("guards");
      assert.equal((await post("guards", { action: "request-refund" }, "customer", "stranger@example.invalid")).status, 403);
      assert.equal((await post("guards", { action: "decide-cancellation" }, "customer")).status, 403);
      database.prepare("UPDATE customer_requests SET is_test_job='no' WHERE id='guards'").run();
      assert.equal((await request("guards")).status, 503);
      assert.equal(database.prepare("SELECT count(*) n FROM stripe_payments").get().n, 0);
      assert.equal(networkCalls, 0);
    });
  } finally {
    globalThis.fetch = originalFetch; database.close(); delete globalThis.__testRefundReview;
    assert.equal(dirname(resolve(scratch)), tempRoot);
    assert.ok(scratch.startsWith(join(tempRoot, "tuveloz-test-refund-")));
    rmSync(scratch, { recursive: true, force: true });
  }
});
