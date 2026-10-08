// Synthetic, single-use rehearsal only. Never bind this Worker to real data.
import { previewAuthenticationErasure, eraseReviewedAuthenticationData } from "../lib/privacy-auth-erasure";
import { AuthErasureRecoveryJournal } from "../lib/privacy-erasure-recovery";
import { replayAuthenticationErasures } from "../lib/privacy-erasure-replay";

type Statement = { sql: string; values: (string | number | null)[] };
declare const REHEARSAL_SCHEMA: string[];
declare const REHEARSAL_ROWS: { common: Statement[]; source: Statement[] };
type Environment = { SOURCE: D1Database; RESTORE: D1Database; JOURNAL: R2Bucket;
  REHEARSAL_TOKEN: string; JOURNAL_SIGNING_KEY: string; EXPIRES_AT: string };
const target = "rehearsal-erased@example.invalid", other = "rehearsal-other@example.invalid";
const requestId = "synthetic-recovery-20261008";
const requireTrue = (condition: unknown) => { if (!condition) throw new Error("Rehearsal assertion failed"); };
async function runStatements(db: D1Database, statements: Statement[]) {
  for (let index = 0; index < statements.length; index += 20) {
    await db.batch(statements.slice(index, index + 20).map(item => db.prepare(item.sql).bind(...item.values)));
  }
}
async function count(db: D1Database, table: string, email: string) {
  return (await db.prepare(`SELECT count(*) n FROM ${table} WHERE email = ?`).bind(email).first<{ n: number }>())?.n;
}

const privacyRecoveryRehearsal = {
  async fetch(request: Request, env: Environment) {
    const headers = { "cache-control": "no-store" };
    const expiry = Date.parse(env.EXPIRES_AT);
    if (request.method !== "POST" || new URL(request.url).pathname !== "/run") return new Response(null, { status: 404, headers });
    if (!/^[a-f0-9]{64}$/.test(env.REHEARSAL_TOKEN || "")
      || request.headers.get("authorization") !== `Bearer ${env.REHEARSAL_TOKEN}`) return new Response(null, { status: 403, headers });
    if (!Number.isFinite(expiry) || expiry <= Date.now() || expiry > Date.now() + 3600000
      || !/^[a-f0-9]{64}$/.test(env.JOURNAL_SIGNING_KEY || "")
      || env.JOURNAL_SIGNING_KEY === env.REHEARSAL_TOKEN) return new Response(null, { status: 403, headers });
    let stage = "empty-resources";
    const passed: string[] = [];
    try {
      // Check every target before the first mutation. There is deliberately no
      // reset, arbitrary SQL, upload or caller-selected account endpoint.
      for (const db of [env.SOURCE, env.RESTORE]) {
        const existing = await db.prepare("SELECT count(*) n FROM sqlite_schema WHERE type='table' AND name NOT GLOB 'sqlite_*' AND name NOT GLOB '_cf_*'").first<{ n: number }>();
        requireTrue(existing?.n === 0);
      }
      requireTrue((await env.JOURNAL.list({ limit: 1 })).objects.length === 0);
      // Atomic single-use claim also rejects overlapping requests. A partial
      // run requires investigation/new empty resources, never an automatic reset.
      const claim = await env.JOURNAL.put("rehearsal-single-use", "synthetic-only", { onlyIf: { etagDoesNotMatch: "*" } });
      requireTrue(claim !== null);
      stage = "synthetic-schema";
      for (const db of [env.SOURCE, env.RESTORE]) {
        await runStatements(db, REHEARSAL_SCHEMA.map(sql => ({ sql, values: [] })));
        await runStatements(db, REHEARSAL_ROWS.common);
      }
      await runStatements(env.SOURCE, REHEARSAL_ROWS.source);
      // Synthetic owner verification is bundled only in this rehearsal. The
      // real owner authentication module and deployed website are unchanged.
      const internalRequest = new Request("https://rehearsal.invalid/action", { method: "POST", headers: { origin: "https://rehearsal.invalid" } });
      const journal = new AuthErasureRecoveryJournal(env.JOURNAL, "synthetic-cloud-recovery", "rehearsal", { rehearsal: env.JOURNAL_SIGNING_KEY });
      stage = "source-erasure";
      const preview = await previewAuthenticationErasure(env.SOURCE, requestId);
      requireTrue(preview?.eligible);
      const approval = { requestId, reviewToken: preview!.reviewToken, caseReference: "SYNTHETIC-ERASURE",
        recoveryReference: "SYNTHETIC-RECOVERY", confirmAuthenticationOnly: true, confirmRetentionReviewed: true, confirmRecoveryRecorded: true };
      requireTrue((await eraseReviewedAuthenticationData(internalRequest, env.SOURCE, approval, journal)).status === "erased");
      requireTrue((await eraseReviewedAuthenticationData(internalRequest, env.SOURCE, approval, journal)).status === "already-erased");
      requireTrue((await journal.completedIntents()).length === 1);
      requireTrue(await count(env.SOURCE, "account_credentials", other) === 1);
      passed.push("signed-erasure-and-retry");
      const review = { isolatedRestoreConfirmed: true, sourceWritesPausedConfirmed: true, recoveryCaseReference: "SYNTHETIC-RESTORE" };
      stage = "tampered-journal";
      const intentKey = (await env.JOURNAL.list({ prefix: journal.prefix })).objects.find(object => object.key.endsWith("/intent.json"))!.key;
      const original = await (await env.JOURNAL.get(intentKey))!.text();
      requireTrue(await env.JOURNAL.put(intentKey, "must-not-replace", { onlyIf: { etagDoesNotMatch: "*" } }) === null);
      requireTrue(await (await env.JOURNAL.get(intentKey))!.text() === original);
      await env.JOURNAL.put(intentKey, "synthetic-corruption");
      let rejected = false;
      try { await replayAuthenticationErasures(internalRequest, env.RESTORE, journal, review); } catch { rejected = true; }
      requireTrue(rejected && await count(env.RESTORE, "account_credentials", target) === 1);
      requireTrue(await count(env.RESTORE, "account_closures", target) === 0);
      await env.JOURNAL.put(intentKey, original);
      passed.push("conditional-write-and-tamper-denial");
      stage = "rollback";
      await env.RESTORE.prepare("CREATE TRIGGER synthetic_abort BEFORE DELETE ON passkey_credentials BEGIN SELECT RAISE(ABORT, 'synthetic'); END").run();
      rejected = false;
      try { await replayAuthenticationErasures(internalRequest, env.RESTORE, journal, review); } catch { rejected = true; }
      requireTrue(rejected && await count(env.RESTORE, "account_closures", target) === 0);
      requireTrue(await count(env.RESTORE, "auth_sessions", target) === 2);
      await env.RESTORE.prepare("DROP TRIGGER synthetic_abort").run();
      passed.push("transaction-rollback");
      stage = "silent-deletion-failure";
      await env.RESTORE.prepare("CREATE TRIGGER synthetic_ignore BEFORE DELETE ON phone_login_codes BEGIN SELECT RAISE(IGNORE); END").run();
      rejected = false;
      try { await replayAuthenticationErasures(internalRequest, env.RESTORE, journal, review); } catch { rejected = true; }
      requireTrue(rejected && await count(env.RESTORE, "account_phone_numbers", target) === 1);
      await env.RESTORE.prepare("DROP TRIGGER synthetic_ignore").run();
      passed.push("remaining-phone-code-denial");
      stage = "verified-restore";
      const result = await replayAuthenticationErasures(internalRequest, env.RESTORE, journal, review);
      requireTrue(result.replayed === 1 && result.trafficMayOpen === false);
      for (const table of ["auth_sessions", "login_codes", "password_verification_codes", "passkey_credentials", "account_credentials", "account_phone_numbers"]) {
        requireTrue(await count(env.RESTORE, table, target) === 0);
      }
      requireTrue((await env.RESTORE.prepare("SELECT count(*) n FROM phone_login_codes WHERE phone_e164 = '+12025550101'").first<{ n: number }>())?.n === 0);
      requireTrue(await count(env.RESTORE, "account_closures", target) === 1);
      requireTrue(await count(env.RESTORE, "auth_sessions", other) === 2);
      requireTrue(await count(env.RESTORE, "account_credentials", other) === 1);
      requireTrue((await replayAuthenticationErasures(internalRequest, env.RESTORE, journal, review)).replayed === 1);
      passed.push("restore-readback-isolation-and-retry");
      return Response.json({ syntheticOnly: true, passed, trafficMayOpen: false }, { headers });
    } catch {
      // Only fixed stage names leave this test Worker. Never return records,
      // SQL results, tokens, raw exceptions or signing keys.
      return Response.json({ syntheticOnly: true, failedStage: stage, passed, trafficMayOpen: false }, { status: 409, headers });
    }
  },
};

export default privacyRecoveryRehearsal;
