ALTER TABLE `provider_catalog_items`
  ADD COLUMN `maximum_price_cents` integer NOT NULL DEFAULT 0
  CHECK (`maximum_price_cents` >= 0);
--> statement-breakpoint
CREATE TABLE `customer_service_reminders` (
  `id` text PRIMARY KEY NOT NULL,
  `customer_email` text NOT NULL,
  `vehicle` text NOT NULL,
  `service` text NOT NULL,
  `due_date` text NOT NULL DEFAULT '',
  `due_mileage` integer NOT NULL DEFAULT 0,
  `current_mileage` integer NOT NULL DEFAULT 0,
  `note` text NOT NULL DEFAULT '',
  `source_request_id` text NOT NULL DEFAULT '',
  `status` text NOT NULL DEFAULT 'active',
  `created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (`due_mileage` >= 0),
  CHECK (`current_mileage` >= 0),
  CHECK (`status` IN ('active','completed','dismissed')),
  CHECK (trim(`due_date`) <> '' OR `due_mileage` > 0)
);
--> statement-breakpoint
CREATE INDEX `customer_service_reminders_account_status_idx`
  ON `customer_service_reminders` (`customer_email`, `status`, `due_date`);
--> statement-breakpoint
CREATE INDEX `customer_service_reminders_source_request_idx`
  ON `customer_service_reminders` (`source_request_id`);