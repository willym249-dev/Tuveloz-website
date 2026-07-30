CREATE TABLE `stripe_customers` (
	`customer_email` text PRIMARY KEY NOT NULL,
	`stripe_customer_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stripe_customers_customer_id_unique` ON `stripe_customers` (`stripe_customer_id`);
--> statement-breakpoint
CREATE INDEX `stripe_customers_updated_at_idx` ON `stripe_customers` (`updated_at`);
