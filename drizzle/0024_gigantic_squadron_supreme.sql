ALTER TABLE `stripe_payments` ADD `refund_amount_cents` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `stripe_payments` ADD `refunded_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `stripe_payments` ADD `dispute_status` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `stripe_payments` ADD `dispute_updated_at` text DEFAULT '' NOT NULL;