CREATE TABLE `provider_gallery_items` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_id` text NOT NULL,
	`image_key` text NOT NULL,
	`image_type` text NOT NULL,
	`caption` text DEFAULT '' NOT NULL,
	`service` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `provider_gallery_items_provider_id_idx` ON `provider_gallery_items` (`provider_id`);--> statement-breakpoint
CREATE INDEX `provider_gallery_items_created_at_idx` ON `provider_gallery_items` (`created_at`);--> statement-breakpoint
CREATE TABLE `provider_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_id` text NOT NULL,
	`slug` text NOT NULL,
	`business_name` text NOT NULL,
	`headline` text DEFAULT '' NOT NULL,
	`about` text DEFAULT '' NOT NULL,
	`years_experience` text DEFAULT '' NOT NULL,
	`availability_status` text DEFAULT 'Available now' NOT NULL,
	`availability_note` text DEFAULT '' NOT NULL,
	`business_hours` text DEFAULT '' NOT NULL,
	`logo_image_key` text DEFAULT '' NOT NULL,
	`logo_image_type` text DEFAULT '' NOT NULL,
	`public_status` text DEFAULT 'draft' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `provider_profiles_provider_id_unique` ON `provider_profiles` (`provider_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `provider_profiles_slug_unique` ON `provider_profiles` (`slug`);--> statement-breakpoint
CREATE INDEX `provider_profiles_public_status_idx` ON `provider_profiles` (`public_status`);
