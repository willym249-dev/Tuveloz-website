ALTER TABLE `provider_applications` ADD `preferred_language` text DEFAULT 'English' NOT NULL;--> statement-breakpoint
ALTER TABLE `provider_applications` ADD `service_rules_version` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `provider_applications` ADD `service_rules_acknowledged_at` text DEFAULT '' NOT NULL;