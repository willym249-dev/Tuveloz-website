CREATE TABLE `phone_contact_consents` (
	`id` text PRIMARY KEY NOT NULL,
	`role` text NOT NULL,
	`email` text NOT NULL,
	`phone` text NOT NULL,
	`source` text DEFAULT '' NOT NULL,
	`sms_marketing_consent_text` text DEFAULT '' NOT NULL,
	`sms_marketing_consent_version` text DEFAULT '' NOT NULL,
	`sms_marketing_consented_at` text DEFAULT '' NOT NULL,
	`sms_marketing_revoked_at` text DEFAULT '' NOT NULL,
	`revoke_token` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `phone_contact_consents_role_email_unique` ON `phone_contact_consents` (`role`,`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `phone_contact_consents_revoke_token_unique` ON `phone_contact_consents` (`revoke_token`);--> statement-breakpoint
CREATE INDEX `phone_contact_consents_marketing_idx` ON `phone_contact_consents` (`sms_marketing_revoked_at`,`sms_marketing_consented_at`);
