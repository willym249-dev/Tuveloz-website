CREATE TABLE `agreement_acceptances` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_id` text NOT NULL,
	`person_id` text DEFAULT '' NOT NULL,
	`jurisdiction` text DEFAULT '' NOT NULL,
	`agreement_key` text NOT NULL,
	`agreement_version` text NOT NULL,
	`agreement_hash` text NOT NULL,
	`agreement_text` text NOT NULL,
	`accepted_by_name` text NOT NULL,
	`accepted_by_title` text DEFAULT '' NOT NULL,
	`acceptance_action` text DEFAULT 'affirmative-checkbox' NOT NULL,
	`accepted_at` text NOT NULL,
	`ip_address` text DEFAULT '' NOT NULL,
	`session_id` text DEFAULT '' NOT NULL,
	`device_context` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `agreement_acceptances_provider_person_jurisdiction_key_version_unique` ON `agreement_acceptances` (`provider_id`,`person_id`,`jurisdiction`,`agreement_key`,`agreement_version`);--> statement-breakpoint
CREATE INDEX `agreement_acceptances_provider_time_idx` ON `agreement_acceptances` (`provider_id`,`accepted_at`);--> statement-breakpoint
CREATE INDEX `agreement_acceptances_person_time_idx` ON `agreement_acceptances` (`person_id`,`accepted_at`);--> statement-breakpoint
CREATE INDEX `agreement_acceptances_key_version_idx` ON `agreement_acceptances` (`agreement_key`,`agreement_version`);--> statement-breakpoint
CREATE TABLE `job_authorization_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`quote_id` text DEFAULT '' NOT NULL,
	`stage` text NOT NULL,
	`scope_version` integer NOT NULL,
	`assignment_version` integer DEFAULT 0 NOT NULL,
	`decision_version` integer DEFAULT 1 NOT NULL,
	`provider_id` text NOT NULL,
	`performing_person_id` text NOT NULL,
	`supervisor_person_id` text DEFAULT '' NOT NULL,
	`service_codes` text DEFAULT '[]' NOT NULL,
	`jurisdiction` text NOT NULL,
	`scheduled_for` text DEFAULT '' NOT NULL,
	`decision` text NOT NULL,
	`reason_codes` text DEFAULT '[]' NOT NULL,
	`eligibility_snapshot_ids` text DEFAULT '[]' NOT NULL,
	`service_activation_decision_ids` text DEFAULT '[]' NOT NULL,
	`evidence_decision_ids` text DEFAULT '[]' NOT NULL,
	`supervision_checkpoint_ids` text DEFAULT '[]' NOT NULL,
	`agreement_versions` text DEFAULT '{}' NOT NULL,
	`insurance_coverage_determination_id` text DEFAULT '' NOT NULL,
	`location_rule_result` text DEFAULT '' NOT NULL,
	`scope_check_result` text DEFAULT '' NOT NULL,
	`job_control_profile` text DEFAULT '{}' NOT NULL,
	`customer_provider_disclosure_accepted_at` text DEFAULT '' NOT NULL,
	`policy_version` text NOT NULL,
	`rules_engine_version` text NOT NULL,
	`decided_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`valid_through` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `job_authorization_request_stage_scope_assignment_decision_unique` ON `job_authorization_snapshots` (`request_id`,`stage`,`scope_version`,`assignment_version`,`decision_version`);--> statement-breakpoint
CREATE INDEX `job_authorization_provider_stage_idx` ON `job_authorization_snapshots` (`provider_id`,`stage`);--> statement-breakpoint
CREATE INDEX `job_authorization_performer_schedule_idx` ON `job_authorization_snapshots` (`performing_person_id`,`scheduled_for`);--> statement-breakpoint
CREATE INDEX `job_authorization_supervisor_idx` ON `job_authorization_snapshots` (`supervisor_person_id`);--> statement-breakpoint
CREATE INDEX `job_authorization_decision_validity_idx` ON `job_authorization_snapshots` (`decision`,`valid_through`);--> statement-breakpoint
CREATE INDEX `job_authorization_quote_idx` ON `job_authorization_snapshots` (`quote_id`);--> statement-breakpoint
CREATE TABLE `job_scope_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`quote_id` text DEFAULT '' NOT NULL,
	`version` integer NOT NULL,
	`service_codes` text DEFAULT '[]' NOT NULL,
	`jurisdiction` text NOT NULL,
	`scheduled_for` text DEFAULT '' NOT NULL,
	`scope_details` text DEFAULT '{}' NOT NULL,
	`price_breakdown` text DEFAULT '{}' NOT NULL,
	`parts_responsibility` text DEFAULT '' NOT NULL,
	`change_reason` text DEFAULT '' NOT NULL,
	`created_by_provider_id` text DEFAULT '' NOT NULL,
	`created_by_person_id` text DEFAULT '' NOT NULL,
	`provider_approved_at` text DEFAULT '' NOT NULL,
	`customer_authorized_at` text DEFAULT '' NOT NULL,
	`authorization_decision_id` text DEFAULT '' NOT NULL,
	`supersedes_scope_version_id` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `job_scope_versions_request_version_unique` ON `job_scope_versions` (`request_id`,`version`);--> statement-breakpoint
CREATE INDEX `job_scope_versions_quote_idx` ON `job_scope_versions` (`quote_id`);--> statement-breakpoint
CREATE INDEX `job_scope_versions_authorization_decision_idx` ON `job_scope_versions` (`authorization_decision_id`);--> statement-breakpoint
CREATE INDEX `job_scope_versions_scheduled_for_idx` ON `job_scope_versions` (`scheduled_for`);--> statement-breakpoint
CREATE INDEX `job_scope_versions_created_at_idx` ON `job_scope_versions` (`created_at`);--> statement-breakpoint
CREATE TABLE `provider_audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_id` text NOT NULL,
	`person_id` text DEFAULT '' NOT NULL,
	`request_id` text DEFAULT '' NOT NULL,
	`service_code` text DEFAULT '' NOT NULL,
	`jurisdiction` text DEFAULT '' NOT NULL,
	`event_type` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`event_version` integer DEFAULT 1 NOT NULL,
	`actor_type` text NOT NULL,
	`actor_id` text NOT NULL,
	`outcome` text NOT NULL,
	`reason_codes` text DEFAULT '[]' NOT NULL,
	`metadata` text DEFAULT '{}' NOT NULL,
	`policy_version` text DEFAULT '' NOT NULL,
	`previous_event_hash` text DEFAULT '' NOT NULL,
	`event_hash` text NOT NULL,
	`occurred_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `provider_audit_events_event_hash_unique` ON `provider_audit_events` (`event_hash`);--> statement-breakpoint
CREATE INDEX `provider_audit_events_provider_time_idx` ON `provider_audit_events` (`provider_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `provider_audit_events_person_time_idx` ON `provider_audit_events` (`person_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `provider_audit_events_request_time_idx` ON `provider_audit_events` (`request_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `provider_audit_events_entity_idx` ON `provider_audit_events` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `provider_audit_events_type_time_idx` ON `provider_audit_events` (`event_type`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `provider_audit_events_service_jurisdiction_idx` ON `provider_audit_events` (`service_code`,`jurisdiction`);--> statement-breakpoint
CREATE TABLE `provider_evidence_submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_id` text NOT NULL,
	`person_id` text DEFAULT '' NOT NULL,
	`requirement_key` text NOT NULL,
	`service_code` text DEFAULT '' NOT NULL,
	`jurisdiction` text NOT NULL,
	`evidence_type` text NOT NULL,
	`evidence_scope` text DEFAULT '{}' NOT NULL,
	`storage_key` text DEFAULT '' NOT NULL,
	`content_type` text DEFAULT '' NOT NULL,
	`document_hash` text DEFAULT '' NOT NULL,
	`issuer` text DEFAULT '' NOT NULL,
	`source_url` text DEFAULT '' NOT NULL,
	`effective_at` text DEFAULT '' NOT NULL,
	`expires_at` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`submitted_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`reviewed_at` text DEFAULT '' NOT NULL,
	`reviewed_by` text DEFAULT '' NOT NULL,
	`review_decision_id` text DEFAULT '' NOT NULL,
	`reason_codes` text DEFAULT '[]' NOT NULL,
	`review_notes` text DEFAULT '' NOT NULL,
	`supersedes_evidence_id` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `provider_evidence_provider_requirement_status_idx` ON `provider_evidence_submissions` (`provider_id`,`requirement_key`,`status`);--> statement-breakpoint
CREATE INDEX `provider_evidence_person_service_jurisdiction_idx` ON `provider_evidence_submissions` (`person_id`,`service_code`,`jurisdiction`);--> statement-breakpoint
CREATE INDEX `provider_evidence_expiration_idx` ON `provider_evidence_submissions` (`expires_at`);--> statement-breakpoint
CREATE INDEX `provider_evidence_review_decision_idx` ON `provider_evidence_submissions` (`review_decision_id`);--> statement-breakpoint
CREATE INDEX `provider_evidence_supersedes_idx` ON `provider_evidence_submissions` (`supersedes_evidence_id`);--> statement-breakpoint
CREATE TABLE `provider_pathway_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_id` text NOT NULL,
	`provider_person_id` text DEFAULT '' NOT NULL,
	`relationship_path` text NOT NULL,
	`provider_level` text NOT NULL,
	`sponsoring_provider_id` text DEFAULT '' NOT NULL,
	`registration_holder_id` text DEFAULT '' NOT NULL,
	`pathway_version` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`policy_version` text NOT NULL,
	`hold_reason_codes` text DEFAULT '[]' NOT NULL,
	`no_employee_attested_at` text DEFAULT '' NOT NULL,
	`no_employee_attestation_expires_at` text DEFAULT '' NOT NULL,
	`effective_at` text DEFAULT '' NOT NULL,
	`valid_through` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `provider_pathway_profiles_provider_version_unique` ON `provider_pathway_profiles` (`provider_id`,`pathway_version`);--> statement-breakpoint
CREATE INDEX `provider_pathway_profiles_provider_status_idx` ON `provider_pathway_profiles` (`provider_id`,`status`);--> statement-breakpoint
CREATE INDEX `provider_pathway_profiles_person_idx` ON `provider_pathway_profiles` (`provider_person_id`);--> statement-breakpoint
CREATE INDEX `provider_pathway_profiles_sponsor_status_idx` ON `provider_pathway_profiles` (`sponsoring_provider_id`,`status`);--> statement-breakpoint
CREATE INDEX `provider_pathway_profiles_valid_through_idx` ON `provider_pathway_profiles` (`valid_through`);--> statement-breakpoint
CREATE TABLE `provider_personnel` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_id` text NOT NULL,
	`person_id` text NOT NULL,
	`relationship_type` text NOT NULL,
	`personnel_role` text DEFAULT 'technician' NOT NULL,
	`provider_level` text DEFAULT '' NOT NULL,
	`roster_version` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`identity_verified_at` text DEFAULT '' NOT NULL,
	`age_verified_at` text DEFAULT '' NOT NULL,
	`employment_started_at` text DEFAULT '' NOT NULL,
	`employment_ended_at` text DEFAULT '' NOT NULL,
	`employer_attested_at` text DEFAULT '' NOT NULL,
	`work_authorization_attested_at` text DEFAULT '' NOT NULL,
	`lawful_pay_attested_at` text DEFAULT '' NOT NULL,
	`employer_attested_by_person_id` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `provider_personnel_provider_person_roster_version_unique` ON `provider_personnel` (`provider_id`,`person_id`,`roster_version`);--> statement-breakpoint
CREATE INDEX `provider_personnel_provider_status_idx` ON `provider_personnel` (`provider_id`,`status`);--> statement-breakpoint
CREATE INDEX `provider_personnel_provider_person_status_idx` ON `provider_personnel` (`provider_id`,`person_id`,`status`);--> statement-breakpoint
CREATE INDEX `provider_personnel_person_status_idx` ON `provider_personnel` (`person_id`,`status`);--> statement-breakpoint
CREATE INDEX `provider_personnel_employment_end_idx` ON `provider_personnel` (`employment_ended_at`);--> statement-breakpoint
CREATE TABLE `provider_service_eligibility` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_id` text NOT NULL,
	`person_id` text DEFAULT '' NOT NULL,
	`service_code` text NOT NULL,
	`jurisdiction` text NOT NULL,
	`relationship_path` text NOT NULL,
	`provider_level` text NOT NULL,
	`eligibility_state` text DEFAULT 'blocked' NOT NULL,
	`reason_codes` text DEFAULT '[]' NOT NULL,
	`requirement_versions` text DEFAULT '{}' NOT NULL,
	`evidence_decision_ids` text DEFAULT '[]' NOT NULL,
	`rules_engine_version` text NOT NULL,
	`policy_version` text NOT NULL,
	`calculated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`valid_through` text DEFAULT '' NOT NULL,
	`next_expiration_at` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `provider_service_eligibility_provider_person_service_jurisdiction_unique` ON `provider_service_eligibility` (`provider_id`,`person_id`,`service_code`,`jurisdiction`);--> statement-breakpoint
CREATE INDEX `provider_service_eligibility_provider_state_idx` ON `provider_service_eligibility` (`provider_id`,`eligibility_state`);--> statement-breakpoint
CREATE INDEX `provider_service_eligibility_person_state_idx` ON `provider_service_eligibility` (`person_id`,`eligibility_state`);--> statement-breakpoint
CREATE INDEX `provider_service_eligibility_service_jurisdiction_state_idx` ON `provider_service_eligibility` (`service_code`,`jurisdiction`,`eligibility_state`);--> statement-breakpoint
CREATE INDEX `provider_service_eligibility_valid_through_idx` ON `provider_service_eligibility` (`valid_through`);--> statement-breakpoint
CREATE TABLE `service_activation_decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_id` text NOT NULL,
	`person_id` text DEFAULT '' NOT NULL,
	`service_code` text NOT NULL,
	`jurisdiction` text NOT NULL,
	`stage` text NOT NULL,
	`decision_version` integer DEFAULT 1 NOT NULL,
	`decision` text NOT NULL,
	`eligibility_id` text DEFAULT '' NOT NULL,
	`reason_codes` text DEFAULT '[]' NOT NULL,
	`requirement_versions` text DEFAULT '{}' NOT NULL,
	`evidence_decision_ids` text DEFAULT '[]' NOT NULL,
	`job_context` text DEFAULT '{}' NOT NULL,
	`policy_version` text NOT NULL,
	`rules_engine_version` text NOT NULL,
	`decision_source` text DEFAULT 'rules-engine' NOT NULL,
	`decided_by` text DEFAULT 'system' NOT NULL,
	`decided_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`valid_through` text DEFAULT '' NOT NULL,
	`supersedes_decision_id` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `service_activation_provider_person_service_jurisdiction_stage_version_unique` ON `service_activation_decisions` (`provider_id`,`person_id`,`service_code`,`jurisdiction`,`stage`,`decision_version`);--> statement-breakpoint
CREATE INDEX `service_activation_lookup_idx` ON `service_activation_decisions` (`provider_id`,`person_id`,`service_code`,`jurisdiction`,`stage`);--> statement-breakpoint
CREATE INDEX `service_activation_eligibility_idx` ON `service_activation_decisions` (`eligibility_id`);--> statement-breakpoint
CREATE INDEX `service_activation_decided_at_idx` ON `service_activation_decisions` (`decided_at`);--> statement-breakpoint
CREATE INDEX `service_activation_valid_through_idx` ON `service_activation_decisions` (`valid_through`);--> statement-breakpoint
CREATE TABLE `supervision_checkpoints` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`scope_version` integer NOT NULL,
	`provider_id` text NOT NULL,
	`performing_person_id` text NOT NULL,
	`supervisor_person_id` text NOT NULL,
	`service_codes` text DEFAULT '[]' NOT NULL,
	`jurisdiction` text NOT NULL,
	`checkpoint_type` text NOT NULL,
	`checkpoint_sequence` integer DEFAULT 1 NOT NULL,
	`supervision_level` text NOT NULL,
	`performing_person_checked_in_at` text DEFAULT '' NOT NULL,
	`supervisor_checked_in_at` text DEFAULT '' NOT NULL,
	`location_result` text DEFAULT '' NOT NULL,
	`co_location_result` text DEFAULT '' NOT NULL,
	`ability_to_intervene_attested_at` text DEFAULT '' NOT NULL,
	`supervisor_attested_at` text DEFAULT '' NOT NULL,
	`checkpoint_data` text DEFAULT '{}' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`occurred_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `supervision_checkpoints_request_scope_type_sequence_unique` ON `supervision_checkpoints` (`request_id`,`scope_version`,`checkpoint_type`,`checkpoint_sequence`);--> statement-breakpoint
CREATE INDEX `supervision_checkpoints_provider_request_idx` ON `supervision_checkpoints` (`provider_id`,`request_id`);--> statement-breakpoint
CREATE INDEX `supervision_checkpoints_performing_person_idx` ON `supervision_checkpoints` (`performing_person_id`);--> statement-breakpoint
CREATE INDEX `supervision_checkpoints_supervisor_idx` ON `supervision_checkpoints` (`supervisor_person_id`);--> statement-breakpoint
CREATE INDEX `supervision_checkpoints_occurred_at_idx` ON `supervision_checkpoints` (`occurred_at`);--> statement-breakpoint
ALTER TABLE `customer_requests` ADD `jurisdiction` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `customer_requests` ADD `service_codes` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `customer_requests` ADD `scheduled_for` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `customer_requests` ADD `assigned_person_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `customer_requests` ADD `assigned_supervisor_person_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `customer_requests` ADD `assignment_version` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `customer_requests` ADD `policy_version` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `customer_requests` ADD `customer_provider_disclosure_accepted_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `customer_requests_jurisdiction_status_idx` ON `customer_requests` (`jurisdiction`,`status`);--> statement-breakpoint
CREATE INDEX `customer_requests_scheduled_for_idx` ON `customer_requests` (`scheduled_for`);--> statement-breakpoint
CREATE INDEX `customer_requests_assigned_person_idx` ON `customer_requests` (`assigned_person_id`);--> statement-breakpoint
CREATE INDEX `customer_requests_assigned_supervisor_idx` ON `customer_requests` (`assigned_supervisor_person_id`);--> statement-breakpoint
ALTER TABLE `provider_job_records` ADD `job_start_decision_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `provider_job_records` ADD `completion_decision_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `provider_job_records_start_decision_idx` ON `provider_job_records` (`job_start_decision_id`);--> statement-breakpoint
CREATE INDEX `provider_job_records_completion_decision_idx` ON `provider_job_records` (`completion_decision_id`);--> statement-breakpoint
ALTER TABLE `provider_quotes` ADD `service_codes` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `provider_quotes` ADD `performing_person_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `provider_quotes` ADD `supervisor_person_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `provider_quotes` ADD `scheduled_for` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `provider_quotes` ADD `scope_version` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `provider_quotes` ADD `authorization_decision_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `provider_quotes_performing_person_idx` ON `provider_quotes` (`performing_person_id`);--> statement-breakpoint
CREATE INDEX `provider_quotes_supervisor_person_idx` ON `provider_quotes` (`supervisor_person_id`);--> statement-breakpoint
CREATE INDEX `provider_quotes_scheduled_for_idx` ON `provider_quotes` (`scheduled_for`);--> statement-breakpoint
CREATE INDEX `provider_quotes_authorization_decision_idx` ON `provider_quotes` (`authorization_decision_id`);
