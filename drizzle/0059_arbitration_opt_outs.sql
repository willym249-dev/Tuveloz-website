CREATE TABLE `arbitration_opt_outs` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`role` text DEFAULT '' NOT NULL,
	`terms_version` text NOT NULL,
	`method` text NOT NULL,
	`recorded_at` text NOT NULL,
	`confirmation_sent_at` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `arbitration_opt_outs_email_terms_version_unique` ON `arbitration_opt_outs` (`email`,`terms_version`);
