CREATE TABLE `customer_profiles` (
	`email` text PRIMARY KEY NOT NULL,
	`display_name` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`email_notifications` text DEFAULT 'important' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `customer_profiles_updated_at_idx` ON `customer_profiles` (`updated_at`);
--> statement-breakpoint
CREATE TABLE `saved_providers` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_email` text NOT NULL,
	`provider_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `saved_providers_customer_provider_unique` ON `saved_providers` (`customer_email`,`provider_id`);
--> statement-breakpoint
CREATE INDEX `saved_providers_customer_email_idx` ON `saved_providers` (`customer_email`);
--> statement-breakpoint
CREATE INDEX `saved_providers_created_at_idx` ON `saved_providers` (`created_at`);
--> statement-breakpoint
CREATE TABLE `job_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`sender_email` text NOT NULL,
	`sender_role` text NOT NULL,
	`recipient_email` text NOT NULL,
	`body` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `job_messages_request_created_idx` ON `job_messages` (`request_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `job_messages_recipient_email_idx` ON `job_messages` (`recipient_email`);
--> statement-breakpoint
CREATE INDEX `job_messages_sender_email_idx` ON `job_messages` (`sender_email`);
