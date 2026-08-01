ALTER TABLE `customer_requests`
  ADD `labor_only_parts_acknowledged_at` text NOT NULL DEFAULT '';

ALTER TABLE `provider_quotes`
  ADD `labor_only_parts_confirmed_at` text NOT NULL DEFAULT '';

ALTER TABLE `provider_profiles`
  ADD `customer_supplied_parts_policy` text NOT NULL DEFAULT 'Discuss before accepting';

DROP TRIGGER IF EXISTS `customer_requests_labor_only_parts_insert`;
CREATE TRIGGER `customer_requests_labor_only_parts_insert`
BEFORE INSERT ON `customer_requests`
WHEN trim(NEW.`labor_only_parts_acknowledged_at`) = ''
OR NEW.`parts_source` NOT IN (
  'Customer supplies any needed parts — labor only',
  'I have the parts — labor only',
  'No parts needed — labor only',
  'Not sure whether parts are needed — discuss with provider'
)
OR NEW.`parts_preference` NOT IN (
  'OEM',
  'Aftermarket',
  'No preference',
  'Discuss with provider'
)
BEGIN
  SELECT RAISE(ABORT, 'Tuveloz customer requests must use the labor-only parts workflow');
END;

DROP TRIGGER IF EXISTS `customer_requests_labor_only_parts_update`;
CREATE TRIGGER `customer_requests_labor_only_parts_update`
BEFORE UPDATE OF `parts_source`, `parts_preference`, `labor_only_parts_acknowledged_at` ON `customer_requests`
WHEN trim(NEW.`labor_only_parts_acknowledged_at`) = ''
OR NEW.`parts_source` NOT IN (
  'Customer supplies any needed parts — labor only',
  'I have the parts — labor only',
  'No parts needed — labor only',
  'Not sure whether parts are needed — discuss with provider'
)
OR NEW.`parts_preference` NOT IN (
  'OEM',
  'Aftermarket',
  'No preference',
  'Discuss with provider'
)
BEGIN
  SELECT RAISE(ABORT, 'Tuveloz customer requests must use the labor-only parts workflow');
END;

DROP TRIGGER IF EXISTS `provider_quotes_labor_only_insert`;
CREATE TRIGGER `provider_quotes_labor_only_insert`
BEFORE INSERT ON `provider_quotes`
WHEN trim(NEW.`labor_only_parts_confirmed_at`) = ''
OR CAST(NEW.`parts_price_cents` AS integer) <> 0
OR CAST(NEW.`labor_price_cents` AS integer) <> CAST(NEW.`price_cents` AS integer)
OR NEW.`part_type` NOT IN ('Customer supplied', 'No parts needed')
BEGIN
  SELECT RAISE(ABORT, 'Tuveloz provider quotes must be labor only');
END;

DROP TRIGGER IF EXISTS `provider_quotes_labor_only_update`;
CREATE TRIGGER `provider_quotes_labor_only_update`
BEFORE UPDATE OF `price_cents`, `labor_price_cents`, `parts_price_cents`, `part_type`, `labor_only_parts_confirmed_at`
ON `provider_quotes`
WHEN trim(NEW.`labor_only_parts_confirmed_at`) = ''
OR CAST(NEW.`parts_price_cents` AS integer) <> 0
OR CAST(NEW.`labor_price_cents` AS integer) <> CAST(NEW.`price_cents` AS integer)
OR NEW.`part_type` NOT IN ('Customer supplied', 'No parts needed')
BEGIN
  SELECT RAISE(ABORT, 'Tuveloz provider quotes must be labor only');
END;

DROP TRIGGER IF EXISTS `provider_profiles_customer_supplied_parts_policy_insert`;
CREATE TRIGGER `provider_profiles_customer_supplied_parts_policy_insert`
BEFORE INSERT ON `provider_profiles`
WHEN NEW.`customer_supplied_parts_policy` NOT IN (
  'OEM',
  'Aftermarket',
  'Either',
  'Discuss before accepting'
)
BEGIN
  SELECT RAISE(ABORT, 'Choose a listed customer-supplied-parts preference');
END;

DROP TRIGGER IF EXISTS `provider_profiles_customer_supplied_parts_policy_update`;
CREATE TRIGGER `provider_profiles_customer_supplied_parts_policy_update`
BEFORE UPDATE OF `customer_supplied_parts_policy` ON `provider_profiles`
WHEN NEW.`customer_supplied_parts_policy` NOT IN (
  'OEM',
  'Aftermarket',
  'Either',
  'Discuss before accepting'
)
BEGIN
  SELECT RAISE(ABORT, 'Choose a listed customer-supplied-parts preference');
END;

DROP TRIGGER IF EXISTS `job_authorizations_labor_only_insert`;
CREATE TRIGGER `job_authorizations_labor_only_insert`
BEFORE INSERT ON `job_authorizations`
WHEN NEW.`parts_cents` <> 0
OR NEW.`other_fees_cents` <> 0
OR NEW.`total_cents` <> NEW.`labor_cents`
BEGIN
  SELECT RAISE(ABORT, 'Tuveloz job authorizations must be labor only');
END;

DROP TRIGGER IF EXISTS `job_authorizations_labor_only_update`;
CREATE TRIGGER `job_authorizations_labor_only_update`
BEFORE UPDATE OF `labor_cents`, `parts_cents`, `other_fees_cents`, `total_cents`
ON `job_authorizations`
WHEN NEW.`parts_cents` <> 0
OR NEW.`other_fees_cents` <> 0
OR NEW.`total_cents` <> NEW.`labor_cents`
BEGIN
  SELECT RAISE(ABORT, 'Tuveloz job authorizations must be labor only');
END;

DROP TRIGGER IF EXISTS `job_change_orders_labor_only_insert`;
CREATE TRIGGER `job_change_orders_labor_only_insert`
BEFORE INSERT ON `job_change_orders`
WHEN CASE
  WHEN json_valid(NEW.`price_breakdown`) = 0 THEN 1
  WHEN CAST(json_extract(NEW.`price_breakdown`, '$.partsAmountCents') AS integer) <> 0 THEN 1
  WHEN CAST(json_extract(NEW.`price_breakdown`, '$.taxAmountCents') AS integer) <> 0 THEN 1
  WHEN CAST(json_extract(NEW.`price_breakdown`, '$.otherAmountCents') AS integer) <> 0 THEN 1
  WHEN CAST(json_extract(NEW.`price_breakdown`, '$.totalAmountCents') AS integer)
    <> CAST(json_extract(NEW.`price_breakdown`, '$.laborAmountCents') AS integer) THEN 1
  ELSE 0
END
BEGIN
  SELECT RAISE(ABORT, 'Tuveloz change orders must be labor only');
END;

DROP TRIGGER IF EXISTS `job_change_orders_labor_only_update`;
CREATE TRIGGER `job_change_orders_labor_only_update`
BEFORE UPDATE OF `price_breakdown` ON `job_change_orders`
WHEN CASE
  WHEN json_valid(NEW.`price_breakdown`) = 0 THEN 1
  WHEN CAST(json_extract(NEW.`price_breakdown`, '$.partsAmountCents') AS integer) <> 0 THEN 1
  WHEN CAST(json_extract(NEW.`price_breakdown`, '$.taxAmountCents') AS integer) <> 0 THEN 1
  WHEN CAST(json_extract(NEW.`price_breakdown`, '$.otherAmountCents') AS integer) <> 0 THEN 1
  WHEN CAST(json_extract(NEW.`price_breakdown`, '$.totalAmountCents') AS integer)
    <> CAST(json_extract(NEW.`price_breakdown`, '$.laborAmountCents') AS integer) THEN 1
  ELSE 0
END
BEGIN
  SELECT RAISE(ABORT, 'Tuveloz change orders must be labor only');
END;

DROP TRIGGER IF EXISTS `provider_invoices_labor_only_insert`;
CREATE TRIGGER `provider_invoices_labor_only_insert`
BEFORE INSERT ON `provider_invoices`
WHEN NEW.`parts_amount_cents` <> 0
OR NEW.`tax_amount_cents` <> 0
OR NEW.`other_amount_cents` <> 0
OR NEW.`total_amount_cents` <> NEW.`labor_amount_cents`
BEGIN
  SELECT RAISE(ABORT, 'Tuveloz provider invoices must be labor only');
END;

DROP TRIGGER IF EXISTS `provider_invoices_labor_only_update`;
CREATE TRIGGER `provider_invoices_labor_only_update`
BEFORE UPDATE OF `labor_amount_cents`, `parts_amount_cents`, `tax_amount_cents`, `other_amount_cents`, `total_amount_cents`
ON `provider_invoices`
WHEN NEW.`parts_amount_cents` <> 0
OR NEW.`tax_amount_cents` <> 0
OR NEW.`other_amount_cents` <> 0
OR NEW.`total_amount_cents` <> NEW.`labor_amount_cents`
BEGIN
  SELECT RAISE(ABORT, 'Tuveloz provider invoices must be labor only');
END;

DROP TRIGGER IF EXISTS `job_cancellations_labor_only_insert`;
CREATE TRIGGER `job_cancellations_labor_only_insert`
BEFORE INSERT ON `job_cancellations`
WHEN NEW.`parts_committed_cents` <> 0
BEGIN
  SELECT RAISE(ABORT, 'Tuveloz cancellations cannot include a provider parts claim');
END;

DROP TRIGGER IF EXISTS `job_cancellations_labor_only_update`;
CREATE TRIGGER `job_cancellations_labor_only_update`
BEFORE UPDATE OF `parts_committed_cents` ON `job_cancellations`
WHEN NEW.`parts_committed_cents` <> 0
BEGIN
  SELECT RAISE(ABORT, 'Tuveloz cancellations cannot include a provider parts claim');
END;

DROP TRIGGER IF EXISTS `repair_authorizations_labor_only_insert`;
CREATE TRIGGER `repair_authorizations_labor_only_insert`
BEFORE INSERT ON `repair_authorization_records`
WHEN NEW.`estimate_fee_cents` <> 0
OR NEW.`surcharge_cents` <> 0
OR NEW.`parts_amount_cents` <> 0
OR NEW.`tax_amount_cents` <> 0
OR NEW.`other_amount_cents` <> 0
OR NEW.`total_amount_cents` <> NEW.`labor_amount_cents`
BEGIN
  SELECT RAISE(ABORT, 'Tuveloz repair authorizations must be labor only');
END;

DROP TRIGGER IF EXISTS `repair_authorizations_labor_only_update`;
CREATE TRIGGER `repair_authorizations_labor_only_update`
BEFORE UPDATE OF `estimate_fee_cents`, `surcharge_cents`, `labor_amount_cents`, `parts_amount_cents`, `tax_amount_cents`, `other_amount_cents`, `total_amount_cents`
ON `repair_authorization_records`
WHEN NEW.`estimate_fee_cents` <> 0
OR NEW.`surcharge_cents` <> 0
OR NEW.`parts_amount_cents` <> 0
OR NEW.`tax_amount_cents` <> 0
OR NEW.`other_amount_cents` <> 0
OR NEW.`total_amount_cents` <> NEW.`labor_amount_cents`
BEGIN
  SELECT RAISE(ABORT, 'Tuveloz repair authorizations must be labor only');
END;

DROP TRIGGER IF EXISTS `repair_authorization_items_labor_only_insert`;
CREATE TRIGGER `repair_authorization_items_labor_only_insert`
BEFORE INSERT ON `repair_authorization_items`
WHEN NEW.`line_type` NOT IN ('labor', 'part')
OR (NEW.`line_type` = 'part' AND (NEW.`unit_amount_cents` <> 0 OR NEW.`line_amount_cents` <> 0))
BEGIN
  SELECT RAISE(ABORT, 'Customer-supplied repair parts may be recorded only at a zero Tuveloz amount');
END;

DROP TRIGGER IF EXISTS `repair_authorization_items_labor_only_update`;
CREATE TRIGGER `repair_authorization_items_labor_only_update`
BEFORE UPDATE OF `line_type`, `unit_amount_cents`, `line_amount_cents` ON `repair_authorization_items`
WHEN NEW.`line_type` NOT IN ('labor', 'part')
OR (NEW.`line_type` = 'part' AND (NEW.`unit_amount_cents` <> 0 OR NEW.`line_amount_cents` <> 0))
BEGIN
  SELECT RAISE(ABORT, 'Customer-supplied repair parts may be recorded only at a zero Tuveloz amount');
END;

DROP TRIGGER IF EXISTS `provider_invoice_items_labor_only_insert`;
CREATE TRIGGER `provider_invoice_items_labor_only_insert`
BEFORE INSERT ON `provider_invoice_items`
WHEN NEW.`line_type` NOT IN ('labor', 'part')
OR (NEW.`line_type` = 'part' AND (NEW.`unit_amount_cents` <> 0 OR NEW.`line_amount_cents` <> 0))
BEGIN
  SELECT RAISE(ABORT, 'Customer-supplied invoice parts may be recorded only at a zero Tuveloz amount');
END;

DROP TRIGGER IF EXISTS `provider_invoice_items_labor_only_update`;
CREATE TRIGGER `provider_invoice_items_labor_only_update`
BEFORE UPDATE OF `line_type`, `unit_amount_cents`, `line_amount_cents` ON `provider_invoice_items`
WHEN NEW.`line_type` NOT IN ('labor', 'part')
OR (NEW.`line_type` = 'part' AND (NEW.`unit_amount_cents` <> 0 OR NEW.`line_amount_cents` <> 0))
BEGIN
  SELECT RAISE(ABORT, 'Customer-supplied invoice parts may be recorded only at a zero Tuveloz amount');
END;
