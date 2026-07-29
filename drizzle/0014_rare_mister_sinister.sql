CREATE TABLE `provider_job_records` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`provider_email` text NOT NULL,
	`work_status` text DEFAULT 'scheduled' NOT NULL,
	`timer_started_at` text DEFAULT '' NOT NULL,
	`tracked_seconds` integer DEFAULT 0 NOT NULL,
	`billable_minutes` integer DEFAULT 0 NOT NULL,
	`work_notes` text DEFAULT '' NOT NULL,
	`parts_notes` text DEFAULT '' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `provider_job_records_request_provider_unique` ON `provider_job_records` (`request_id`,`provider_email`);--> statement-breakpoint
CREATE INDEX `provider_job_records_provider_email_idx` ON `provider_job_records` (`provider_email`);--> statement-breakpoint
CREATE INDEX `provider_job_records_updated_at_idx` ON `provider_job_records` (`updated_at`);
