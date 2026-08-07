CREATE TABLE `referral_codes` (
	`code` text PRIMARY KEY NOT NULL,
	`owner_role` text NOT NULL,
	`owner_email` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `referral_codes_owner_unique` ON `referral_codes` (`owner_role`,`owner_email`);--> statement-breakpoint
CREATE INDEX `referral_codes_status_idx` ON `referral_codes` (`status`);--> statement-breakpoint
CREATE TABLE `referral_signups` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`referrer_role` text NOT NULL,
	`referrer_email` text NOT NULL,
	`referred_role` text NOT NULL,
	`referred_entity_id` text DEFAULT '' NOT NULL,
	`referred_key` text NOT NULL,
	`status` text DEFAULT 'recorded' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `referral_signups_referred_unique` ON `referral_signups` (`referred_role`,`referred_key`);--> statement-breakpoint
CREATE INDEX `referral_signups_code_idx` ON `referral_signups` (`code`,`created_at`);--> statement-breakpoint
CREATE INDEX `referral_signups_referrer_idx` ON `referral_signups` (`referrer_role`,`referrer_email`);
