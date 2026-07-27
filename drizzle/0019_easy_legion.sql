CREATE TABLE `expansion_interests` (
	`id` text PRIMARY KEY NOT NULL,
	`audience` text NOT NULL,
	`provider_type` text DEFAULT '' NOT NULL,
	`locality` text NOT NULL,
	`state` text NOT NULL,
	`email` text NOT NULL,
	`request_key` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `expansion_interests_request_key_unique` ON `expansion_interests` (`request_key`);--> statement-breakpoint
CREATE INDEX `expansion_interests_created_at_idx` ON `expansion_interests` (`created_at`);--> statement-breakpoint
CREATE INDEX `expansion_interests_area_idx` ON `expansion_interests` (`state`,`locality`);--> statement-breakpoint
CREATE INDEX `expansion_interests_audience_idx` ON `expansion_interests` (`audience`);