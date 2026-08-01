ALTER TABLE `stripe_payments` ADD `scope_version` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `stripe_payments` ADD `scope_authorization_decision_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `stripe_payments` ADD `authorized_price_snapshot` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
CREATE INDEX `stripe_payments_scope_authorization_idx` ON `stripe_payments` (`scope_authorization_decision_id`);
