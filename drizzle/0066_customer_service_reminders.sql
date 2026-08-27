CREATE TABLE `customer_service_reminders` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_email` text NOT NULL,
	`vehicle` text NOT NULL,
	`service` text NOT NULL,
	`due_date` text DEFAULT '' NOT NULL,
	`due_mileage` integer DEFAULT 0 NOT NULL,
	`current_mileage` integer DEFAULT 0 NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`source_request_id` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `customer_service_reminders_email_status_idx` ON `customer_service_reminders` (`customer_email`,`status`,`due_date`);--> statement-breakpoint
CREATE INDEX `customer_service_reminders_source_idx` ON `customer_service_reminders` (`source_request_id`);
