import { AuthErasureRecoveryJournal, type AuthErasureIntent } from "./privacy-erasure-recovery";
import { verifyOwnerRequest } from "./owner-auth";
import { isStrictSameOriginWriteRequest } from "./request-security";
import { assertAuthenticationCatalogMatches, assertCurrentAuthenticationCatalog } from "./privacy-erasure-catalog";
import { readAuthenticationRecoveryFence, assertAuthenticationRecoveryFence } from "./privacy-recovery-fence";

const expectedClosureSql = `WITH expected(email, request_id, case_reference, closed_at, review_after)
  AS (VALUES (?, ?, ?, ?, ?))`;
const conflictingClosureSql = `SELECT 1 FROM account_closures closed, expected
  WHERE (closed.email = expected.email OR closed.privacy_request_id = expected.request_id)
  AND NOT (closed.email = expected.email AND closed.privacy_request_id = expected.request_id
    AND closed.case_reference = expected.case_reference AND closed.closed_at = expected.closed_at
    AND closed.review_after = expected.review_after)`;
const closureValues = (intent: AuthErasureIntent) => [intent.email, intent.requestId,
  intent.closureCaseReference, intent.closedAt, intent.reviewAfter];
const closureProblem = () => new Error("The restore closure does not match the reviewed evidence. Keep the restore isolated.");

// For an isolated, fully migrated restore only. This never enables traffic or
// proves that the supplied catalog is the current authoritative store.
export async function replayAuthenticationErasures(request: Request, db: D1Database,
  journal: AuthErasureRecoveryJournal, review: {
    isolatedRestoreConfirmed: boolean; sourceWritesPausedConfirmed: boolean; recoveryCaseReference: string;
  }, source: D1Database) {
  const owner = await verifyOwnerRequest(request);
  if (!owner.ok || !isStrictSameOriginWriteRequest(request)) throw new Error("Verified owner recovery access required.");
  if (review.isolatedRestoreConfirmed !== true || review.sourceWritesPausedConfirmed !== true
    || typeof review.recoveryCaseReference !== "string" || review.recoveryCaseReference.trim().length < 8) {
    throw new Error("A restricted restore and paused source writes must be confirmed.");
  }
  if (!source || source === db) throw new Error("A separate current source database is required for recovery reconciliation.");
  const fence = await readAuthenticationRecoveryFence(source);
  if (fence.paused !== 1 || fence.caseReference !== review.recoveryCaseReference.trim()) {
    throw new Error("A database-enforced source pause for this recovery case is required.");
  }
  const intents = await journal.completedIntents();
  if (intents.length > 100) throw new Error("Recovery catalog requires a separately reviewed batch plan.");
  await assertCurrentAuthenticationCatalog(source, intents);
  const statements: D1PreparedStatement[] = [];
  // Validate every existing restore closure before submitting any writes. A
  // matching email alone cannot establish the case, dates or request ownership.
  for (const intent of intents) {
    const existing = await db.prepare(`${expectedClosureSql}
      SELECT EXISTS(${conflictingClosureSql}) AS conflict`).bind(...closureValues(intent)).first<{ conflict: number }>();
    if (existing?.conflict !== 0) throw closureProblem();
    // Recheck within the same D1 transaction as all deletions. A late conflict
    // selects NULL for the existing NOT NULL email constraint, aborting the
    // entire batch; it cannot overwrite another case or leave partial erasure.
    // Exact existing records remain untouched and repeated replay stays safe.
    statements.push(db.prepare(`${expectedClosureSql}
      INSERT INTO account_closures (email, privacy_request_id, case_reference, closed_at, review_after)
      SELECT (CASE WHEN EXISTS(${conflictingClosureSql}) THEN NULL ELSE email END),
        request_id, case_reference, closed_at, review_after FROM expected WHERE true
      ON CONFLICT(email) DO NOTHING`).bind(...closureValues(intent)));
  }
  for (const intent of intents) {
    // Anonymous phone challenges must be removed before their association.
    statements.push(db.prepare(`DELETE FROM phone_login_codes WHERE lower(trim(email)) = ?
      OR (trim(email) = '' AND phone_e164 IN (SELECT phone_e164 FROM account_phone_numbers WHERE lower(trim(email)) = ?))`)
      .bind(intent.email, intent.email));
    for (const table of ["auth_sessions", "login_codes", "password_verification_codes", "passkey_credentials", "account_credentials"]) {
      statements.push(db.prepare(`DELETE FROM ${table} WHERE lower(trim(email)) = ?`).bind(intent.email));
    }
    // Keep the association if an unexpected trigger silently preserves a phone
    // challenge. A later retry must still be able to identify that challenge.
    statements.push(db.prepare(`DELETE FROM account_phone_numbers WHERE lower(trim(email)) = ?
      AND NOT EXISTS (SELECT 1 FROM phone_login_codes
        WHERE trim(phone_login_codes.email) = ''
          AND phone_login_codes.phone_e164 = account_phone_numbers.phone_e164)`)
      .bind(intent.email));
  }
  await assertAuthenticationRecoveryFence(source, fence);
  if (statements.length) await db.batch(statements);
  // Command success alone does not establish deletion (for example, a trigger
  // can RAISE(IGNORE)). Read back the postconditions before reporting success.
  // The restore remains isolated on failure; a retry can finish preserved rows.
  for (const intent of intents) {
    const tables = ["auth_sessions", "login_codes", "password_verification_codes", "passkey_credentials",
      "account_credentials", "account_phone_numbers", "phone_login_codes"];
    const verified = await db.prepare(`${expectedClosureSql}
      SELECT EXISTS(SELECT 1 FROM account_closures closed, expected
        WHERE closed.email = expected.email AND closed.privacy_request_id = expected.request_id
          AND closed.case_reference = expected.case_reference AND closed.closed_at = expected.closed_at
          AND closed.review_after = expected.review_after) AS closed,
        EXISTS(${conflictingClosureSql}) AS conflict,
        ${tables.map(table => `(SELECT count(*) FROM ${table} WHERE lower(trim(email)) = (SELECT email FROM expected))`).join(" + ")} AS remaining`)
      .bind(...closureValues(intent)).first<{ closed: number; conflict: number; remaining: number }>();
    if (verified?.closed !== 1 || verified.conflict !== 0 || verified.remaining !== 0) {
      throw new Error("Recovery verification failed. Keep the restored database isolated and review remaining authentication records.");
    }
  }
  // Catch source movement or journal changes during replay. Even a successful
  // comparison cannot replace an actual write pause or authorize traffic.
  await assertCurrentAuthenticationCatalog(source, intents);
  assertAuthenticationCatalogMatches(intents, await journal.completedIntents());
  await assertAuthenticationRecoveryFence(source, fence);
  return { replayed: intents.length, recoveryCaseReference: review.recoveryCaseReference.trim(),
    trafficMayOpen: false as const, requiresCurrentCatalogAndRestoreReview: true as const };
}
