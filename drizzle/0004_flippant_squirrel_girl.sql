ALTER TABLE `customer_requests` ADD `issue_image_key` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `customer_requests` ADD `issue_image_type` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `customer_requests` ADD `completion_image_key` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `customer_requests` ADD `completion_image_type` text DEFAULT '' NOT NULL;