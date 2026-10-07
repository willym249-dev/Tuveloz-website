import { verifyOwnerRequest } from "./owner-auth";
import { isStrictSameOriginWriteRequest } from "./request-security";
import { privacyReviewToken } from "./privacy-access-closure";
import { PRIVACY_CLOSURE_SUBJECT_SQL, UNUSED_ACCOUNT_CLOSURE_PREDICATE } from "./privacy-closure-preview";
import { AuthErasureRecoveryJournal, type AuthErasureIntent } from "./privacy-erasure-recovery";

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

type Snapshot = { eligible: number; records: Record<string, unknown[]>; request: { email: string };
  closed: { case: string; reviewAfter: string; closedAt: string } | null };
async function snapshotFor(db: D1Database, requestId: string) {
  const result = await db.prepare(AUTH_ERASURE_SNAPSHOT_SQL).bind(requestId).first<{ snapshot: string }>();
  if (!result) return null;
  const data = JSON.parse(result.snapshot) as Snapshot;
  const digest = await privacyReviewToken([{ item: "auth-erasure-v1", value: result.snapshot }]);
  const counts = Object.fromEntries(AUTH_ERASURE_TABLES.map(table => [table, data.records[table].length]));
  return { raw: result.snapshot, eligible: data.eligible === 1, digest, counts, data };
}

export async function previewAuthenticationErasure(db: D1Database, requestId: string) {
  const snapshot = await snapshotFor(db, requestId);
  return snapshot ? { requestId, scope: "authentication-records" as const, eligible: snapshot.eligible,
    reviewToken: snapshot.digest, counts: snapshot.counts, completesPrivacyRequest: false as const } : null;
}

type Approval = { requestId: string; reviewToken: string; caseReference: string; recoveryReference: string;
  confirmAuthenticationOnly: boolean; confirmRetentionReviewed: boolean; confirmRecoveryRecorded: boolean };
export async function eraseReviewedAuthenticationData(request: Request, db: D1Database, approval: Approval,
  journal: AuthErasureRecoveryJournal) {
  const owner = await verifyOwnerRequest(request);
  if (!owner.ok || !isStrictSameOriginWriteRequest(request)) return { status: "forbidden" as const };
  if (!approval.requestId || approval.requestId.length > 100 || !/^[a-f0-9]{64}$/.test(approval.reviewToken)
    || ![approval.caseReference, approval.recoveryReference].every(value => typeof value === "string" && value.trim().length >= 8 && value.length <= 200)
    || approval.confirmAuthenticationOnly !== true || approval.confirmRetentionReviewed !== true || approval.confirmRecoveryRecorded !== true) {
    return { status: "invalid" as const };
  }
  if (!(journal instanceof AuthErasureRecoveryJournal)) return { status: "recovery-unavailable" as const };
  const recoveryIntent = (snapshot: NonNullable<Awaited<ReturnType<typeof snapshotFor>>>, approvedBy: string): AuthErasureIntent => {
    if (!snapshot.data.closed) throw new Error("Reviewed account closure is missing.");
    return { requestId: approval.requestId, email: snapshot.data.request.email.trim().toLowerCase(),
      snapshotDigest: approval.reviewToken, approvedBy, caseReference: approval.caseReference.trim(),
      recoveryReference: approval.recoveryReference.trim(), closureCaseReference: snapshot.data.closed.case,
      closedAt: snapshot.data.closed.closedAt, reviewAfter: snapshot.data.closed.reviewAfter };
  };
  const previous = await db.prepare("SELECT case_reference, recovery_reference, snapshot_digest, approved_by FROM privacy_auth_erasure_records WHERE request_id = ?")
    .bind(approval.requestId).first<{ case_reference: string; recovery_reference: string; snapshot_digest: string; approved_by: string }>();
  if (previous) {
    const snapshot = await snapshotFor(db, approval.requestId);
    const matching = previous.case_reference === approval.caseReference.trim()
      && previous.recovery_reference === approval.recoveryReference.trim() && previous.snapshot_digest === approval.reviewToken;
    if (!matching || !snapshot?.data.closed || !Object.values(snapshot.counts).every(count => count === 0)) return { status: "conflict" as const };
    try { await journal.confirm(recoveryIntent(snapshot, previous.approved_by)); }
    catch { return { status: "recovery-pending" as const, completesPrivacyRequest: false as const }; }
    return { status: "already-erased" as const, completesPrivacyRequest: false as const };
  }
  const snapshot = await snapshotFor(db, approval.requestId);
  if (!snapshot?.eligible || snapshot.digest !== approval.reviewToken) return { status: "conflict" as const };
  const intent = recoveryIntent(snapshot, owner.email);
  await journal.prepare(intent);
  const result = await db.prepare(`INSERT INTO privacy_auth_erasure_records
    (request_id, scope, approved_by, case_reference, recovery_reference, snapshot_digest, record_counts)
    SELECT ?, 'authentication-records', ?, ?, ?, ?, ? FROM (${AUTH_ERASURE_SNAPSHOT_SQL}) current
    WHERE current.snapshot = ? AND json_extract(current.snapshot, '$.eligible') = 1
    ON CONFLICT(request_id) DO NOTHING`)
    .bind(approval.requestId, owner.email, approval.caseReference.trim(), approval.recoveryReference.trim(),
      approval.reviewToken, JSON.stringify(snapshot.counts), approval.requestId, snapshot.raw).run();
  // D1 counts the receipt AND its trigger's deletions in meta.changes. An
  // accepted insert can therefore change many rows; only zero means no insert.
  if (!(result.meta.changes >= 1)) return { status: "conflict" as const };
  try { await journal.confirm(intent); }
  catch { return { status: "recovery-pending" as const, completesPrivacyRequest: false as const }; }
  return { status: "erased" as const, completesPrivacyRequest: false as const };
}
