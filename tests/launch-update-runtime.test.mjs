import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { build } from "esbuild";
import { drizzle } from "drizzle-orm/sqlite-proxy";

// Actual sequence selection, outbox SQL, consent checks and transport retries.
// Only runtime bindings and the email transport are fixtures. No network.
test("launch updates survive interruptions and respect current consent", async t => {
  const repo = resolve(import.meta.dirname, "..");
  const scratch = mkdtempSync(join(resolve(tmpdir()), "tuveloz-launch-mail-"));
  const database = new DatabaseSync(":memory:");
  const originalFetch = globalThis.fetch, originalError = console.error;
  const outbound = [], errors = [];
  const initialTime = Date.parse("2026-10-06T12:00:00.000Z");
  t.mock.timers.enable({ apis: ["Date"], now: initialTime });
  const advance = days => t.mock.timers.setTime(Date.now() + days * 86_400_000);
  const state = { db: null, failInsertFor: "", failCursor: false, beforeCursor: null,
    afterCandidateSelection: null,
    failTransport: false, missingReceipt: false, env: {
      SITE_URL: "https://tuveloz.invalid", LAUNCH_UPDATES_POSTAL_ADDRESS: "SYNTHETIC MAILBOX - LOCAL TEST ONLY",
      RESEND_API_KEY: "synthetic-no-credential", RESEND_FROM_EMAIL: "Tuveloz <sender@example.invalid>",
    } };
  globalThis.__launchUpdateRuntime = state;
  const ago = days => new Date(Date.now() - days * 86_400_000).toISOString();
  const subscriber = (name, days = 1, changes = {}) => {
    const email = changes.email ?? `${name}@example.invalid`;
    const values = { email, source: "local-test", language: "en", consent_text: "SYNTHETIC OPT-IN",
      consent_version: "test-version", consented_at: ago(days), unsubscribed_at: "",
      unsubscribe_token: `synthetic-token-${name}`, last_step_sent: -1, last_step_sent_at: "", ...changes };
    const columns = Object.keys(values);
    database.prepare(`INSERT INTO launch_update_subscribers (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})`)
      .run(...Object.values(values));
    return email;
  };
  const cursor = email => database.prepare("SELECT last_step_sent FROM launch_update_subscribers WHERE email=?").get(email).last_step_sent;
  const mail = () => database.prepare("SELECT * FROM email_notification_outbox ORDER BY created_at,id").all();
  const seedStep = (email, step, changes = {}) => {
    const consent = database.prepare("SELECT consented_at FROM launch_update_subscribers WHERE email=?").get(email).consented_at;
    const values = { id: crypto.randomUUID(), event_key: `launch-updates:v2:${step}:${consent}:${email}`,
      recipient_email: email, subject: `Synthetic step ${step}`, text_body: "LOCAL TEST ONLY",
      status: "pending", sent_at: "", created_at: ago(60), ...changes };
    const columns = Object.keys(values);
    database.prepare(`INSERT INTO email_notification_outbox (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})`)
      .run(...Object.values(values));
    return values.id;
  };
  const reset = () => {
    t.mock.timers.setTime(initialTime);
    database.exec("DELETE FROM email_notification_outbox; DELETE FROM launch_update_subscribers;");
    outbound.length = 0; errors.length = 0;
    state.failInsertFor = ""; state.failCursor = false; state.beforeCursor = null;
    state.afterCandidateSelection = null;
    state.failTransport = false; state.missingReceipt = false;
    state.env.LAUNCH_UPDATES_POSTAL_ADDRESS = "SYNTHETIC MAILBOX - LOCAL TEST ONLY";
  };
  try {
    console.error = (...args) => errors.push(args);
    globalThis.fetch = async (url, options) => {
      assert.equal(String(url), "https://api.resend.com/emails");
      assert.ok(options.headers["Idempotency-Key"].length <= 256, "Resend key length limit");
      outbound.push({ key: options.headers["Idempotency-Key"], body: JSON.parse(options.body) });
      if (state.failTransport) return new Response("Synthetic outage", { status: 503 });
      return Response.json(state.missingReceipt ? {} : { id: `synthetic-receipt-${outbound.length}` });
    };
    for (const entry of JSON.parse(readFileSync(join(repo, "drizzle/meta/_journal.json"), "utf8")).entries) {
      for (const statement of readFileSync(join(repo, "drizzle", entry.tag + ".sql"), "utf8").split("--> statement-breakpoint")) {
        if (statement.trim()) database.exec(statement);
      }
    }
    state.db = drizzle(async (query, params, method) => {
      if (state.failInsertFor && query.startsWith('insert into "email_notification_outbox"')
        && params.includes(state.failInsertFor)) throw Error("Synthetic enqueue outage");
      if (query.startsWith('update "launch_update_subscribers"')) {
        if (state.failCursor) throw Error("Synthetic cursor outage");
        if (state.beforeCursor) { const change = state.beforeCursor; state.beforeCursor = null; change(); }
      }
      if (method === "run") { database.prepare(query).run(...params); return { rows: [] }; }
      database.exec("PRAGMA short_column_names=OFF; PRAGMA full_column_names=ON;");
      try {
        const statement = database.prepare(query);
        const rows = method === "get" ? Object.values(statement.get(...params) ?? {})
          : statement.all(...params).map(row => Object.values(row));
        if (state.afterCandidateSelection && query.startsWith('select "event_key" from "email_notification_outbox"')) {
          const change = state.afterCandidateSelection; state.afterCandidateSelection = null; change();
        }
        return { rows };
      } finally { database.exec("PRAGMA short_column_names=ON; PRAGMA full_column_names=OFF;"); }
    });
    const bundle = join(scratch, "launch.cjs");
    await build({ absWorkingDir: repo, stdin: { contents: `
      export { processDueLaunchUpdates } from "./lib/launch-update-delivery";
      export { flushPendingEmailNotifications } from "./lib/email-notifications";
    `, resolveDir: repo, loader: "ts" }, bundle: true, platform: "node", format: "cjs", outfile: bundle,
      target: "node22", logLevel: "silent", plugins: [{ name: "local-bindings", setup(builder) {
        builder.onResolve({ filter: /^cloudflare:workers$/ }, () => ({ path: "env", namespace: "fixture" }));
        builder.onResolve({ filter: /(?:^|\/)db$/ }, args => args.path.startsWith(".") ? { path: "db", namespace: "fixture" } : null);
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({ loader: "js", contents: args.path === "env"
          ? "export const env = globalThis.__launchUpdateRuntime.env;" : "export function getDb() { return globalThis.__launchUpdateRuntime.db; }" }));
      } }] });
    const api = createRequire(import.meta.url)(bundle);

    await t.test("a long-disabled list cannot catch up on consecutive cron ticks", async () => {
      reset(); const email = subscriber("delayed-activation", 60);
      const consent = database.prepare("SELECT consented_at FROM launch_update_subscribers WHERE email=?").get(email).consented_at;
      await api.processDueLaunchUpdates(); await api.flushPendingEmailNotifications(20);
      assert.equal(outbound.length, 1);
      advance(15 / 1440);
      await api.processDueLaunchUpdates(); await api.flushPendingEmailNotifications(20);
      advance(15 / 1440);
      await api.processDueLaunchUpdates(); await api.flushPendingEmailNotifications(20);
      assert.equal(outbound.length, 1, "overdue follow-ups must not burst after activation");
      assert.equal(cursor(email), 0); assert.equal(mail().length, 1);
      assert.equal(database.prepare("SELECT consented_at FROM launch_update_subscribers WHERE email=?").get(email).consented_at, consent);
    });

    for (const initialAge of [0, 60]) {
      await t.test(`normal spacing survives an initial delay of ${initialAge} days`, async () => {
        reset(); const email = subscriber(`spacing-${initialAge}`, initialAge);
        const tick = async () => { await api.processDueLaunchUpdates(); await api.flushPendingEmailNotifications(20); };
        await tick(); assert.equal(outbound.length, 1);
        t.mock.timers.setTime(initialTime + 7 * 86_400_000 - 1);
        await tick(); assert.equal(outbound.length, 1, "wait the full seven days");
        t.mock.timers.setTime(initialTime + 7 * 86_400_000);
        await tick(); assert.equal(outbound.length, 2); assert.equal(cursor(email), 1);
        t.mock.timers.setTime(initialTime + 30 * 86_400_000 - 1);
        await tick(); assert.equal(outbound.length, 2, "wait the full 23 days after the second email");
        t.mock.timers.setTime(initialTime + 30 * 86_400_000);
        await tick(); assert.equal(outbound.length, 3); assert.equal(cursor(email), 2);
        advance(100); await tick(); assert.equal(outbound.length, 3);
      });
    }
    await t.test("a prolonged transport outage starts the wait only after confirmed acceptance", async () => {
      reset(); const email = subscriber("transport-delay", 60); state.failTransport = true;
      await api.processDueLaunchUpdates(); await api.flushPendingEmailNotifications(20);
      advance(40); await api.processDueLaunchUpdates();
      assert.equal(cursor(email), 0); assert.equal(mail().length, 1);
      state.failTransport = false; await api.flushPendingEmailNotifications(20);
      const acceptedAt = Date.now();
      await api.processDueLaunchUpdates(); assert.equal(mail().length, 1);
      t.mock.timers.setTime(acceptedAt + 7 * 86_400_000);
      await api.processDueLaunchUpdates(); state.missingReceipt = true;
      await api.flushPendingEmailNotifications(20);
      advance(40); await api.processDueLaunchUpdates();
      assert.equal(cursor(email), 1); assert.equal(mail().length, 2, "unconfirmed second email cannot unlock the third");
      state.missingReceipt = false; await api.flushPendingEmailNotifications(20);
      await api.processDueLaunchUpdates(); assert.equal(mail().length, 2);
      advance(23); await api.processDueLaunchUpdates(); await api.flushPendingEmailNotifications(20);
      assert.equal(mail().length, 3); assert.ok(mail().every(row => row.status === "sent"));
    });
    await t.test("already queued follow-ups wait for acceptance and cannot block security mail", async () => {
      reset(); const email = subscriber("queued-backlog", 60, { last_step_sent: 2 });
      seedStep(email, 0); seedStep(email, 1); seedStep(email, 2);
      database.prepare("INSERT INTO email_notification_outbox (id,event_key,recipient_email,subject,text_body,created_at) VALUES (?,?,?,?,?,?)")
        .run("security", "security:account_created:spacing", "owner@example.invalid", "Account alert", "LOCAL TEST ONLY", ago(1));
      await api.flushPendingEmailNotifications(20);
      assert.deepEqual(outbound.map(row => row.body.subject), ["Synthetic step 0", "Account alert"]);
      assert.ok(mail().filter(row => row.status !== "sent").every(row => row.attempts === 0));
      advance(7); await api.flushPendingEmailNotifications(1);
      assert.equal(outbound.at(-1).body.subject, "Synthetic step 1");
      advance(23); await api.flushPendingEmailNotifications(1);
      assert.equal(outbound.at(-1).body.subject, "Synthetic step 2");
      assert.ok(mail().every(row => row.status === "sent"));
    });
    await t.test("missing, invalid, failed, legacy or superseded receipts never unlock follow-ups", async () => {
      for (const variant of ["missing", "blank", "invalid", "before-consent", "future", "failed", "legacy", "old-consent", "wrong-recipient"]) {
        reset(); const email = subscriber(`receipt-${variant}`, 60, { last_step_sent: 0 });
        const changes = { status: "sent", sent_at: ago(40) };
        if (variant === "blank") changes.sent_at = "";
        if (variant === "invalid") changes.sent_at = "invalid";
        if (variant === "before-consent") changes.sent_at = ago(90);
        if (variant === "future") changes.sent_at = ago(-1);
        if (variant === "failed") changes.status = "failed";
        if (variant === "legacy") changes.event_key = `launch-updates:0:${email}`;
        if (variant === "old-consent") changes.event_key = `launch-updates:v2:0:${ago(90)}:${email}`;
        if (variant === "wrong-recipient") changes.recipient_email = "another@example.invalid";
        if (variant !== "missing") seedStep(email, 0, changes);
        const priorCount = mail().length;
        await api.processDueLaunchUpdates();
        assert.equal(mail().length, priorCount, variant); assert.equal(cursor(email), 0, variant);
        const pendingId = seedStep(email, 1);
        state.env.RESEND_API_KEY = ""; // No successful prior acceptance can be created by this flush.
        await api.flushPendingEmailNotifications(20);
        state.env.RESEND_API_KEY = "synthetic-no-credential";
        assert.equal(outbound.length, 0, variant);
        const pending = mail().find(row => row.id === pendingId);
        assert.equal(pending.status, "pending", variant); assert.equal(pending.attempts, 0, variant);
      }
    });
    await t.test("old subscribers waiting on spacing do not starve a new welcome", async () => {
      reset(); const waiting = subscriber("waiting-receipt", 60, { last_step_sent: 0 });
      seedStep(waiting, 0, { status: "sent", sent_at: ago(1) });
      const due = subscriber("fresh-welcome", 1);
      await api.processDueLaunchUpdates(1); await api.flushPendingEmailNotifications(1);
      assert.deepEqual(outbound.map(row => row.body.to[0]), [due]);
      assert.equal(cursor(waiting), 0);
    });
    await t.test("spacing is rechecked after the retry batch has been selected", async () => {
      reset(); const email = subscriber("recheck", 60, { last_step_sent: 1 });
      const receiptId = seedStep(email, 0, { status: "sent", sent_at: ago(10) });
      const followupId = seedStep(email, 1);
      let changed = false;
      state.afterCandidateSelection = () => {
        changed = true;
        database.prepare("UPDATE email_notification_outbox SET sent_at=? WHERE id=?").run(ago(0), receiptId);
      };
      await api.flushPendingEmailNotifications(20);
      assert.ok(changed, "fixture must change the receipt after batch selection");
      assert.equal(outbound.length, 0);
      assert.equal(mail().find(row => row.id === followupId).attempts, 0);
    });
    await t.test("fresh consent and opt-out keep their boundaries for delayed follow-ups", async () => {
      reset(); const email = subscriber("renewed-spacing", 90, { last_step_sent: 1 });
      seedStep(email, 0, { status: "sent", sent_at: ago(60) }); seedStep(email, 1);
      database.prepare("UPDATE launch_update_subscribers SET consented_at=?,last_step_sent=-1 WHERE email=?").run(ago(1), email);
      await api.processDueLaunchUpdates(); await api.flushPendingEmailNotifications(20);
      assert.equal(outbound.length, 1); assert.match(outbound[0].body.subject, /launch list/);
      advance(7); await api.processDueLaunchUpdates();
      database.prepare("UPDATE launch_update_subscribers SET unsubscribed_at=? WHERE email=?").run(ago(0), email);
      await api.flushPendingEmailNotifications(20); assert.equal(outbound.length, 1);
    });

    await t.test("missing postal address keeps the entire sequence inactive", async () => {
      reset(); const email = subscriber("no-address"); state.env.LAUNCH_UPDATES_POSTAL_ADDRESS = "";
      assert.equal((await api.processDueLaunchUpdates()).blocked, "missing_postal_address");
      assert.equal(cursor(email), -1); assert.equal(mail().length, 0); assert.equal(outbound.length, 0);
    });
    await t.test("failed enqueue does not advance the subscriber or block later candidates", async () => {
      reset(); const failed = subscriber("failed", 2), other = subscriber("other");
      state.failInsertFor = failed;
      await api.processDueLaunchUpdates();
      assert.equal(cursor(failed), -1, "an unsaved welcome must remain due");
      assert.equal(cursor(other), 0);
      state.failInsertFor = ""; await api.processDueLaunchUpdates(); await api.flushPendingEmailNotifications(20);
      assert.equal(cursor(failed), 0); assert.equal(mail().length, 2);
      assert.equal(outbound.length, 2);
    });
    await t.test("interruption after saving mail keeps one durable row and can recover the cursor", async () => {
      reset(); const email = subscriber("cursor"); state.failCursor = true;
      await api.processDueLaunchUpdates().catch(() => {});
      assert.equal(mail().length, 1, "mail must be saved before advancing"); assert.equal(cursor(email), -1);
      state.failCursor = false; await api.processDueLaunchUpdates(); await api.flushPendingEmailNotifications(20);
      assert.equal(mail().length, 1); assert.equal(cursor(email), 0); assert.equal(outbound.length, 1);
    });
    await t.test("an older subscriber waiting for day seven cannot starve a new welcome", async () => {
      reset(); const waiting = subscriber("waiting", 2, { last_step_sent: 0 });
      const due = subscriber("new", 1);
      await api.processDueLaunchUpdates(1); await api.flushPendingEmailNotifications(20);
      assert.equal(cursor(waiting), 0); assert.equal(cursor(due), 0);
      assert.deepEqual(outbound.map(row => row.body.to[0]), [due]);
    });
    await t.test("parallel sweeps keep one row and one accepted message", async () => {
      reset(); const email = subscriber("parallel");
      await Promise.all([api.processDueLaunchUpdates(), api.processDueLaunchUpdates()]);
      await api.flushPendingEmailNotifications(20);
      assert.equal(cursor(email), 0); assert.equal(mail().length, 1); assert.equal(outbound.length, 1);
    });
    await t.test("a stale sweep cannot overwrite a later cursor", async () => {
      reset(); const email = subscriber("race");
      state.beforeCursor = () => database.prepare("UPDATE launch_update_subscribers SET last_step_sent=1 WHERE email=?").run(email);
      await api.processDueLaunchUpdates(); assert.equal(cursor(email), 1);
    });
    await t.test("fresh consent restarts the welcome without reviving mail from older consent", async () => {
      reset(); const email = subscriber("returning", 40); state.failTransport = true;
      await api.processDueLaunchUpdates(); await api.flushPendingEmailNotifications(20);
      const oldKey = mail()[0].event_key;
      database.prepare("UPDATE launch_update_subscribers SET consented_at=?, last_step_sent=-1, language='es' WHERE email=?").run(ago(1), email);
      state.failTransport = false; outbound.length = 0;
      await api.processDueLaunchUpdates(); await api.flushPendingEmailNotifications(20);
      assert.equal(mail().length, 2); assert.equal(outbound.length, 1);
      assert.notEqual(outbound[0].key, oldKey); assert.match(outbound[0].body.subject, /lista de lanzamiento/);
      assert.match(outbound[0].body.text, /Cancelar la suscripción/);
    });
    await t.test("unsubscribing before a retry suppresses the queued message", async () => {
      reset(); const email = subscriber("opt-out"); state.failTransport = true;
      await api.processDueLaunchUpdates(); await api.flushPendingEmailNotifications(20);
      database.prepare("UPDATE launch_update_subscribers SET unsubscribed_at=? WHERE email=?").run(ago(0), email);
      state.failTransport = false; outbound.length = 0;
      await api.flushPendingEmailNotifications(20); assert.equal(outbound.length, 0);
      assert.notEqual(mail()[0].status, "sent");
    });
    await t.test("changed consent during queueing preserves the new signup and suppresses the old message", async () => {
      reset(); const email = subscriber("changed-consent", 40);
      state.beforeCursor = () => database.prepare("UPDATE launch_update_subscribers SET consented_at=?, last_step_sent=-1 WHERE email=?")
        .run(ago(1), email);
      await api.processDueLaunchUpdates();
      assert.equal(cursor(email), -1);
      await api.flushPendingEmailNotifications(20); assert.equal(outbound.length, 0);
      await api.processDueLaunchUpdates(); await api.flushPendingEmailNotifications(20);
      assert.equal(cursor(email), 0); assert.equal(outbound.length, 1); assert.equal(mail().length, 2);
    });
    await t.test("missing consent or invalid timestamps do not crowd out eligible subscribers", async () => {
      reset(); const incomplete = [
        subscriber("no-consent", 40, { consent_text: " " }),
        subscriber("no-version", 40, { consent_version: "" }),
        subscriber("bad-time", 40, { consented_at: "not-a-date" }),
      ];
      const eligible = subscriber("eligible");
      await api.processDueLaunchUpdates(1); await api.flushPendingEmailNotifications(20);
      assert.deepEqual(incomplete.map(cursor), [-1, -1, -1]);
      assert.deepEqual(outbound.map(row => row.body.to[0]), [eligible]);
    });
    await t.test("removing the postal address also blocks mail already queued", async () => {
      reset(); subscriber("paused-after-queue"); await api.processDueLaunchUpdates();
      state.env.LAUNCH_UPDATES_POSTAL_ADDRESS = " ";
      await api.flushPendingEmailNotifications(20);
      assert.equal(outbound.length, 0); assert.equal(mail()[0].attempts, 0); assert.equal(mail()[0].status, "pending");
    });
    await t.test("long email addresses retain distinct bounded delivery keys across retries", async () => {
      reset();
      const domain = `${"d".repeat(63)}.${"e".repeat(63)}.${"f".repeat(37)}.invalid`;
      const emails = ["a", "b"].map(tail => subscriber(`long-${tail}`, 1, {
        email: `${"x".repeat(63)}${tail}@${domain}`,
      }));
      state.missingReceipt = true;
      await api.processDueLaunchUpdates(); await api.flushPendingEmailNotifications(20);
      assert.ok(mail().every(row => row.event_key.length > 256));
      const firstKeys = new Map(outbound.map(row => [row.body.to[0], row.key]));
      assert.equal(new Set(firstKeys.values()).size, 2);
      assert.ok([...firstKeys.values()].every(key => /^tuveloz:sha256:[a-f0-9]{64}$/.test(key)));
      state.missingReceipt = false; outbound.length = 0;
      await api.flushPendingEmailNotifications(20);
      assert.deepEqual(new Set(outbound.map(row => row.body.to[0])), new Set(emails));
      assert.ok(outbound.every(row => row.key === firstKeys.get(row.body.to[0])));
      assert.ok(mail().every(row => row.status === "sent"));
    });
    await t.test("suppressed and legacy marketing cannot consume every retry slot", async () => {
      reset(); const optedOut = subscriber("suppressed", 2, { unsubscribed_at: ago(1) });
      const active = subscriber("active-legacy");
      const insert = database.prepare("INSERT INTO email_notification_outbox (id,event_key,recipient_email,subject,text_body,created_at) VALUES (?,?,?,?,?,?)");
      insert.run("old-1", `launch-updates:0:${optedOut}`, optedOut, "OLD", "OLD", ago(3));
      insert.run("old-2", `launch-updates:0:${active}`, active, "OLD", "OLD", ago(2));
      insert.run("alert", "security:account_created:fixture", "owner@example.invalid", "Account alert", "TEST", ago(1));
      await api.flushPendingEmailNotifications(1);
      assert.equal(outbound.length, 1); assert.equal(outbound[0].body.subject, "Account alert");
      assert.equal(mail().filter(row => row.status === "sent").length, 1);
    });
    await t.test("malformed acceptance stays retryable with the same delivery key", async () => {
      reset(); subscriber("receipt"); state.missingReceipt = true;
      await api.processDueLaunchUpdates(); await api.flushPendingEmailNotifications(20);
      assert.equal(mail()[0].status, "failed"); const key = mail()[0].event_key;
      state.missingReceipt = false; await api.flushPendingEmailNotifications(20);
      assert.equal(mail()[0].status, "sent"); assert.ok(outbound.every(row => row.key === key));
      const count = outbound.length; await api.flushPendingEmailNotifications(20);
      assert.equal(outbound.length, count);
    });
  } finally {
    t.mock.timers.reset();
    globalThis.fetch = originalFetch; console.error = originalError;
    delete globalThis.__launchUpdateRuntime; database.close();
    assert.equal(dirname(scratch), resolve(tmpdir())); rmSync(scratch, { recursive: true, force: true });
  }
});
