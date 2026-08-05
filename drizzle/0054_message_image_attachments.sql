-- Adds optional, fail-closed image attachments to job messages. Additive columns
-- only (no table rebuild, no trigger churn): image_key/image_type point at the R2
-- object, scan_status stays '' for text-only messages and 'pending' until a scan
-- clears it to 'clean' (or 'blocked'). Serving and display require 'clean', so an
-- unscanned image is never exposed.
ALTER TABLE `job_messages` ADD `image_key` text DEFAULT '' NOT NULL;
ALTER TABLE `job_messages` ADD `image_type` text DEFAULT '' NOT NULL;
ALTER TABLE `job_messages` ADD `scan_status` text DEFAULT '' NOT NULL;
CREATE INDEX `job_messages_scan_status_idx` ON `job_messages` (`scan_status`);
