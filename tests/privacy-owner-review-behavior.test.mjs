import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { build } from "esbuild";

test("owner privacy decisions preserve final records and concurrent changes", async t => {
  const repo = resolve(import.meta.dirname, "..");
  const scratch = mkdtempSync(join(tmpdir(), "tuveloz-privacy-owner-"));
  const database = new DatabaseSync(":memory:");
  const state = { owner: true, beforeWrite: null, loseBatchReply: false, failDelivery: false,
    failRefresh: false, committed: false, emails: [], env: {} };
  state.env.DB = { prepare(query) {
    let values = [];
    return {
      bind(...params) { values = params; return this; },
      async first() { return database.prepare(query).get(...values) ?? null; },
      async all() {
        if (state.failRefresh && state.committed) throw new Error("Synthetic list refresh failure");
        return { results: database.prepare(query).all(...values) };
      },
      async run() {
        if (/UPDATE privacy_requests/.test(query) && state.beforeWrite) {
          const competingWrite = state.beforeWrite;
          state.beforeWrite = null;
          competingWrite();
        }
        return { meta: { changes: Number(database.prepare(query).run(...values).changes) } };
      },
    };
  }, async batch(statements) {
    if (state.beforeWrite) {
      const competingWrite = state.beforeWrite;
      state.beforeWrite = null;
      competingWrite();
    }
    database.exec("BEGIN");
    let results;
    try {
      results = [];
      for (const statement of statements) results.push(await statement.run());
      database.exec("COMMIT");
      state.committed = true;
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
    if (state.loseBatchReply) {
      state.loseBatchReply = false;
      throw new Error("Synthetic lost reply after database commit");
    }
    return results;
  } };
  globalThis.__privacyOwnerReview = state;
  try {
    database.exec(readFileSync(join(repo, "drizzle/0034_privacy_center.sql"), "utf8"));
    database.exec(readFileSync(join(repo, "drizzle/0030_email_notification_outbox.sql"), "utf8"));
    const notificationSchema = readFileSync(join(repo, "drizzle/0032_marketplace_tools.sql"), "utf8")
      .split("--> statement-breakpoint")
      .filter(sql => /^CREATE (TABLE `account_notifications`|(?:UNIQUE )?INDEX `account_notifications_)/.test(sql.trim()));
    assert.equal(notificationSchema.length, 3);
    notificationSchema.forEach(sql => database.exec(sql));
    const fenceSchema = readFileSync(join(repo, "drizzle/0073_authentication_recovery_write_fence.sql"), "utf8")
      .split("--> statement-breakpoint")
      .filter(sql => /CREATE TABLE privacy_recovery_fences|CREATE TRIGGER privacy_pause_privacy_requests_update/.test(sql));
    assert.equal(fenceSchema.length, 2);
    fenceSchema.forEach(sql => database.exec(sql));
    Object.defineProperty(state, "notices", { get: () => database.prepare("SELECT * FROM account_notifications").all() });
    const bundle = join(scratch, "review.cjs");
    await build({ absWorkingDir: repo, entryPoints: ["app/api/admin/privacy-requests/route.ts"],
      bundle: true, platform: "node", format: "cjs", outfile: bundle, target: "node22", logLevel: "silent",
      plugins: [{ name: "isolated-privacy-review", setup(builder) {
        builder.onResolve({ filter: /^(cloudflare:workers)$|\/(owner-auth|email-notifications|marketplace-notifications)$/ }, args => ({ path: args.path.split("/").at(-1), namespace: "fixture" }));
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({ loader: "js", contents: {
          "cloudflare:workers": "export const env = globalThis.__privacyOwnerReview.env;",
          "owner-auth": 'export const isVerifiedOwnerRequest=async()=>globalThis.__privacyOwnerReview.owner; export const getAuthenticatedEmail=()=>"owner@example.invalid";',
          "email-notifications": "export const sendMarketplaceUpdateEmail=async input=>{const state=globalThis.__privacyOwnerReview; state.emails.push(input); if(state.failDelivery) throw new Error('Synthetic email transport failure');};",
          "marketplace-notifications": "export const notifyMarketplaceAccount=async input=>{globalThis.__privacyOwnerReview.notices.push(input);};",
        }[args.path] }));
      } }] });
    const api = createRequire(import.meta.url)(bundle);
    const request = async (status = "completed", origin = "https://tuveloz.invalid", note = "The requested review has been completed.") => {
      const listing = await api.GET(new Request("https://tuveloz.invalid/api/admin/privacy-requests"));
      const review = (await listing.json()).requests?.find(item => item.id === "synthetic-request");
      return new Request("https://tuveloz.invalid/api/admin/privacy-requests", {
        method: "POST", headers: { origin, "content-type": "application/json" },
        body: JSON.stringify({ id: "synthetic-request", status, resolutionNote: note, reviewVersion: review?.reviewVersion }),
      });
    };
    const seed = (status = "submitted") => {
      database.exec("DROP TRIGGER IF EXISTS synthetic_failure; DELETE FROM privacy_recovery_fences; DELETE FROM privacy_requests; DELETE FROM account_notifications; DELETE FROM email_notification_outbox");
      database.prepare("INSERT INTO privacy_requests (id,email,role,request_type,status) VALUES (?,?,?,?,?)")
        .run("synthetic-request", "applicant@example.invalid", "provider", "access", status);
      state.emails.length = 0; state.beforeWrite = null; state.owner = true;
      state.loseBatchReply = false; state.failDelivery = false;
      state.failRefresh = false; state.committed = false;
    };
    const row = () => database.prepare("SELECT * FROM privacy_requests WHERE id = ?").get("synthetic-request");
    const queued = () => database.prepare("SELECT * FROM email_notification_outbox").all();
    t.afterEach(() => {
      assert.equal(queued().length, state.notices.length, "email and in-app notices remain paired");
    });

    await t.test("completed and denied records cannot be rewritten or reopened", async () => {
      for (const finalStatus of ["completed", "denied"]) {
        for (const nextStatus of ["in-review", "completed", "denied"]) {
          seed(finalStatus);
          const before = row();
          assert.equal((await api.POST(await request(nextStatus))).status, 409);
          assert.deepEqual(row(), before);
          assert.equal(state.notices.length, 0); assert.equal(state.emails.length, 0);
        }
      }
    });

    await t.test("same-status changes to the reviewed record are not overwritten or sent to a stale recipient", async () => {
      for (const [column, value] of [
        ["resolution_note", "Another owner review saved in the same second."],
        ["details", "Changed scope from the account holder."],
        ["email", "other@example.invalid"],
        ["role", "customer"],
        ["request_type", "account-closure"],
        ["related_request_id", "another-case"],
        ["identity_source", "support-verified"],
        ["updated_at", "2030-01-01 00:00:00"],
        ["created_at", "2030-01-01 00:00:00"],
        ["resolved_at", "2030-01-01 00:00:00"],
      ]) {
        seed("in-review");
        state.beforeWrite = () => database.prepare(`UPDATE privacy_requests SET ${column}=? WHERE id=?`)
          .run(value, "synthetic-request");
        assert.equal((await api.POST(await request())).status, 409, column);
        assert.equal(row()[column], value);
        assert.equal(row().status, "in-review");
        assert.equal(state.notices.length, 0); assert.equal(state.emails.length, 0);
      }
    });

    await t.test("a stale owner form is rejected even when the status and timestamp did not change", async () => {
      seed("in-review");
      const staleRequest = await request();
      database.prepare("UPDATE privacy_requests SET resolution_note=? WHERE id=?")
        .run("A more recent review with the same timestamp.", "synthetic-request");
      const before = row();
      assert.equal((await api.POST(staleRequest)).status, 409);
      assert.deepEqual(row(), before);
      assert.equal(state.notices.length, 0); assert.equal(state.emails.length, 0);
    });

    await t.test("a missing or forged review version cannot save a decision", async () => {
      for (const version of [undefined, "", "a".repeat(64), "invalid", 42]) {
        seed();
        const body = await (await request()).json();
        body.reviewVersion = version;
        const response = await api.POST(new Request("https://tuveloz.invalid/api/admin/privacy-requests", {
          method: "POST", headers: { origin: "https://tuveloz.invalid", "content-type": "application/json" },
          body: JSON.stringify(body),
        }));
        assert.equal(response.status, 409);
        assert.equal(row().status, "submitted");
        assert.equal(state.notices.length, 0); assert.equal(state.emails.length, 0);
      }
    });

    await t.test("withdrawal after the owner's read is preserved and sends no completion notice", async () => {
      seed();
      state.beforeWrite = () => database.prepare("UPDATE privacy_requests SET status='withdrawn', resolution_note='Withdrawn by the signed-in account holder.' WHERE id=?")
        .run("synthetic-request");
      const response = await api.POST(await request());
      assert.equal(response.status, 409);
      assert.equal(response.headers.get("cache-control"), "private, no-store");
      assert.match((await response.json()).error, /Refresh the page/);
      assert.equal(row().status, "withdrawn");
      assert.equal(row().resolution_note, "Withdrawn by the signed-in account holder.");
      assert.equal(state.notices.length, 0); assert.equal(state.emails.length, 0);
    });

    await t.test("a competing review decision is not overwritten or announced twice", async () => {
      seed("in-review");
      state.beforeWrite = () => database.prepare("UPDATE privacy_requests SET status='denied', resolution_note='A different review decision was recorded.' WHERE id=?")
        .run("synthetic-request");
      assert.equal((await api.POST(await request())).status, 409);
      assert.equal(row().status, "denied");
      assert.equal(row().resolution_note, "A different review decision was recorded.");
      assert.equal(state.notices.length, 0); assert.equal(state.emails.length, 0);
    });

    await t.test("a normal review still records the decision and notifies its account", async () => {
      seed();
      const response = await api.POST(await request());
      assert.equal(response.status, 200);
      assert.equal(row().status, "completed");
      assert.ok(row().resolved_at);
      assert.match(row().resolution_note, /Owner reviewer: owner@example.invalid/);
      assert.equal(state.notices.length, 1); assert.equal(state.emails.length, 1);
      assert.equal(state.notices[0].email, "applicant@example.invalid");
      assert.equal(state.emails[0].recipientEmail, "applicant@example.invalid");
      assert.equal(queued().length, 1);
      assert.equal(queued()[0].event_key, "marketplace:privacy-status-email:synthetic-request:completed");
      assert.equal(queued()[0].text_body, state.emails[0].lines.join("\n"));
      assert.equal(queued()[0].status, "pending", "queueing is not delivery");
      assert.equal(queued()[0].attempts, 0);
    });

    await t.test("an in-app notice failure leaves the decision open and retryable", async () => {
      seed();
      const before = row();
      database.exec("CREATE TRIGGER synthetic_failure BEFORE INSERT ON account_notifications BEGIN SELECT RAISE(ABORT, 'Synthetic notice write failure'); END");
      assert.equal((await api.POST(await request())).status, 400);
      assert.deepEqual(row(), before);
      assert.equal(state.notices.length, 0); assert.equal(queued().length, 0); assert.equal(state.emails.length, 0);
      database.exec("DROP TRIGGER synthetic_failure");
      assert.equal((await api.POST(await request())).status, 200);
      assert.equal(row().status, "completed");
    });

    await t.test("an email queue failure rolls back both the notice and decision", async () => {
      seed();
      const before = row();
      database.exec("CREATE TRIGGER synthetic_failure BEFORE INSERT ON email_notification_outbox BEGIN SELECT RAISE(ABORT, 'Synthetic outbox write failure'); END");
      assert.equal((await api.POST(await request())).status, 400);
      assert.deepEqual(row(), before);
      assert.equal(state.notices.length, 0); assert.equal(queued().length, 0); assert.equal(state.emails.length, 0);
    });

    await t.test("a decision write failure rolls back both previously queued notices", async () => {
      seed("in-review");
      const before = row();
      database.exec("INSERT INTO privacy_recovery_fences (generation,paused,case_reference,changed_by) VALUES (1,1,'synthetic-test','owner@example.invalid')");
      assert.equal((await api.POST(await request("denied"))).status, 400);
      assert.deepEqual(row(), before);
      assert.equal(state.notices.length, 0); assert.equal(queued().length, 0); assert.equal(state.emails.length, 0);
    });

    await t.test("a lost database reply preserves final decisions and durable notices without duplicates", async () => {
      for (const status of ["completed", "denied"]) {
        seed("in-review");
        const original = await request(status);
        const retry = original.clone();
        state.loseBatchReply = true;
        const response = await api.POST(original);
        assert.equal(response.status, 400);
        assert.match((await response.json()).error, /Unable to confirm whether your review was saved/);
        const committed = row();
        assert.equal(committed.status, status);
        assert.equal(state.notices.length, 1); assert.equal(queued().length, 1);
        assert.equal(queued()[0].status, "pending");
        assert.equal(state.emails.length, 0, "immediate delivery was interrupted");
        assert.equal((await api.POST(retry)).status, 409);
        assert.deepEqual(row(), committed);
        assert.equal(state.notices.length, 1); assert.equal(queued().length, 1);
      }
    });

    await t.test("email transport failure does not turn a saved decision into a failed save", async () => {
      seed();
      state.failDelivery = true;
      assert.equal((await api.POST(await request())).status, 200);
      assert.equal(row().status, "completed");
      assert.equal(state.notices.length, 1); assert.equal(queued().length, 1);
      assert.equal(queued()[0].status, "pending");
      assert.equal(queued()[0].sent_at, "");
    });

    await t.test("a failed list refresh reports that the decision was saved", async () => {
      seed();
      const submission = await request();
      state.failRefresh = true;
      const response = await api.POST(submission);
      assert.equal(response.status, 409);
      assert.match((await response.json()).error, /Your decision was saved.*Reload the page/);
      assert.equal(row().status, "completed");
      assert.equal(state.notices.length, 1); assert.equal(queued().length, 1);
      assert.equal(state.emails.length, 1);
    });

    await t.test("repeated in-review saves preserve existing notifications and do not duplicate them", async () => {
      seed();
      assert.equal((await api.POST(await request("in-review"))).status, 200);
      const initialNotice = state.notices[0];
      const initialEmail = queued()[0];
      assert.equal((await api.POST(await request("in-review", "https://tuveloz.invalid", "Additional review evidence recorded."))).status, 200);
      assert.match(row().resolution_note, /Additional review evidence/);
      assert.equal(state.notices.length, 1); assert.equal(queued().length, 1);
      assert.deepEqual(state.notices[0], initialNotice);
      assert.deepEqual(queued()[0], initialEmail);
      assert.equal((await api.POST(await request("denied"))).status, 200);
      assert.equal(state.notices.length, 2); assert.equal(queued().length, 2);
    });

    await t.test("both durable notices use the normalized account address", async () => {
      seed();
      database.prepare("UPDATE privacy_requests SET email=? WHERE id=?")
        .run(" Applicant@Example.invalid ", "synthetic-request");
      assert.equal((await api.POST(await request())).status, 200);
      assert.equal(state.notices[0].email, "applicant@example.invalid");
      assert.equal(queued()[0].recipient_email, "applicant@example.invalid");
      assert.equal(state.emails[0].recipientEmail, "applicant@example.invalid");
    });

    await t.test("existing withdrawal, invalid explanation, and unauthorized requests do not write or notify", async () => {
      seed("withdrawn");
      assert.equal((await api.POST(await request())).status, 409);
      assert.equal(row().status, "withdrawn");
      seed();
      assert.equal((await api.POST(await request("completed", "https://tuveloz.invalid", "short"))).status, 400);
      assert.equal((await api.POST(await request("completed", "https://other.invalid"))).status, 403);
      state.owner = false;
      assert.equal((await api.POST(await request())).status, 403);
      assert.equal(row().status, "submitted");
      assert.equal(state.notices.length, 0); assert.equal(state.emails.length, 0);
    });
  } finally {
    delete globalThis.__privacyOwnerReview;
    database.close();
    rmSync(scratch, { recursive: true, force: true });
  }
});
