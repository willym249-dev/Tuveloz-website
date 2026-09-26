import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { build } from "esbuild";

// Real notification routes and SQLite. Session identity and email delivery are
// fixture boundaries; this checks stored notices, not login or real email.
test("notification updates preserve account history and isolate account actions", async t => {
  const repo = resolve(import.meta.dirname, "..");
  const scratch = mkdtempSync(join(tmpdir(), "tuveloz-notifications-"));
  const db = new DatabaseSync(":memory:");
  const state = { session: null, env: { DB: { prepare(query) {
    let values = [];
    return {
      bind(...params) { values = params; return this; },
      async all() { return { results: db.prepare(query).all(...values) }; },
      async run() { return { meta: { changes: Number(db.prepare(query).run(...values).changes) } }; },
    };
  } } } };
  globalThis.__notificationFixture = state;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("No external calls allowed"); };
  try {
    for (const entry of JSON.parse(readFileSync(join(repo, "drizzle/meta/_journal.json"), "utf8")).entries) {
      for (const sql of readFileSync(join(repo, "drizzle", entry.tag + ".sql"), "utf8").split("--> statement-breakpoint")) {
        if (sql.trim()) db.exec(sql);
      }
    }
    const outfile = join(scratch, "route.cjs");
    await build({ absWorkingDir: repo, entryPoints: ["app/api/notifications/route.ts"], outfile,
      bundle: true, platform: "node", format: "cjs", logLevel: "silent",
      plugins: [{ name: "isolated-notifications", setup(builder) {
        builder.onResolve({ filter: /^(cloudflare:workers)$|\/account-auth$|\/email-notifications$/ }, args => ({ path: args.path, namespace: "fixture" }));
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({ loader: "js", contents: args.path === "cloudflare:workers"
          ? "export const env = globalThis.__notificationFixture.env;"
          : args.path.endsWith("account-auth")
            ? `export async function getAccountSession() { return globalThis.__notificationFixture.session; }
               export function isSameOriginRequest(r) { return r.headers.get("origin") === new URL(r.url).origin; }`
            : "export async function flushPendingEmailNotifications() {} export async function sendMarketplaceUpdateEmail() { throw new Error('No mail in fixture'); }" }));
      } }],
    });
    const api = createRequire(import.meta.url)(outfile);
    const origin = "https://tuveloz.invalid";
    const get = () => api.GET(new Request(origin + "/api/notifications"));
    const post = (body, requestOrigin = origin) => api.POST(new Request(origin + "/api/notifications", {
      method: "POST", headers: { origin: requestOrigin, "content-type": "application/json" }, body: JSON.stringify(body),
    }));
    const rows = () => db.prepare("SELECT * FROM account_notifications ORDER BY id").all();
    const seed = (id, email, role, eventKey, readAt = "") => db.prepare(
      "INSERT INTO account_notifications (id,event_key,email,role,title,body,href,read_at,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
    ).run(id, eventKey, email, role, "Old welcome", "Request vehicle work and appointments now", "/post-job", readAt, "2026-08-01 12:00:00");

    await t.test("signed-out requests cannot read or change notifications", async () => {
      assert.equal((await get()).status, 401);
      assert.equal((await post({ action: "mark-all-read" })).status, 401);
      assert.equal(rows().length, 0);
    });
    await t.test("corrects an existing welcome without resetting its ID, date or read state", async () => {
      seed("old-customer", "CUSTOMER@example.invalid", "customer", "welcome:customer:customer@example.invalid", "2026-08-02T12:00:00Z");
      state.session = { email: "customer@example.invalid", role: "customer" };
      const result = await (await get()).json();
      assert.equal(result.notifications.length, 1);
      assert.equal(result.notifications[0].href, "/customer");
      assert.match(result.notifications[0].body, /review your details/);
      assert.doesNotMatch(result.notifications[0].body, /request vehicle work|appointments/i);
      assert.equal(result.notifications[0].id, "old-customer");
      assert.equal(result.notifications[0].createdAt, "2026-08-01 12:00:00");
      assert.equal(result.notifications[0].readAt, "2026-08-02T12:00:00Z");
      assert.equal(result.unreadCount, 0);
      await get(); assert.equal(rows().length, 1, "repeat reads must not duplicate welcome");
    });
    await t.test("provider welcome links to application workspace without implying approval", async () => {
      state.session = { email: "customer@example.invalid", role: "provider" };
      const result = await (await get()).json();
      assert.equal(result.notifications.length, 1);
      assert.equal(result.notifications[0].href, "/provider-jobs");
      assert.match(result.notifications[0].body, /review your application/);
      assert.doesNotMatch(result.notifications[0].body, /approved services|appointments/);
      assert.equal(result.unreadCount, 1);
    });
    await t.test("same-email roles and other accounts retain their own read state", async () => {
      seed("customer-notice", "customer@example.invalid", "customer", "other-customer-event");
      seed("other-notice", "other@example.invalid", "provider", "other-provider-event");
      assert.equal((await post({ action: "mark-read", id: "customer-notice" })).status, 200);
      assert.equal((await post({ action: "mark-read", id: "other-notice" })).status, 200);
      await post({ action: "mark-all-read" });
      assert.equal(rows().find(row => row.id === "customer-notice").read_at, "");
      assert.equal(rows().find(row => row.id === "other-notice").read_at, "");
      assert.equal((await (await get()).json()).unreadCount, 0);
    });
    await t.test("invalid actions and foreign origins leave stored notices unchanged", async () => {
      const before = rows();
      for (const body of [null, [], {}, { action: "wrong" }, { action: "mark-read" }]) assert.equal((await post(body)).status, 400);
      assert.equal((await post({ action: "mark-all-read" }, "https://other.invalid")).status, 403);
      assert.deepEqual(rows(), before);
    });
    await t.test("a conflicting event key cannot overwrite another account's notice", async () => {
      seed("conflict", "other@example.invalid", "provider", "welcome:customer:collision@example.invalid");
      const before = rows().find(row => row.id === "conflict");
      state.session = { email: "collision@example.invalid", role: "customer" };
      assert.equal((await (await get()).json()).notifications.length, 0);
      assert.deepEqual(rows().find(row => row.id === "conflict"), before);
    });
  } finally {
    globalThis.fetch = originalFetch; delete globalThis.__notificationFixture;
    db.close(); rmSync(scratch, { recursive: true, force: true });
  }
});
