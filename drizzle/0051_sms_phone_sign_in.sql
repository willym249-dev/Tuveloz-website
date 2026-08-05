CREATE TABLE `account_phone_numbers` (
	`email` text PRIMARY KEY NOT NULL,
	`phone_e164` text NOT NULL,
	`verified_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `account_phone_numbers_phone_unique` ON `account_phone_numbers` (`phone_e164`);--> statement-breakpoint
CREATE TABLE `phone_login_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`phone_e164` text NOT NULL,
	`purpose` text NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`code_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`used_at` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `phone_login_codes_phone_purpose_idx` ON `phone_login_codes` (`phone_e164`,`purpose`);--> statement-breakpoint
CREATE INDEX `phone_login_codes_email_purpose_idx` ON `phone_login_codes` (`email`,`purpose`);--> statement-breakpoint
CREATE INDEX `phone_login_codes_expires_at_idx` ON `phone_login_codes` (`expires_at`);--> statement-breakpoint
CREATE INDEX `phone_login_codes_created_at_idx` ON `phone_login_codes` (`created_at`);
