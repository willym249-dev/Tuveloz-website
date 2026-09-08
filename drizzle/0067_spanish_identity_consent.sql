-- Preserve all identity binding guards and existing consent records. Only the
-- reviewed Spanish consent version is added to the allowed insert versions.
DROP TRIGGER provider_identity_verification_insert_guard;
--> statement-breakpoint
CREATE TRIGGER provider_identity_verification_insert_guard
BEFORE INSERT ON provider_identity_verification_sessions
BEGIN
	SELECT RAISE(ABORT, 'identity verification insert requires the latest independent owner-operator binding') WHERE (
		NEW.decision_status = 'pending'
		AND NEW.stripe_status = 'creating'
		AND NEW.stripe_verification_session_id = ''
		AND NEW.stripe_verification_report_id = ''
		AND NEW.person_name_source_type = 'application_evidence'
		AND NEW.person_name_source_id = NEW.application_submission_evidence_id
		AND NEW.certification_version IN (
			'stripe-identity-owner-operator-consent-2026-08-01-v1',
			'stripe-identity-owner-operator-consent-2026-09-08-es-v1'
		)
		AND NEW.attempt_number >= 1
		AND length(NEW.account_session_hash) = 64
		AND lower(NEW.account_session_hash) = NEW.account_session_hash
		AND NEW.account_session_hash NOT GLOB '*[^0-9a-f]*'
		AND datetime(NEW.consented_at) IS NOT NULL
		AND NEW.application_submission_evidence_id = (
			SELECT id
			FROM provider_application_submission_evidence
			WHERE provider_id = NEW.provider_id
			ORDER BY created_at DESC, id DESC
			LIMIT 1
		)
		AND EXISTS (
			SELECT 1
			FROM provider_pathway_profiles
			WHERE provider_id = NEW.provider_id
				AND provider_person_id = NEW.person_id
				AND relationship_path = 'independent_startup'
				AND sponsoring_provider_id = ''
				AND registration_holder_id IN ('', NEW.provider_id)
				AND pathway_version = (
					SELECT max(pathway_version)
					FROM provider_pathway_profiles
					WHERE provider_id = NEW.provider_id
				)
		)
		AND EXISTS (
			SELECT 1
			FROM provider_personnel
			WHERE provider_id = NEW.provider_id
				AND person_id = NEW.person_id
				AND relationship_type = 'owner_operator'
				AND status IN ('pending', 'active')
				AND roster_version = (
					SELECT max(roster_version)
					FROM provider_personnel
					WHERE provider_id = NEW.provider_id
						AND person_id = NEW.person_id
				)
		)
	) IS NOT TRUE;
END;
