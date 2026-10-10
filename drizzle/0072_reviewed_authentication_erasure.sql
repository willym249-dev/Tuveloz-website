-- Empty on installation. Internal erasure engine only; no public action is enabled.
CREATE TABLE privacy_auth_erasure_records (
  request_id TEXT PRIMARY KEY NOT NULL,
  scope TEXT NOT NULL CHECK(scope = 'authentication-records'),
  approved_by TEXT NOT NULL,
  case_reference TEXT NOT NULL CHECK(length(trim(case_reference)) >= 8),
  recovery_reference TEXT NOT NULL CHECK(length(trim(recovery_reference)) >= 8),
  snapshot_digest TEXT NOT NULL CHECK(length(snapshot_digest) = 64),
  record_counts TEXT NOT NULL CHECK(json_valid(record_counts)),
  completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
-- The receipt and all removals share one SQLite statement/transaction.
CREATE TRIGGER privacy_auth_erasure_apply AFTER INSERT ON privacy_auth_erasure_records
BEGIN
  SELECT (CASE WHEN NOT EXISTS (
    SELECT 1 FROM account_closures closed JOIN privacy_requests request
      ON closed.privacy_request_id = request.id AND closed.email = lower(trim(request.email))
    JOIN privacy_access_closure_reviews review ON review.request_id = request.id
    WHERE request.id = NEW.request_id AND request.request_type = 'account-closure'
      AND request.status IN ('submitted', 'in-review')
      AND request.identity_source = 'signed-in-account'
  ) THEN RAISE(ABORT, 'Reviewed account closure required') END);
  DELETE FROM phone_login_codes WHERE lower(trim(email)) IN
    (SELECT lower(trim(email)) FROM privacy_requests WHERE id = NEW.request_id)
    OR (trim(email) = '' AND phone_e164 IN (SELECT phone_e164 FROM account_phone_numbers
      WHERE lower(trim(email)) IN (SELECT lower(trim(email)) FROM privacy_requests WHERE id = NEW.request_id)));
  DELETE FROM auth_sessions WHERE lower(trim(email)) IN (SELECT lower(trim(email)) FROM privacy_requests WHERE id = NEW.request_id);
  DELETE FROM login_codes WHERE lower(trim(email)) IN (SELECT lower(trim(email)) FROM privacy_requests WHERE id = NEW.request_id);
  DELETE FROM password_verification_codes WHERE lower(trim(email)) IN (SELECT lower(trim(email)) FROM privacy_requests WHERE id = NEW.request_id);
  DELETE FROM passkey_credentials WHERE lower(trim(email)) IN (SELECT lower(trim(email)) FROM privacy_requests WHERE id = NEW.request_id);
  DELETE FROM account_credentials WHERE lower(trim(email)) IN (SELECT lower(trim(email)) FROM privacy_requests WHERE id = NEW.request_id);
  DELETE FROM account_phone_numbers WHERE lower(trim(email)) IN (SELECT lower(trim(email)) FROM privacy_requests WHERE id = NEW.request_id);
END;
