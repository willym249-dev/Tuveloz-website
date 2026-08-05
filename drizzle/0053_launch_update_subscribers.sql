CREATE TABLE `launch_update_subscribers` (
	`email` text PRIMARY KEY NOT NULL,
	`source` text DEFAULT '' NOT NULL,
	`language` text DEFAULT 'en' NOT NULL,
	`consent_text` text DEFAULT '' NOT NULL,
	`consent_version` text DEFAULT '' NOT NULL,
	`consented_at` text DEFAULT '' NOT NULL,
	`unsubscribed_at` text DEFAULT '' NOT NULL,
	`unsubscribe_token` text NOT NULL,
	`last_step_sent` integer DEFAULT -1 NOT NULL,
	`last_step_sent_at` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `launch_update_subscribers_token_unique` ON `launch_update_subscribers` (`unsubscribe_token`);--> statement-breakpoint
CREATE INDEX `launch_update_subscribers_step_idx` ON `launch_update_subscribers` (`unsubscribed_at`,`last_step_sent`);