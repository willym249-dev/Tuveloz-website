-- Preserve every provider, customer, vehicle, diagnosis, labor, mechanic,
-- warranty, notice, and signed-authorization fact after a provider invoice is final.
-- Customer signature and copy-delivery fields are intentionally handled by the
-- separate one-time signature/delivery trigger.
CREATE TRIGGER `provider_invoice_final_legal_fields_immutable`
BEFORE UPDATE ON `provider_invoices`
WHEN OLD.`status` = 'final' AND (
  NEW.`authorization_record_id` <> OLD.`authorization_record_id`
  OR NEW.`provider_business_name` <> OLD.`provider_business_name`
  OR NEW.`provider_business_address` <> OLD.`provider_business_address`
  OR NEW.`provider_business_phone` <> OLD.`provider_business_phone`
  OR NEW.`county_registration_number` <> OLD.`county_registration_number`
  OR NEW.`customer_name` <> OLD.`customer_name`
  OR NEW.`customer_address` <> OLD.`customer_address`
  OR NEW.`vehicle_year` <> OLD.`vehicle_year`
  OR NEW.`vehicle_make_model` <> OLD.`vehicle_make_model`
  OR NEW.`vehicle_tag` <> OLD.`vehicle_tag`
  OR NEW.`vehicle_vin` <> OLD.`vehicle_vin`
  OR NEW.`odometer_reading` <> OLD.`odometer_reading`
  OR NEW.`customer_instructions` <> OLD.`customer_instructions`
  OR NEW.`provider_diagnosis` <> OLD.`provider_diagnosis`
  OR NEW.`labor_billing_method` <> OLD.`labor_billing_method`
  OR NEW.`labor_disclosure` <> OLD.`labor_disclosure`
  OR NEW.`mechanic_identifiers` <> OLD.`mechanic_identifiers`
  OR NEW.`provider_representative_name` <> OLD.`provider_representative_name`
  OR NEW.`provider_representative_title` <> OLD.`provider_representative_title`
  OR NEW.`provider_signed_at` <> OLD.`provider_signed_at`
  OR NEW.`warranty_work_statement` <> OLD.`warranty_work_statement`
  OR NEW.`manufacturer_notice` <> OLD.`manufacturer_notice`
  OR NEW.`responsibility_notice` <> OLD.`responsibility_notice`
)
BEGIN
  SELECT RAISE(ABORT, 'Final provider invoice legal fields are immutable');
END;
