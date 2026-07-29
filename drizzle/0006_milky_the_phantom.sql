ALTER TABLE `customer_requests` ADD `launch_area` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `customer_requests` ADD `municipality` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `provider_applications` ADD `business_municipality` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `provider_applications` ADD `insurance_expires_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `provider_applications` ADD `verification_status` text DEFAULT 'not reviewed' NOT NULL;--> statement-breakpoint
ALTER TABLE `provider_applications` ADD `verification_checklist` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `provider_applications` ADD `verified_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `provider_applications` ADD `verified_by` text DEFAULT '' NOT NULL;
