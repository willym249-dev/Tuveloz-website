CREATE TABLE `provider_quotes` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`provider_name` text NOT NULL,
	`provider_email` text NOT NULL,
	`price_cents` text NOT NULL,
	`availability` text NOT NULL,
	`message` text NOT NULL,
	`status` text DEFAULT 'submitted' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `provider_quotes_request_id_idx` ON `provider_quotes` (`request_id`);--> statement-breakpoint
CREATE INDEX `provider_quotes_created_at_idx` ON `provider_quotes` (`created_at`);--> statement-breakpoint
ALTER TABLE `customer_requests` ADD `access_token` text DEFAULT '' NOT NULL;
