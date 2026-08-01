-- Integrated launch controls for provider appeals, data rights, evidence scanning,
-- customer authorization, job operations, payments, and launch readiness.
CREATE TABLE `compliance_reminders` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_id` text NOT NULL,
	`evidence_submission_id` text DEFAULT '' NOT NULL,
	`service_code` text DEFAULT '' NOT NULL,
	`reminder_type` text NOT NULL,
	`due_at` text NOT NULL,
	`channel` text DEFAULT 'email' NOT NULL,
	`recipient_email` text NOT NULL,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`scheduled_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`sent_at` text DEFAULT '' NOT NULL,
	`last_attempt_at` text DEFAULT '' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`event_key` text NOT NULL,
	`metadata` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `compliance_reminders_event_key_unique` ON `compliance_reminders` (`event_key`);--> statement-breakpoint
CREATE INDEX `compliance_reminders_provider_due_idx` ON `compliance_reminders` (`provider_id`,`due_at`);--> statement-breakpoint
CREATE INDEX `compliance_reminders_status_due_idx` ON `compliance_reminders` (`status`,`due_at`);--> statement-breakpoint
CREATE INDEX `compliance_reminders_evidence_idx` ON `compliance_reminders` (`evidence_submission_id`);--> statement-breakpoint
CREATE TABLE `customer_agreement_acceptances` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_email` text NOT NULL,
	`request_id` text DEFAULT '' NOT NULL,
	`quote_id` text DEFAULT '' NOT NULL,
	`scope_version` integer DEFAULT 0 NOT NULL,
	`scope_snapshot` text DEFAULT '{}' NOT NULL,
	`agreement_key` text NOT NULL,
	`agreement_version` text NOT NULL,
	`agreement_hash` text NOT NULL,
	`agreement_text` text NOT NULL,
	`accepted_by_name` text NOT NULL,
	`acceptance_action` text DEFAULT 'affirmative-checkbox' NOT NULL,
	`accepted_at` text NOT NULL,
	`ip_address` text DEFAULT '' NOT NULL,
	`session_id` text DEFAULT '' NOT NULL,
	`device_context` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customer_agreement_request_quote_key_version_scope_unique` ON `customer_agreement_acceptances` (`request_id`,`quote_id`,`agreement_key`,`agreement_version`,`scope_version`);--> statement-breakpoint
CREATE INDEX `customer_agreement_customer_time_idx` ON `customer_agreement_acceptances` (`customer_email`,`accepted_at`);--> statement-breakpoint
CREATE INDEX `customer_agreement_request_idx` ON `customer_agreement_acceptances` (`request_id`);--> statement-breakpoint
CREATE INDEX `customer_agreement_quote_idx` ON `customer_agreement_acceptances` (`quote_id`);--> statement-breakpoint
CREATE TABLE `data_rights_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`requester_email` text NOT NULL,
	`requester_role` text NOT NULL,
	`provider_id` text DEFAULT '' NOT NULL,
	`request_type` text NOT NULL,
	`scope` text DEFAULT 'account_and_documents' NOT NULL,
	`details` text DEFAULT '' NOT NULL,
	`identity_verification_status` text DEFAULT 'account_session_verified' NOT NULL,
	`status` text DEFAULT 'submitted' NOT NULL,
	`received_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`due_at` text DEFAULT '' NOT NULL,
	`legal_hold` text DEFAULT 'no' NOT NULL,
	`resolved_at` text DEFAULT '' NOT NULL,
	`resolved_by` text DEFAULT '' NOT NULL,
	`response_summary` text DEFAULT '' NOT NULL,
	`deletion_completed_at` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `data_rights_requester_time_idx` ON `data_rights_requests` (`requester_email`,`received_at`);--> statement-breakpoint
CREATE INDEX `data_rights_provider_status_idx` ON `data_rights_requests` (`provider_id`,`status`);--> statement-breakpoint
CREATE INDEX `data_rights_status_due_idx` ON `data_rights_requests` (`status`,`due_at`);--> statement-breakpoint
CREATE INDEX `data_rights_type_status_idx` ON `data_rights_requests` (`request_type`,`status`);--> statement-breakpoint
CREATE TABLE `evidence_file_scans` (
	`id` text PRIMARY KEY NOT NULL,
	`evidence_submission_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`scan_provider` text DEFAULT 'manual_external_review' NOT NULL,
	`scan_engine_version` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`threat_name` text DEFAULT '' NOT NULL,
	`file_hash` text NOT NULL,
	`requested_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`completed_at` text DEFAULT '' NOT NULL,
	`reviewed_by` text DEFAULT '' NOT NULL,
	`review_notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `evidence_file_scans_evidence_status_idx` ON `evidence_file_scans` (`evidence_submission_id`,`status`);--> statement-breakpoint
CREATE INDEX `evidence_file_scans_provider_status_idx` ON `evidence_file_scans` (`provider_id`,`status`);--> statement-breakpoint
CREATE INDEX `evidence_file_scans_requested_at_idx` ON `evidence_file_scans` (`requested_at`);--> statement-breakpoint
CREATE TABLE `job_cancellations` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`quote_id` text DEFAULT '' NOT NULL,
	`requested_by_role` text NOT NULL,
	`requested_by_email` text NOT NULL,
	`cancellation_type` text NOT NULL,
	`reason` text NOT NULL,
	`status` text DEFAULT 'submitted' NOT NULL,
	`scheduled_for` text DEFAULT '' NOT NULL,
	`requested_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`notice_hours` integer DEFAULT 0 NOT NULL,
	`provider_travel_started` text DEFAULT 'no' NOT NULL,
	`parts_committed_cents` integer DEFAULT 0 NOT NULL,
	`work_performed_cents` integer DEFAULT 0 NOT NULL,
	`proposed_refund_cents` integer DEFAULT 0 NOT NULL,
	`retained_amount_cents` integer DEFAULT 0 NOT NULL,
	`decision_by` text DEFAULT '' NOT NULL,
	`decision_at` text DEFAULT '' NOT NULL,
	`decision_reason` text DEFAULT '' NOT NULL,
	`payment_adjustment_id` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `job_cancellations_request_status_idx` ON `job_cancellations` (`request_id`,`status`);--> statement-breakpoint
CREATE INDEX `job_cancellations_requested_at_idx` ON `job_cancellations` (`requested_at`);--> statement-breakpoint
CREATE INDEX `job_cancellations_type_status_idx` ON `job_cancellations` (`cancellation_type`,`status`);--> statement-breakpoint
CREATE TABLE `job_change_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`quote_id` text DEFAULT '' NOT NULL,
	`prior_scope_version` integer NOT NULL,
	`proposed_scope_version` integer NOT NULL,
	`service_codes` text DEFAULT '[]' NOT NULL,
	`scope_details` text DEFAULT '{}' NOT NULL,
	`price_breakdown` text DEFAULT '{}' NOT NULL,
	`reason` text NOT NULL,
	`requested_by_provider_id` text NOT NULL,
	`requested_by_person_id` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'pending_customer' NOT NULL,
	`provider_approved_at` text DEFAULT '' NOT NULL,
	`customer_authorized_at` text DEFAULT '' NOT NULL,
	`customer_declined_at` text DEFAULT '' NOT NULL,
	`authorization_snapshot_id` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `job_change_orders_request_scope_unique` ON `job_change_orders` (`request_id`,`proposed_scope_version`);--> statement-breakpoint
CREATE INDEX `job_change_orders_request_status_idx` ON `job_change_orders` (`request_id`,`status`);--> statement-breakpoint
CREATE INDEX `job_change_orders_provider_status_idx` ON `job_change_orders` (`requested_by_provider_id`,`status`);--> statement-breakpoint
CREATE TABLE `job_incidents` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`quote_id` text DEFAULT '' NOT NULL,
	`provider_id` text DEFAULT '' NOT NULL,
	`reporter_role` text NOT NULL,
	`reporter_email` text NOT NULL,
	`incident_type` text NOT NULL,
	`severity` text NOT NULL,
	`summary` text NOT NULL,
	`occurred_at` text NOT NULL,
	`location_summary` text DEFAULT '' NOT NULL,
	`injury_reported` text DEFAULT 'no' NOT NULL,
	`property_damage_reported` text DEFAULT 'no' NOT NULL,
	`emergency_services_contacted` text DEFAULT 'no' NOT NULL,
	`work_stopped_at` text DEFAULT '' NOT NULL,
	`insurer_notified_at` text DEFAULT '' NOT NULL,
	`evidence_references` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`hold_payments` text DEFAULT 'yes' NOT NULL,
	`assigned_to` text DEFAULT '' NOT NULL,
	`resolution` text DEFAULT '' NOT NULL,
	`resolved_at` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `job_incidents_request_status_idx` ON `job_incidents` (`request_id`,`status`);--> statement-breakpoint
CREATE INDEX `job_incidents_provider_status_idx` ON `job_incidents` (`provider_id`,`status`);--> statement-breakpoint
CREATE INDEX `job_incidents_severity_status_idx` ON `job_incidents` (`severity`,`status`);--> statement-breakpoint
CREATE INDEX `job_incidents_occurred_at_idx` ON `job_incidents` (`occurred_at`);--> statement-breakpoint
CREATE TABLE `job_lifecycle_events` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`quote_id` text DEFAULT '' NOT NULL,
	`provider_id` text DEFAULT '' NOT NULL,
	`actor_role` text NOT NULL,
	`actor_id` text NOT NULL,
	`event_type` text NOT NULL,
	`from_status` text DEFAULT '' NOT NULL,
	`to_status` text DEFAULT '' NOT NULL,
	`scope_version` integer DEFAULT 0 NOT NULL,
	`authorization_snapshot_id` text DEFAULT '' NOT NULL,
	`reason_code` text DEFAULT '' NOT NULL,
	`details` text DEFAULT '{}' NOT NULL,
	`previous_event_hash` text DEFAULT '' NOT NULL,
	`event_hash` text NOT NULL,
	`occurred_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `job_lifecycle_events_hash_unique` ON `job_lifecycle_events` (`event_hash`);--> statement-breakpoint
CREATE INDEX `job_lifecycle_request_time_idx` ON `job_lifecycle_events` (`request_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `job_lifecycle_provider_time_idx` ON `job_lifecycle_events` (`provider_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `job_lifecycle_type_time_idx` ON `job_lifecycle_events` (`event_type`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `launch_gate_decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`gate_key` text NOT NULL,
	`gate_version` integer DEFAULT 1 NOT NULL,
	`category` text NOT NULL,
	`service_code` text DEFAULT '' NOT NULL,
	`jurisdiction` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`required` text DEFAULT 'yes' NOT NULL,
	`evidence_reference` text DEFAULT '' NOT NULL,
	`approved_by` text DEFAULT '' NOT NULL,
	`approved_at` text DEFAULT '' NOT NULL,
	`valid_through` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`decided_by` text DEFAULT '' NOT NULL,
	`supersedes_decision_id` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `launch_gate_key_version_unique` ON `launch_gate_decisions` (`gate_key`,`gate_version`);--> statement-breakpoint
CREATE INDEX `launch_gate_category_status_idx` ON `launch_gate_decisions` (`category`,`status`);--> statement-breakpoint
CREATE INDEX `launch_gate_service_jurisdiction_status_idx` ON `launch_gate_decisions` (`service_code`,`jurisdiction`,`status`);--> statement-breakpoint
CREATE INDEX `launch_gate_valid_through_idx` ON `launch_gate_decisions` (`valid_through`);--> statement-breakpoint
CREATE TABLE `payment_adjustments` (
	`id` text PRIMARY KEY NOT NULL,
	`payment_id` text DEFAULT '' NOT NULL,
	`request_id` text NOT NULL,
	`quote_id` text DEFAULT '' NOT NULL,
	`adjustment_type` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`currency` text DEFAULT 'usd' NOT NULL,
	`status` text DEFAULT 'requested' NOT NULL,
	`reason_code` text NOT NULL,
	`details` text DEFAULT '{}' NOT NULL,
	`requested_by_role` text NOT NULL,
	`requested_by_id` text NOT NULL,
	`requested_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`decided_by` text DEFAULT '' NOT NULL,
	`decided_at` text DEFAULT '' NOT NULL,
	`provider_impact_cents` integer DEFAULT 0 NOT NULL,
	`customer_impact_cents` integer DEFAULT 0 NOT NULL,
	`stripe_refund_id` text DEFAULT '' NOT NULL,
	`stripe_dispute_id` text DEFAULT '' NOT NULL,
	`transfer_reversal_id` text DEFAULT '' NOT NULL,
	`idempotency_key` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payment_adjustments_idempotency_unique` ON `payment_adjustments` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `payment_adjustments_request_status_idx` ON `payment_adjustments` (`request_id`,`status`);--> statement-breakpoint
CREATE INDEX `payment_adjustments_payment_idx` ON `payment_adjustments` (`payment_id`);--> statement-breakpoint
CREATE INDEX `payment_adjustments_type_status_idx` ON `payment_adjustments` (`adjustment_type`,`status`);--> statement-breakpoint
CREATE TABLE `provider_appeals` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_id` text NOT NULL,
	`evidence_submission_id` text DEFAULT '' NOT NULL,
	`service_code` text DEFAULT '' NOT NULL,
	`appeal_type` text NOT NULL,
	`reason` text NOT NULL,
	`supporting_evidence_ids` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'submitted' NOT NULL,
	`submitted_by_email` text NOT NULL,
	`submitted_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`due_at` text DEFAULT '' NOT NULL,
	`reviewed_by` text DEFAULT '' NOT NULL,
	`reviewed_at` text DEFAULT '' NOT NULL,
	`decision` text DEFAULT '' NOT NULL,
	`decision_reason` text DEFAULT '' NOT NULL,
	`resolution_notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `provider_appeals_provider_status_idx` ON `provider_appeals` (`provider_id`,`status`);--> statement-breakpoint
CREATE INDEX `provider_appeals_evidence_idx` ON `provider_appeals` (`evidence_submission_id`);--> statement-breakpoint
CREATE INDEX `provider_appeals_service_idx` ON `provider_appeals` (`service_code`);--> statement-breakpoint
CREATE INDEX `provider_appeals_status_due_idx` ON `provider_appeals` (`status`,`due_at`);--> statement-breakpoint
CREATE TABLE `provider_invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`quote_id` text DEFAULT '' NOT NULL,
	`provider_id` text NOT NULL,
	`invoice_number` text NOT NULL,
	`scope_version` integer NOT NULL,
	`service_codes` text DEFAULT '[]' NOT NULL,
	`labor_amount_cents` integer DEFAULT 0 NOT NULL,
	`parts_amount_cents` integer DEFAULT 0 NOT NULL,
	`tax_amount_cents` integer DEFAULT 0 NOT NULL,
	`other_amount_cents` integer DEFAULT 0 NOT NULL,
	`total_amount_cents` integer DEFAULT 0 NOT NULL,
	`parts_description` text DEFAULT '' NOT NULL,
	`returned_parts_choice` text DEFAULT 'not_recorded' NOT NULL,
	`warranty_provider` text DEFAULT 'provider_business' NOT NULL,
	`warranty_terms` text DEFAULT '' NOT NULL,
	`work_summary` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`issued_at` text DEFAULT '' NOT NULL,
	`customer_viewed_at` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `provider_invoices_provider_number_unique` ON `provider_invoices` (`provider_id`,`invoice_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `provider_invoices_request_scope_unique` ON `provider_invoices` (`request_id`,`scope_version`);--> statement-breakpoint
CREATE INDEX `provider_invoices_request_status_idx` ON `provider_invoices` (`request_id`,`status`);--> statement-breakpoint
CREATE INDEX `provider_invoices_provider_status_idx` ON `provider_invoices` (`provider_id`,`status`);
