import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { build } from "esbuild";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";

// Exercise the real Privacy Center, D1 transaction and email consent checks.
// Only signed-in identity and outbound mail are synthetic. Nothing leaves the PC.
test("Privacy Center opt-out suppresses queued launch marketing", { timeout: 120000 }, async t => {
  const repo = resolve(import.meta.dirname, "..");
  const schema = new DatabaseSync(":memory:");
  const sent = [];
  let runtime;
  try {
    const journal = JSON.parse(readFileSync(join(repo, "drizzle/meta/_journal.json"), "utf8"));
    for (const entry of journal.entries) schema.exec(readFileSync(join(repo, "drizzle", `${entry.tag}.sql`), "utf8"));
    const definitions = schema.prepare(
      "SELECT sql FROM sqlite_schema WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 ELSE 2 END, name",
    ).all();
    const compiled = await build({
      absWorkingDir: repo,
      stdin: { resolveDir: repo, loader: "ts", contents: `
        import { POST } from "./app/api/privacy-center/route";
        import { POST as subscribe } from "./app/api/launch-updates/subscribe/route";
        import { flushPendingEmailNotifications } from "./lib/email-notifications";
        import { processDueLaunchUpdates } from "./lib/launch-update-delivery";
        export default { async fetch(request) {
          const path = new URL(request.url).pathname;
          if (path === "/subscribe") return subscribe(request);
          if (path === "/sequence") {
            await processDueLaunchUpdates();
            return Response.json({ ok: true });
          }
          if (path === "/flush") {
            await flushPendingEmailNotifications(100);
            return Response.json({ ok: true });
          }
          return POST(request);
        } };
      ` },
      bundle: true, platform: "browser", format: "esm", external: ["cloudflare:workers"],
      write: false, logLevel: "silent",
      plugins: [{
        name: "synthetic-signed-in-account",
        setup(builder) {
          builder.onResolve({ filter: /\/account-auth$/ }, () => ({ path: "account", namespace: "fixture" }));
          builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
            loader: "js", contents: `
              export async function getPrivacyAccountSession(request) {
                const email = request.headers.get("x-synthetic-account");
                return email?.endsWith("@example.invalid")
                  ? { email, role: "customer", availableRoles: ["customer"] } : null;
              }
              export async function providerApplicationOwnershipFor(email) {
                return { id: "synthetic-provider", email };
              }
            `,
          }));
        },
      }],
    });
    runtime = new Miniflare(convertV4MiniflareOptions({
      host: "127.0.0.1", port: 0,
      workers: [{
        name: "local-privacy-optout-fixture", modules: true, script: compiled.outputFiles[0].text,
        compatibilityDate: "2026-07-27", d1Databases: ["DB"],
        bindings: {
          SITE_URL: "https://tuveloz.invalid",
          RESEND_API_KEY: "synthetic-not-a-credential",
          RESEND_FROM_EMAIL: "Tuveloz <sender@example.invalid>",
          LAUNCH_UPDATES_POSTAL_ADDRESS: "SYNTHETIC LOCAL TEST ONLY",
        },
        outboundService: async request => {
          assert.equal(request.url, "https://api.resend.com/emails", "unexpected outbound request");
          sent.push({ key: request.headers.get("Idempotency-Key"), body: await request.json() });
          return Response.json({ id: `synthetic-receipt-${sent.length}` });
        },
      }],
    }));
    const db = await runtime.getD1Database("DB");
    for (let i = 0; i < definitions.length; i += 25) {
      await db.batch(definitions.slice(i, i + 25).map(row => db.prepare(row.sql)));
    }
    const consent = "2026-09-01T12:00:00.000Z";
    const seed = async name => {
      const email = `${name}@example.invalid`;
      await db.prepare(`INSERT INTO launch_update_subscribers
        (email,source,language,consent_text,consent_version,consented_at,unsubscribe_token)
        VALUES (?,'synthetic','en','SYNTHETIC CONSENT','synthetic-v1',?,?)`)
        .bind(email, consent, `synthetic-token-${name}`).run();
      for (const role of ["customer", "provider"]) {
        await db.prepare(`INSERT INTO account_communication_preferences
          (email,role,marketing_email,product_update_email,optional_reminder_email,
           launch_notification_email,launch_notification_consent_at,
           launch_notification_consent_version,launch_notification_consent_source)
          VALUES (?,?,'yes','yes','yes','yes',?,'synthetic-separate-consent','account_create')`)
          .bind(email, role, consent).run();
      }
      const event = `launch-updates:v2:0:${consent}:${email}`;
      await db.prepare(`INSERT INTO email_notification_outbox
        (id,event_key,recipient_email,subject,text_body) VALUES (?,?,?,'SYNTHETIC MARKETING','LOCAL TEST ONLY')`)
        .bind(`mail-${name}`, event, email).run();
      return { email, event };
    };
    const optOut = (email, role = "customer") => runtime.dispatchFetch(
      `https://tuveloz.invalid/api/privacy-center?scope=${role}`, {
        method: "POST",
        headers: { origin: "https://tuveloz.invalid", "content-type": "application/json", "x-synthetic-account": email },
        body: JSON.stringify({ action: "submit-request", requestType: "opt-out", details: "SYNTHETIC OPT-OUT" }),
      },
    );
    const savePreferences = (email, choices, role = "customer") => runtime.dispatchFetch(
      `https://tuveloz.invalid/api/privacy-center?scope=${role}`, {
        method: "POST",
        headers: { origin: "https://tuveloz.invalid", "content-type": "application/json", "x-synthetic-account": email },
        body: JSON.stringify({
          action: "save-preferences",
          optionalReminderEmail: true,
          launchNotificationEmail: true,
          ...choices,
        }),
      },
    );
    const subscriber = email => db.prepare("SELECT * FROM launch_update_subscribers WHERE email=?").bind(email).first();
    const prefs = email => db.prepare("SELECT * FROM account_communication_preferences WHERE email=? ORDER BY role").bind(email).all();
    const requests = email => db.prepare("SELECT * FROM privacy_requests WHERE email=?").bind(email).all();
    const flush = async () => {
      const response = await runtime.dispatchFetch("https://tuveloz.invalid/flush");
      assert.equal(response.status, 200, await response.text());
    };

    for (const role of ["customer", "provider"]) {
      await t.test(`${role} opt-out stops its queued marketing while other and essential mail still send`, async () => {
        const target = await seed(`target-${role}`);
        const other = await seed(`other-${role}`);
        const otherBefore = await subscriber(other.email);
        const otherPrefs = await prefs(other.email);
        const beforePrefs = (await prefs(target.email)).results;
        const response = await optOut(target.email, role);
        assert.equal(response.status, 201, await response.clone().text());
        assert.equal((await response.json()).requests[0].status, "completed");
        await flush();
        assert.equal(sent.some(mail => mail.key === target.event), false,
          "a completed Privacy Center opt-out must suppress the already-queued marketing");
        assert.equal(sent.some(mail => mail.key === other.event), true);
        assert.equal(sent.some(mail => mail.key.startsWith("marketplace:privacy-confirmation:")
          && JSON.stringify(mail.body.to).includes(target.email)), true, "essential case confirmation still sends");
        assert.ok((await subscriber(target.email)).unsubscribed_at);
        assert.deepEqual(await subscriber(other.email), otherBefore);
        assert.deepEqual((await prefs(other.email)).results, otherPrefs.results);
        const afterPrefs = (await prefs(target.email)).results;
        const selected = afterPrefs.find(row => row.role === role);
        assert.equal(selected.marketing_email, "no");
        assert.equal(selected.product_update_email, "no");
        for (const field of ["optional_reminder_email", "launch_notification_email",
          "launch_notification_consent_at", "launch_notification_consent_version", "launch_notification_consent_source"]) {
          assert.equal(selected[field], beforePrefs.find(row => row.role === role)[field]);
        }
        assert.deepEqual(afterPrefs.find(row => row.role !== role), beforePrefs.find(row => row.role !== role));
        const suppressed = await db.prepare("SELECT status,attempts FROM email_notification_outbox WHERE event_key=?").bind(target.event).first();
        assert.deepEqual(suppressed, { status: "pending", attempts: 0 });
      });
    }

    for (const failure of ["subscription", "receipt"]) {
      await t.test(`${failure} failure cannot leave a falsely completed opt-out and retry succeeds`, async () => {
        const target = await seed(`failure-${failure}`);
        const beforeSubscriber = await subscriber(target.email);
        const beforePrefs = await prefs(target.email);
        const beforeRequests = await requests(target.email);
        const beforeSent = sent.length;
        const table = failure === "subscription" ? "launch_update_subscribers" : "privacy_requests";
        const verb = failure === "subscription" ? "UPDATE" : "INSERT";
        await db.prepare(`CREATE TRIGGER synthetic_optout_failure BEFORE ${verb} ON ${table}
          WHEN NEW.email='${target.email}' BEGIN SELECT RAISE(ABORT,'Synthetic opt-out storage failure'); END`).run();
        try {
          const failed = await optOut(target.email);
          assert.equal(failed.status, 503);
          assert.deepEqual(await subscriber(target.email), beforeSubscriber);
          assert.deepEqual((await prefs(target.email)).results, beforePrefs.results);
          assert.deepEqual((await requests(target.email)).results, beforeRequests.results);
          assert.equal(sent.length, beforeSent);
        } finally {
          await db.prepare("DROP TRIGGER synthetic_optout_failure").run();
        }
        assert.equal((await optOut(target.email)).status, 201);
        const firstUnsubscribe = (await subscriber(target.email)).unsubscribed_at;
        assert.ok(firstUnsubscribe);
        assert.equal((await optOut(target.email)).status, 201);
        assert.equal((await subscriber(target.email)).unsubscribed_at, firstUnsubscribe);
        await flush();
        assert.equal(sent.some(mail => mail.key === target.event), false);
      });
    }

    for (const role of ["customer", "provider"]) {
      for (const category of ["marketingEmail", "productUpdateEmail"]) {
        await t.test(`${role} saving an explicit ${category} refusal suppresses the mixed newsletter`, async () => {
          const target = await seed(`saved-${role}-${category.toLowerCase()}`);
          const before = (await prefs(target.email)).results.find(row => row.role !== role);
          const response = await savePreferences(target.email, {
            marketingEmail: true, productUpdateEmail: true, [category]: role === "customer" ? false : "no",
          }, role);
          assert.equal(response.status, 200, await response.clone().text());
          assert.ok((await subscriber(target.email)).unsubscribed_at);
          const saved = (await response.json()).preferences;
          assert.equal(saved[category], false);
          assert.equal(saved.optionalReminderEmail, true);
          assert.equal(saved.launchNotificationEmail, role === "customer");
          assert.deepEqual((await prefs(target.email)).results.find(row => row.role !== role), before);
          assert.equal((await requests(target.email)).results.length, 0);
          await flush();
          assert.equal(sent.some(mail => mail.key === target.event), false);
        });
      }
    }

    await t.test("a failed preference save rolls back instead of leaving the newsletter active behind saved refusals", async () => {
      const target = await seed("saved-failure");
      const beforePrefs = (await prefs(target.email)).results;
      const beforeSubscriber = await subscriber(target.email);
      await db.prepare(`CREATE TRIGGER synthetic_save_failure BEFORE UPDATE ON launch_update_subscribers
        WHEN NEW.email='${target.email}' BEGIN SELECT RAISE(ABORT,'Synthetic preference save failure'); END`).run();
      try {
        const response = await savePreferences(target.email, { marketingEmail: false, productUpdateEmail: false });
        assert.equal(response.status, 503);
        assert.deepEqual((await prefs(target.email)).results, beforePrefs);
        assert.deepEqual(await subscriber(target.email), beforeSubscriber);
        assert.equal(sent.some(mail => mail.key === target.event), false);
      } finally {
        await db.prepare("DROP TRIGGER synthetic_save_failure").run();
      }
      assert.equal((await savePreferences(target.email, { marketingEmail: false, productUpdateEmail: false })).status, 200);
      const suppression = (await subscriber(target.email)).unsubscribed_at;
      assert.ok(suppression);
      assert.equal((await savePreferences(target.email, { marketingEmail: true, productUpdateEmail: true })).status, 200);
      assert.equal((await subscriber(target.email)).unsubscribed_at, suppression,
        "saving general preferences must not re-enroll a suppressed newsletter");
      await flush();
      assert.equal(sent.some(mail => mail.key === target.event), false);
    });

    await t.test("absent preferences and positive preferences do not revoke a separately consented newsletter", async () => {
      for (const [name, choices] of [
        ["absent", {}], ["positive", { marketingEmail: true, productUpdateEmail: true }],
      ]) {
        const target = await seed(`saved-${name}`);
        const before = await subscriber(target.email);
        assert.equal((await savePreferences(target.email, choices)).status, 200);
        assert.deepEqual(await subscriber(target.email), before);
        await flush();
        assert.equal(sent.filter(mail => mail.key === target.event).length, 1);
      }
    });

    await t.test("fresh explicit newsletter consent starts new mail without reviving the suppressed message", async () => {
      const target = await seed("fresh-consent");
      assert.equal((await optOut(target.email)).status, 201);
      assert.equal(sent.some(mail => mail.key === target.event), false);
      const response = await runtime.dispatchFetch("https://tuveloz.invalid/subscribe", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: target.email, consent: true, source: "synthetic-local", language: "es" }),
      });
      assert.equal(response.status, 202, await response.clone().text());
      const renewed = await subscriber(target.email);
      assert.equal(renewed.unsubscribed_at, "");
      assert.notEqual(renewed.consented_at, consent);
      assert.equal((await prefs(target.email)).results.find(row => row.role === "customer").marketing_email, "no",
        "ordinary preference defaults must not override later explicit newsletter consent");
      assert.equal((await runtime.dispatchFetch("https://tuveloz.invalid/sequence")).status, 200);
      await flush();
      const newEvent = `launch-updates:v2:0:${renewed.consented_at}:${target.email}`;
      assert.equal(sent.filter(mail => mail.key === newEvent).length, 1);
      assert.equal(sent.some(mail => mail.key === target.event), false);
    });

    await t.test("D1-safe retry matching preserves protective and closed-transaction boundaries", async () => {
      const allowed = [
        "marketplace:job-authorization-response:synthetic:declined:provider",
        "MARKETPLACE:JOB-AUTHORIZATION-RESPONSE:synthetic-upper:declined:provider",
      ];
      const blocked = [
        "marketplace:job-authorization-response:synthetic:accepted:provider",
        "marketplace:job-authorization-response:synthetic:declined",
        "xmarketplace:job-authorization-response:synthetic:declined:provider",
        "marketplace:job-authorization-response:synthetic:declined:provider:accepted:provider",
      ];
      for (const [index, event] of [...allowed, ...blocked].entries()) {
        await db.prepare(`INSERT INTO email_notification_outbox (id,event_key,recipient_email,subject,text_body)
          VALUES (?,?, 'protective@example.invalid','SYNTHETIC RETRY','LOCAL TEST ONLY')`)
          .bind(`protective-boundary-${index}`, event).run();
      }
      await flush();
      for (const event of allowed) assert.equal(sent.filter(mail => mail.key === event).length, 1, event);
      for (const event of blocked) {
        assert.equal(sent.some(mail => mail.key === event), false, event);
        const row = await db.prepare("SELECT status,attempts FROM email_notification_outbox WHERE event_key=?").bind(event).first();
        assert.deepEqual(row, { status: "pending", attempts: 0 });
      }
    });
  } finally {
    if (runtime) await runtime.dispose();
    schema.close();
  }
});
