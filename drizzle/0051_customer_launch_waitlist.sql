CREATE TABLE `customer_waitlist_signups` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`zip` text NOT NULL,
	`service` text NOT NULL,
	`launch_area` text NOT NULL,
	`marketing_consent` integer DEFAULT false NOT NULL,
	`request_key` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customer_waitlist_signups_request_key_unique` ON `customer_waitlist_signups` (`request_key`);--> statement-breakpoint
CREATE INDEX `customer_waitlist_signups_created_at_idx` ON `customer_waitlist_signups` (`created_at`);--> statement-breakpoint
CREATE INDEX `customer_waitlist_signups_zip_idx` ON `customer_waitlist_signups` (`zip`);
