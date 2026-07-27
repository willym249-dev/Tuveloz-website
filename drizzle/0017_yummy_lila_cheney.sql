ALTER TABLE `provider_profiles` ADD `profile_view_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `provider_quotes` ADD `decline_reason` text DEFAULT '' NOT NULL;