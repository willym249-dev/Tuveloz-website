-- Concurrent uploads must not create two pending files for one requirement.
-- Structured evidence and historical submissions are intentionally unaffected.
CREATE TRIGGER provider_document_pending_guard
BEFORE INSERT ON provider_evidence_submissions
WHEN NEW.storage_key <> '' AND NEW.status = 'pending'
AND EXISTS (
  SELECT 1 FROM provider_evidence_submissions prior
  WHERE prior.provider_id = NEW.provider_id
    AND prior.person_id = NEW.person_id
    AND prior.service_code = NEW.service_code
    AND prior.requirement_key = NEW.requirement_key
    AND prior.jurisdiction = NEW.jurisdiction
    AND prior.storage_key <> ''
    AND prior.status = 'pending'
)
BEGIN
  SELECT RAISE(ABORT, 'provider_document_pending_conflict');
END;
