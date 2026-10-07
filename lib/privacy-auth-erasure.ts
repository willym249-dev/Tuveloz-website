import { verifyOwnerRequest } from "./owner-auth";
import { isStrictSameOriginWriteRequest } from "./request-security";
import { privacyReviewToken } from "./privacy-access-closure";
import { PRIVACY_CLOSURE_SUBJECT_SQL, UNUSED_ACCOUNT_CLOSURE_PREDICATE } from "./privacy-closure-preview";

// Internal engine. No route/UI calls this until durable recovery replay is ready.
// Records are selected by the saved request, never an operator-supplied email.
const subjectEmail = "lower(trim(email)) IN (SELECT lower(trim(email)) FROM subject)";
const sources = [
  { table: "auth_sessions", fields: "id, email, role, expires_at, last_seen_at", where: subjectEmail },
  { table: "account_credentials", fields: "email, updated_at, failed_attempts, locked_until", where: subjectEmail },
  { table: "login_codes", fields: "id, email, role, expires_at, attempts, used_at", where: subjectEmail },
  { table: "password_verification_codes", fields: "id, email, role, purpose, expires_at, attempts, used_at", where: subjectEmail },
  { table: "passkey_credentials", fields: "id, email, role, counter, last_used_at", where: subjectEmail },
  { table: "account_phone_numbers", fields: "email, phone_e164, updated_at", where: subjectEmail },
  { table: "phone_login_codes", fields: "id, email, phone_e164, purpose, expires_at, attempts, used_at",
    where: `${subjectEmail} OR (trim(email) = '' AND phone_e164 IN (SELECT phone_e164 FROM account_phone_numbers WHERE ${subjectEmail}))` },
] as const;
export const AUTH_ERASURE_TABLES = sources.map(source => source.table);
const records = sources.map(source => {
  const columns = source.fields.split(", ");
  return `'${source.table}', json((SELECT json_group_array(json(record)) FROM
    (SELECT json_array(${source.fields}) AS record FROM ${source.table} WHERE ${source.where} ORDER BY ${columns[0]})))`;
}).join(",\n");

// Contents remain in server memory, never in a response, log or receipt. Only
// row identity/version data is read; password/code/token material is excluded.
export const AUTH_ERASURE_SNAPSHOT_SQL = `${PRIVACY_CLOSURE_SUBJECT_SQL}
SELECT json_object(
 'request', json_object('id', id, 'email', email, 'role', role, 'status', status,
   'details', details, 'resolution', resolution_note, 'updated', updated_at),
 'closed', (SELECT json_object('case', case_reference, 'reviewAfter', review_after, 'closedAt', closed_at)
   FROM account_closures WHERE privacy_request_id = subject.id AND email = lower(trim(subject.email))),
 'eligible', CASE WHEN request_type = 'account-closure' AND identity_source = 'signed-in-account'
   AND status IN ('submitted', 'in-review') AND ${UNUSED_ACCOUNT_CLOSURE_PREDICATE}
   AND EXISTS (SELECT 1 FROM account_closures WHERE privacy_request_id = subject.id AND email = lower(trim(subject.email)))
   AND EXISTS (SELECT 1 FROM privacy_access_closure_reviews WHERE request_id = subject.id)
   THEN 1 ELSE 0 END,
 'records', json_object(${records})
) AS snapshot FROM subject`;

type Snapshot = { eligible: number; records: Record<string, unknown[]> };
async function snapshotFor(db: D1Database, requestId: string) {
  const result = await db.prepare(AUTH_ERASURE_SNAPSHOT_SQL).bind(requestId).first<{ snapshot: string }>();
  if (!result) return null;
  const data = JSON.parse(result.snapshot) as Snapshot;
  const digest = await privacyReviewToken([{ item: "auth-erasure-v1", value: result.snapshot }]);
  const counts = Object.fromEntries(AUTH_ERASURE_TABLES.map(table => [table, data.records[table].length]));
  return { raw: result.snapshot, eligible: data.eligible === 1, digest, counts };
}

export async function previewAuthenticationErasure(db: D1Database, requestId: string) {
  const snapshot = await snapshotFor(db, requestId);
  return snapshot ? { requestId, scope: "authentication-records" as const, eligible: snapshot.eligible,
    reviewToken: snapshot.digest, counts: snapshot.counts, completesPrivacyRequest: false as const } : null;
}

type Approval = { requestId: string; reviewToken: string; caseReference: string; recoveryReference: string;
  confirmAuthenticationOnly: boolean; confirmRetentionReviewed: boolean; confirmRecoveryRecorded: boolean };
export async function eraseReviewedAuthenticationData(request: Request, db: D1Database, approval: Approval) {
  const owner = await verifyOwnerRequest(request);
  if (!owner.ok || !isStrictSameOriginWriteRequest(request)) return { status: "forbidden" as const };
  if (!approval.requestId || approval.requestId.length > 100 || !/^[a-f0-9]{64}$/.test(approval.reviewToken)
    || ![approval.caseReference, approval.recoveryReference].every(value => typeof value === "string" && value.trim().length >= 8 && value.length <= 200)
    || approval.confirmAuthenticationOnly !== true || approval.confirmRetentionReviewed !== true || approval.confirmRecoveryRecorded !== true) {
    return { status: "invalid" as const };
  }
  const previous = await db.prepare("SELECT case_reference, recovery_reference, snapshot_digest FROM privacy_auth_erasure_records WHERE request_id = ?")
    .bind(approval.requestId).first<{ case_reference: string; recovery_reference: string; snapshot_digest: string }>();
  if (previous) {
    const snapshot = await snapshotFor(db, approval.requestId);
    const matching = previous.case_reference === approval.caseReference.trim()
      && previous.recovery_reference === approval.recoveryReference.trim() && previous.snapshot_digest === approval.reviewToken;
    return matching && snapshot && Object.values(snapshot.counts).every(count => count === 0)
      ? { status: "already-erased" as const, completesPrivacyRequest: false as const }
      : { status: "conflict" as const };
  }
  const snapshot = await snapshotFor(db, approval.requestId);
  if (!snapshot?.eligible || snapshot.digest !== approval.reviewToken) return { status: "conflict" as const };
  const result = await db.prepare(`INSERT INTO privacy_auth_erasure_records
    (request_id, scope, approved_by, case_reference, recovery_reference, snapshot_digest, record_counts)
    SELECT ?, 'authentication-records', ?, ?, ?, ?, ? FROM (${AUTH_ERASURE_SNAPSHOT_SQL}) current
    WHERE current.snapshot = ? AND json_extract(current.snapshot, '$.eligible') = 1
    ON CONFLICT(request_id) DO NOTHING`)
    .bind(approval.requestId, owner.email, approval.caseReference.trim(), approval.recoveryReference.trim(),
      approval.reviewToken, JSON.stringify(snapshot.counts), approval.requestId, snapshot.raw).run();
  return result.meta.changes === 1 ? { status: "erased" as const, completesPrivacyRequest: false as const }
    : { status: "conflict" as const };
}
