CREATE TABLE `policy_acceptances` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`bundle_version` text NOT NULL,
	`acceptance_text` text DEFAULT '' NOT NULL,
	`accepted_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `policy_acceptances_email_idx` ON `policy_acceptances` (`email`);
