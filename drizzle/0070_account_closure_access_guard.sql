-- Empty on installation. No account is closed by applying this migration.
-- A reviewed closure executor must establish scope/authority before inserting.
CREATE TABLE account_closures (
  email TEXT PRIMARY KEY NOT NULL CHECK(email = lower(trim(email)) AND length(email) > 0),
  privacy_request_id TEXT NOT NULL CHECK(length(trim(privacy_request_id)) > 0),
  case_reference TEXT NOT NULL CHECK(length(trim(case_reference)) >= 8),
  closed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  review_after TEXT NOT NULL CHECK(length(trim(review_after)) > 0)
);
--> statement-breakpoint
-- Session revocation and challenge invalidation occur in the closure insert's
-- transaction. Passwords, passkeys, phones, jobs and documents remain subject
-- to the approved disposition plan; this operation does not erase them.
CREATE TRIGGER account_closure_revoke_access AFTER INSERT ON account_closures
BEGIN
  DELETE FROM auth_sessions WHERE lower(trim(email)) = NEW.email;
  UPDATE login_codes SET used_at = CURRENT_TIMESTAMP
    WHERE lower(trim(email)) = NEW.email AND used_at = '';
  UPDATE password_verification_codes SET used_at = CURRENT_TIMESTAMP
    WHERE lower(trim(email)) = NEW.email AND used_at = '';
  UPDATE phone_login_codes SET used_at = CURRENT_TIMESTAMP
    WHERE used_at = '' AND (lower(trim(email)) = NEW.email
      OR (trim(email) = '' AND phone_e164 IN
        (SELECT phone_e164 FROM account_phone_numbers WHERE lower(trim(email)) = NEW.email)));
END;
--> statement-breakpoint
CREATE TRIGGER closed_account_session_insert BEFORE INSERT ON auth_sessions
WHEN EXISTS (SELECT 1 FROM account_closures WHERE email = lower(trim(NEW.email)))
BEGIN SELECT RAISE(ABORT, 'Account access is closed'); END;
--> statement-breakpoint
CREATE TRIGGER closed_account_session_update BEFORE UPDATE OF email, role ON auth_sessions
WHEN EXISTS (SELECT 1 FROM account_closures WHERE email = lower(trim(NEW.email)))
BEGIN SELECT RAISE(ABORT, 'Account access is closed'); END;
--> statement-breakpoint
CREATE TRIGGER closed_account_credentials_insert BEFORE INSERT ON account_credentials
WHEN EXISTS (SELECT 1 FROM account_closures WHERE email = lower(trim(NEW.email)))
BEGIN SELECT RAISE(ABORT, 'Account access is closed'); END;
--> statement-breakpoint
CREATE TRIGGER closed_account_credentials_update BEFORE UPDATE OF email, password_hash, password_salt, password_iterations ON account_credentials
WHEN EXISTS (SELECT 1 FROM account_closures WHERE email = lower(trim(NEW.email)))
BEGIN SELECT RAISE(ABORT, 'Account access is closed'); END;
--> statement-breakpoint
CREATE TRIGGER closed_account_login_code_insert BEFORE INSERT ON login_codes
WHEN EXISTS (SELECT 1 FROM account_closures WHERE email = lower(trim(NEW.email)))
BEGIN SELECT RAISE(ABORT, 'Account access is closed'); END;
--> statement-breakpoint
CREATE TRIGGER closed_account_password_code_insert BEFORE INSERT ON password_verification_codes
WHEN EXISTS (SELECT 1 FROM account_closures WHERE email = lower(trim(NEW.email)))
BEGIN SELECT RAISE(ABORT, 'Account access is closed'); END;
--> statement-breakpoint
CREATE TRIGGER closed_account_phone_insert BEFORE INSERT ON account_phone_numbers
WHEN EXISTS (SELECT 1 FROM account_closures WHERE email = lower(trim(NEW.email)))
BEGIN SELECT RAISE(ABORT, 'Account access is closed'); END;
--> statement-breakpoint
CREATE TRIGGER closed_account_phone_update BEFORE UPDATE OF email, phone_e164 ON account_phone_numbers
WHEN EXISTS (SELECT 1 FROM account_closures WHERE email = lower(trim(NEW.email)))
BEGIN SELECT RAISE(ABORT, 'Account access is closed'); END;
--> statement-breakpoint
CREATE TRIGGER closed_account_phone_code_insert BEFORE INSERT ON phone_login_codes
WHEN EXISTS (SELECT 1 FROM account_closures WHERE email = lower(trim(NEW.email)))
  OR (trim(NEW.email) = '' AND EXISTS (
    SELECT 1 FROM account_phone_numbers phone JOIN account_closures closed
      ON closed.email = lower(trim(phone.email)) WHERE phone.phone_e164 = NEW.phone_e164))
BEGIN SELECT RAISE(ABORT, 'Account access is closed'); END;
--> statement-breakpoint
CREATE TRIGGER closed_account_passkey_insert BEFORE INSERT ON passkey_credentials
WHEN EXISTS (SELECT 1 FROM account_closures WHERE email = lower(trim(NEW.email)))
BEGIN SELECT RAISE(ABORT, 'Account access is closed'); END;
--> statement-breakpoint
CREATE TRIGGER closed_account_passkey_update BEFORE UPDATE OF email, role, public_key ON passkey_credentials
WHEN EXISTS (SELECT 1 FROM account_closures WHERE email = lower(trim(NEW.email)))
BEGIN SELECT RAISE(ABORT, 'Account access is closed'); END;
