CREATE TABLE `account_service_area_settings` (
	`email` text NOT NULL,
	`role` text NOT NULL,
	`municipality` text DEFAULT '' NOT NULL,
	`zip` text DEFAULT '' NOT NULL,
	`service_locations` text DEFAULT '' NOT NULL,
	`service_address` text DEFAULT '' NOT NULL,
	`service_area` text DEFAULT '' NOT NULL,
	`work_locations` text DEFAULT '' NOT NULL,
	`travel_radius_miles` integer DEFAULT 0 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`email`, `role`)
);
--> statement-breakpoint
CREATE INDEX `account_service_area_settings_role_idx` ON `account_service_area_settings` (`role`);
--> statement-breakpoint
CREATE INDEX `account_service_area_settings_updated_at_idx` ON `account_service_area_settings` (`updated_at`);
