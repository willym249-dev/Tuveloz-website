CREATE TABLE `provider_application_challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`payload_hash` text NOT NULL,
	`code_hash` text NOT NULL,
	`source_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`verified_at` text DEFAULT '' NOT NULL,
	`used_at` text DEFAULT '' NOT NULL,
	`consumption_nonce` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `provider_application_challenges_email_created_idx` ON `provider_application_challenges` (`email`,`created_at`);--> statement-breakpoint
CREATE INDEX `provider_application_challenges_expires_idx` ON `provider_application_challenges` (`expires_at`);--> statement-breakpoint
CREATE INDEX `provider_application_challenges_source_created_idx` ON `provider_application_challenges` (`source_hash`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `provider_application_challenges_consumption_nonce_unique` ON `provider_application_challenges` (`consumption_nonce`) WHERE `consumption_nonce` <> '';--> statement-breakpoint
CREATE TABLE `provider_application_email_claims` (
	`normalized_email` text PRIMARY KEY NOT NULL,
	`provider_id` text NOT NULL,
	`challenge_id` text DEFAULT '' NOT NULL,
	`consumption_nonce` text DEFAULT '' NOT NULL,
	`claimed_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `provider_application_email_claims_provider_unique` ON `provider_application_email_claims` (`provider_id`);--> statement-breakpoint
INSERT OR IGNORE INTO `provider_application_email_claims` (
	`normalized_email`,
	`provider_id`,
	`challenge_id`,
	`consumption_nonce`,
	`claimed_at`
)
SELECT
	lower(trim(`email`)),
	`id`,
	'',
	'',
	COALESCE(NULLIF(`created_at`, ''), CURRENT_TIMESTAMP)
FROM `provider_applications`
WHERE `status` <> 'declined'
	AND trim(`email`) <> ''
ORDER BY lower(trim(`email`)), datetime(`created_at`) ASC, `id` ASC;--> statement-breakpoint
CREATE TRIGGER `provider_application_email_claim_requires_consumed_challenge`
BEFORE INSERT ON `provider_application_email_claims`
WHEN NOT (
	(
		NEW.`challenge_id` = ''
		AND NEW.`consumption_nonce` = ''
		AND EXISTS (
			SELECT 1
			FROM `provider_applications`
			WHERE `id` = NEW.`provider_id`
				AND `status` <> 'declined'
				AND lower(trim(`email`)) = NEW.`normalized_email`
		)
	)
	OR
	(
		NEW.`challenge_id` <> ''
		AND NEW.`consumption_nonce` <> ''
		AND EXISTS (
			SELECT 1
			FROM `provider_application_challenges`
			WHERE `id` = NEW.`challenge_id`
				AND `email` = NEW.`normalized_email`
				AND `verified_at` <> ''
				AND `used_at` = NEW.`claimed_at`
				AND `consumption_nonce` = NEW.`consumption_nonce`
				AND `expires_at` > NEW.`claimed_at`
		)
	)
)
BEGIN
	SELECT RAISE(ABORT, 'provider application claim requires a consumed email challenge');
END;--> statement-breakpoint
CREATE TRIGGER `provider_application_email_claim_release_after_decline`
AFTER UPDATE OF `status` ON `provider_applications`
WHEN NEW.`status` = 'declined' AND OLD.`status` <> 'declined'
BEGIN
	DELETE FROM `provider_application_email_claims`
	WHERE `provider_id` = NEW.`id`;

	INSERT OR IGNORE INTO `provider_application_email_claims` (
		`normalized_email`,
		`provider_id`,
		`challenge_id`,
		`consumption_nonce`,
		`claimed_at`
	)
	SELECT
		lower(trim(`email`)),
		`id`,
		'',
		'',
		COALESCE(NULLIF(`created_at`, ''), CURRENT_TIMESTAMP)
	FROM `provider_applications`
	WHERE `status` <> 'declined'
		AND `id` <> NEW.`id`
		AND lower(trim(`email`)) = lower(trim(NEW.`email`))
	ORDER BY datetime(`created_at`) ASC, `id` ASC
	LIMIT 1;
END;--> statement-breakpoint
CREATE TABLE `provider_application_submission_evidence` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_id` text NOT NULL,
	`normalized_email` text NOT NULL,
	`challenge_id` text NOT NULL,
	`consumption_nonce` text NOT NULL,
	`normalized_snapshot` text NOT NULL,
	`payload_hash` text NOT NULL,
	`accepted_document_manifest` text NOT NULL,
	`verified_at` text NOT NULL,
	`consumed_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX `provider_application_submission_evidence_challenge_unique` ON `provider_application_submission_evidence` (`challenge_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `provider_application_submission_evidence_nonce_unique` ON `provider_application_submission_evidence` (`consumption_nonce`);--> statement-breakpoint
CREATE INDEX `provider_application_submission_evidence_provider_idx` ON `provider_application_submission_evidence` (`provider_id`,`created_at`);--> statement-breakpoint
CREATE TRIGGER `provider_application_submission_evidence_requires_consumed_challenge`
BEFORE INSERT ON `provider_application_submission_evidence`
WHEN NOT EXISTS (
	SELECT 1
	FROM `provider_application_challenges`
	WHERE `id` = NEW.`challenge_id`
		AND `email` = NEW.`normalized_email`
		AND `payload_hash` = NEW.`payload_hash`
		AND `verified_at` = NEW.`verified_at`
		AND `used_at` = NEW.`consumed_at`
		AND `consumption_nonce` = NEW.`consumption_nonce`
		AND NEW.`consumption_nonce` <> ''
		AND `expires_at` > NEW.`consumed_at`
)
BEGIN
	SELECT RAISE(ABORT, 'provider application evidence requires the current consumed challenge nonce');
END;--> statement-breakpoint
CREATE TRIGGER `provider_application_submission_evidence_immutable_update`
BEFORE UPDATE ON `provider_application_submission_evidence`
BEGIN
	SELECT RAISE(ABORT, 'provider application submission evidence is immutable');
END;--> statement-breakpoint
CREATE TRIGGER `provider_application_submission_evidence_immutable_delete`
BEFORE DELETE ON `provider_application_submission_evidence`
BEGIN
	SELECT RAISE(ABORT, 'provider application submission evidence is immutable');
END;--> statement-breakpoint
ALTER TABLE `agreement_acceptances` ADD `provider_application_submission_evidence_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `agreement_acceptances_provider_application_submission_idx` ON `agreement_acceptances` (`provider_application_submission_evidence_id`);--> statement-breakpoint
CREATE TABLE `public_write_rate_limits` (
	`action` text NOT NULL,
	`key_hash` text NOT NULL,
	`window_started_at` integer NOT NULL,
	`request_count` integer DEFAULT 0 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`action`, `key_hash`)
);
--> statement-breakpoint
CREATE INDEX `public_write_rate_limits_updated_idx` ON `public_write_rate_limits` (`updated_at`);
