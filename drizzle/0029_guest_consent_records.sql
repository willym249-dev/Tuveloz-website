ALTER TABLE `customer_requests` ADD `remember_email_consent` text DEFAULT 'no' NOT NULL;
--> statement-breakpoint
ALTER TABLE `customer_requests` ADD `remember_email_consent_text` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `customer_requests` ADD `marketing_consent` text DEFAULT 'no' NOT NULL;
--> statement-breakpoint
ALTER TABLE `customer_requests` ADD `marketing_consent_text` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `customer_requests` ADD `consent_version` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `customer_requests` ADD `consent_source` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `customer_requests` ADD `consent_recorded_at` text DEFAULT '' NOT NULL;
