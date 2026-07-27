ALTER TABLE `provider_applications` ADD `access_token` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `provider_applications` ADD `alerts_enabled` text DEFAULT 'yes' NOT NULL;