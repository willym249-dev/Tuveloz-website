import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { build } from "esbuild";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";

test("privacy decisions and notifications commit together in local Cloudflare D1", { timeout: 120000 }, async t => {
  const repo = resolve(import.meta.dirname, "..");
  const schema = new DatabaseSync(":memory:");
  let runtime;
  try {
    const journal = JSON.parse(readFileSync(join(repo, "drizzle/meta/_journal.json"), "utf8"));
    for (const entry of journal.entries) {
      schema.exec(readFileSync(join(repo, "drizzle", `${entry.tag}.sql`), "utf8"));
    }
    const definitions = schema.prepare(
      "SELECT sql FROM sqlite_schema WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 ELSE 2 END, name",
    ).all();
    const compiled = await build({
      absWorkingDir: repo,
      stdin: {
        resolveDir: repo, loader: "ts", contents: `
          import { GET, POST } from "./app/api/admin/privacy-requests/route";
          export default { async fetch(request) {
            return request.method === "GET" ? GET(request) : POST(request);
          } };
        `,
      },
      bundle: true, platform: "browser", format: "esm", external: ["cloudflare:workers"],
      write: false, logLevel: "silent",
      plugins: [{
        name: "synthetic-owner-and-mail",
        setup(builder) {
          builder.onResolve({ filter: /\/(owner-auth|email-notifications)$/ }, args => ({
            path: args.path.split("/").at(-1), namespace: "fixture",
          }));
          builder.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({
            loader: "js",
            contents: args.path === "owner-auth"
              ? `export const isVerifiedOwnerRequest=async request=>request.headers.get("x-fixture-owner")==="yes";
                 export const getAuthenticatedEmail=()=>"owner@example.invalid";`
              : `export const sendMarketplaceUpdateEmail=async()=>{throw Error("Synthetic delivery interruption");};`,
          }));
        },
      }],
    });
    // Ephemeral local storage and a real D1 batch implementation. Mail transport
    // deliberately fails after commit; no credentials or remote bindings exist.
    runtime = new Miniflare(convertV4MiniflareOptions({
      host: "127.0.0.1", port: 0,
      workers: [{
        name: "local-privacy-decision-fixture", modules: true,
        script: compiled.outputFiles[0].text, compatibilityDate: "2026-07-27",
        d1Databases: ["DB"],
        outboundService: () => { throw Error("External traffic forbidden"); },
      }],
    }));
    const db = await runtime.getD1Database("DB");
    for (let i = 0; i < definitions.length; i += 25) {
      await db.batch(definitions.slice(i, i + 25).map(row => db.prepare(row.sql)));
    }
    const url = "https://tuveloz.invalid/api/admin/privacy-requests";
    const headers = {
      origin: "https://tuveloz.invalid", "content-type": "application/json", "x-fixture-owner": "yes",
    };
    const prepareReview = async (id, status = "completed") => {
      await db.prepare("INSERT INTO privacy_requests (id,email,role,request_type,status) VALUES (?,?, 'provider','access','in-review')")
        .bind(id, `${id}@example.invalid`).run();
      const response = await runtime.dispatchFetch(url, { headers });
      assert.equal(response.status, 200, await response.clone().text());
      const row = (await response.json()).requests.find(item => item.id === id);
      assert.match(row.reviewVersion, /^[a-f0-9]{64}$/);
      return { id, status, reviewVersion: row.reviewVersion, resolutionNote: "The synthetic privacy review is complete." };
    };
    const submit = input => runtime.dispatchFetch(url, { method: "POST", headers, body: JSON.stringify(input) });
    const requestRow = id => db.prepare("SELECT * FROM privacy_requests WHERE id=?").bind(id).first();
    const notices = async (id, status) => {
      const notice = await db.prepare("SELECT * FROM account_notifications WHERE event_key=?")
        .bind(`privacy-owner-status:${id}:${status}`).all();
      const email = await db.prepare("SELECT * FROM email_notification_outbox WHERE event_key=?")
        .bind(`marketplace:privacy-status-email:${id}:${status}`).all();
      return { notices: notice.results, emails: email.results };
    };

    await t.test("completed and denied decisions remain final with one durable pair after a replay", async () => {
      for (const status of ["completed", "denied"]) {
        const input = await prepareReview(`runtime-decision-${status}`, status);
        const response = await submit(input);
        assert.equal(response.status, 200, await response.clone().text());
        const saved = await requestRow(input.id);
        assert.equal(saved.status, status);
        assert.match(saved.resolution_note, /Owner reviewer: owner@example.invalid/);
        assert.ok(saved.resolved_at);
        const pair = await notices(input.id, status);
        assert.equal(pair.notices.length, 1);
        assert.equal(pair.emails.length, 1);
        assert.equal(pair.emails[0].status, "pending");
        assert.equal(pair.emails[0].attempts, 0);
        assert.equal(pair.emails[0].sent_at, "");
        assert.equal(pair.emails[0].recipient_email, `${input.id}@example.invalid`);
        assert.match(pair.emails[0].text_body, /The synthetic privacy review is complete/);
        assert.equal((await submit(input)).status, 409);
        assert.deepEqual(await requestRow(input.id), saved);
        assert.deepEqual(await notices(input.id, status), pair);
      }
    });

    await t.test("an outbox insert failure rolls back the earlier notice and leaves the decision open", async () => {
      const input = await prepareReview("runtime-outbox-failure");
      const before = await requestRow(input.id);
      await db.prepare(`CREATE TRIGGER synthetic_outbox_failure BEFORE INSERT ON email_notification_outbox
        WHEN NEW.event_key = 'marketplace:privacy-status-email:runtime-outbox-failure:completed'
        BEGIN SELECT RAISE(ABORT, 'Synthetic outbox insertion failure'); END`).run();
      assert.equal((await submit(input)).status, 400);
      assert.deepEqual(await requestRow(input.id), before);
      assert.deepEqual(await notices(input.id, input.status), { notices: [], emails: [] });
      await db.prepare("DROP TRIGGER synthetic_outbox_failure").run();
      assert.equal((await submit(input)).status, 200);
      const pair = await notices(input.id, input.status);
      assert.equal(pair.notices.length, 1);
      assert.equal(pair.emails.length, 1);
    });

    await t.test("the actual recovery fence rolls back both inserts when the final update fails", async () => {
      const input = await prepareReview("runtime-fenced-decision", "denied");
      const before = await requestRow(input.id);
      await db.prepare("INSERT INTO privacy_recovery_fences (generation,paused,case_reference,changed_by) VALUES (1,1,'RUNTIME-PRIVACY-FENCE','owner@example.invalid')").run();
      assert.equal((await submit(input)).status, 400);
      assert.deepEqual(await requestRow(input.id), before);
      assert.deepEqual(await notices(input.id, input.status), { notices: [], emails: [] });
      await db.prepare("INSERT INTO privacy_recovery_fences (generation,paused,case_reference,changed_by) VALUES (2,0,'RUNTIME-PRIVACY-FENCE','owner@example.invalid')").run();
      assert.equal((await submit(input)).status, 200);
      assert.equal((await requestRow(input.id)).status, "denied");
      const pair = await notices(input.id, input.status);
      assert.equal(pair.notices.length, 1);
      assert.equal(pair.emails.length, 1);
    });
  } finally {
    if (runtime) await runtime.dispose();
    schema.close();
  }
});
