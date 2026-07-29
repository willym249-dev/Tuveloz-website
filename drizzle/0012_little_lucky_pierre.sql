ALTER TABLE `customer_requests` ADD `approved_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `customer_requests` ADD `reminder_sent_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `customer_requests` ADD `reminder_last_attempt_at` text DEFAULT '' NOT NULL;
