CREATE TABLE `account_credentials` (
	`email` text PRIMARY KEY NOT NULL,
	`password_hash` text NOT NULL,
	`password_salt` text NOT NULL,
	`password_iterations` integer NOT NULL,
	`verified_at` text NOT NULL,
	`failed_attempts` integer DEFAULT 0 NOT NULL,
	`locked_until` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `account_credentials_locked_until_idx` ON `account_credentials` (`locked_until`);--> statement-breakpoint
CREATE TABLE `password_verification_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`purpose` text NOT NULL,
	`code_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`used_at` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `password_codes_email_role_purpose_idx` ON `password_verification_codes` (`email`,`role`,`purpose`);--> statement-breakpoint
CREATE INDEX `password_codes_expires_at_idx` ON `password_verification_codes` (`expires_at`);--> statement-breakpoint
CREATE INDEX `password_codes_created_at_idx` ON `password_verification_codes` (`created_at`);