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
    for (const table of ["auth_sessions", "login_codes", "password_verification_codes", "passkey_credentials", "account_credentials", "account_phone_numbers"]) {
      statements.push(db.prepare(`DELETE FROM ${table} WHERE lower(trim(email)) = ?`).bind(intent.email));
    }
  }
  if (statements.length) await db.batch(statements);
  return { replayed: intents.length, recoveryCaseReference: review.recoveryCaseReference.trim(),
    trafficMayOpen: false as const, requiresCurrentCatalogAndRestoreReview: true as const };
}
