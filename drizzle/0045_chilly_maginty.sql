CREATE TABLE `stripe_connected_account_snapshots` (
	`connected_account_id` text PRIMARY KEY NOT NULL,
	`provider_application_id` text DEFAULT '' NOT NULL,
	`livemode` integer DEFAULT 0 NOT NULL,
	`payout_failure_hold` integer DEFAULT 0 NOT NULL,
	`payout_hold_reason` text DEFAULT '' NOT NULL,
	`last_payout_id` text DEFAULT '' NOT NULL,
	`last_payout_status` text DEFAULT '' NOT NULL,
	`last_payout_failure_code` text DEFAULT '' NOT NULL,
	`last_payout_livemode` integer DEFAULT 0 NOT NULL,
	`last_payout_event_created` integer DEFAULT 0 NOT NULL,
	`last_payout_event_id` text DEFAULT '' NOT NULL,
	`external_account_hold` integer DEFAULT 1 NOT NULL,
	`external_account_hold_reason` text DEFAULT 'no_snapshot' NOT NULL,
	`last_external_account_id` text DEFAULT '' NOT NULL,
	`last_external_account_type` text DEFAULT '' NOT NULL,
	`last_external_account_status` text DEFAULT '' NOT NULL,
	`last_external_account_livemode` integer DEFAULT 0 NOT NULL,
	`last_external_account_event_created` integer DEFAULT 0 NOT NULL,
	`last_external_account_event_id` text DEFAULT '' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `stripe_connected_account_snapshots_provider_idx` ON `stripe_connected_account_snapshots` (`provider_application_id`);--> statement-breakpoint
CREATE INDEX `stripe_connected_account_snapshots_payout_hold_idx` ON `stripe_connected_account_snapshots` (`payout_failure_hold`,`external_account_hold`);--> statement-breakpoint
CREATE INDEX `stripe_connected_account_snapshots_updated_at_idx` ON `stripe_connected_account_snapshots` (`updated_at`);--> statement-breakpoint
CREATE TABLE `stripe_webhook_events` (
	`id` text PRIMARY KEY NOT NULL,
	`endpoint` text NOT NULL,
	`event_id` text NOT NULL,
	`event_type` text NOT NULL,
	`livemode` integer DEFAULT 0 NOT NULL,
	`connected_account_id` text DEFAULT '' NOT NULL,
	`object_id` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'processing' NOT NULL,
	`attempt_count` integer DEFAULT 1 NOT NULL,
	`received_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`last_attempt_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`processed_at` text DEFAULT '' NOT NULL,
	`last_error` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stripe_webhook_events_endpoint_event_unique` ON `stripe_webhook_events` (`endpoint`,`event_id`);--> statement-breakpoint
CREATE INDEX `stripe_webhook_events_status_attempt_idx` ON `stripe_webhook_events` (`status`,`last_attempt_at`);--> statement-breakpoint
CREATE INDEX `stripe_webhook_events_received_at_idx` ON `stripe_webhook_events` (`received_at`);--> statement-breakpoint
ALTER TABLE `stripe_payments` ADD `refund_status` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `stripe_payments` ADD `refund_updated_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `stripe_payments` ADD `refund_failure_reason` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `stripe_payments` ADD `last_refund_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `stripe_payments` ADD `last_refund_event_created` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `stripe_payments` ADD `last_refund_event_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `stripe_payments` ADD `last_dispute_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `stripe_payments` ADD `last_dispute_event_created` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `stripe_payments` ADD `last_dispute_event_id` text DEFAULT '' NOT NULL;