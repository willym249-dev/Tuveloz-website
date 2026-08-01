-- Fail-closed repair-record gates. A browser or legacy API route cannot start,
-- complete, finalize, or financially release a job without the required signed
-- provider records for the exact accepted quote and scope.
CREATE TRIGGER `provider_job_insert_requires_signed_repair_authorization`
BEFORE INSERT ON `provider_job_records`
WHEN (
  NEW.`work_status` IN ('in progress','completed')
  OR NEW.`timer_started_at` <> ''
) AND NOT EXISTS (
  SELECT 1
    FROM `repair_authorization_records` authorization
    INNER JOIN `provider_quotes` quote
      ON quote.`id` = authorization.`quote_id`
     AND quote.`request_id` = authorization.`request_id`
     AND quote.`scope_version` = authorization.`scope_version`
     AND lower(quote.`provider_email`) = lower(authorization.`provider_email`)
   WHERE authorization.`request_id` = NEW.`request_id`
     AND lower(authorization.`provider_email`) = lower(NEW.`provider_email`)
     AND authorization.`status` = 'signed'
     AND authorization.`customer_signature_at` <> ''
     AND authorization.`document_hash` <> ''
     AND quote.`status` = 'accepted'
)
BEGIN
  SELECT RAISE(ABORT, 'A signed repair authorization for the exact accepted scope is required before work starts or completes');
END;
--> statement-breakpoint
CREATE TRIGGER `provider_job_update_requires_signed_repair_authorization`
BEFORE UPDATE ON `provider_job_records`
WHEN (
  NEW.`work_status` IN ('in progress','completed')
  OR NEW.`timer_started_at` <> ''
) AND NOT EXISTS (
  SELECT 1
    FROM `repair_authorization_records` authorization
    INNER JOIN `provider_quotes` quote
      ON quote.`id` = authorization.`quote_id`
     AND quote.`request_id` = authorization.`request_id`
     AND quote.`scope_version` = authorization.`scope_version`
     AND lower(quote.`provider_email`) = lower(authorization.`provider_email`)
   WHERE authorization.`request_id` = NEW.`request_id`
     AND lower(authorization.`provider_email`) = lower(NEW.`provider_email`)
     AND authorization.`status` = 'signed'
     AND authorization.`customer_signature_at` <> ''
     AND authorization.`document_hash` <> ''
     AND quote.`status` = 'accepted'
)
BEGIN
  SELECT RAISE(ABORT, 'A signed repair authorization for the exact accepted scope is required before work starts or completes');
END;
--> statement-breakpoint
CREATE TRIGGER `provider_invoice_cannot_insert_final_directly`
BEFORE INSERT ON `provider_invoices`
WHEN NEW.`status` = 'final'
BEGIN
  SELECT RAISE(ABORT, 'A final provider invoice must be assembled as a draft with itemized lines and a signed authorization before finalization');
END;
--> statement-breakpoint
CREATE TRIGGER `provider_invoice_final_requires_complete_repair_record`
BEFORE UPDATE ON `provider_invoices`
WHEN NEW.`status` = 'final' AND OLD.`status` <> 'final' AND (
  NEW.`authorization_record_id` = ''
  OR NEW.`provider_business_name` = ''
  OR NEW.`provider_business_address` = ''
  OR NEW.`provider_business_phone` = ''
  OR NEW.`county_registration_number` = ''
  OR NEW.`customer_name` = ''
  OR NEW.`customer_address` = ''
  OR NEW.`vehicle_year` = ''
  OR NEW.`vehicle_make_model` = ''
  OR NEW.`vehicle_tag` = ''
  OR NEW.`customer_instructions` = ''
  OR NEW.`provider_diagnosis` = ''
  OR NEW.`labor_billing_method` = ''
  OR NEW.`labor_disclosure` = ''
  OR NEW.`mechanic_identifiers` = '[]'
  OR NEW.`provider_representative_name` = ''
  OR NEW.`provider_representative_title` = ''
  OR NEW.`provider_signed_at` = ''
  OR NEW.`warranty_work_statement` = ''
  OR NEW.`warranty_terms` = ''
  OR NEW.`manufacturer_notice` = ''
  OR NEW.`responsibility_notice` = ''
  OR NEW.`document_snapshot` = '{}'
  OR NEW.`document_hash` = ''
  OR NOT EXISTS (
    SELECT 1
      FROM `repair_authorization_records` authorization
     WHERE authorization.`id` = NEW.`authorization_record_id`
       AND authorization.`request_id` = NEW.`request_id`
       AND authorization.`quote_id` = NEW.`quote_id`
       AND authorization.`provider_id` = NEW.`provider_id`
       AND authorization.`scope_version` = NEW.`scope_version`
       AND authorization.`status` = 'signed'
       AND authorization.`customer_signature_at` <> ''
       AND authorization.`document_hash` <> ''
  )
  OR NOT EXISTS (
    SELECT 1
      FROM `provider_invoice_items` item
     WHERE item.`invoice_id` = NEW.`id`
  )
)
BEGIN
  SELECT RAISE(ABORT, 'The final provider invoice requires a complete signed authorization, itemized lines, provider certification, notices, and immutable snapshot');
END;
--> statement-breakpoint
CREATE TRIGGER `stripe_payment_release_requires_signed_delivered_provider_invoice`
BEFORE UPDATE ON `stripe_payments`
WHEN NEW.`status` IN ('ready_for_release','released','paid_and_transferred')
AND OLD.`status` <> NEW.`status`
AND NOT EXISTS (
  SELECT 1
    FROM `provider_invoices` invoice
   WHERE invoice.`request_id` = NEW.`request_id`
     AND invoice.`quote_id` = NEW.`quote_id`
     AND invoice.`status` = 'final'
     AND invoice.`customer_signature_at` <> ''
     AND invoice.`customer_copy_delivered_at` <> ''
     AND invoice.`provider_copy_retained_at` <> ''
     AND invoice.`document_hash` <> ''
)
BEGIN
  SELECT RAISE(ABORT, 'Provider payment release requires a customer-signed final provider invoice, delivered customer copy, and retained provider copy');
END;
