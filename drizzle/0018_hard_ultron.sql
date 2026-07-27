ALTER TABLE `customer_requests` ADD `budget_range` text DEFAULT 'I''m flexible' NOT NULL;--> statement-breakpoint
ALTER TABLE `customer_requests` ADD `preferred_provider_email` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `customer_requests` ADD `preferred_provider_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `customer_requests` ADD `repeat_of_request_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `customer_requests_preferred_provider_idx` ON `customer_requests` (`preferred_provider_email`);