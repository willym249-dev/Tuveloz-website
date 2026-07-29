ALTER TABLE `provider_applications` ADD `provider_self_assessment` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `provider_applications` ADD `service_eligibility_statuses` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `provider_applications` ADD `approved_services` text DEFAULT '' NOT NULL;
