CREATE TABLE `customer_vehicles` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_email` text NOT NULL,
	`label` text DEFAULT '' NOT NULL,
	`year` text DEFAULT '' NOT NULL,
	`make` text NOT NULL,
	`model` text NOT NULL,
	`trim` text DEFAULT '' NOT NULL,
	`color` text DEFAULT '' NOT NULL,
	`plate` text DEFAULT '' NOT NULL,
	`vin` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`archived` text DEFAULT 'no' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `customer_vehicles_email_idx` ON `customer_vehicles` (`customer_email`,`archived`);--> statement-breakpoint
CREATE INDEX `customer_vehicles_created_at_idx` ON `customer_vehicles` (`created_at`);--> statement-breakpoint
CREATE TABLE `fleet_inquiries` (
	`id` text PRIMARY KEY NOT NULL,
	`company_name` text NOT NULL,
	`contact_name` text NOT NULL,
	`email` text NOT NULL,
	`fleet_size` text NOT NULL,
	`vehicle_types` text DEFAULT '' NOT NULL,
	`municipality` text DEFAULT '' NOT NULL,
	`services_needed` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`request_key` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fleet_inquiries_request_key_unique` ON `fleet_inquiries` (`request_key`);--> statement-breakpoint
CREATE INDEX `fleet_inquiries_status_idx` ON `fleet_inquiries` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `fleet_inquiries_created_at_idx` ON `fleet_inquiries` (`created_at`);
