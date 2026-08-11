-- Launch-notification opt-in, captured at customer account creation.
--
-- Deliberately a separate flag from marketing_email: this consent is scoped to
-- "we opened customer requests, plus essential launch updates" and must not be
-- treated as permission for a broader marketing list. Keeping it in its own
-- column means revoking one never silently revokes or grants the other.
--
-- The three consent-provenance columns exist so the record can answer when the
-- person agreed, to which policy bundle version, and from which surface —
-- without which a stored "yes" is an assertion with no evidence behind it.
--
-- Additive only. Existing rows default to no consent, which is the correct and
-- safe reading of "this person was never asked".
ALTER TABLE account_communication_preferences ADD COLUMN launch_notification_email text DEFAULT 'no' NOT NULL;
--> statement-breakpoint
ALTER TABLE account_communication_preferences ADD COLUMN launch_notification_consent_at text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE account_communication_preferences ADD COLUMN launch_notification_consent_version text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE account_communication_preferences ADD COLUMN launch_notification_consent_source text DEFAULT '' NOT NULL;
