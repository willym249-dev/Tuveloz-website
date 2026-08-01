ALTER TABLE `provider_evidence_submissions` ADD `authenticity_verification_method` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `provider_evidence_submissions` ADD `authenticity_verified_by` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `provider_evidence_submissions` ADD `authenticity_verification_reference` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `provider_evidence_submissions` ADD `authenticity_source_url` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `provider_evidence_submissions` ADD `authenticity_verified_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `provider_evidence_submissions` ADD `authenticity_valid_through` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `provider_personnel` ADD `identity_verification_provider` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `provider_personnel` ADD `identity_verification_reference` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `provider_personnel` ADD `identity_verification_checked_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `provider_personnel` ADD `identity_verification_valid_through` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `provider_personnel` ADD `age_verification_provider` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `provider_personnel` ADD `age_verification_reference` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `provider_personnel` ADD `age_verification_checked_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `provider_personnel` ADD `age_verification_valid_through` text DEFAULT '' NOT NULL;
