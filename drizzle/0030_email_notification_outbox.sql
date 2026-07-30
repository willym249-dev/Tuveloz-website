CREATE TABLE `email_notification_outbox` (
  `id` text PRIMARY KEY NOT NULL,
  `event_key` text NOT NULL,
  `recipient_email` text NOT NULL,
  `subject` text NOT NULL,
  `text_body` text NOT NULL,
  `status` text DEFAULT 'pending' NOT NULL,
  `attempts` integer DEFAULT 0 NOT NULL,
  `last_error` text DEFAULT '' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `sent_at` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `email_notification_outbox_event_key_unique` ON `email_notification_outbox` (`event_key`);
--> statement-breakpoint
CREATE INDEX `email_notification_outbox_status_created_idx` ON `email_notification_outbox` (`status`,`created_at`);
--> statement-breakpoint
CREATE INDEX `email_notification_outbox_recipient_idx` ON `email_notification_outbox` (`recipient_email`);
