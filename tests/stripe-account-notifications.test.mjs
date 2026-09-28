import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { build } from "esbuild";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import Stripe from "stripe";
import React from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";

// Real route, Stripe signatures and migrated SQL; all vendor reads are local
// fixtures and every other network call fails. No real accounts or mail.
test("Stripe account changes durably notify only the correct real provider", async t => {
  const repo = resolve(import.meta.dirname, "..");
  const tempRoot = resolve(tmpdir());
  const scratch = mkdtempSync(join(tempRoot, "tuveloz-stripe-account-"));
  const database = new DatabaseSync(":memory:");
  const originalFetch = globalThis.fetch;
  const originalError = console.error;
  const secret = "whsec_synthetic_account_notice_fixture";
  const accountId = "acct_synthetic_account_notice";
  const type = "v2.core.account[requirements].updated";
  const state = { db: null, failBatch: false, failComplete: false,
    beforeBatch: null, reads: [], events: new Map(), account: null,
    env: { STRIPE_SECRET_KEY: "sk_test_synthetic_account_notice_fixture",
      STRIPE_CONNECT_WEBHOOK_SECRET: secret, SITE_URL: "https://tuveloz.invalid",
      APP_ENVIRONMENT: "production", STRIPE_ALLOW_LIVE_MODE: "false" } };
  globalThis.__stripeAccountNotice = state;
  let sequence = 0;
  const reset = ({ language = "English", testProvider = "no" } = {}) => {
    database.exec("DELETE FROM account_notifications; DELETE FROM email_notification_outbox; DELETE FROM provider_applications; DELETE FROM stripe_webhook_events;");
    database.prepare(`INSERT INTO provider_applications
      (id,name,email,service,service_area,experience,insurance_status,is_test_provider,stripe_account_id,preferred_language)
      VALUES ('provider-fixture','SYNTHETIC','provider@example.invalid','test-only',
      'test-only','test-only','unverified',?,?,?)`).run(testProvider, accountId, language);
    state.env.APP_ENVIRONMENT = "production";
    state.failBatch = false; state.failComplete = false; state.beforeBatch = null; state.reads = [];
    state.account = { id: accountId, livemode: true, dashboard: "express",
      configuration: { recipient: { capabilities: { stripe_balance: { stripe_transfers: { status: "active" } } } } },
      requirements: { summary: { minimum_deadline: { status: "currently_due" } },
        entries: [{ description: "SENSITIVE FIXTURE - never email this", awaiting_action_from: "user" }] } };
  };
  const event = (overrides = {}) => ({ id: `evt_synthetic_account_${++sequence}`, type,
    object: "v2.core.event", livemode: true, created: new Date().toISOString(),
    related_object: { id: accountId, type: "v2.core.account", url: `/v2/core/accounts/${accountId}` }, ...overrides });
  const count = table => database.prepare(`SELECT count(*) n FROM ${table}`).get().n;
  const outbox = () => database.prepare("SELECT * FROM email_notification_outbox").all();
  const receipt = id => database.prepare("SELECT status FROM stripe_webhook_events WHERE event_id=?").get(id)?.status;
  try {
    console.error = () => {};
    for (const entry of JSON.parse(readFileSync(join(repo, "drizzle/meta/_journal.json"), "utf8")).entries) {
      for (const statement of readFileSync(join(repo, "drizzle", entry.tag + ".sql"), "utf8").split("--> statement-breakpoint")) {
        if (statement.trim()) database.exec(statement);
      }
    }
    state.db = drizzle(async (query, params, method) => {
      if (state.failComplete && query.startsWith('update "stripe_webhook_events"') && params[0] === "processed") {
        state.failComplete = false; throw Error("Synthetic receipt failure");
      }
      if (method === "run") { database.prepare(query).run(...params); return { rows: [] }; }
      database.exec("PRAGMA short_column_names=OFF; PRAGMA full_column_names=ON;");
      try {
        const statement = database.prepare(query);
        return { rows: method === "get" ? Object.values(statement.get(...params) ?? {})
          : statement.all(...params).map(row => Object.values(row)) };
      } finally { database.exec("PRAGMA short_column_names=ON; PRAGMA full_column_names=OFF;"); }
    });
    state.env.DB = {
      prepare(sql) { return { sql, params: [], bind(...params) { this.params = params; return this; },
        async all() { return { results: database.prepare(sql).all(...this.params) }; } }; },
      async batch(statements) {
        state.beforeBatch?.(); state.beforeBatch = null;
        database.exec("BEGIN");
        try {
          const results = statements.map((statement, i) => {
            if (state.failBatch && i === 1) throw Error("Synthetic outbox storage failure");
            return { meta: { changes: database.prepare(statement.sql).run(...statement.params).changes } };
          });
          database.exec("COMMIT"); return results;
        } catch (error) { database.exec("ROLLBACK"); throw error; }
      },
    };
    globalThis.fetch = async (input, init) => {
      const url = new URL(typeof input === "string" ? input : input.url ?? input);
      const method = init?.method ?? input.method ?? "GET";
      assert.equal(method, "GET", "Fixture allows no API writes or sends");
      assert.equal(url.hostname, "api.stripe.com");
      state.reads.push(url.pathname);
      let object;
      if (url.pathname.startsWith("/v2/core/events/")) object = state.events.get(url.pathname.split("/").at(-1));
      else if (url.pathname === `/v2/core/accounts/${accountId}`) object = state.account;
      else throw Error(`Unexpected network request: ${url.pathname}`);
      assert.ok(object, "Missing synthetic fixture");
      return new Response(JSON.stringify(object), { status: 200, headers: { "content-type": "application/json" } });
    };
    const bundle = join(scratch, "account.cjs");
    await build({ absWorkingDir: repo, stdin: { contents: `
      export { POST } from "./app/api/stripe/webhooks/connect/route";
      export { stripeLiveModeEnabled } from "./lib/stripe";
      export { emailEventAllowedByReleaseState } from "./lib/email-event-policy";
    `, resolveDir: repo, loader: "ts" }, bundle: true, platform: "node", format: "cjs",
      outfile: bundle, target: "node22", logLevel: "silent", plugins: [{ name: "local-bindings", setup(builder) {
        builder.onResolve({ filter: /^cloudflare:workers$/ }, () => ({ path: "env", namespace: "fixture" }));
        builder.onResolve({ filter: /(?:^|\/)db$/ }, args => args.path.startsWith(".") ? { path: "db", namespace: "fixture" } : null);
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({ loader: "js", contents: args.path === "env"
          ? "export const env = globalThis.__stripeAccountNotice.env;"
          : "export function getDb() { return globalThis.__stripeAccountNotice.db; }" }));
      } }] });
    const api = createRequire(import.meta.url)(bundle);
    const send = async (value, { signedWith = secret, retrieved = value } = {}) => {
      state.events.set(value.id, retrieved);
      const payload = JSON.stringify(value);
      return api.POST(new Request("https://tuveloz.invalid/api/stripe/webhooks/connect", {
        method: "POST", body: payload, headers: { "stripe-signature":
          Stripe.webhooks.generateTestHeaderString({ payload, secret: signedWith }) },
      }));
    };
    await t.test("forged signature causes no API read, receipt or notification", async () => {
      reset();
      assert.equal((await send(event(), { signedWith: "whsec_wrong" })).status, 400);
      assert.equal(state.reads.length, 0); assert.equal(count("stripe_webhook_events"), 0);
      assert.equal(outbox().length, 0);
    });
    await t.test("both supported changes notify with a secure link and no sensitive requirement text", async () => {
      for (const eventType of [type, "v2.core.account[configuration.recipient].capability_status_updated"]) {
        reset(); const value = event({ type: eventType });
        assert.equal((await send(value)).status, 200);
        assert.equal(receipt(value.id), "processed");
        assert.equal(count("account_notifications"), 1);
        assert.equal(outbox().length, 1);
        const notice = outbox()[0];
        assert.equal(notice.recipient_email, "provider@example.invalid");
        assert.match(notice.text_body, /https:\/\/tuveloz\.invalid\/provider-jobs#stripe-payouts/);
        assert.doesNotMatch(notice.text_body, /SENSITIVE|acct_|verified|approved/);
        assert.equal(notice.status, "pending");
        assert.equal(api.emailEventAllowedByReleaseState(notice.event_key, false), true);
        assert.equal(database.prepare("SELECT verification_status FROM provider_applications").get().verification_status, "not reviewed");
        assert.equal(api.stripeLiveModeEnabled(), false);
      }
    });
    await t.test("Spanish providers receive Spanish copy", async () => {
      reset({ language: "Spanish" }); await send(event());
      assert.match(outbox()[0].subject, /Revisa tu cuenta/);
      assert.match(outbox()[0].text_body, /No envíes documentos/);
    });
    await t.test("signed retries produce one account notice and one email intent", async () => {
      reset(); const value = event(); await send(value);
      assert.deepEqual(await (await send(value)).json(), { received: true, duplicate: true });
      assert.equal(count("account_notifications"), 1); assert.equal(outbox().length, 1);
    });
    await t.test("outbox failure rolls back both notices and Stripe can retry", async () => {
      reset(); state.failBatch = true; const value = event();
      assert.equal((await send(value)).status, 502); assert.equal(receipt(value.id), "failed");
      assert.equal(count("account_notifications"), 0); assert.equal(outbox().length, 0);
      state.failBatch = false;
      assert.equal((await send(value)).status, 200); assert.equal(outbox().length, 1);
    });
    await t.test("failure after saving notices cannot duplicate them on replay", async () => {
      reset(); state.failComplete = true; const value = event();
      assert.equal((await send(value)).status, 502); assert.equal(outbox().length, 1);
      assert.equal((await send(value)).status, 200);
      assert.equal(count("account_notifications"), 1); assert.equal(outbox().length, 1);
    });
    await t.test("staging, test events, test providers and unmapped accounts send nothing", async () => {
      for (const scenario of ["staging", "event", "provider", "unmapped"]) {
        reset(); const value = event();
        if (scenario === "staging") state.env.APP_ENVIRONMENT = "staging";
        if (scenario === "event") { value.livemode = false; state.account.livemode = false; }
        if (scenario === "provider") database.exec("UPDATE provider_applications SET is_test_provider='yes'");
        if (scenario === "unmapped") database.exec("DELETE FROM provider_applications");
        assert.equal((await send(value)).status, 200, scenario);
        assert.equal(count("account_notifications"), 0, scenario); assert.equal(outbox().length, 0, scenario);
      }
    });
    await t.test("late events use the current account status, not outdated requirement payloads", async () => {
      reset(); state.account.requirements = { summary: { minimum_deadline: { status: "none" } }, entries: [] };
      assert.equal((await send(event())).status, 200); assert.equal(outbox().length, 0);
    });
    await t.test("mismatched event or account facts fail without notifying", async () => {
      for (const scenario of ["event-id", "event-mode", "event-type", "account-id", "account-mode"]) {
        reset(); const value = event(); const retrieved = structuredClone(value);
        if (scenario === "event-id") retrieved.id = "evt_wrong";
        if (scenario === "event-mode") retrieved.livemode = false;
        if (scenario === "event-type") retrieved.type = "v2.core.account.closed";
        if (scenario === "account-id") state.account.id = "acct_wrong";
        if (scenario === "account-mode") state.account.livemode = false;
        assert.equal((await send(value, { retrieved })).status, 502, scenario);
        assert.equal(outbox().length, 0, scenario);
      }
    });
    await t.test("ownership changes during processing cannot notify the previous provider", async () => {
      reset(); state.beforeBatch = () => database.exec("UPDATE provider_applications SET stripe_account_id='acct_reassigned'");
      assert.equal((await send(event())).status, 200);
      assert.equal(count("account_notifications"), 0); assert.equal(outbox().length, 0);
    });
    await t.test("ambiguous ownership fails rather than choosing a recipient", async () => {
      reset(); database.prepare(`INSERT INTO provider_applications
        (id,name,email,service,service_area,experience,insurance_status,stripe_account_id)
        VALUES ('provider-other','SYNTHETIC','other@example.invalid','test','test','test','unverified',?)`).run(accountId);
      assert.equal((await send(event())).status, 502); assert.equal(outbox().length, 0);
    });
  } finally {
    globalThis.fetch = originalFetch; console.error = originalError;
    delete globalThis.__stripeAccountNotice; database.close();
    assert.equal(dirname(scratch), tempRoot);
    assert.ok(scratch.startsWith(join(tempRoot, "tuveloz-stripe-account-")));
    rmSync(scratch, { recursive: true, force: true });
  }
});

test("the rendered Stripe panel keeps its update button for due information even with active transfers", async () => {
  const repo = resolve(import.meta.dirname, "..");
  const tempRoot = resolve(tmpdir());
  const scratch = mkdtempSync(join(tempRoot, "tuveloz-stripe-panel-"));
  const fixture = { React, jsxRuntime, index: 0, connect: null };
  globalThis.__stripePanelNotice = fixture;
  try {
    const bundle = join(scratch, "panel.cjs");
    await build({ absWorkingDir: repo, entryPoints: ["app/components/stripe-connect-panel.tsx"],
      bundle: true, platform: "node", format: "cjs", outfile: bundle, target: "node22", logLevel: "silent",
      plugins: [{ name: "render-account-state", setup(builder) {
        builder.onResolve({ filter: /^(react(?:\/jsx-runtime)?|next\/link)$/ }, args => ({ path: args.path, namespace: "fixture" }));
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({ loader: "js", contents: args.path === "react"
          ? `export function useEffect() {} export function useState(initial) {
              const f = globalThis.__stripePanelNotice, i = f.index++;
              return [i === 0 ? f.connect : i === 1 ? false : initial, () => {}];
            }`
          : args.path === "react/jsx-runtime"
            ? `export const { jsx, jsxs, Fragment } = globalThis.__stripePanelNotice.jsxRuntime;`
            : `export default function Link(props) { return globalThis.__stripePanelNotice.React.createElement("a", props); }` }));
      } }] });
    const { StripeConnectPanel } = createRequire(import.meta.url)(bundle);
    for (const [status, needsAction] of [
      [{ requirementsStatus: "currently_due", requirements: [], readyToReceivePayments: true }, true],
      [{ requirementsStatus: "eventually_due", requirements: [], readyToReceivePayments: true }, true],
      [{ requirementsStatus: "none", requirements: [{ description: "Fixture detail", awaitingActionFrom: "user" }], readyToReceivePayments: true }, true],
      [{ requirementsStatus: "none", requirements: [], readyToReceivePayments: false }, true],
      [{ requirementsStatus: "none", requirements: [], readyToReceivePayments: true }, false],
    ]) {
      fixture.index = 0;
      fixture.connect = { connected: true, providerName: "SYNTHETIC", status: {
        accountId: "acct_fixture", onboardingComplete: true, transferStatus: "active", ...status,
      } };
      const html = renderToStaticMarkup(React.createElement(StripeConnectPanel, { signedIn: true }));
      assert.match(html, /id="stripe-payouts"/);
      assert.equal(html.includes("Continue Stripe onboarding"), needsAction, JSON.stringify(status));
    }
  } finally {
    delete globalThis.__stripePanelNotice;
    assert.equal(dirname(scratch), tempRoot);
    assert.ok(scratch.startsWith(join(tempRoot, "tuveloz-stripe-panel-")));
    rmSync(scratch, { recursive: true, force: true });
  }
});
