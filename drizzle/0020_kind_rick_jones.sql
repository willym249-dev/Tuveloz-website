CREATE TABLE `auth_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`last_seen_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_sessions_token_hash_unique` ON `auth_sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `auth_sessions_email_idx` ON `auth_sessions` (`email`);--> statement-breakpoint
CREATE INDEX `auth_sessions_expires_at_idx` ON `auth_sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `login_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`code_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`used_at` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `login_codes_email_role_idx` ON `login_codes` (`email`,`role`);--> statement-breakpoint
CREATE INDEX `login_codes_expires_at_idx` ON `login_codes` (`expires_at`);--> statement-breakpoint
CREATE INDEX `login_codes_created_at_idx` ON `login_codes` (`created_at`);--> statement-breakpoint
ALTER TABLE `provider_quotes` ADD `customer_fee_rate_bps` integer DEFAULT 1000 NOT NULL;--> statement-breakpoint
ALTER TABLE `provider_quotes` ADD `customer_fee_cents` text DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE `provider_quotes` ADD `customer_total_cents` text DEFAULT '0' NOT NULL;--> statement-breakpoint
CREATE INDEX `customer_requests_email_idx` ON `customer_requests` (`email`);--> statement-breakpoint
CREATE INDEX `provider_applications_email_idx` ON `provider_applications` (`email`);