CREATE TABLE provider_identity_verification_sessions (
	id text PRIMARY KEY NOT NULL,
	provider_id text NOT NULL,
	person_id text NOT NULL,
	application_submission_evidence_id text NOT NULL,
	person_name_source_type text NOT NULL,
	person_name_source_id text NOT NULL,
	account_session_hash text NOT NULL,
	certification_version text NOT NULL,
	attempt_number integer NOT NULL,
	stripe_verification_session_id text DEFAULT '' NOT NULL,
	stripe_verification_report_id text DEFAULT '' NOT NULL,
	stripe_status text DEFAULT 'creating' NOT NULL,
	decision_status text DEFAULT 'pending' NOT NULL,
	failure_code text DEFAULT '' NOT NULL,
	livemode integer DEFAULT 0 NOT NULL,
	consented_at text NOT NULL,
	checked_at text DEFAULT '' NOT NULL,
	verified_at text DEFAULT '' NOT NULL,
	redacted_at text DEFAULT '' NOT NULL,
	last_stripe_event_id text DEFAULT '' NOT NULL,
	last_stripe_event_created integer DEFAULT 0 NOT NULL,
	created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX provider_identity_verification_stripe_session_unique ON provider_identity_verification_sessions (stripe_verification_session_id) WHERE "provider_identity_verification_sessions"."stripe_verification_session_id" <> '';--> statement-breakpoint
CREATE UNIQUE INDEX provider_identity_verification_attempt_unique ON provider_identity_verification_sessions (provider_id,person_id,attempt_number);--> statement-breakpoint
CREATE UNIQUE INDEX provider_identity_verification_one_active_unique ON provider_identity_verification_sessions (provider_id,person_id) WHERE "provider_identity_verification_sessions"."decision_status" = 'pending' and "provider_identity_verification_sessions"."stripe_status" in ('creating', 'requires_input', 'processing', 'verified');--> statement-breakpoint
CREATE INDEX provider_identity_verification_provider_person_idx ON provider_identity_verification_sessions (provider_id,person_id,created_at);--> statement-breakpoint
CREATE INDEX provider_identity_verification_application_evidence_idx ON provider_identity_verification_sessions (application_submission_evidence_id);--> statement-breakpoint
CREATE INDEX provider_identity_verification_status_idx ON provider_identity_verification_sessions (decision_status,stripe_status,updated_at);
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
		AND NEW.certification_version = 'stripe-identity-owner-operator-consent-2026-08-01-v1'
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
--> statement-breakpoint
CREATE TRIGGER provider_identity_verification_binding_immutable
BEFORE UPDATE ON provider_identity_verification_sessions
WHEN NEW.provider_id <> OLD.provider_id
	OR NEW.person_id <> OLD.person_id
	OR NEW.application_submission_evidence_id <> OLD.application_submission_evidence_id
	OR NEW.person_name_source_type <> OLD.person_name_source_type
	OR NEW.person_name_source_id <> OLD.person_name_source_id
	OR NEW.account_session_hash <> OLD.account_session_hash
	OR NEW.certification_version <> OLD.certification_version
	OR NEW.attempt_number <> OLD.attempt_number
	OR NEW.consented_at <> OLD.consented_at
	OR (OLD.stripe_verification_session_id <> '' AND NEW.stripe_verification_session_id <> OLD.stripe_verification_session_id)
	OR (OLD.stripe_verification_report_id <> '' AND NEW.stripe_verification_report_id <> OLD.stripe_verification_report_id)
	OR (
		NEW.livemode <> OLD.livemode
		AND NOT (
			OLD.decision_status = 'pending'
			AND OLD.stripe_verification_session_id = ''
			AND NEW.stripe_verification_session_id <> ''
		)
	)
BEGIN
	SELECT RAISE(ABORT, 'identity verification binding is immutable');
END;
--> statement-breakpoint
CREATE TRIGGER provider_identity_verification_terminal_immutable
BEFORE UPDATE ON provider_identity_verification_sessions
WHEN OLD.decision_status IN ('approved', 'blocked', 'closed')
	AND (
		NEW.decision_status <> OLD.decision_status
		OR (
			NEW.stripe_status <> OLD.stripe_status
			AND NOT (
				OLD.decision_status = 'closed'
				AND OLD.failure_code = 'application_evidence_superseded'
				AND NEW.stripe_status = 'canceled'
			)
		)
		OR NEW.failure_code <> OLD.failure_code
		OR NEW.checked_at <> OLD.checked_at
		OR NEW.verified_at <> OLD.verified_at
	)
BEGIN
	SELECT RAISE(ABORT, 'terminal identity verification decision is immutable');
END;
--> statement-breakpoint
CREATE TRIGGER provider_identity_verification_approval_requires_personnel_reference
BEFORE UPDATE OF decision_status ON provider_identity_verification_sessions
WHEN OLD.decision_status = 'pending' AND NEW.decision_status = 'approved'
BEGIN
	SELECT RAISE(ABORT, 'approved identity session requires exact latest application, pathway, and personnel binding') WHERE (
		NEW.stripe_status = 'verified'
		AND NEW.stripe_verification_session_id GLOB 'vs_*'
		AND NEW.stripe_verification_report_id GLOB 'vr_*'
		AND NEW.failure_code = ''
		AND NEW.checked_at = NEW.verified_at
		AND datetime(NEW.checked_at) IS NOT NULL
		AND NEW.last_stripe_event_id <> ''
		AND NEW.last_stripe_event_created > 0
		AND NEW.person_name_source_type = 'application_evidence'
		AND NEW.person_name_source_id = NEW.application_submission_evidence_id
		AND NEW.application_submission_evidence_id = (
			SELECT id
			FROM provider_application_submission_evidence
			WHERE provider_id = NEW.provider_id
			ORDER BY created_at DESC, id DESC
			LIMIT 1
		)
		AND EXISTS (
			SELECT 1
			FROM provider_application_submission_evidence
			WHERE id = NEW.application_submission_evidence_id
				AND provider_id = NEW.provider_id
				AND json_valid(normalized_snapshot) = 1
				AND json_extract(normalized_snapshot, '$.format') = 'tuveloz_provider_application_payload_v2'
				AND json_extract(normalized_snapshot, '$.acknowledgements.performingPersonIdentityAcknowledged') = 1
				AND length(trim(json_extract(normalized_snapshot, '$.performingPersonFirstName'))) >= 1
				AND length(trim(json_extract(normalized_snapshot, '$.performingPersonLastName'))) >= 1
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
			FROM provider_personnel AS p
			WHERE p.provider_id = NEW.provider_id
				AND p.person_id = NEW.person_id
				AND p.relationship_type = 'owner_operator'
				AND p.status IN ('pending', 'active')
				AND (
					(
						p.identity_verification_provider = ''
						AND p.identity_verification_reference = ''
						AND p.identity_verification_checked_at = ''
						AND p.identity_verification_valid_through = ''
						AND p.age_verification_provider = ''
						AND p.age_verification_reference = ''
						AND p.age_verification_checked_at = ''
						AND p.age_verification_valid_through = ''
					)
					OR (
						p.identity_verification_provider = 'stripe_identity'
						AND p.age_verification_provider = 'stripe_identity'
						AND p.identity_verification_reference = p.age_verification_reference
						AND p.identity_verification_checked_at = p.age_verification_checked_at
						AND p.identity_verification_valid_through = p.age_verification_valid_through
						AND p.identity_verification_valid_through < date(NEW.checked_at)
						AND EXISTS (
							SELECT 1
							FROM provider_identity_verification_sessions AS prior
							WHERE prior.id <> NEW.id
								AND prior.provider_id = NEW.provider_id
								AND prior.person_id = NEW.person_id
								AND prior.application_submission_evidence_id = NEW.application_submission_evidence_id
								AND prior.decision_status = 'approved'
								AND prior.stripe_status = 'verified'
								AND prior.stripe_verification_session_id = p.identity_verification_reference
								AND prior.checked_at = p.identity_verification_checked_at
								AND date(prior.checked_at, '+365 days') = p.identity_verification_valid_through
						)
					)
				)
				AND p.roster_version = (
					SELECT max(roster_version)
					FROM provider_personnel
					WHERE provider_id = NEW.provider_id
						AND person_id = NEW.person_id
				)
		)
	) IS NOT TRUE;
END;
--> statement-breakpoint
CREATE TRIGGER provider_identity_verification_approval_stamps_personnel
AFTER UPDATE OF decision_status ON provider_identity_verification_sessions
WHEN OLD.decision_status = 'pending' AND NEW.decision_status = 'approved'
BEGIN
	UPDATE provider_personnel
	SET status = 'active',
		identity_verified_at = NEW.checked_at,
		age_verified_at = NEW.checked_at,
		identity_verification_provider = 'stripe_identity',
		identity_verification_reference = NEW.stripe_verification_session_id,
		identity_verification_checked_at = NEW.checked_at,
		identity_verification_valid_through = date(NEW.checked_at, '+365 days'),
		age_verification_provider = 'stripe_identity',
		age_verification_reference = NEW.stripe_verification_session_id,
		age_verification_checked_at = NEW.checked_at,
		age_verification_valid_through = date(NEW.checked_at, '+365 days'),
		updated_at = CURRENT_TIMESTAMP
	WHERE provider_id = NEW.provider_id
		AND person_id = NEW.person_id
		AND relationship_type = 'owner_operator'
		AND status IN ('pending', 'active')
		AND roster_version = (
			SELECT max(roster_version)
			FROM provider_personnel
			WHERE provider_id = NEW.provider_id
				AND person_id = NEW.person_id
		);
	SELECT RAISE(ABORT, 'approved identity session could not stamp exactly one personnel record') WHERE changes() <> 1;

	UPDATE provider_pathway_profiles
	SET registration_holder_id = NEW.provider_id,
		updated_at = CURRENT_TIMESTAMP
	WHERE provider_id = NEW.provider_id
		AND provider_person_id = NEW.person_id
		AND relationship_path = 'independent_startup'
		AND sponsoring_provider_id = ''
		AND registration_holder_id IN ('', NEW.provider_id)
		AND pathway_version = (
			SELECT max(pathway_version)
			FROM provider_pathway_profiles
			WHERE provider_id = NEW.provider_id
		);
	SELECT RAISE(ABORT, 'approved identity session could not bind exactly one independent profile') WHERE changes() <> 1;
END;
--> statement-breakpoint
CREATE TRIGGER provider_personnel_identity_revocation_blocks_provider
AFTER UPDATE OF identity_verification_provider, identity_verification_reference,
	identity_verification_checked_at, identity_verification_valid_through,
	age_verification_provider, age_verification_reference,
	age_verification_checked_at, age_verification_valid_through
ON provider_personnel
WHEN (
	OLD.identity_verification_provider <> ''
	OR OLD.identity_verification_reference <> ''
	OR OLD.age_verification_provider <> ''
	OR OLD.age_verification_reference <> ''
)
	AND NEW.identity_verification_provider = ''
	AND NEW.identity_verification_reference = ''
	AND NEW.identity_verification_checked_at = ''
	AND NEW.identity_verification_valid_through = ''
	AND NEW.age_verification_provider = ''
	AND NEW.age_verification_reference = ''
	AND NEW.age_verification_checked_at = ''
	AND NEW.age_verification_valid_through = ''
BEGIN
	UPDATE provider_personnel
	SET status = 'pending',
		identity_verified_at = '',
		age_verified_at = '',
		updated_at = CURRENT_TIMESTAMP
	WHERE id = NEW.id
		AND provider_id = NEW.provider_id;

	UPDATE provider_service_eligibility
	SET eligibility_state = 'blocked',
		reason_codes = '["identity_verification_revoked_or_transitioned"]',
		valid_through = '',
		next_expiration_at = '',
		calculated_at = CURRENT_TIMESTAMP,
		updated_at = CURRENT_TIMESTAMP
	WHERE provider_id = NEW.provider_id;

	UPDATE provider_applications
	SET verification_status = 'in review',
		service_eligibility_statuses = '',
		approved_services = '',
		verified_at = '',
		verified_by = '',
		alerts_enabled = 'no',
		status = CASE WHEN status = 'declined' THEN status ELSE 'new' END
	WHERE id = NEW.provider_id;
END;
--> statement-breakpoint
CREATE TRIGGER provider_application_identity_reverification_on_amendment
AFTER INSERT ON provider_application_submission_evidence
WHEN NEW.id = (
	SELECT id
	FROM provider_application_submission_evidence
	WHERE provider_id = NEW.provider_id
	ORDER BY created_at DESC, id DESC
	LIMIT 1
)
	AND (
		EXISTS (
			SELECT 1
			FROM provider_identity_verification_sessions
			WHERE provider_id = NEW.provider_id
				AND application_submission_evidence_id <> NEW.id
				AND decision_status IN ('approved', 'pending')
		)
		OR EXISTS (
			SELECT 1
			FROM provider_personnel
			WHERE provider_id = NEW.provider_id
				AND (
					identity_verification_provider <> ''
					OR identity_verification_reference <> ''
					OR age_verification_provider <> ''
					OR age_verification_reference <> ''
				)
		)
	)
BEGIN
	UPDATE provider_identity_verification_sessions
	SET decision_status = 'closed',
		failure_code = 'application_evidence_superseded',
		updated_at = CURRENT_TIMESTAMP
	WHERE provider_id = NEW.provider_id
		AND application_submission_evidence_id <> NEW.id
		AND decision_status = 'pending';

	UPDATE provider_personnel
	SET status = 'pending',
		identity_verified_at = '',
		age_verified_at = '',
		identity_verification_provider = '',
		identity_verification_reference = '',
		identity_verification_checked_at = '',
		identity_verification_valid_through = '',
		age_verification_provider = '',
		age_verification_reference = '',
		age_verification_checked_at = '',
		age_verification_valid_through = '',
		updated_at = CURRENT_TIMESTAMP
	WHERE provider_id = NEW.provider_id
		AND (
			identity_verification_provider <> ''
			OR identity_verification_reference <> ''
			OR age_verification_provider <> ''
			OR age_verification_reference <> ''
		);

	UPDATE provider_service_eligibility
	SET eligibility_state = 'blocked',
		reason_codes = '["identity_reverification_required_after_application_amendment"]',
		valid_through = '',
		next_expiration_at = '',
		calculated_at = CURRENT_TIMESTAMP,
		updated_at = CURRENT_TIMESTAMP
	WHERE provider_id = NEW.provider_id;

	UPDATE provider_applications
	SET verification_status = 'in review',
		service_eligibility_statuses = '',
		approved_services = '',
		verified_at = '',
		verified_by = '',
		alerts_enabled = 'no',
		status = CASE WHEN status = 'declined' THEN status ELSE 'new' END
	WHERE id = NEW.provider_id;
END;
--> statement-breakpoint
CREATE TRIGGER provider_personnel_stripe_identity_guard_insert
BEFORE INSERT ON provider_personnel
WHEN lower(trim(NEW.identity_verification_provider)) = 'stripe_identity'
	OR lower(trim(NEW.age_verification_provider)) = 'stripe_identity'
BEGIN
	SELECT RAISE(ABORT, 'stripe identity personnel evidence requires an approved bound session') WHERE NOT EXISTS (
		SELECT 1
		FROM provider_identity_verification_sessions
		WHERE provider_id = NEW.provider_id
			AND person_id = NEW.person_id
			AND decision_status = 'approved'
			AND stripe_status = 'verified'
			AND stripe_verification_session_id = NEW.identity_verification_reference
			AND stripe_verification_session_id = NEW.age_verification_reference
			AND NEW.identity_verification_provider = 'stripe_identity'
			AND NEW.age_verification_provider = 'stripe_identity'
			AND NEW.identity_verification_checked_at = checked_at
			AND NEW.age_verification_checked_at = checked_at
			AND NEW.identity_verification_valid_through = date(checked_at, '+365 days')
			AND NEW.age_verification_valid_through = date(checked_at, '+365 days')
	);
END;
--> statement-breakpoint
CREATE TRIGGER provider_personnel_stripe_identity_binding_immutable
BEFORE UPDATE OF id, provider_id, person_id, relationship_type, roster_version
ON provider_personnel
WHEN (
	OLD.identity_verification_provider <> ''
	OR OLD.identity_verification_reference <> ''
	OR OLD.age_verification_provider <> ''
	OR OLD.age_verification_reference <> ''
)
	AND (
		NEW.id <> OLD.id
		OR NEW.provider_id <> OLD.provider_id
		OR NEW.person_id <> OLD.person_id
		OR NEW.relationship_type <> OLD.relationship_type
		OR NEW.roster_version <> OLD.roster_version
	)
BEGIN
	SELECT RAISE(ABORT, 'verified Stripe identity personnel binding is immutable until verification is revoked');
END;
--> statement-breakpoint
CREATE TRIGGER provider_personnel_stripe_identity_guard_update
BEFORE UPDATE OF identity_verification_provider, identity_verification_reference,
	identity_verification_checked_at, identity_verification_valid_through,
	age_verification_provider, age_verification_reference,
	age_verification_checked_at, age_verification_valid_through
ON provider_personnel
WHEN lower(trim(NEW.identity_verification_provider)) = 'stripe_identity'
	OR lower(trim(NEW.age_verification_provider)) = 'stripe_identity'
BEGIN
	SELECT RAISE(ABORT, 'stripe identity personnel evidence requires an approved bound session') WHERE NOT EXISTS (
		SELECT 1
		FROM provider_identity_verification_sessions
		WHERE provider_id = NEW.provider_id
			AND person_id = NEW.person_id
			AND decision_status = 'approved'
			AND stripe_status = 'verified'
			AND stripe_verification_session_id = NEW.identity_verification_reference
			AND stripe_verification_session_id = NEW.age_verification_reference
			AND NEW.identity_verification_provider = 'stripe_identity'
			AND NEW.age_verification_provider = 'stripe_identity'
			AND NEW.identity_verification_checked_at = checked_at
			AND NEW.age_verification_checked_at = checked_at
			AND NEW.identity_verification_valid_through = date(checked_at, '+365 days')
			AND NEW.age_verification_valid_through = date(checked_at, '+365 days')
	);
END;
