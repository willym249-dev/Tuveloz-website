-- Existing signatures and nonblank delivery facts remain immutable. An
-- authenticated customer's new receipt may fill only missing copy facts;
-- the route also checks exact displayed hash, participant and live readiness.
DROP TRIGGER provider_invoice_signed_immutable;
--> statement-breakpoint
CREATE TRIGGER provider_invoice_signed_immutable
BEFORE UPDATE ON provider_invoices
WHEN OLD.customer_signature_at <> '' AND (
  NEW.customer_signature_name <> OLD.customer_signature_name OR
  NEW.customer_signature_action <> OLD.customer_signature_action OR
  NEW.customer_signature_at <> OLD.customer_signature_at OR
  NEW.customer_signature_ip <> OLD.customer_signature_ip OR
  NEW.customer_signature_session_id <> OLD.customer_signature_session_id OR
  NEW.customer_signature_device <> OLD.customer_signature_device OR
  (OLD.customer_copy_delivery_method <> '' AND NEW.customer_copy_delivery_method <> OLD.customer_copy_delivery_method) OR
  (OLD.customer_copy_delivered_to <> '' AND NEW.customer_copy_delivered_to <> OLD.customer_copy_delivered_to) OR
  (OLD.customer_copy_delivered_at <> '' AND NEW.customer_copy_delivered_at <> OLD.customer_copy_delivered_at) OR
  (OLD.provider_copy_retained_at <> '' AND NEW.provider_copy_retained_at <> OLD.provider_copy_retained_at)
)
BEGIN
  SELECT RAISE(ABORT, 'Signed provider invoice signature and original delivery facts are immutable');
END;
--> statement-breakpoint
CREATE TRIGGER provider_invoice_copy_repair_requires_signature_evidence
BEFORE UPDATE ON provider_invoices
WHEN OLD.customer_signature_at <> '' AND (
  NEW.customer_copy_delivery_method <> OLD.customer_copy_delivery_method OR
  NEW.customer_copy_delivered_to <> OLD.customer_copy_delivered_to OR
  NEW.customer_copy_delivered_at <> OLD.customer_copy_delivered_at OR
  NEW.provider_copy_retained_at <> OLD.provider_copy_retained_at
) AND (
  NEW.status <> 'final' OR NEW.document_hash = '' OR
  NEW.customer_copy_delivery_method <> 'secure-account-copy' OR
  NEW.customer_copy_delivered_to = '' OR NEW.customer_copy_delivered_at = '' OR NEW.provider_copy_retained_at = '' OR
  NOT EXISTS (
    SELECT 1 FROM customer_agreement_acceptances acceptance
    JOIN customer_requests request ON request.id = NEW.request_id
    WHERE acceptance.request_id = NEW.request_id AND acceptance.quote_id = NEW.quote_id
      AND acceptance.scope_version = NEW.scope_version
      AND lower(acceptance.customer_email) = lower(request.email)
      AND lower(NEW.customer_copy_delivered_to) = lower(request.email)
      AND acceptance.agreement_key = 'provider_final_invoice_signature'
      AND acceptance.agreement_version = 'maryland-repair-records-2026-08-01-v2'
      AND acceptance.agreement_hash = NEW.document_hash AND acceptance.scope_snapshot = NEW.document_snapshot
      AND acceptance.agreement_text = NEW.document_snapshot || char(10) || 'Electronic transaction consent: By typing your name and selecting the separate signature checkbox, you agree to conduct this specific repair authorization or invoice transaction electronically and to receive, access, download, and retain the exact electronic record through your secure Tuveloz account. You may refuse to conduct this or a future transaction electronically. If you do not agree, do not sign electronically and contact the provider to arrange a non-electronic record. Your typed name and affirmative checkbox are intended as your electronic signature on this exact stored record. This does not waive any non-waivable right or accept work outside the written record.'
      AND acceptance.accepted_by_name = NEW.customer_signature_name
      AND acceptance.acceptance_action = NEW.customer_signature_action
      AND acceptance.accepted_at = NEW.customer_signature_at
      AND acceptance.session_id = NEW.customer_signature_session_id AND acceptance.session_id <> ''
      AND acceptance.ip_address = NEW.customer_signature_ip
      AND acceptance.device_context = NEW.customer_signature_device
  )
)
BEGIN
  SELECT RAISE(ABORT, 'Invoice copy receipt requires the matching original customer signature evidence');
END;
