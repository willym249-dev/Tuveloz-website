import { PRIVACY_CLOSURE_SUBJECT_SQL, UNUSED_ACCOUNT_CLOSURE_PREDICATE } from "./privacy-closure-preview";

export async function privacyReviewToken(rows: { item: string; value: string }[]) {
  const stable = [...rows].sort((a, b) => a.item.localeCompare(b.item));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(stable)));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

// Request identity/state and unused-account conditions are rechecked inside the
// write itself. The review is separately recorded in the same D1 transaction.
export const CLOSE_UNUSED_ACCOUNT_SQL = `${PRIVACY_CLOSURE_SUBJECT_SQL}
INSERT INTO account_closures (email, privacy_request_id, case_reference, review_after)
SELECT lower(trim(email)), id, ?, ? FROM subject
 WHERE request_type = 'account-closure' AND status IN ('submitted','in-review')
   AND identity_source = 'signed-in-account'
   AND email = ? AND role = ? AND status = ? AND updated_at = ?
   AND details = ? AND resolution_note = ?
   AND NOT EXISTS (SELECT 1 FROM privacy_access_closure_reviews review WHERE review.request_id = subject.id)
   AND ${UNUSED_ACCOUNT_CLOSURE_PREDICATE}
ON CONFLICT(email) DO NOTHING`;
