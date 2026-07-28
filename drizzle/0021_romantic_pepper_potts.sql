CREATE TABLE `stripe_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`payment_type` text NOT NULL,
	`request_id` text,
	`quote_id` text,
	`stripe_product_id` text,
	`stripe_price_id` text,
	`product_name` text NOT NULL,
	`provider_application_id` text NOT NULL,
	`connected_account_id` text NOT NULL,
	`customer_email` text DEFAULT '' NOT NULL,
	`currency` text DEFAULT 'usd' NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`provider_amount_cents` integer NOT NULL,
	`application_fee_cents` integer NOT NULL,
	`customer_total_cents` integer NOT NULL,
	`settlement_strategy` text NOT NULL,
	`checkout_session_id` text,
	`payment_intent_id` text,
	`charge_id` text,
	`transfer_group` text,
	`transfer_id` text,
	`status` text DEFAULT 'checkout_creating' NOT NULL,
	`paid_at` text DEFAULT '' NOT NULL,
	`released_at` text DEFAULT '' NOT NULL,
	`released_by` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `stripe_payments_request_id_idx` ON `stripe_payments` (`request_id`);--> statement-breakpoint
CREATE INDEX `stripe_payments_quote_id_idx` ON `stripe_payments` (`quote_id`);--> statement-breakpoint
CREATE INDEX `stripe_payments_provider_idx` ON `stripe_payments` (`provider_application_id`);--> statement-breakpoint
CREATE INDEX `stripe_payments_status_idx` ON `stripe_payments` (`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `stripe_payments_checkout_session_unique` ON `stripe_payments` (`checkout_session_id`);--> statement-breakpoint
CREATE INDEX `stripe_payments_payment_intent_idx` ON `stripe_payments` (`payment_intent_id`);--> statement-breakpoint
ALTER TABLE `provider_applications` ADD `stripe_account_id` text;--> statement-breakpoint
CREATE INDEX `provider_applications_stripe_account_idx` ON `provider_applications` (`stripe_account_id`);