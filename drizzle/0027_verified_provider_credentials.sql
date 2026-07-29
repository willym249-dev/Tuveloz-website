CREATE TABLE `provider_credential_verifications` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_id` text NOT NULL,
	`requirement_key` text NOT NULL,
	`requirement_label` text NOT NULL,
	`jurisdiction` text NOT NULL,
	`credential_identifier` text DEFAULT '' NOT NULL,
	`issuing_authority` text NOT NULL,
	`legal_basis_url` text NOT NULL,
	`official_lookup_url` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`verification_method` text DEFAULT 'official-online-record' NOT NULL,
	`checked_at` text DEFAULT '' NOT NULL,
	`expires_at` text DEFAULT '' NOT NULL,
	`verified_by` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `provider_credential_provider_requirement_unique` ON `provider_credential_verifications` (`provider_id`,`requirement_key`);
--> statement-breakpoint
CREATE INDEX `provider_credential_provider_id_idx` ON `provider_credential_verifications` (`provider_id`);
--> statement-breakpoint
CREATE INDEX `provider_credential_status_idx` ON `provider_credential_verifications` (`status`);
--> statement-breakpoint
CREATE INDEX `provider_credential_checked_at_idx` ON `provider_credential_verifications` (`checked_at`);
