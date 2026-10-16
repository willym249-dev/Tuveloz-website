-- Internal recovery maintenance only. Empty history means normal writes.
-- No route enables this control. A pause affects sign-in and privacy writes;
-- installation alone does not pause anything or authorize real erasure.
CREATE TABLE privacy_recovery_fences (
  generation INTEGER PRIMARY KEY NOT NULL CHECK(generation > 0 AND generation <= 9007199254740991),
  paused INTEGER NOT NULL CHECK(paused IN (0, 1)),
  case_reference TEXT NOT NULL CHECK(length(trim(case_reference)) BETWEEN 8 AND 200),
  changed_by TEXT NOT NULL,
  changed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TRIGGER privacy_recovery_fence_append BEFORE INSERT ON privacy_recovery_fences
BEGIN
  SELECT (CASE WHEN NEW.generation != COALESCE((SELECT max(generation) FROM privacy_recovery_fences), 0) + 1
    OR NEW.paused = COALESCE((SELECT paused FROM privacy_recovery_fences ORDER BY generation DESC LIMIT 1), 0)
    OR (NEW.paused = 0 AND NEW.case_reference != (SELECT case_reference FROM privacy_recovery_fences ORDER BY generation DESC LIMIT 1))
    THEN RAISE(ABORT, 'Recovery pause transition is stale') END);
END;
--> statement-breakpoint
CREATE TRIGGER privacy_recovery_fence_no_update BEFORE UPDATE ON privacy_recovery_fences
BEGIN SELECT RAISE(ABORT, 'Recovery pause history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER privacy_recovery_fence_no_delete BEFORE DELETE ON privacy_recovery_fences
BEGIN SELECT RAISE(ABORT, 'Recovery pause history is immutable'); END;
--> statement-breakpoint
CREATE TRIGGER privacy_pause_auth_sessions_insert BEFORE INSERT ON auth_sessions
WHEN (SELECT paused FROM privacy_recovery_fences ORDER BY generation DESC LIMIT 1) = 1
BEGIN SELECT RAISE(ABORT, 'Authentication recovery maintenance is active'); END;
--> statement-breakpoint
CREATE TRIGGER privacy_pause_auth_sessions_update BEFORE UPDATE ON auth_sessions
WHEN (SELECT paused FROM privacy_recovery_fences ORDER BY generation DESC LIMIT 1) = 1
BEGIN SELECT RAISE(ABORT, 'Authentication recovery maintenance is active'); END;
--> statement-breakpoint
CREATE TRIGGER privacy_pause_auth_sessions_delete BEFORE DELETE ON auth_sessions
WHEN (SELECT paused FROM privacy_recovery_fences ORDER BY generation DESC LIMIT 1) = 1
BEGIN SELECT RAISE(ABORT, 'Authentication recovery maintenance is active'); END;
--> statement-breakpoint
CREATE TRIGGER privacy_pause_account_credentials_insert BEFORE INSERT ON account_credentials
WHEN (SELECT paused FROM privacy_recovery_fences ORDER BY generation DESC LIMIT 1) = 1
BEGIN SELECT RAISE(ABORT, 'Authentication recovery maintenance is active'); END;
--> statement-breakpoint
CREATE TRIGGER privacy_pause_account_credentials_update BEFORE UPDATE ON account_credentials
WHEN (SELECT paused FROM privacy_recovery_fences ORDER BY generation DESC LIMIT 1) = 1
BEGIN SELECT RAISE(ABORT, 'Authentication recovery maintenance is active'); END;
--> statement-breakpoint
CREATE TRIGGER privacy_pause_account_credentials_delete BEFORE DELETE ON account_credentials
WHEN (SELECT paused FROM privacy_recovery_fences ORDER BY generation DESC LIMIT 1) = 1
BEGIN SELECT RAISE(ABORT, 'Authentication recovery maintenance is active'); END;
--> statement-breakpoint
CREATE TRIGGER privacy_pause_login_codes_insert BEFORE INSERT ON login_codes
WHEN (SELECT paused FROM privacy_recovery_fences ORDER BY generation DESC LIMIT 1) = 1
BEGIN SELECT RAISE(ABORT, 'Authentication recovery maintenance is active'); END;
--> statement-breakpoint
CREATE TRIGGER privacy_pause_login_codes_update BEFORE UPDATE ON login_codes
WHEN (SELECT paused FROM privacy_recovery_fences ORDER BY generation DESC LIMIT 1) = 1
BEGIN SELECT RAISE(ABORT, 'Authentication recovery maintenance is active'); END;
--> statement-breakpoint
CREATE TRIGGER privacy_pause_login_codes_delete BEFORE DELETE ON login_codes
WHEN (SELECT paused FROM privacy_recovery_fences ORDER BY generation DESC LIMIT 1) = 1
BEGIN SELECT RAISE(ABORT, 'Authentication recovery maintenance is active'); END;
--> statement-breakpoint
CREATE TRIGGER privacy_pause_password_verification_codes_insert BEFORE INSERT ON password_verification_codes
WHEN (SELECT paused FROM privacy_recovery_fences ORDER BY generation DESC LIMIT 1) = 1
BEGIN SELECT RAISE(ABORT, 'Authentication recovery maintenance is active'); END;
--> statement-breakpoint
CREATE TRIGGER privacy_pause_password_verification_codes_update BEFORE UPDATE ON password_verification_codes
WHEN (SELECT paused FROM privacy_recovery_fences ORDER BY generation DESC LIMIT 1) = 1
BEGIN SELECT RAISE(ABORT, 'Authentication recovery maintenance is active'); END;
--> statement-breakpoint
CREATE TRIGGER privacy_pause_password_verification_codes_delete BEFORE DELETE ON password_verification_codes
WHEN (SELECT paused FROM privacy_recovery_fences ORDER BY generation DESC LIMIT 1) = 1
BEGIN SELECT RAISE(ABORT, 'Authentication recovery maintenance is active'); END;
--> statement-breakpoint
CREATE TRIGGER privacy_pause_passkey_credentials_insert BEFORE INSERT ON passkey_credentials
WHEN (SELECT paused FROM privacy_recovery_fences ORDER BY generation DESC LIMIT 1) = 1
BEGIN SELECT RAISE(ABORT, 'Authentication recovery maintenance is active'); END;
--> statement-breakpoint
CREATE TRIGGER privacy_pause_passkey_credentials_update BEFORE UPDATE ON passkey_credentials
WHEN (SELECT paused FROM privacy_recovery_fences ORDER BY generation DESC LIMIT 1) = 1
BEGIN SELECT RAISE(ABORT, 'Authentication recovery maintenance is active'); END;
--> statement-breakpoint
CREATE TRIGGER privacy_pause_passkey_credentials_delete BEFORE DELETE ON passkey_credentials
WHEN (SELECT paused FROM privacy_recovery_fences ORDER BY generation DESC LIMIT 1) = 1
BEGIN SELECT RAISE(ABORT, 'Authentication recovery maintenance is active'); END;
--> statement-breakpoint
CREATE TRIGGER privacy_pause_account_phone_numbers_insert BEFORE INSERT ON account_phone_numbers
WHEN (SELECT paused FROM privacy_recovery_fences ORDER BY generation DESC LIMIT 1) = 1
BEGIN SELECT RAISE(ABORT, 'Authentication recovery maintenance is active'); END;
--> statement-breakpoint
CREATE TRIGGER privacy_pause_account_phone_numbers_update BEFORE UPDATE ON account_phone_numbers
WHEN (SELECT paused FROM privacy_recovery_fences ORDER BY generation DESC LIMIT 1) = 1
BEGIN SELECT RAISE(ABORT, 'Authentication recovery maintenance is active'); END;
--> statement-breakpoint
CREATE TRIGGER privacy_pause_account_phone_numbers_delete BEFORE DELETE ON account_phone_numbers
WHEN (SELECT paused FROM privacy_recovery_fences ORDER BY generation DESC LIMIT 1) = 1
BEGIN SELECT RAISE(ABORT, 'Authentication recovery maintenance is active'); END;
--> statement-breakpoint
CREATE TRIGGER privacy_pause_phone_login_codes_insert BEFORE INSERT ON phone_login_codes
WHEN (SELECT paused FROM privacy_recovery_fences ORDER BY generation DESC LIMIT 1) = 1
BEGIN SELECT RAISE(ABORT, 'Authentication recovery maintenance is active'); END;
--> statement-breakpoint
CREATE TRIGGER privacy_pause_phone_login_codes_update BEFORE UPDATE ON phone_login_codes
WHEN (SELECT paused FROM privacy_recovery_fences ORDER BY generation DESC LIMIT 1) = 1
BEGIN SELECT RAISE(ABORT, 'Authentication recovery maintenance is active'); END;
--> statement-breakpoint
CREATE TRIGGER privacy_pause_phone_login_codes_delete BEFORE DELETE ON phone_login_codes
WHEN (SELECT paused FROM privacy_recovery_fences ORDER BY generation DESC LIMIT 1) = 1
BEGIN SELECT RAISE(ABORT, 'Authentication recovery maintenance is active'); END;
--> statement-breakpoint
CREATE TRIGGER privacy_pause_account_closures_insert BEFORE INSERT ON account_closures
WHEN (SELECT paused FROM privacy_recovery_fences ORDER BY generation DESC LIMIT 1) = 1
BEGIN SELECT RAISE(ABORT, 'Authentication recovery maintenance is active'); END;
--> statement-breakpoint
CREATE TRIGGER privacy_pause_account_closures_update BEFORE UPDATE ON account_closures
WHEN (SELECT paused FROM privacy_recovery_fences ORDER BY generation DESC LIMIT 1) = 1
BEGIN SELECT RAISE(ABORT, 'Authentication recovery maintenance is active'); END;
--> statement-breakpoint
CREATE TRIGGER privacy_pause_account_closures_delete BEFORE DELETE ON account_closures
WHEN (SELECT paused FROM privacy_recovery_fences ORDER BY generation DESC LIMIT 1) = 1
BEGIN SELECT RAISE(ABORT, 'Authentication recovery maintenance is active'); END;
--> statement-breakpoint
CREATE TRIGGER privacy_pause_privacy_access_closure_reviews_insert BEFORE INSERT ON privacy_access_closure_reviews
WHEN (SELECT paused FROM privacy_recovery_fences ORDER BY generation DESC LIMIT 1) = 1
BEGIN SELECT RAISE(ABORT, 'Authentication recovery maintenance is active'); END;
--> statement-breakpoint
CREATE TRIGGER privacy_pause_privacy_access_closure_reviews_update BEFORE UPDATE ON privacy_access_closure_reviews
WHEN (SELECT paused FROM privacy_recovery_fences ORDER BY generation DESC LIMIT 1) = 1
BEGIN SELECT RAISE(ABORT, 'Authentication recovery maintenance is active'); END;
--> statement-breakpoint
CREATE TRIGGER privacy_pause_privacy_access_closure_reviews_delete BEFORE DELETE ON privacy_access_closure_reviews
WHEN (SELECT paused FROM privacy_recovery_fences ORDER BY generation DESC LIMIT 1) = 1
BEGIN SELECT RAISE(ABORT, 'Authentication recovery maintenance is active'); END;
--> statement-breakpoint
CREATE TRIGGER privacy_pause_privacy_auth_erasure_records_insert BEFORE INSERT ON privacy_auth_erasure_records
WHEN (SELECT paused FROM privacy_recovery_fences ORDER BY generation DESC LIMIT 1) = 1
BEGIN SELECT RAISE(ABORT, 'Authentication recovery maintenance is active'); END;
--> statement-breakpoint
CREATE TRIGGER privacy_pause_privacy_auth_erasure_records_update BEFORE UPDATE ON privacy_auth_erasure_records
WHEN (SELECT paused FROM privacy_recovery_fences ORDER BY generation DESC LIMIT 1) = 1
BEGIN SELECT RAISE(ABORT, 'Authentication recovery maintenance is active'); END;
--> statement-breakpoint
CREATE TRIGGER privacy_pause_privacy_auth_erasure_records_delete BEFORE DELETE ON privacy_auth_erasure_records
WHEN (SELECT paused FROM privacy_recovery_fences ORDER BY generation DESC LIMIT 1) = 1
BEGIN SELECT RAISE(ABORT, 'Authentication recovery maintenance is active'); END;
--> statement-breakpoint
CREATE TRIGGER privacy_pause_privacy_requests_insert BEFORE INSERT ON privacy_requests
WHEN (SELECT paused FROM privacy_recovery_fences ORDER BY generation DESC LIMIT 1) = 1
BEGIN SELECT RAISE(ABORT, 'Authentication recovery maintenance is active'); END;
--> statement-breakpoint
CREATE TRIGGER privacy_pause_privacy_requests_update BEFORE UPDATE ON privacy_requests
WHEN (SELECT paused FROM privacy_recovery_fences ORDER BY generation DESC LIMIT 1) = 1
BEGIN SELECT RAISE(ABORT, 'Authentication recovery maintenance is active'); END;
--> statement-breakpoint
CREATE TRIGGER privacy_pause_privacy_requests_delete BEFORE DELETE ON privacy_requests
WHEN (SELECT paused FROM privacy_recovery_fences ORDER BY generation DESC LIMIT 1) = 1
BEGIN SELECT RAISE(ABORT, 'Authentication recovery maintenance is active'); END;
