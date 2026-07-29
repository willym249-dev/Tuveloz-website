ALTER TABLE `account_credentials` ADD `terms_accepted_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `account_credentials` ADD `terms_version` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `customer_requests` ADD `terms_accepted_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `customer_requests` ADD `terms_version` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `provider_applications` ADD `terms_accepted_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `provider_applications` ADD `terms_version` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `stripe_payments` ADD `policy_accepted_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `stripe_payments` ADD `policy_version` text DEFAULT '' NOT NULL;