CREATE TABLE `analytics_events` (
	`id` text PRIMARY KEY NOT NULL,
	`event` text NOT NULL,
	`props` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX `analytics_events_event_created_at_idx` ON `analytics_events` (`event`,`created_at`);
