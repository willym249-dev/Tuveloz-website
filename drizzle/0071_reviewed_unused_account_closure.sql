-- Private review evidence, not a statement of deletion or legal approval.
CREATE TABLE privacy_access_closure_reviews (
  request_id TEXT PRIMARY KEY NOT NULL,
  reviewed_by TEXT NOT NULL,
  scope TEXT NOT NULL CHECK(scope = 'whole-account-access'),
  case_reference TEXT NOT NULL,
  review_after TEXT NOT NULL,
  retention_notes TEXT NOT NULL CHECK(length(trim(retention_notes)) >= 20),
  snapshot_digest TEXT NOT NULL CHECK(length(snapshot_digest) = 64),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
-- A request validated before closure cannot create a job/quote after closure.
CREATE TRIGGER closed_account_customer_request_insert BEFORE INSERT ON customer_requests
WHEN EXISTS (SELECT 1 FROM account_closures WHERE email = lower(trim(NEW.email)))
BEGIN SELECT RAISE(ABORT, 'Account access is closed'); END;
--> statement-breakpoint
CREATE TRIGGER closed_account_provider_quote_insert BEFORE INSERT ON provider_quotes
WHEN EXISTS (SELECT 1 FROM account_closures WHERE email = lower(trim(NEW.provider_email)))
  OR EXISTS (SELECT 1 FROM customer_requests request JOIN account_closures closed
    ON closed.email = lower(trim(request.email)) WHERE request.id = NEW.request_id)
BEGIN SELECT RAISE(ABORT, 'Account access is closed'); END;
