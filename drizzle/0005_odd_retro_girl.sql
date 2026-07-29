CREATE TABLE `job_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`provider_name` text NOT NULL,
	`provider_email` text NOT NULL,
	`customer_display_name` text NOT NULL,
	`service` text NOT NULL,
	`rating` integer NOT NULL,
	`comment` text NOT NULL,
	`status` text DEFAULT 'published' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `job_reviews_request_id_unique` ON `job_reviews` (`request_id`);--> statement-breakpoint
CREATE INDEX `job_reviews_provider_email_idx` ON `job_reviews` (`provider_email`);--> statement-breakpoint
CREATE INDEX `job_reviews_created_at_idx` ON `job_reviews` (`created_at`);--> statement-breakpoint
CREATE INDEX `job_reviews_status_idx` ON `job_reviews` (`status`);
