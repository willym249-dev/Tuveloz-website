CREATE TABLE `job_evidence_items` (
  `id` text PRIMARY KEY NOT NULL,
  `request_id` text NOT NULL,
  `provider_email` text NOT NULL,
  `customer_email` text NOT NULL,
  `uploaded_by_email` text NOT NULL,
  `uploaded_by_role` text NOT NULL,
  `evidence_type` text NOT NULL,
  `image_key` text NOT NULL DEFAULT '',
  `image_type` text NOT NULL DEFAULT '',
  `note` text NOT NULL DEFAULT '',
  `odometer_miles` integer NOT NULL DEFAULT 0,
  `technician_name` text NOT NULL DEFAULT '',
  `record_version` text NOT NULL DEFAULT 'job-evidence-2026-07-31',
  `created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (`uploaded_by_role` IN ('customer','provider')),
  CHECK (`evidence_type` IN ('customer-condition','provider-before-work','progress','receipt-note','completion-note')),
  CHECK (`odometer_miles` >= 0),
  CHECK (trim(`image_key`) <> '' OR trim(`note`) <> '')
);
--> statement-breakpoint
CREATE INDEX `job_evidence_items_request_created_idx`
  ON `job_evidence_items` (`request_id`, `created_at`);
--> statement-breakpoint
CREATE INDEX `job_evidence_items_customer_idx`
  ON `job_evidence_items` (`customer_email`, `created_at`);
--> statement-breakpoint
CREATE INDEX `job_evidence_items_provider_idx`
  ON `job_evidence_items` (`provider_email`, `created_at`);