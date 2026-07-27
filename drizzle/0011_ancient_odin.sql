ALTER TABLE `customer_requests` ADD `parts_source` text DEFAULT 'Either is okay' NOT NULL;--> statement-breakpoint
ALTER TABLE `customer_requests` ADD `parts_preference` text DEFAULT 'No preference' NOT NULL;--> statement-breakpoint
ALTER TABLE `provider_quotes` ADD `labor_price_cents` text DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE `provider_quotes` ADD `parts_price_cents` text DEFAULT '0' NOT NULL;