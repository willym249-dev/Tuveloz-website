CREATE TABLE `provider_work_history_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_id` text NOT NULL,
	`person_id` text DEFAULT '' NOT NULL,
	`employer_name` text NOT NULL,
	`self_employed` text DEFAULT 'no' NOT NULL,
	`city` text DEFAULT '' NOT NULL,
	`start_month` text NOT NULL,
	`end_month` text DEFAULT '' NOT NULL,
	`still_working_here` text DEFAULT 'no' NOT NULL,
	`work_performed` text DEFAULT '' NOT NULL,
	`service_category` text DEFAULT '' NOT NULL,
	`reference_name` text DEFAULT '' NOT NULL,
	`reference_phone` text DEFAULT '' NOT NULL,
	`reference_contact_consent` text DEFAULT 'no' NOT NULL,
	`audit_status` text DEFAULT 'not_selected' NOT NULL,
	`audit_notes` text DEFAULT '' NOT NULL,
	`audited_at` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "provider_work_history_self_employed_check" CHECK("provider_work_history_entries"."self_employed" in ('yes', 'no')),
	CONSTRAINT "provider_work_history_still_working_check" CHECK("provider_work_history_entries"."still_working_here" in ('yes', 'no')),
	CONSTRAINT "provider_work_history_reference_consent_check" CHECK("provider_work_history_entries"."reference_contact_consent" in ('yes', 'no')),
	CONSTRAINT "provider_work_history_audit_status_check" CHECK("provider_work_history_entries"."audit_status" in ('not_selected', 'selected', 'confirmed', 'contradicted', 'unreachable')),
	CONSTRAINT "provider_work_history_end_month_check" CHECK(("provider_work_history_entries"."still_working_here" = 'yes' and "provider_work_history_entries"."end_month" = '') or ("provider_work_history_entries"."still_working_here" = 'no' and "provider_work_history_entries"."end_month" <> ''))
);
--> statement-breakpoint
CREATE INDEX `provider_work_history_provider_idx` ON `provider_work_history_entries` (`provider_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `provider_work_history_person_idx` ON `provider_work_history_entries` (`person_id`);--> statement-breakpoint
CREATE INDEX `provider_work_history_audit_idx` ON `provider_work_history_entries` (`audit_status`);--> statement-breakpoint
CREATE TABLE `provider_competency_claims` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_id` text NOT NULL,
	`person_id` text DEFAULT '' NOT NULL,
	`service_code` text NOT NULL,
	`route_code` text NOT NULL,
	`provider_note` text DEFAULT '' NOT NULL,
	`evidence_submission_id` text DEFAULT '' NOT NULL,
	`verification_status` text DEFAULT 'pending' NOT NULL,
	`verified_by_email` text DEFAULT '' NOT NULL,
	`verified_at` text DEFAULT '' NOT NULL,
	`review_notes` text DEFAULT '' NOT NULL,
	`points_version` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "provider_competency_claims_status_check" CHECK("provider_competency_claims"."verification_status" in ('pending', 'verified', 'rejected'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `provider_competency_claims_unique` ON `provider_competency_claims` (`provider_id`,`person_id`,`service_code`,`route_code`);--> statement-breakpoint
CREATE INDEX `provider_competency_claims_provider_idx` ON `provider_competency_claims` (`provider_id`);--> statement-breakpoint
CREATE INDEX `provider_competency_claims_status_idx` ON `provider_competency_claims` (`verification_status`);
