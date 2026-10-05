import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { build } from "esbuild";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { checkoutModule } from "./helpers/checkout-evidence.mjs";
const { validStripePayments } = checkoutModule("./lib/stripe-payment-response");

// Real route and migrated SQL; future eligibility and Stripe are isolated fixtures.
// The fake processor deliberately does not retain expired idempotency keys.
test("provider transfers recover without repeating uncertain money movement", async t => {
  const root = resolve(import.meta.dirname, ".."), temp = resolve(tmpdir());
  const scratch = mkdtempSync(join(temp, "tuveloz-transfer-recovery-"));
  const originalFetch = globalThis.fetch;
  let database, transfers = [], calls = [], loseReply = false, corruptReply = false;
  let beforeCreate, beforeIntent, beforeSave, beforeList, beforeBatch, batchBarrier, failBatch = false;
  let transferReads = 0;
  const context = { quoteId: "quote-synthetic", scopeVersion: 1, providerEmail: "provider@example.invalid" };
  const state = { db: null, open: true, owner: true, context, stripe: null };
  globalThis.__transferRecovery = state;
  const intent = () => ({ id: "pi_synthetic", status: "succeeded", amount: 10500, amount_received: 10500,
    currency: "usd", livemode: false, transfer_group: "tuveloz_payment-synthetic", transfer_data: null,
    metadata: { tuveloz_payment_record_id: "payment-synthetic" }, latest_charge: {
      id: "ch_synthetic", payment_intent: "pi_synthetic", paid: true, captured: true, status: "succeeded",
      amount: 10500, amount_captured: 10500, currency: "usd", livemode: false,
      refunded: false, amount_refunded: 0, disputed: false, transfer: null, transfer_data: null,
    } });
  state.stripe = {
    paymentIntents: { retrieve: async () => { beforeIntent?.(); return intent(); } },
    transfers: {
      list: async args => { assert.equal(args.transfer_group, "tuveloz_payment-synthetic"); await beforeList?.(); return { data: transfers, has_more: false }; },
      retrieve: async id => { transferReads++; const match = transfers.find(item => item.id === id); assert.ok(match); return match; },
      create: async (params, options) => {
        calls.push({ params, options }); await beforeCreate?.();
        const transfer = { id: `tr_synthetic_${calls.length}`, object: "transfer", ...params,
          created: 1800000000, livemode: false, reversed: false, amount_reversed: 0 };
        transfers.push(transfer);
        if (loseReply) throw Error("SYNTHETIC lost reply after transfer");
        return corruptReply ? { ...transfer, destination: "acct_wrong" } : transfer;
      },
    },
  };
  const seed = (table, values) => {
    const fields = database.prepare(`PRAGMA table_info(${table})`).all();
    const required = Object.fromEntries(fields.filter(col => col.notnull && col.dflt_value === null && !(col.name in values))
      .map(col => [col.name, col.type === "INTEGER" ? 0 : ""]));
    const row = { ...required, ...values }, keys = Object.keys(row);
    database.prepare(`INSERT INTO ${table} (${keys.join(",")}) VALUES (${keys.map(() => "?").join(",")})`).run(...Object.values(row));
  };
  const reset = (invoiceOverrides = {}) => {
    database?.close(); database = new DatabaseSync(":memory:");
    for (const entry of JSON.parse(readFileSync(join(root, "drizzle/meta/_journal.json"), "utf8")).entries) {
      for (const sql of readFileSync(join(root, "drizzle", `${entry.tag}.sql`), "utf8").split("--> statement-breakpoint")) if (sql.trim()) database.exec(sql);
    }
    const querySql = (sql, params, method) => {
      assert.ok(params.length <= 100, "D1 parameter limit");
      if (beforeSave && sql.startsWith('update "stripe_payments"')) { const hook = beforeSave; beforeSave = null; hook(); }
      if (method === "run") { database.prepare(sql).run(...params); return { rows: [] }; }
      database.exec("PRAGMA short_column_names=OFF; PRAGMA full_column_names=ON;");
      try { const statement = database.prepare(sql); return { rows: method === "get" ? Object.values(statement.get(...params) ?? {}) : statement.all(...params).map(row => Object.values(row)) }; }
      finally { database.exec("PRAGMA short_column_names=ON; PRAGMA full_column_names=OFF;"); }
    };
    state.db = drizzle(querySql, async queries => {
      await batchBarrier?.();
      const hook = beforeBatch; beforeBatch = null; hook?.();
      database.exec("BEGIN");
      try {
        const result = queries.map((query, index) => {
          if (failBatch && index === 1) throw Error("SYNTHETIC reversal receipt storage failure");
          return querySql(query.sql, query.params, query.method);
        });
        database.exec("COMMIT"); return result;
      } catch (error) { database.exec("ROLLBACK"); throw error; }
    });
    state.open = true; state.owner = true; transfers = []; calls = []; loseReply = false; corruptReply = false;
    beforeCreate = beforeIntent = beforeSave = beforeList = beforeBatch = batchBarrier = null;
    failBatch = false; transferReads = 0;
    seed("customer_requests", { id: "job-synthetic", status: "completed", is_test_job: "no",
      parts_source: "No parts needed — labor only", parts_preference: "No preference", labor_only_parts_acknowledged_at: "2026-10-01T00:00:00Z" });
    seed("provider_applications", { id: "provider-synthetic", email: context.providerEmail, is_test_provider: "no", stripe_account_id: "acct_synthetic" });
    seed("provider_quotes", { id: context.quoteId, request_id: "job-synthetic", provider_name: "SYNTHETIC PROVIDER",
      provider_email: context.providerEmail, scope_version: 1, status: "accepted", price_cents: "10000", labor_price_cents: "10000",
      parts_price_cents: "0", part_type: "No parts needed", labor_only_parts_confirmed_at: "2026-10-01T00:00:00Z" });
    seed("repair_authorization_records", { id: "authorization-synthetic", request_id: "job-synthetic", quote_id: context.quoteId,
      provider_id: "provider-synthetic", provider_email: context.providerEmail, scope_version: 1, status: "signed",
      customer_signature_at: "2026-10-01T00:00:00Z", document_hash: "SYNTHETIC AUTHORIZATION ONLY" });
    seed("stripe_payments", { id: "payment-synthetic", payment_type: "quote", request_id: "job-synthetic", quote_id: context.quoteId,
      scope_version: 1, scope_authorization_decision_id: "scope-synthetic", authorized_price_snapshot: '{"laborAmountCents":10000}',
      provider_application_id: "provider-synthetic", connected_account_id: "acct_synthetic", currency: "usd", provider_amount_cents: 10000,
      application_fee_cents: 500, customer_total_cents: 10500, settlement_strategy: "separate_transfer", payment_intent_id: "pi_synthetic",
      charge_id: "ch_synthetic", transfer_group: "tuveloz_payment-synthetic", status: "paid_pending_completion", paid_at: "2026-10-01T00:00:00Z" });
    seed("job_scope_versions", { id: "scope-synthetic", request_id: "job-synthetic", quote_id: context.quoteId, version: 1,
      authorization_decision_id: "scope-synthetic", price_breakdown: '{"laborAmountCents":10000}' });
    seed("provider_job_records", { id: "work-synthetic", request_id: "job-synthetic", provider_email: context.providerEmail,
      work_status: "completed", job_start_decision_id: "start-synthetic", completion_decision_id: "completion-synthetic" });
    const invoiceFields = Object.fromEntries(`provider_business_name provider_business_address provider_business_phone county_registration_number
      customer_name customer_address vehicle_year vehicle_make_model vehicle_tag customer_instructions provider_diagnosis labor_billing_method
      labor_disclosure provider_representative_name provider_representative_title provider_signed_at warranty_work_statement warranty_terms
      manufacturer_notice responsibility_notice document_hash customer_signature_at customer_copy_delivered_at provider_copy_retained_at`
      .split(/\s+/).filter(Boolean).map(name => [name, "SYNTHETIC FIXTURE ONLY"]));
    const invoice = { ...invoiceFields, id: "invoice-synthetic", request_id: "job-synthetic", quote_id: context.quoteId,
      provider_id: "provider-synthetic", authorization_record_id: "authorization-synthetic", scope_version: 1, status: "draft",
      labor_amount_cents: 10000, total_amount_cents: 10000, mechanic_identifiers: '["SYNTHETIC"]', document_snapshot: '{"synthetic":true}', ...invoiceOverrides };
    if (invoice.quote_id !== context.quoteId || invoice.provider_id !== "provider-synthetic" || invoice.scope_version !== 1) {
      // A different saved invoice is final for its own authorization, not for this
      // paid context. Seed that history after the original work record; all real
      // finalization, invoice immutability and payment-release triggers stay on.
      database.exec("DELETE FROM repair_authorization_records WHERE id='authorization-synthetic'");
      seed("repair_authorization_records", { id: invoice.authorization_record_id, request_id: invoice.request_id,
        quote_id: invoice.quote_id, provider_id: invoice.provider_id, provider_email: context.providerEmail,
        scope_version: invoice.scope_version, status: "signed", customer_signature_at: "2026-10-01T00:00:00Z",
        document_hash: "SYNTHETIC OTHER AUTHORIZATION ONLY" });
    }
    seed("provider_invoices", invoice);
    seed("provider_invoice_items", { id: "item-synthetic", invoice_id: "invoice-synthetic", line_type: "labor", description: "SYNTHETIC LABOR", unit_amount_cents: 10000, line_amount_cents: 10000 });
    database.exec("UPDATE provider_invoices SET status='final' WHERE id='invoice-synthetic'");
    seed("customer_agreement_acceptances", { id: "confirmation-synthetic", request_id: "job-synthetic", quote_id: context.quoteId,
      scope_version: 1, agreement_key: "customer_completion_confirmation", agreement_version: "completion-confirmation:1" });
  };
  try {
    globalThis.fetch = async () => { throw Error("External network is forbidden in this fixture"); };
    const routePath = join(root, "app/api/stripe/admin/payments/route.ts").replaceAll("\\", "/");
    await build({ entryPoints: [routePath], bundle: true, platform: "node", format: "cjs", target: "node22",
      outfile: join(scratch, "route.cjs"), logLevel: "silent", plugins: [{ name: "transfer-fixture", setup(builder) {
        builder.onResolve({ filter: /^cloudflare:workers$/ }, () => ({ path: "env", namespace: "fixture" }));
        builder.onResolve({ filter: /(?:^|\/)db$/ }, args => args.path.startsWith(".") ? { path: "db", namespace: "fixture" } : null);
        for (const dependency of ["owner-auth", "stripe", "runtime-marketplace-action", "runtime-launch-readiness", "stripe-connected-account-snapshots"]) {
          builder.onResolve({ filter: new RegExp(`(?:^|/)${dependency}$`) }, () => ({ path: dependency, namespace: "fixture" }));
        }
        builder.onResolve({ filter: /job-operations$/ }, args => args.importer.replaceAll("\\", "/") === routePath ? { path: "operations", namespace: "fixture" } : null);
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({ loader: "ts", resolveDir: root, contents: {
          env: "export const env = {};", db: "export const getDb=()=>globalThis.__transferRecovery.db;",
          "owner-auth": 'export const isVerifiedOwnerRequest=async()=>globalThis.__transferRecovery.owner; export const getAuthenticatedEmail=()=>"owner@example.invalid";',
          stripe: 'export const getStripeClient=()=>globalThis.__transferRecovery.stripe; export const stripeLiveModeEnabled=()=>false; export const retrieveRecipientAccountStatus=async()=>({readyToReceivePayments:true}); export const stripeErrorResponse=(e)=>Response.json({error:e.message},{status:502});',
          "runtime-marketplace-action": "export const runtimeMarketplaceActionAllowed=async()=>globalThis.__transferRecovery.open;",
          "runtime-launch-readiness": 'export const runtimeRealMarketplaceReleaseDecision=async()=>({approved:globalThis.__transferRecovery.open,providerOnboardingDecisionIds:["synthetic"],transactionPilotDecisionIds:["synthetic"],checkedAt:"2026-10-01T00:00:00Z"});',
          "stripe-connected-account-snapshots": 'export const connectedAccountPayoutSafety=async()=>({allowed:true,reasons:[]});',
          operations: 'export {assessPayoutReadiness} from "./lib/job-operations"; export const evaluateAssignedJobStage=async()=>({allowed:true,context:globalThis.__transferRecovery.context,result:{decisionId:"payout-synthetic"}}); export const jobAuthorizationDecisionMatchesContext=async()=>true; export const appendJobLifecycleEvent=async()=>{};',
        }[args.path] }));
      } }] });
    const api = createRequire(import.meta.url)(join(scratch, "route.cjs"));
    const post = async (action, origin = "https://tuveloz.invalid") => {
      const response = await api.POST(new Request("https://tuveloz.invalid/api/stripe/admin/payments", { method: "POST",
        headers: { origin, "content-type": "application/json" }, body: JSON.stringify({ paymentId: "payment-synthetic", ...(action ? { action } : {}) }) }));
      return { status: response.status, body: await response.json() };
    };
    const payment = () => database.prepare("SELECT * FROM stripe_payments WHERE id='payment-synthetic'").get();
    const markers = () => database.prepare("SELECT * FROM payment_adjustments WHERE adjustment_type='stripe_transfer_reversal_review'").all();
    const list = async () => {
      const response = await api.GET(new Request("https://tuveloz.invalid/api/stripe/admin/payments"));
      assert.equal(response.status, 200); assert.equal(response.headers.get("cache-control"), "no-store");
      const data = await response.json(); assert.equal(validStripePayments(data.payments), true);
      assert.equal(data.payments[0].canRelease, false);
      assert.equal(typeof data.payments[0].transferReversalReviewRequired, "boolean");
      return data.payments[0];
    };
    const reverse = (amount = 1000) => Object.assign(transfers[0], { amount_reversed: amount, reversed: amount === 10000 });
    await t.test("late retry after a lost transfer reply does not send a second transfer", async () => {
      reset(); loseReply = true; const first = await post(); assert.notEqual(first.body.ok, true); assert.equal(calls.length, 1);
      loseReply = false; const recovered = await post();
      assert.equal(calls.length, 1, "never recreate after processor idempotency retention ends");
      assert.equal(recovered.body.ok, true); assert.equal(payment().transfer_id, "tr_synthetic_1");
    });
    await t.test("a malformed transfer receipt never claims release", async () => {
      reset(); corruptReply = true; const response = await post();
      assert.notEqual(response.body.ok, true); assert.equal(payment().transfer_id, null);
    });
    await t.test("a concurrent dispute remains held when the transfer reply arrives", async () => {
      reset(); beforeCreate = () => database.exec("UPDATE stripe_payments SET status='disputed',dispute_status='needs_response'");
      await post(); assert.equal(payment().status, "disputed");
    });
    await t.test("a successful release sends only the provider amount and a durable operation reference", async () => {
      reset(); const response = await post(); assert.equal(response.body.transferConfirmed, true);
      assert.equal(response.body.paymentId, "payment-synthetic"); assert.equal(calls.length, 1);
      assert.equal(calls[0].params.amount, 10000); assert.equal(calls[0].options.idempotencyKey, "tuveloz-release-payment-synthetic");
      const saved = database.prepare("SELECT * FROM payment_adjustments WHERE adjustment_type='stripe_provider_transfer'").get();
      assert.equal(saved.status, "transfer_recorded"); assert.equal(calls[0].params.metadata.tuveloz_transfer_execution_id, saved.id);
      assert.equal(saved.provider_impact_cents, 0, "execution is not a second accounting adjustment");
      assert.deepEqual(JSON.parse(saved.details).invoice, { id: "invoice-synthetic", requestId: "job-synthetic",
        quoteId: context.quoteId, providerId: "provider-synthetic", scopeVersion: 1, status: "final", totalAmountCents: 10000,
        documentHash: "SYNTHETIC FIXTURE ONLY", customerSignatureAt: "SYNTHETIC FIXTURE ONLY",
        customerCopyDeliveredAt: "SYNTHETIC FIXTURE ONLY", providerCopyRetainedAt: "SYNTHETIC FIXTURE ONLY" });
      assert.equal((await post()).body.transferConfirmed, true); assert.equal(calls.length, 1);
    });
    const invoiceRequiredFields = ["customer_signature_at", "customer_copy_delivered_at", "provider_copy_retained_at", "document_hash"];
    const invoiceMismatchCases = [
      ...invoiceRequiredFields.map(field => [field, { [field]: field === "document_hash" ? "  " : "" }]),
      ["quote identity", { quote_id: "other-quote" }],
      ["provider identity", { provider_id: "other-provider" }],
      ["scope identity", { scope_version: 2 }],
    ];
    const assertInvoiceBlockedBeforeTransfer = async label => {
      const result = await post();
      const reserved = database.prepare("SELECT count(*) n FROM payment_adjustments WHERE adjustment_type='stripe_provider_transfer'").get().n;
      const actual = { status: result.status, transfers: calls.length, reservations: reserved, transferId: payment().transfer_id };
      assert.deepEqual(actual, { status: 409, transfers: 0, reservations: 0, transferId: null },
        `${label}: invoice failure must precede both the transfer and its reservation; response=${JSON.stringify(result.body)}`);
      assert.equal(payment().status, "paid_pending_completion");
    };
    for (const [label, values] of invoiceMismatchCases) {
      await t.test(`invoice preflight rejects missing or mismatched ${label} before reserving or sending`, async () => {
        reset(values);
        await assertInvoiceBlockedBeforeTransfer(label);
      });
    }
    for (const [label, change] of [
      ["invoice identity", "id='replacement-invoice'"],
      ["final status", "status='draft'"],
    ]) {
      await t.test(`invoice preflight rechecks ${label} changed during processor verification before reservation`, async () => {
        reset(); let changed = false;
        beforeIntent = () => { changed = true; database.exec(`UPDATE provider_invoices SET ${change} WHERE id='invoice-synthetic'`); };
        await assertInvoiceBlockedBeforeTransfer(label);
        assert.equal(changed, true, "the race must occur after initial invoice review");
      });
    }
    await t.test("a changed hash on a re-finalized invoice cannot reuse the reviewed snapshot", async () => {
      reset(); let changed = false;
      beforeIntent = () => {
        database.exec("UPDATE provider_invoices SET status='draft' WHERE id='invoice-synthetic'");
        database.exec("UPDATE provider_invoices SET document_hash='SYNTHETIC CHANGED HASH' WHERE id='invoice-synthetic'");
        database.exec("UPDATE provider_invoices SET status='final' WHERE id='invoice-synthetic'");
        changed = true;
      };
      await assertInvoiceBlockedBeforeTransfer("changed hash");
      assert.equal(changed, true, "the real database allowed re-finalization before reservation");
    });
    await t.test("sealed invoice evidence cannot change during processor verification", async () => {
      for (const [label, change] of [
        ...invoiceRequiredFields.map(field => [field, `${field}=''`]),
        ["request identity", "request_id='other-job'"],
        ["quote identity", "quote_id='other-quote'"],
        ["provider identity", "provider_id='other-provider'"],
        ["scope identity", "scope_version=2"],
        ["changed document hash", "document_hash='SYNTHETIC CHANGED HASH'"],
        ["changed customer signature", "customer_signature_at='SYNTHETIC CHANGED SIGNATURE'"],
        ["changed copy delivery", "customer_copy_delivered_at='SYNTHETIC CHANGED DELIVERY'"],
        ["changed provider retention", "provider_copy_retained_at='SYNTHETIC CHANGED RETENTION'"],
        ["authorized amount", "labor_amount_cents=10001,total_amount_cents=10001"],
      ]) {
        reset(); let attempted = false;
        const before = database.prepare("SELECT * FROM provider_invoices WHERE id='invoice-synthetic'").get();
        beforeIntent = () => {
          attempted = true;
          // Either overlapping trigger may reject a delivery-field mutation;
          // the complete invoice must remain identical before any transfer.
          assert.throws(() => database.exec(`UPDATE provider_invoices SET ${change} WHERE id='invoice-synthetic'`),
            /immutable|matching original customer signature evidence/, label);
        };
        assert.equal((await post()).body.transferConfirmed, true, label);
        assert.equal(attempted, true, label);
        assert.deepEqual(database.prepare("SELECT * FROM provider_invoices WHERE id='invoice-synthetic'").get(), before, label);
        assert.equal(calls.length, 1, "only the unchanged, valid signed invoice can proceed");
      }
    });
    await t.test("an explicit status check never initiates a transfer and an unknown attempt stays read-only", async () => {
      reset(); assert.equal((await post("check_transfer")).body.transferConfirmed, false); assert.equal(calls.length, 0);
      loseReply = true; await post(); transfers = []; loseReply = false;
      database.exec("UPDATE payment_adjustments SET created_at='2020-01-01'");
      for (const action of [undefined, "check_transfer", "release"]) {
        assert.equal((await post(action)).body.transferConfirmed, false); assert.equal(calls.length, 1);
      }
    });
    await t.test("owner, origin and release gates stop sending; closed release still permits recovery", async () => {
      reset(); state.owner = false; assert.equal((await post()).status, 403);
      state.owner = true; assert.equal((await post(undefined, "https://other.invalid")).status, 403);
      state.open = false; assert.equal((await post()).status, 503); assert.equal(calls.length, 0);
      state.open = true; loseReply = true; await post(); state.open = false;
      assert.equal((await post("check_transfer")).body.transferConfirmed, true); assert.equal(calls.length, 1);
    });
    await t.test("concurrent clicks reserve one operation before the first Stripe reply", async () => {
      reset(); let started, finish;
      const entered = new Promise(resolve => { started = resolve; }); const resume = new Promise(resolve => { finish = resolve; });
      beforeCreate = async () => { started(); await resume; };
      const first = post(); await entered;
      const second = await post(); assert.notEqual(second.body.ok, true); assert.equal(calls.length, 1);
      finish(); assert.equal((await first).body.transferConfirmed, true);
      assert.equal(database.prepare("SELECT count(*) n FROM payment_adjustments WHERE adjustment_type='stripe_provider_transfer'").get().n, 1);
    });
    await t.test("a local receipt-write failure can recover without sending again", async () => {
      reset(); beforeSave = () => { throw Error("SYNTHETIC receipt storage failure"); };
      assert.notEqual((await post()).body.ok, true); assert.equal(calls.length, 1);
      assert.equal((await post("check_transfer")).body.transferConfirmed, true); assert.equal(calls.length, 1);
    });
    await t.test("legacy transfers without a local reservation are found before any new send", async () => {
      reset(); await post(); const legacy = { ...transfers[0], metadata: { ...transfers[0].metadata } };
      delete legacy.metadata.tuveloz_transfer_execution_id; reset(); transfers = [legacy];
      assert.equal((await post()).body.transferConfirmed, true); assert.equal(calls.length, 0);
    });
    await t.test("wrong, malformed or duplicated processor records cannot confirm a transfer", async () => {
      for (const change of [x => x.amount++, x => x.currency = "eur", x => x.destination = "acct_other",
        x => x.source_transaction = "ch_other", x => x.transfer_group = "other", x => x.livemode = true,
        x => x.metadata.tuveloz_payment_record_id = "other", x => x.metadata.tuveloz_transfer_execution_id = "other",
        x => x.reversed = true]) {
        reset(); loseReply = true; await post(); change(transfers[0]); loseReply = false;
        assert.equal((await post()).status, 409); assert.equal(calls.length, 1); assert.equal(payment().transfer_id, null);
      }
      reset(); loseReply = true; await post(); transfers.push({ ...transfers[0], id: "tr_other" });
      assert.equal((await post()).status, 409); assert.equal(calls.length, 1);
    });
    await t.test("a recorded provider transfer becomes a zero-impact review after partial or full reversal", async () => {
      for (const amount of [1, 4500, 10000]) {
        reset(); assert.equal((await post()).body.transferConfirmed, true);
        const before = payment(); reverse(amount);
        const response = await post("check_transfer");
        assert.equal(response.status, 409); assert.notEqual(response.body.transferConfirmed, true);
        assert.match(response.body.error, /reversal|reversed/i);
        const saved = payment();
        assert.equal(saved.status, before.status, "historical payment status remains independent of the review marker");
        for (const key of ["transfer_id", "released_at", "released_by", "provider_amount_cents", "application_fee_cents", "customer_total_cents",
          "refund_amount_cents", "refund_status", "last_refund_id", "refunded_at", "dispute_status"]) {
          assert.ok(Object.hasOwn(saved, key), key); assert.equal(saved[key], before[key], key);
        }
        assert.equal(calls.length, 1, "a reversal never sends a replacement transfer");
        assert.equal(markers().length, 1);
        const marker = markers()[0];
        assert.equal(marker.payment_id, "payment-synthetic"); assert.equal(marker.request_id, "job-synthetic");
        assert.equal(marker.quote_id, "quote-synthetic"); assert.equal(marker.status, "review_required");
        for (const key of ["amount_cents", "provider_impact_cents", "customer_impact_cents"]) assert.equal(marker[key], 0, key);
        for (const key of ["stripe_refund_id", "stripe_dispute_id", "transfer_reversal_id", "decided_by", "decided_at"]) assert.equal(marker[key], "", key);
        const details = JSON.parse(marker.details);
        assert.equal(details.transferId, before.transfer_id); assert.equal(details.payment.id, before.id);
        assert.equal(details.accountingEntry, false); assert.equal(details.collectionAuthorized, false);
        const beforeListWrites = database.prepare("SELECT total_changes() count").get().count, reads = transferReads;
        const listed = await list();
        assert.equal(listed.transferReversalReviewRequired, true);
        assert.equal(listed.status, "transfer_reversed_review"); assert.equal(listed.transferId, before.transfer_id);
        assert.equal(database.prepare("SELECT total_changes() count").get().count, beforeListWrites, "GET must not write");
        assert.equal(transferReads, reads, "GET uses saved evidence without contacting Stripe");
      }
    });
    await t.test("a reversed transfer after a lost reply records its original ID and keeps the reservation", async () => {
      reset(); loseReply = true; await post(); loseReply = false;
      assert.equal(payment().transfer_id, null);
      const attempt = database.prepare("SELECT * FROM payment_adjustments WHERE adjustment_type='stripe_provider_transfer'").get();
      reverse(2500);
      assert.equal((await post("check_transfer")).status, 409);
      assert.equal(payment().transfer_id, "tr_synthetic_1"); assert.equal(payment().status, "paid_pending_completion");
      assert.ok(payment().released_at); assert.equal(markers().length, 1);
      assert.deepEqual(database.prepare("SELECT * FROM payment_adjustments WHERE id=?").get(attempt.id), attempt);
      assert.equal((await list()).transferReversalReviewRequired, true);
      for (const action of [undefined, "check_transfer", "release"]) {
        assert.notEqual((await post(action)).body.transferConfirmed, true);
        assert.equal(calls.length, 1); assert.equal(markers().length, 1);
      }
    });
    await t.test("concurrent reversal checks create one marker and preserve the original transfer", async () => {
      reset(); await post(); reverse();
      let arrivals = 0, release;
      const barrier = new Promise(resolve => { release = resolve; });
      batchBarrier = async () => { if (++arrivals === 2) release(); await barrier; };
      const responses = await Promise.all([post("check_transfer"), post("check_transfer")]);
      assert.deepEqual(responses.map(response => response.status), [409, 409]);
      assert.equal(markers().length, 1); assert.equal(payment().transfer_id, "tr_synthetic_1");
      assert.equal(payment().status, "released"); assert.equal(calls.length, 1);
    });
    await t.test("a failed reversal batch rolls back both marker and adoption, then recovers without another send", async () => {
      reset(); loseReply = true; await post(); loseReply = false; reverse();
      const before = payment(); failBatch = true;
      assert.equal((await post("check_transfer")).status, 502);
      assert.deepEqual(payment(), before); assert.equal(markers().length, 0);
      failBatch = false;
      assert.equal((await post("check_transfer")).status, 409);
      assert.equal(payment().transfer_id, "tr_synthetic_1"); assert.equal(markers().length, 1); assert.equal(calls.length, 1);
    });
    await t.test("changed payment binding before the reversal transaction cannot create a marker or adopt a transfer", async () => {
      reset(); loseReply = true; await post(); loseReply = false; reverse();
      beforeBatch = () => database.exec("UPDATE stripe_payments SET connected_account_id='acct_changed'");
      assert.equal((await post("check_transfer")).status, 409);
      assert.equal(payment().connected_account_id, "acct_changed"); assert.equal(payment().transfer_id, null);
      assert.equal(payment().status, "paid_pending_completion"); assert.equal(markers().length, 0); assert.equal(calls.length, 1);
    });
    await t.test("a reversal marker arriving after the initial check prevents an atomic stale success", async () => {
      reset(); await post(); reverse(); assert.equal((await post("check_transfer")).status, 409);
      const marker = markers()[0];
      // Replay the exact valid observation as a second writer between the stale read and its UPDATE.
      database.prepare("DELETE FROM payment_adjustments WHERE id=?").run(marker.id);
      reverse(0); beforeSave = () => seed("payment_adjustments", marker);
      const response = await post("check_transfer");
      assert.equal(response.status, 409); assert.notEqual(response.body.transferConfirmed, true);
      assert.deepEqual(markers(), [marker]); assert.equal(calls.length, 1);
      assert.equal((await list()).transferReversalReviewRequired, true);
    });
    await t.test("a hold arriving before reversal recording keeps its financial state and its review marker", async () => {
      reset(); await post(); reverse();
      beforeBatch = () => database.exec("UPDATE stripe_payments SET status='refunded',refund_amount_cents=10500,refund_status='succeeded',last_refund_id='re_other',dispute_status='needs_response'");
      assert.equal((await post("check_transfer")).status, 409);
      const saved = payment();
      assert.equal(saved.status, "refunded"); assert.equal(saved.refund_amount_cents, 10500);
      assert.equal(saved.refund_status, "succeeded"); assert.equal(saved.last_refund_id, "re_other");
      assert.equal(saved.dispute_status, "needs_response"); assert.equal(markers().length, 1);
      const listed = await list();
      assert.equal(listed.status, "refunded"); assert.equal(listed.transferReversalReviewRequired, true);
    });
    await t.test("a positive reversal with unsafe amounts or mismatched identity cannot create review evidence", async () => {
      const changes = [
        x => x.amount_reversed = -1, x => x.amount_reversed = 10001, x => x.amount_reversed = 0.5,
        x => x.amount_reversed = "1000", x => x.amount_reversed = NaN, x => x.amount_reversed = Infinity,
        x => x.amount_reversed = Number.MAX_SAFE_INTEGER + 1, x => x.amount_reversed = undefined,
        x => x.reversed = true, x => x.reversed = "false", x => x.reversed = undefined,
        x => x.amount_reversed = 10000, x => x.amount = 10500, x => x.livemode = true,
        x => x.destination = "acct_other", x => x.source_transaction = "ch_other", x => x.transfer_group = "other",
        x => x.currency = "eur", x => x.object = "charge", x => x.created = Number.MAX_SAFE_INTEGER,
        x => x.metadata.tuveloz_payment_record_id = "other", x => x.metadata.tuveloz_request_id = "other",
        x => x.metadata.tuveloz_quote_id = "other", x => x.metadata.tuveloz_transfer_execution_id = "other",
      ];
      for (const change of changes) {
        reset(); await post(); const before = payment(); reverse(); change(transfers[0]);
        assert.equal((await post("check_transfer")).status, 409, String(change));
        assert.deepEqual(payment(), before, String(change)); assert.equal(markers().length, 0); assert.equal(calls.length, 1);
      }
    });
    await t.test("reversal review survives later zero snapshots and independent refund or dispute statuses", async () => {
      for (const [status, refund, dispute] of [
        ["released", "", ""], ["refund_pending", "pending", ""], ["refunded", "succeeded", ""],
        ["disputed", "", "needs_response"], ["launch_shutdown_hold", "", ""],
      ]) {
        reset(); await post();
        database.prepare("UPDATE stripe_payments SET status=?,refund_status=?,dispute_status=?,refund_amount_cents=?")
          .run(status, refund, dispute, refund === "succeeded" ? 10500 : 0);
        reverse(); assert.equal((await post("check_transfer")).status, 409);
        assert.equal(payment().status, status);
        assert.equal(payment().refund_status, refund); assert.equal(payment().dispute_status, dispute);
        const marker = markers()[0];
        // Other reconciliation writers own payment.status; the independent review must remain visible.
        database.prepare("UPDATE stripe_payments SET status=?").run(status);
        reverse(0);
        const listed = await list();
        assert.equal(listed.transferReversalReviewRequired, true);
        assert.equal(listed.status, status === "released" ? "transfer_reversed_review" : status);
        const response = await post("check_transfer");
        assert.equal(response.status, 409); assert.notEqual(response.body.transferConfirmed, true);
        assert.equal((await list()).transferReversalReviewRequired, true);
        assert.deepEqual(markers(), [marker]); assert.equal(calls.length, 1);
      }
    });
    await t.test("a payment hold or changed quote during verification prevents reservation and sending", async () => {
      for (const sql of ["UPDATE stripe_payments SET status='disputed',dispute_status='needs_response'",
        "UPDATE stripe_payments SET refund_status='pending'", "UPDATE provider_quotes SET scope_version=2"]) {
        reset(); beforeIntent = () => database.exec(sql); assert.equal((await post()).status, 409); assert.equal(calls.length, 0);
      }
    });
    await t.test("changed payment identity cannot adopt the original transfer or resend it", async () => {
      reset(); loseReply = true; await post(); database.exec("UPDATE stripe_payments SET connected_account_id='acct_other'");
      assert.equal((await post()).status, 409); assert.equal(calls.length, 1); assert.equal(payment().transfer_id, null);
    });
    await t.test("two requests that passed the initial reads still reserve and send once", async () => {
      reset(); let arrive = 0, release;
      const barrier = new Promise(resolve => { release = resolve; });
      beforeList = async () => { if (++arrive === 2) release(); await barrier; };
      const replies = await Promise.all([post(), post()]);
      assert.ok(replies.some(reply => reply.body.transferConfirmed)); assert.equal(calls.length, 1);
    });
    await t.test("payment-list recovery markers are valid and never enable release controls", async () => {
      reset();
      assert.equal((await list()).transferReversalReviewRequired, false);
      assert.equal((await list()).transferAttemptStatus, null);
      loseReply = true; await post(); assert.equal((await list()).transferAttemptStatus, "transfer_submission_unconfirmed");
      assert.equal((await list()).transferReversalReviewRequired, false);
      await post("check_transfer"); assert.equal((await list()).transferAttemptStatus, "transfer_recorded");
      assert.equal((await list()).transferReversalReviewRequired, false);
    });
  } finally {
    globalThis.fetch = originalFetch; database?.close(); delete globalThis.__transferRecovery;
    assert.ok(scratch.startsWith(temp + (process.platform === "win32" ? "\\" : "/")));
    rmSync(scratch, { recursive: true, force: true });
  }
});
