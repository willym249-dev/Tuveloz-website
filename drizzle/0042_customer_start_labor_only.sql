-- Customer approval before repair start and labor-only Tuveloz launch controls.
-- Provider-supplied parts, parts tax, and provider add-on charges remain outside
-- Tuveloz payments until the tax and payment structure is formally approved.

DROP TRIGGER IF EXISTS provider_job_records_customer_start_insert_guard;
CREATE TRIGGER provider_job_records_customer_start_insert_guard
BEFORE INSERT ON provider_job_records
WHEN (
  NEW.work_status = 'in progress'
  OR trim(COALESCE(NEW.timer_started_at, '')) <> ''
)
AND EXISTS (
  SELECT 1
    FROM customer_requests request
   WHERE request.id = NEW.request_id
     AND (request.is_test_job = 'no' OR request.is_test_job = 'yes')
)
AND NOT EXISTS (
  SELECT 1
    FROM provider_quotes quote
    INNER JOIN customer_agreement_acceptances acceptance
      ON acceptance.request_id = quote.request_id
     AND acceptance.quote_id = quote.id
     AND acceptance.scope_version = quote.scope_version
     AND acceptance.agreement_key = 'job_start_authorization'
     AND acceptance.agreement_version = 'job-start-authorization-2026-08-01'
     AND trim(acceptance.accepted_at) <> ''
   WHERE quote.request_id = NEW.request_id
     AND lower(quote.provider_email) = lower(NEW.provider_email)
     AND quote.status = 'accepted'
)
BEGIN
  SELECT RAISE(ABORT, 'Customer start authorization is required before repairs begin.');
END;

DROP TRIGGER IF EXISTS provider_job_records_customer_start_update_guard;
CREATE TRIGGER provider_job_records_customer_start_update_guard
BEFORE UPDATE OF work_status, timer_started_at ON provider_job_records
WHEN (
  NEW.work_status = 'in progress'
  OR trim(COALESCE(NEW.timer_started_at, '')) <> ''
)
AND EXISTS (
  SELECT 1
    FROM customer_requests request
   WHERE request.id = NEW.request_id
     AND (request.is_test_job = 'no' OR request.is_test_job = 'yes')
)
AND NOT EXISTS (
  SELECT 1
    FROM provider_quotes quote
    INNER JOIN customer_agreement_acceptances acceptance
      ON acceptance.request_id = quote.request_id
     AND acceptance.quote_id = quote.id
     AND acceptance.scope_version = quote.scope_version
     AND acceptance.agreement_key = 'job_start_authorization'
     AND acceptance.agreement_version = 'job-start-authorization-2026-08-01'
     AND trim(acceptance.accepted_at) <> ''
   WHERE quote.request_id = NEW.request_id
     AND lower(quote.provider_email) = lower(NEW.provider_email)
     AND quote.status = 'accepted'
)
BEGIN
  SELECT RAISE(ABORT, 'Customer start authorization is required before repairs begin.');
END;

DROP TRIGGER IF EXISTS provider_quotes_labor_only_insert_guard;
CREATE TRIGGER provider_quotes_labor_only_insert_guard
BEFORE INSERT ON provider_quotes
WHEN EXISTS (
  SELECT 1
    FROM customer_requests request
   WHERE request.id = NEW.request_id
     AND (request.is_test_job = 'no' OR request.is_test_job = 'yes')
)
AND (
  COALESCE(CAST(NEW.parts_price_cents AS INTEGER), 0) <> 0
  OR COALESCE(CAST(NEW.price_cents AS INTEGER), 0)
     <> COALESCE(CAST(NEW.labor_price_cents AS INTEGER), 0)
)
BEGIN
  SELECT RAISE(ABORT, 'Tuveloz launch quotes are labor only. Parts must be purchased independently by the customer.');
END;

DROP TRIGGER IF EXISTS provider_quotes_labor_only_update_guard;
CREATE TRIGGER provider_quotes_labor_only_update_guard
BEFORE UPDATE OF price_cents, labor_price_cents, parts_price_cents ON provider_quotes
WHEN EXISTS (
  SELECT 1
    FROM customer_requests request
   WHERE request.id = NEW.request_id
     AND (request.is_test_job = 'no' OR request.is_test_job = 'yes')
)
AND (
  COALESCE(CAST(NEW.parts_price_cents AS INTEGER), 0) <> 0
  OR COALESCE(CAST(NEW.price_cents AS INTEGER), 0)
     <> COALESCE(CAST(NEW.labor_price_cents AS INTEGER), 0)
)
BEGIN
  SELECT RAISE(ABORT, 'Tuveloz launch quotes are labor only. Parts must be purchased independently by the customer.');
END;

DROP TRIGGER IF EXISTS job_authorizations_labor_only_insert_guard;
CREATE TRIGGER job_authorizations_labor_only_insert_guard
BEFORE INSERT ON job_authorizations
WHEN EXISTS (
  SELECT 1
    FROM customer_requests request
   WHERE request.id = NEW.request_id
     AND (request.is_test_job = 'no' OR request.is_test_job = 'yes')
)
AND (
  NEW.parts_cents <> 0
  OR NEW.other_fees_cents <> 0
  OR NEW.total_cents <> NEW.labor_cents
)
BEGIN
  SELECT RAISE(ABORT, 'Tuveloz authorizations may include labor only during the launch phase.');
END;

DROP TRIGGER IF EXISTS job_authorizations_labor_only_update_guard;
CREATE TRIGGER job_authorizations_labor_only_update_guard
BEFORE UPDATE OF labor_cents, parts_cents, other_fees_cents, total_cents ON job_authorizations
WHEN EXISTS (
  SELECT 1
    FROM customer_requests request
   WHERE request.id = NEW.request_id
     AND (request.is_test_job = 'no' OR request.is_test_job = 'yes')
)
AND (
  NEW.parts_cents <> 0
  OR NEW.other_fees_cents <> 0
  OR NEW.total_cents <> NEW.labor_cents
)
BEGIN
  SELECT RAISE(ABORT, 'Tuveloz authorizations may include labor only during the launch phase.');
END;

DROP TRIGGER IF EXISTS job_scope_versions_labor_only_insert_guard;
CREATE TRIGGER job_scope_versions_labor_only_insert_guard
BEFORE INSERT ON job_scope_versions
WHEN trim(COALESCE(NEW.quote_id, '')) <> ''
AND EXISTS (
  SELECT 1
    FROM customer_requests request
   WHERE request.id = NEW.request_id
     AND (request.is_test_job = 'no' OR request.is_test_job = 'yes')
)
AND (
  json_valid(NEW.price_breakdown) <> 1
  OR COALESCE(CAST(json_extract(NEW.price_breakdown, '$.partsAmountCents') AS INTEGER), -1) <> 0
  OR COALESCE(CAST(json_extract(NEW.price_breakdown, '$.taxAmountCents') AS INTEGER), -1) <> 0
  OR COALESCE(CAST(json_extract(NEW.price_breakdown, '$.otherAmountCents') AS INTEGER), -1) <> 0
  OR COALESCE(CAST(json_extract(NEW.price_breakdown, '$.totalAmountCents') AS INTEGER), -1)
     <> COALESCE(CAST(json_extract(NEW.price_breakdown, '$.laborAmountCents') AS INTEGER), -2)
)
BEGIN
  SELECT RAISE(ABORT, 'The authorized Tuveloz scope must be labor only with zero parts, tax, and provider add-on charges.');
END;

DROP TRIGGER IF EXISTS job_scope_versions_labor_only_update_guard;
CREATE TRIGGER job_scope_versions_labor_only_update_guard
BEFORE UPDATE OF price_breakdown ON job_scope_versions
WHEN trim(COALESCE(NEW.quote_id, '')) <> ''
AND EXISTS (
  SELECT 1
    FROM customer_requests request
   WHERE request.id = NEW.request_id
     AND (request.is_test_job = 'no' OR request.is_test_job = 'yes')
)
AND (
  json_valid(NEW.price_breakdown) <> 1
  OR COALESCE(CAST(json_extract(NEW.price_breakdown, '$.partsAmountCents') AS INTEGER), -1) <> 0
  OR COALESCE(CAST(json_extract(NEW.price_breakdown, '$.taxAmountCents') AS INTEGER), -1) <> 0
  OR COALESCE(CAST(json_extract(NEW.price_breakdown, '$.otherAmountCents') AS INTEGER), -1) <> 0
  OR COALESCE(CAST(json_extract(NEW.price_breakdown, '$.totalAmountCents') AS INTEGER), -1)
     <> COALESCE(CAST(json_extract(NEW.price_breakdown, '$.laborAmountCents') AS INTEGER), -2)
)
BEGIN
  SELECT RAISE(ABORT, 'The authorized Tuveloz scope must be labor only with zero parts, tax, and provider add-on charges.');
END;

DROP TRIGGER IF EXISTS job_change_orders_labor_only_insert_guard;
CREATE TRIGGER job_change_orders_labor_only_insert_guard
BEFORE INSERT ON job_change_orders
WHEN EXISTS (
  SELECT 1
    FROM customer_requests request
   WHERE request.id = NEW.request_id
     AND (request.is_test_job = 'no' OR request.is_test_job = 'yes')
)
AND (
  json_valid(NEW.price_breakdown) <> 1
  OR COALESCE(CAST(json_extract(NEW.price_breakdown, '$.partsAmountCents') AS INTEGER), -1) <> 0
  OR COALESCE(CAST(json_extract(NEW.price_breakdown, '$.taxAmountCents') AS INTEGER), -1) <> 0
  OR COALESCE(CAST(json_extract(NEW.price_breakdown, '$.otherAmountCents') AS INTEGER), -1) <> 0
  OR COALESCE(CAST(json_extract(NEW.price_breakdown, '$.totalAmountCents') AS INTEGER), -1)
     <> COALESCE(CAST(json_extract(NEW.price_breakdown, '$.laborAmountCents') AS INTEGER), -2)
)
BEGIN
  SELECT RAISE(ABORT, 'Added Tuveloz work must remain labor only and requires separate customer authorization.');
END;

DROP TRIGGER IF EXISTS job_change_orders_labor_only_update_guard;
CREATE TRIGGER job_change_orders_labor_only_update_guard
BEFORE UPDATE OF price_breakdown ON job_change_orders
WHEN EXISTS (
  SELECT 1
    FROM customer_requests request
   WHERE request.id = NEW.request_id
     AND (request.is_test_job = 'no' OR request.is_test_job = 'yes')
)
AND (
  json_valid(NEW.price_breakdown) <> 1
  OR COALESCE(CAST(json_extract(NEW.price_breakdown, '$.partsAmountCents') AS INTEGER), -1) <> 0
  OR COALESCE(CAST(json_extract(NEW.price_breakdown, '$.taxAmountCents') AS INTEGER), -1) <> 0
  OR COALESCE(CAST(json_extract(NEW.price_breakdown, '$.otherAmountCents') AS INTEGER), -1) <> 0
  OR COALESCE(CAST(json_extract(NEW.price_breakdown, '$.totalAmountCents') AS INTEGER), -1)
     <> COALESCE(CAST(json_extract(NEW.price_breakdown, '$.laborAmountCents') AS INTEGER), -2)
)
BEGIN
  SELECT RAISE(ABORT, 'Added Tuveloz work must remain labor only and requires separate customer authorization.');
END;

DROP TRIGGER IF EXISTS provider_invoices_labor_only_insert_guard;
CREATE TRIGGER provider_invoices_labor_only_insert_guard
BEFORE INSERT ON provider_invoices
WHEN EXISTS (
  SELECT 1
    FROM customer_requests request
   WHERE request.id = NEW.request_id
     AND (request.is_test_job = 'no' OR request.is_test_job = 'yes')
)
AND (
  NEW.parts_amount_cents <> 0
  OR NEW.tax_amount_cents <> 0
  OR NEW.other_amount_cents <> 0
  OR NEW.total_amount_cents <> NEW.labor_amount_cents
)
BEGIN
  SELECT RAISE(ABORT, 'Tuveloz launch invoices must bill labor only. Customer-supplied parts may be described but not charged.');
END;

DROP TRIGGER IF EXISTS provider_invoices_labor_only_update_guard;
CREATE TRIGGER provider_invoices_labor_only_update_guard
BEFORE UPDATE OF labor_amount_cents, parts_amount_cents, tax_amount_cents, other_amount_cents, total_amount_cents ON provider_invoices
WHEN EXISTS (
  SELECT 1
    FROM customer_requests request
   WHERE request.id = NEW.request_id
     AND (request.is_test_job = 'no' OR request.is_test_job = 'yes')
)
AND (
  NEW.parts_amount_cents <> 0
  OR NEW.tax_amount_cents <> 0
  OR NEW.other_amount_cents <> 0
  OR NEW.total_amount_cents <> NEW.labor_amount_cents
)
BEGIN
  SELECT RAISE(ABORT, 'Tuveloz launch invoices must bill labor only. Customer-supplied parts may be described but not charged.');
END;

DROP TRIGGER IF EXISTS stripe_payments_labor_only_insert_guard;
CREATE TRIGGER stripe_payments_labor_only_insert_guard
BEFORE INSERT ON stripe_payments
WHEN NEW.payment_type = 'quote'
AND EXISTS (
  SELECT 1
    FROM customer_requests request
   WHERE request.id = NEW.request_id
     AND (request.is_test_job = 'no' OR request.is_test_job = 'yes')
)
AND (
  json_valid(NEW.authorized_price_snapshot) <> 1
  OR COALESCE(CAST(json_extract(NEW.authorized_price_snapshot, '$.partsAmountCents') AS INTEGER), -1) <> 0
  OR COALESCE(CAST(json_extract(NEW.authorized_price_snapshot, '$.taxAmountCents') AS INTEGER), -1) <> 0
  OR COALESCE(CAST(json_extract(NEW.authorized_price_snapshot, '$.otherAmountCents') AS INTEGER), -1) <> 0
  OR NEW.provider_amount_cents
     <> COALESCE(CAST(json_extract(NEW.authorized_price_snapshot, '$.laborAmountCents') AS INTEGER), -2)
  OR NEW.customer_total_cents <> NEW.provider_amount_cents + NEW.application_fee_cents
)
BEGIN
  SELECT RAISE(ABORT, 'Stripe Checkout is labor only during the Tuveloz launch phase.');
END;

DROP TRIGGER IF EXISTS stripe_payments_labor_only_update_guard;
CREATE TRIGGER stripe_payments_labor_only_update_guard
BEFORE UPDATE OF provider_amount_cents, application_fee_cents, customer_total_cents, authorized_price_snapshot ON stripe_payments
WHEN NEW.payment_type = 'quote'
AND EXISTS (
  SELECT 1
    FROM customer_requests request
   WHERE request.id = NEW.request_id
     AND (request.is_test_job = 'no' OR request.is_test_job = 'yes')
)
AND (
  json_valid(NEW.authorized_price_snapshot) <> 1
  OR COALESCE(CAST(json_extract(NEW.authorized_price_snapshot, '$.partsAmountCents') AS INTEGER), -1) <> 0
  OR COALESCE(CAST(json_extract(NEW.authorized_price_snapshot, '$.taxAmountCents') AS INTEGER), -1) <> 0
  OR COALESCE(CAST(json_extract(NEW.authorized_price_snapshot, '$.otherAmountCents') AS INTEGER), -1) <> 0
  OR NEW.provider_amount_cents
     <> COALESCE(CAST(json_extract(NEW.authorized_price_snapshot, '$.laborAmountCents') AS INTEGER), -2)
  OR NEW.customer_total_cents <> NEW.provider_amount_cents + NEW.application_fee_cents
)
BEGIN
  SELECT RAISE(ABORT, 'Stripe Checkout is labor only during the Tuveloz launch phase.');
END;
