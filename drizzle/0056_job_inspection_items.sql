-- Adds the service-aware job inspection checklist. A brand-new table only, so
-- this is fully additive: no existing table is touched, no trigger is disturbed,
-- and no existing row changes. The accepted provider writes rows here; the
-- customer reads them. status is 'pending' | 'good' | 'attention'.
CREATE TABLE `job_inspection_items` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`provider_email` text NOT NULL,
	`label` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX `job_inspection_items_request_id_idx` ON `job_inspection_items` (`request_id`);
CREATE INDEX `job_inspection_items_provider_email_idx` ON `job_inspection_items` (`provider_email`);
