CREATE TABLE `passkey_credentials` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`webauthn_user_id` text NOT NULL,
	`public_key` text NOT NULL,
	`counter` integer DEFAULT 0 NOT NULL,
	`transports` text DEFAULT '[]' NOT NULL,
	`device_type` text NOT NULL,
	`backed_up` text DEFAULT 'no' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`last_used_at` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `passkey_credentials_email_role_idx` ON `passkey_credentials` (`email`,`role`);--> statement-breakpoint
CREATE INDEX `passkey_credentials_webauthn_user_id_idx` ON `passkey_credentials` (`webauthn_user_id`);--> statement-breakpoint
CREATE INDEX `passkey_credentials_last_used_at_idx` ON `passkey_credentials` (`last_used_at`);