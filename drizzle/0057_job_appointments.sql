-- Adds confirmed job appointment times. A brand-new table only — fully additive,
-- no existing table or trigger touched. The accepted provider writes a row; the
-- customer reads it; a cron sweep sets reminder_sent_at when the reminder email
-- is queued so it is sent at most once.
CREATE TABLE `job_appointments` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`provider_email` text NOT NULL,
	`appointment_at` text DEFAULT '' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`reminder_sent_at` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE UNIQUE INDEX `job_appointments_request_id_unique` ON `job_appointments` (`request_id`);
CREATE INDEX `job_appointments_reminder_idx` ON `job_appointments` (`reminder_sent_at`);
