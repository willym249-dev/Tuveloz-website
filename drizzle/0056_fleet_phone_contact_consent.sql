ALTER TABLE `fleet_inquiries` ADD `contact_phone` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `fleet_inquiries` ADD `sms_marketing_consent_text` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `fleet_inquiries` ADD `sms_marketing_consent_version` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `fleet_inquiries` ADD `sms_marketing_consented_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `fleet_inquiries` ADD `sms_marketing_revoked_at` text DEFAULT '' NOT NULL;
