import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { build } from "esbuild";

test("owner privacy decisions preserve a concurrent account-holder withdrawal", async t => {
  const repo = resolve(import.meta.dirname, "..");
  const scratch = mkdtempSync(join(tmpdir(), "tuveloz-privacy-owner-"));
  const database = new DatabaseSync(":memory:");
  const state = { owner: true, beforeWrite: null, notices: [], emails: [], env: {} };
  state.env.DB = { prepare(query) {
    let values = [];
    return {
      bind(...params) { values = params; return this; },
      async first() { return database.prepare(query).get(...values) ?? null; },
      async all() { return { results: database.prepare(query).all(...values) }; },
      async run() {
        if (/UPDATE privacy_requests/.test(query) && state.beforeWrite) {
          const competingWrite = state.beforeWrite;
          state.beforeWrite = null;
          competingWrite();
        }
        return { meta: { changes: Number(database.prepare(query).run(...values).changes) } };
      },
    };
  } };
  globalThis.__privacyOwnerReview = state;
  try {
    database.exec(readFileSync(join(repo, "drizzle/0034_privacy_center.sql"), "utf8"));
    const bundle = join(scratch, "review.cjs");
    await build({ absWorkingDir: repo, entryPoints: ["app/api/admin/privacy-requests/route.ts"],
      bundle: true, platform: "node", format: "cjs", outfile: bundle, target: "node22", logLevel: "silent",
      plugins: [{ name: "isolated-privacy-review", setup(builder) {
        builder.onResolve({ filter: /^(cloudflare:workers)$|\/(owner-auth|email-notifications|marketplace-notifications)$/ }, args => ({ path: args.path.split("/").at(-1), namespace: "fixture" }));
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({ loader: "js", contents: {
          "cloudflare:workers": "export const env = globalThis.__privacyOwnerReview.env;",
          "owner-auth": 'export const isVerifiedOwnerRequest=async()=>globalThis.__privacyOwnerReview.owner; export const getAuthenticatedEmail=()=>"owner@example.invalid";',
          "email-notifications": "export const sendMarketplaceUpdateEmail=async input=>{globalThis.__privacyOwnerReview.emails.push(input);};",
          "marketplace-notifications": "export const notifyMarketplaceAccount=async input=>{globalThis.__privacyOwnerReview.notices.push(input);};",
        }[args.path] }));
      } }] });
    const api = createRequire(import.meta.url)(bundle);
    const request = (status = "completed", origin = "https://tuveloz.invalid", note = "The requested review has been completed.") => new Request("https://tuveloz.invalid/api/admin/privacy-requests", {
      method: "POST", headers: { origin, "content-type": "application/json" },
      body: JSON.stringify({ id: "synthetic-request", status, resolutionNote: note }),
    });
    const seed = (status = "submitted") => {
      database.exec("DELETE FROM privacy_requests");
      database.prepare("INSERT INTO privacy_requests (id,email,role,request_type,status) VALUES (?,?,?,?,?)")
        .run("synthetic-request", "applicant@example.invalid", "provider", "access", status);
      state.notices.length = 0; state.emails.length = 0; state.beforeWrite = null; state.owner = true;
    };
    const row = () => database.prepare("SELECT * FROM privacy_requests WHERE id = ?").get("synthetic-request");

    await t.test("withdrawal after the owner's read is preserved and sends no completion notice", async () => {
      seed();
      state.beforeWrite = () => database.prepare("UPDATE privacy_requests SET status='withdrawn', resolution_note='Withdrawn by the signed-in account holder.' WHERE id=?")
        .run("synthetic-request");
      const response = await api.POST(request());
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
      assert.equal((await api.POST(request())).status, 409);
      assert.equal(row().status, "denied");
      assert.equal(row().resolution_note, "A different review decision was recorded.");
      assert.equal(state.notices.length, 0); assert.equal(state.emails.length, 0);
    });

    await t.test("a normal review still records the decision and notifies its account", async () => {
      seed();
      const response = await api.POST(request());
      assert.equal(response.status, 200);
      assert.equal(row().status, "completed");
      assert.ok(row().resolved_at);
      assert.match(row().resolution_note, /Owner reviewer: owner@example.invalid/);
      assert.equal(state.notices.length, 1); assert.equal(state.emails.length, 1);
      assert.equal(state.notices[0].email, "applicant@example.invalid");
      assert.equal(state.emails[0].recipientEmail, "applicant@example.invalid");
    });

    await t.test("existing withdrawal, invalid explanation, and unauthorized requests do not write or notify", async () => {
      seed("withdrawn");
      assert.equal((await api.POST(request())).status, 409);
      assert.equal(row().status, "withdrawn");
      seed();
      assert.equal((await api.POST(request("completed", "https://tuveloz.invalid", "short"))).status, 400);
      assert.equal((await api.POST(request("completed", "https://other.invalid"))).status, 403);
      state.owner = false;
      assert.equal((await api.POST(request())).status, 403);
      assert.equal(row().status, "submitted");
      assert.equal(state.notices.length, 0); assert.equal(state.emails.length, 0);
    });
  } finally {
    delete globalThis.__privacyOwnerReview;
    database.close();
    rmSync(scratch, { recursive: true, force: true });
  }
});
