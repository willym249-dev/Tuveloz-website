-- Maryland and Montgomery County repair-document controls.
-- These tables remain unusable for real jobs while the marketplace is onboarding-only.
CREATE TABLE `repair_authorization_records` (
  `id` text PRIMARY KEY NOT NULL,
  `request_id` text NOT NULL,
  `quote_id` text NOT NULL,
  `provider_id` text NOT NULL,
  `provider_email` text NOT NULL,
  `provider_name` text NOT NULL,
  `provider_business_name` text NOT NULL,
  `provider_business_address` text NOT NULL,
  `provider_business_phone` text NOT NULL,
  `county_registration_number` text NOT NULL,
  `customer_email` text NOT NULL,
  `customer_name` text NOT NULL,
  `customer_address` text NOT NULL,
  `vehicle_year` text NOT NULL,
  `vehicle_make_model` text NOT NULL,
  `vehicle_tag` text NOT NULL,
  `vehicle_vin` text DEFAULT '' NOT NULL,
  `odometer_reading` integer NOT NULL,
  `scope_version` integer NOT NULL,
  `service_codes` text DEFAULT '[]' NOT NULL,
  `customer_instructions` text NOT NULL,
  `provider_diagnosis` text NOT NULL,
  `labor_billing_method` text NOT NULL,
  `labor_disclosure` text NOT NULL,
  `estimated_completion_at` text DEFAULT '' NOT NULL,
  `completion_disclosure` text NOT NULL,
  `estimate_fee_cents` integer DEFAULT 0 NOT NULL,
  `surcharge_cents` integer DEFAULT 0 NOT NULL,
  `surcharge_description` text DEFAULT '' NOT NULL,
  `labor_amount_cents` integer DEFAULT 0 NOT NULL,
  `parts_amount_cents` integer DEFAULT 0 NOT NULL,
  `tax_amount_cents` integer DEFAULT 0 NOT NULL,
  `other_amount_cents` integer DEFAULT 0 NOT NULL,
  `total_amount_cents` integer DEFAULT 0 NOT NULL,
  `replaced_parts_choice` text DEFAULT 'return' NOT NULL,
  `customer_rights_heading` text NOT NULL,
  `customer_rights_text` text NOT NULL,
  `manufacturer_notice` text NOT NULL,
  `responsibility_notice` text NOT NULL,
  `provider_representative_name` text NOT NULL,
  `provider_representative_title` text NOT NULL,
  `provider_signed_at` text NOT NULL,
  `status` text DEFAULT 'draft' NOT NULL,
  `presented_at` text DEFAULT '' NOT NULL,
  `customer_signature_name` text DEFAULT '' NOT NULL,
  `customer_signature_action` text DEFAULT '' NOT NULL,
  `customer_signature_at` text DEFAULT '' NOT NULL,
  `customer_signature_ip` text DEFAULT '' NOT NULL,
  `customer_signature_session_id` text DEFAULT '' NOT NULL,
  `customer_signature_device` text DEFAULT '{}' NOT NULL,
  `document_snapshot` text DEFAULT '{}' NOT NULL,
  `document_hash` text DEFAULT '' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT `repair_authorization_status_check`
    CHECK (`status` IN ('draft','presented','signed','superseded')),
  CONSTRAINT `repair_authorization_parts_choice_check`
    CHECK (`replaced_parts_choice` IN ('return','customer_declined','warranty_return','not_applicable')),
  CONSTRAINT `repair_authorization_amounts_check`
    CHECK (`labor_amount_cents` >= 0 AND `parts_amount_cents` >= 0 AND `tax_amount_cents` >= 0 AND `other_amount_cents` >= 0 AND `total_amount_cents` >= 0),
  CONSTRAINT `repair_authorization_odometer_check`
    CHECK (`odometer_reading` >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `repair_authorization_request_scope_unique`
  ON `repair_authorization_records` (`request_id`,`scope_version`);
--> statement-breakpoint
CREATE INDEX `repair_authorization_participant_status_idx`
  ON `repair_authorization_records` (`customer_email`,`provider_email`,`status`);
--> statement-breakpoint
CREATE INDEX `repair_authorization_provider_status_idx`
  ON `repair_authorization_records` (`provider_id`,`status`);
--> statement-breakpoint
CREATE TABLE `repair_authorization_items` (
  `id` text PRIMARY KEY NOT NULL,
  `authorization_id` text NOT NULL,
  `line_type` text NOT NULL,
  `description` text NOT NULL,
  `part_number` text DEFAULT '' NOT NULL,
  `part_condition` text DEFAULT 'not_applicable' NOT NULL,
  `quantity` integer DEFAULT 1 NOT NULL,
  `unit_amount_cents` integer DEFAULT 0 NOT NULL,
  `line_amount_cents` integer DEFAULT 0 NOT NULL,
  `labor_minutes` integer DEFAULT 0 NOT NULL,
  `mechanic_identifier` text DEFAULT '' NOT NULL,
  `sort_order` integer DEFAULT 0 NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT `repair_authorization_item_type_check`
    CHECK (`line_type` IN ('labor','part','sublet','other','tax')),
  CONSTRAINT `repair_authorization_item_condition_check`
    CHECK (`part_condition` IN ('new','used','rebuilt','reconditioned','not_applicable')),
  CONSTRAINT `repair_authorization_item_amount_check`
    CHECK (`quantity` > 0 AND `unit_amount_cents` >= 0 AND `line_amount_cents` >= 0 AND `labor_minutes` >= 0)
);
--> statement-breakpoint
CREATE INDEX `repair_authorization_items_authorization_order_idx`
  ON `repair_authorization_items` (`authorization_id`,`sort_order`);
--> statement-breakpoint
ALTER TABLE `provider_invoices` ADD COLUMN `authorization_record_id` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `provider_invoices` ADD COLUMN `provider_business_name` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `provider_invoices` ADD COLUMN `provider_business_address` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `provider_invoices` ADD COLUMN `provider_business_phone` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `provider_invoices` ADD COLUMN `county_registration_number` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `provider_invoices` ADD COLUMN `customer_name` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `provider_invoices` ADD COLUMN `customer_address` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `provider_invoices` ADD COLUMN `vehicle_year` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `provider_invoices` ADD COLUMN `vehicle_make_model` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `provider_invoices` ADD COLUMN `vehicle_tag` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `provider_invoices` ADD COLUMN `vehicle_vin` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `provider_invoices` ADD COLUMN `odometer_reading` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `provider_invoices` ADD COLUMN `customer_instructions` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `provider_invoices` ADD COLUMN `provider_diagnosis` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `provider_invoices` ADD COLUMN `labor_billing_method` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `provider_invoices` ADD COLUMN `labor_disclosure` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `provider_invoices` ADD COLUMN `mechanic_identifiers` text DEFAULT '[]' NOT NULL;
--> statement-breakpoint
ALTER TABLE `provider_invoices` ADD COLUMN `provider_representative_name` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `provider_invoices` ADD COLUMN `provider_representative_title` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `provider_invoices` ADD COLUMN `provider_signed_at` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `provider_invoices` ADD COLUMN `warranty_work_statement` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `provider_invoices` ADD COLUMN `manufacturer_notice` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `provider_invoices` ADD COLUMN `responsibility_notice` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `provider_invoices` ADD COLUMN `customer_signature_name` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `provider_invoices` ADD COLUMN `customer_signature_action` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `provider_invoices` ADD COLUMN `customer_signature_at` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `provider_invoices` ADD COLUMN `customer_signature_ip` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `provider_invoices` ADD COLUMN `customer_signature_session_id` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `provider_invoices` ADD COLUMN `customer_signature_device` text DEFAULT '{}' NOT NULL;
--> statement-breakpoint
ALTER TABLE `provider_invoices` ADD COLUMN `customer_copy_delivery_method` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `provider_invoices` ADD COLUMN `customer_copy_delivered_to` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `provider_invoices` ADD COLUMN `customer_copy_delivered_at` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `provider_invoices` ADD COLUMN `provider_copy_retained_at` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `provider_invoices` ADD COLUMN `document_snapshot` text DEFAULT '{}' NOT NULL;
--> statement-breakpoint
ALTER TABLE `provider_invoices` ADD COLUMN `document_hash` text DEFAULT '' NOT NULL;
--> statement-breakpoint
CREATE TABLE `provider_invoice_items` (
  `id` text PRIMARY KEY NOT NULL,
  `invoice_id` text NOT NULL,
  `line_type` text NOT NULL,
  `description` text NOT NULL,
  `part_number` text DEFAULT '' NOT NULL,
  `part_condition` text DEFAULT 'not_applicable' NOT NULL,
  `quantity` integer DEFAULT 1 NOT NULL,
  `unit_amount_cents` integer DEFAULT 0 NOT NULL,
  `line_amount_cents` integer DEFAULT 0 NOT NULL,
  `labor_minutes` integer DEFAULT 0 NOT NULL,
  `mechanic_identifier` text DEFAULT '' NOT NULL,
  `sort_order` integer DEFAULT 0 NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT `provider_invoice_item_type_check`
    CHECK (`line_type` IN ('labor','part','sublet','other','tax')),
  CONSTRAINT `provider_invoice_item_condition_check`
    CHECK (`part_condition` IN ('new','used','rebuilt','reconditioned','not_applicable')),
  CONSTRAINT `provider_invoice_item_amount_check`
    CHECK (`quantity` > 0 AND `unit_amount_cents` >= 0 AND `line_amount_cents` >= 0 AND `labor_minutes` >= 0)
);
--> statement-breakpoint
CREATE INDEX `provider_invoice_items_invoice_order_idx`
  ON `provider_invoice_items` (`invoice_id`,`sort_order`);
--> statement-breakpoint
CREATE TRIGGER `repair_authorization_signed_immutable`
BEFORE UPDATE ON `repair_authorization_records`
WHEN OLD.`status` = 'signed'
BEGIN
  SELECT RAISE(ABORT, 'Signed repair authorization records are immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `repair_authorization_signed_items_no_insert`
BEFORE INSERT ON `repair_authorization_items`
WHEN EXISTS (
  SELECT 1 FROM `repair_authorization_records`
  WHERE `id` = NEW.`authorization_id` AND `status` = 'signed'
)
BEGIN
  SELECT RAISE(ABORT, 'Signed repair authorization items are immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `repair_authorization_signed_items_no_update`
BEFORE UPDATE ON `repair_authorization_items`
WHEN EXISTS (
  SELECT 1 FROM `repair_authorization_records`
  WHERE `id` = OLD.`authorization_id` AND `status` = 'signed'
)
BEGIN
  SELECT RAISE(ABORT, 'Signed repair authorization items are immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `repair_authorization_signed_items_no_delete`
BEFORE DELETE ON `repair_authorization_items`
WHEN EXISTS (
  SELECT 1 FROM `repair_authorization_records`
  WHERE `id` = OLD.`authorization_id` AND `status` = 'signed'
)
BEGIN
  SELECT RAISE(ABORT, 'Signed repair authorization items are immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `provider_invoice_final_core_immutable`
BEFORE UPDATE ON `provider_invoices`
WHEN OLD.`status` = 'final' AND (
  NEW.`request_id` <> OLD.`request_id` OR
  NEW.`quote_id` <> OLD.`quote_id` OR
  NEW.`provider_id` <> OLD.`provider_id` OR
  NEW.`invoice_number` <> OLD.`invoice_number` OR
  NEW.`scope_version` <> OLD.`scope_version` OR
  NEW.`service_codes` <> OLD.`service_codes` OR
  NEW.`labor_amount_cents` <> OLD.`labor_amount_cents` OR
  NEW.`parts_amount_cents` <> OLD.`parts_amount_cents` OR
  NEW.`tax_amount_cents` <> OLD.`tax_amount_cents` OR
  NEW.`other_amount_cents` <> OLD.`other_amount_cents` OR
  NEW.`total_amount_cents` <> OLD.`total_amount_cents` OR
  NEW.`parts_description` <> OLD.`parts_description` OR
  NEW.`returned_parts_choice` <> OLD.`returned_parts_choice` OR
  NEW.`warranty_provider` <> OLD.`warranty_provider` OR
  NEW.`warranty_terms` <> OLD.`warranty_terms` OR
  NEW.`work_summary` <> OLD.`work_summary` OR
  NEW.`document_snapshot` <> OLD.`document_snapshot` OR
  NEW.`document_hash` <> OLD.`document_hash`
)
BEGIN
  SELECT RAISE(ABORT, 'Final provider invoice content is immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `provider_invoice_signed_immutable`
BEFORE UPDATE ON `provider_invoices`
WHEN OLD.`customer_signature_at` <> '' AND (
  NEW.`customer_signature_name` <> OLD.`customer_signature_name` OR
  NEW.`customer_signature_action` <> OLD.`customer_signature_action` OR
  NEW.`customer_signature_at` <> OLD.`customer_signature_at` OR
  NEW.`customer_signature_ip` <> OLD.`customer_signature_ip` OR
  NEW.`customer_signature_session_id` <> OLD.`customer_signature_session_id` OR
  NEW.`customer_signature_device` <> OLD.`customer_signature_device` OR
  NEW.`customer_copy_delivery_method` <> OLD.`customer_copy_delivery_method` OR
  NEW.`customer_copy_delivered_to` <> OLD.`customer_copy_delivered_to` OR
  NEW.`customer_copy_delivered_at` <> OLD.`customer_copy_delivered_at` OR
  NEW.`provider_copy_retained_at` <> OLD.`provider_copy_retained_at`
)
BEGIN
  SELECT RAISE(ABORT, 'Signed provider invoice delivery record is immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `provider_invoice_final_items_no_insert`
BEFORE INSERT ON `provider_invoice_items`
WHEN EXISTS (
  SELECT 1 FROM `provider_invoices`
  WHERE `id` = NEW.`invoice_id` AND `status` = 'final'
)
BEGIN
  SELECT RAISE(ABORT, 'Final provider invoice items are immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `provider_invoice_final_items_no_update`
BEFORE UPDATE ON `provider_invoice_items`
WHEN EXISTS (
  SELECT 1 FROM `provider_invoices`
  WHERE `id` = OLD.`invoice_id` AND `status` = 'final'
)
BEGIN
  SELECT RAISE(ABORT, 'Final provider invoice items are immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `provider_invoice_final_items_no_delete`
BEFORE DELETE ON `provider_invoice_items`
WHEN EXISTS (
  SELECT 1 FROM `provider_invoices`
  WHERE `id` = OLD.`invoice_id` AND `status` = 'final'
)
BEGIN
  SELECT RAISE(ABORT, 'Final provider invoice items are immutable');
END;
