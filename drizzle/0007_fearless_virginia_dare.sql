ALTER TABLE `customer_requests` ADD `is_test_job` text DEFAULT 'no' NOT NULL;--> statement-breakpoint
ALTER TABLE `provider_applications` ADD `is_test_provider` text DEFAULT 'no' NOT NULL;
