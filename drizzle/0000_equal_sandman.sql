CREATE TABLE `customer_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`zip` text NOT NULL,
	`vehicle` text NOT NULL,
	`service` text NOT NULL,
	`details` text NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `customer_requests_created_at_idx` ON `customer_requests` (`created_at`);--> statement-breakpoint
CREATE INDEX `customer_requests_status_idx` ON `customer_requests` (`status`);--> statement-breakpoint
CREATE TABLE `provider_applications` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`service` text NOT NULL,
	`service_area` text NOT NULL,
	`experience` text NOT NULL,
	`insurance_status` text NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `provider_applications_created_at_idx` ON `provider_applications` (`created_at`);--> statement-breakpoint
CREATE INDEX `provider_applications_status_idx` ON `provider_applications` (`status`);