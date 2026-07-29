ALTER TABLE `customer_requests` ADD `service_locations` text DEFAULT 'Provider comes to me' NOT NULL;--> statement-breakpoint
ALTER TABLE `customer_requests` ADD `service_address` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `provider_applications` ADD `work_locations` text DEFAULT 'I travel to customers' NOT NULL;--> statement-breakpoint
ALTER TABLE `provider_applications` ADD `business_service_address` text DEFAULT '' NOT NULL;
