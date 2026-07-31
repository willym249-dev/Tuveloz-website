CREATE TABLE `account_communication_preferences` (
  `email` text NOT NULL,
  `role` text NOT NULL,
  `marketing_email` text NOT NULL DEFAULT 'no',
  `product_update_email` text NOT NULL DEFAULT 'no',
  `optional_reminder_email` text NOT NULL DEFAULT 'yes',
  `created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`email`, `role`),
  CHECK (`role` IN ('customer','provider')),
  CHECK (`marketing_email` IN ('yes','no')),
  CHECK (`product_update_email` IN ('yes','no')),
  CHECK (`optional_reminder_email` IN ('yes','no'))
);
--> statement-breakpoint
CREATE INDEX `account_communication_preferences_updated_idx`
  ON `account_communication_preferences` (`updated_at`);
--> statement-breakpoint
CREATE TABLE `privacy_requests` (
  `id` text PRIMARY KEY NOT NULL,
  `email` text NOT NULL,
  `role` text NOT NULL,
  `request_type` text NOT NULL,
  `related_request_id` text NOT NULL DEFAULT '',
  `details` text NOT NULL DEFAULT '',
  `status` text NOT NULL DEFAULT 'submitted',
  `identity_source` text NOT NULL DEFAULT 'signed-in-account',
  `resolution_note` text NOT NULL DEFAULT '',
  `created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `resolved_at` text NOT NULL DEFAULT '',
  CHECK (`role` IN ('customer','provider')),
  CHECK (`request_type` IN ('access','correction','account-closure','limit-processing','opt-out','appeal')),
  CHECK (`status` IN ('submitted','in-review','completed','denied','withdrawn')),
  CHECK (`identity_source` IN ('signed-in-account','support-verified'))
);
--> statement-breakpoint
CREATE INDEX `privacy_requests_account_created_idx`
  ON `privacy_requests` (`email`, `role`, `created_at`);
--> statement-breakpoint
CREATE INDEX `privacy_requests_status_created_idx`
  ON `privacy_requests` (`status`, `created_at`);
--> statement-breakpoint
CREATE UNIQUE INDEX `privacy_requests_one_active_type_unique`
  ON `privacy_requests` (`email`, `role`, `request_type`)
  WHERE `status` IN ('submitted','in-review');