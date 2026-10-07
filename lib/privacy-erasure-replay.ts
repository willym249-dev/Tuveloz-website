import { AuthErasureRecoveryJournal } from "./privacy-erasure-recovery";
import { verifyOwnerRequest } from "./owner-auth";
import { isStrictSameOriginWriteRequest } from "./request-security";

// For an isolated, fully migrated restore only. This never enables traffic or
// proves that the supplied catalog is the current authoritative store.
export async function replayAuthenticationErasures(request: Request, db: D1Database,
  journal: AuthErasureRecoveryJournal, review: {
    isolatedRestoreConfirmed: boolean; sourceWritesPausedConfirmed: boolean; recoveryCaseReference: string;
  }) {
  const owner = await verifyOwnerRequest(request);
  if (!owner.ok || !isStrictSameOriginWriteRequest(request)) throw new Error("Verified owner recovery access required.");
  if (review.isolatedRestoreConfirmed !== true || review.sourceWritesPausedConfirmed !== true
    || typeof review.recoveryCaseReference !== "string" || review.recoveryCaseReference.trim().length < 8) {
    throw new Error("A restricted restore and paused source writes must be confirmed.");
  }
  const intents = await journal.completedIntents();
  if (intents.length > 100) throw new Error("Recovery catalog requires a separately reviewed batch plan.");
  const statements: D1PreparedStatement[] = [];
  for (const intent of intents) {
    statements.push(db.prepare(`INSERT INTO account_closures (email, privacy_request_id, case_reference, closed_at, review_after)
      VALUES (?, ?, ?, ?, ?) ON CONFLICT(email) DO NOTHING`)
      .bind(intent.email, intent.requestId, intent.closureCaseReference, intent.closedAt, intent.reviewAfter));
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
  if (statements.length) await db.batch(statements);
  // Command success alone does not establish deletion (for example, a trigger
  // can RAISE(IGNORE)). Read back the postconditions before reporting success.
  // The restore remains isolated on failure; a retry can finish preserved rows.
  for (const intent of intents) {
    const tables = ["auth_sessions", "login_codes", "password_verification_codes", "passkey_credentials",
      "account_credentials", "account_phone_numbers", "phone_login_codes"];
    const verified = await db.prepare(`WITH subject(email) AS (VALUES (?))
      SELECT EXISTS(SELECT 1 FROM account_closures WHERE email = (SELECT email FROM subject)) AS closed,
        ${tables.map(table => `(SELECT count(*) FROM ${table} WHERE lower(trim(email)) = (SELECT email FROM subject))`).join(" + ")} AS remaining`)
      .bind(intent.email).first<{ closed: number; remaining: number }>();
    if (verified?.closed !== 1 || verified.remaining !== 0) {
      throw new Error("Recovery verification failed. Keep the restored database isolated and review remaining authentication records.");
    }
  }
  return { replayed: intents.length, recoveryCaseReference: review.recoveryCaseReference.trim(),
    trafficMayOpen: false as const, requiresCurrentCatalogAndRestoreReview: true as const };
}
