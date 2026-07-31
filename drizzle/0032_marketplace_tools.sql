CREATE TABLE `provider_catalog_items` (
  `id` text PRIMARY KEY NOT NULL,
  `provider_id` text NOT NULL,
  `service` text NOT NULL,
  `price_type` text NOT NULL DEFAULT 'starting_at',
  `starting_price_cents` integer NOT NULL DEFAULT 0,
  `description` text NOT NULL DEFAULT '',
  `duration_minutes` integer NOT NULL DEFAULT 0,
  `active` text NOT NULL DEFAULT 'yes',
  `created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`provider_id`) REFERENCES `provider_applications`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `provider_catalog_provider_service_unique` ON `provider_catalog_items` (`provider_id`,`service`);
--> statement-breakpoint
CREATE INDEX `provider_catalog_provider_active_idx` ON `provider_catalog_items` (`provider_id`,`active`);
--> statement-breakpoint
CREATE TABLE `provider_submitted_credentials` (
  `id` text PRIMARY KEY NOT NULL,
  `provider_id` text NOT NULL,
  `credential_name` text NOT NULL,
  `issuing_authority` text NOT NULL DEFAULT '',
  `credential_identifier` text NOT NULL DEFAULT '',
  `jurisdiction` text NOT NULL DEFAULT '',
  `expires_at` text NOT NULL DEFAULT '',
  `status` text NOT NULL DEFAULT 'pending',
  `review_note` text NOT NULL DEFAULT '',
  `public_display` text NOT NULL DEFAULT 'no',
  `created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`provider_id`) REFERENCES `provider_applications`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `provider_submitted_credentials_provider_idx` ON `provider_submitted_credentials` (`provider_id`,`status`);
--> statement-breakpoint
CREATE TABLE `appointments` (
  `id` text PRIMARY KEY NOT NULL,
  `request_id` text NOT NULL DEFAULT '',
  `provider_id` text NOT NULL,
  `provider_email` text NOT NULL,
  `provider_name` text NOT NULL,
  `customer_email` text NOT NULL,
  `customer_name` text NOT NULL DEFAULT '',
  `service` text NOT NULL,
  `requested_by_role` text NOT NULL,
  `starts_at` text NOT NULL,
  `alternate_at` text NOT NULL DEFAULT '',
  `confirmed_start_at` text NOT NULL DEFAULT '',
  `note` text NOT NULL DEFAULT '',
  `status` text NOT NULL DEFAULT 'requested',
  `created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`provider_id`) REFERENCES `provider_applications`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `appointments_provider_status_idx` ON `appointments` (`provider_id`,`status`,`starts_at`);
--> statement-breakpoint
CREATE INDEX `appointments_customer_status_idx` ON `appointments` (`customer_email`,`status`,`starts_at`);
--> statement-breakpoint
CREATE TABLE `account_notifications` (
  `id` text PRIMARY KEY NOT NULL,
  `event_key` text NOT NULL,
  `email` text NOT NULL,
  `role` text NOT NULL,
  `title` text NOT NULL,
  `body` text NOT NULL,
  `href` text NOT NULL DEFAULT '',
  `read_at` text NOT NULL DEFAULT '',
  `created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE UNIQUE INDEX `account_notifications_event_key_unique` ON `account_notifications` (`event_key`);
--> statement-breakpoint
CREATE INDEX `account_notifications_account_idx` ON `account_notifications` (`email`,`role`,`created_at`);
--> statement-breakpoint
CREATE TABLE `job_location_shares` (
  `request_id` text PRIMARY KEY NOT NULL,
  `provider_email` text NOT NULL,
  `customer_email` text NOT NULL,
  `latitude` real,
  `longitude` real,
  `accuracy` real,
  `status` text NOT NULL DEFAULT 'stopped',
  `permission_recorded_at` text NOT NULL DEFAULT '',
  `shared_at` text NOT NULL DEFAULT '',
  `expires_at` text NOT NULL DEFAULT '',
  `updated_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`request_id`) REFERENCES `customer_requests`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `job_location_shares_provider_idx` ON `job_location_shares` (`provider_email`,`status`);
--> statement-breakpoint
CREATE INDEX `job_location_shares_customer_idx` ON `job_location_shares` (`customer_email`,`status`);
--> statement-breakpoint
CREATE TABLE `account_promotions` (
  `email` text NOT NULL,
  `promotion_key` text NOT NULL,
  `status` text NOT NULL DEFAULT 'available',
  `request_id` text NOT NULL DEFAULT '',
  `quote_id` text NOT NULL DEFAULT '',
  `created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `redeemed_at` text NOT NULL DEFAULT '',
  PRIMARY KEY (`email`,`promotion_key`)
);
--> statement-breakpoint
INSERT OR IGNORE INTO `account_promotions` (`email`,`promotion_key`,`status`)
SELECT lower(`email`), 'first-oil-change-fee-free', 'available'
FROM `account_credentials`;
--> statement-breakpoint
CREATE TRIGGER `account_credentials_first_oil_change_promo`
AFTER INSERT ON `account_credentials`
BEGIN
  INSERT OR IGNORE INTO `account_promotions` (`email`,`promotion_key`,`status`)
  VALUES (lower(NEW.`email`), 'first-oil-change-fee-free', 'available');
END;
--> statement-breakpoint
CREATE TRIGGER `provider_quotes_first_oil_change_promo`
AFTER INSERT ON `provider_quotes`
WHEN EXISTS (
  SELECT 1
  FROM `customer_requests` request
  INNER JOIN `account_credentials` credential
    ON lower(credential.`email`) = lower(request.`email`)
  INNER JOIN `account_promotions` promotion
    ON promotion.`email` = lower(request.`email`)
   AND promotion.`promotion_key` = 'first-oil-change-fee-free'
  WHERE request.`id` = NEW.`request_id`
    AND request.`is_test_job` = 'no'
    AND lower(request.`service`) LIKE '%oil change%'
    AND datetime(request.`created_at`) >= datetime(credential.`created_at`)
    AND (
      promotion.`status` = 'available'
      OR (promotion.`status` = 'reserved' AND promotion.`request_id` = NEW.`request_id`)
    )
)
BEGIN
  UPDATE `account_promotions`
     SET `status` = 'reserved',
         `request_id` = NEW.`request_id`,
         `quote_id` = CASE WHEN `quote_id` = '' THEN NEW.`id` ELSE `quote_id` END,
         `updated_at` = CURRENT_TIMESTAMP
   WHERE `promotion_key` = 'first-oil-change-fee-free'
     AND `email` = lower((SELECT `email` FROM `customer_requests` WHERE `id` = NEW.`request_id` LIMIT 1))
     AND (`status` = 'available' OR (`status` = 'reserved' AND `request_id` = NEW.`request_id`));

  UPDATE `provider_quotes`
     SET `customer_fee_rate_bps` = 0,
         `customer_fee_cents` = '0',
         `customer_total_cents` = `price_cents`
   WHERE `id` = NEW.`id`
     AND EXISTS (
       SELECT 1 FROM `account_promotions`
        WHERE `promotion_key` = 'first-oil-change-fee-free'
          AND `email` = lower((SELECT `email` FROM `customer_requests` WHERE `id` = NEW.`request_id` LIMIT 1))
          AND `status` = 'reserved'
          AND `request_id` = NEW.`request_id`
     );

  INSERT OR IGNORE INTO `account_notifications`
    (`id`,`event_key`,`email`,`role`,`title`,`body`,`href`)
  SELECT lower(hex(randomblob(16))),
         'promo:first-oil-change:' || NEW.`request_id`,
         lower(request.`email`),
         'customer',
         'Your first oil-change Tuveloz fee is waived',
         'For this qualifying first oil-change request, Tuveloz will not add its customer service fee. Provider labor, parts, taxes, disposal, travel, and other provider charges are not waived.',
         '/my-request?request=' || NEW.`request_id`
    FROM `customer_requests` request
   WHERE request.`id` = NEW.`request_id`;
END;
--> statement-breakpoint
CREATE TRIGGER `stripe_payments_redeem_first_oil_change_insert`
AFTER INSERT ON `stripe_payments`
WHEN NEW.`status` IN ('paid_pending_completion','ready_for_release','released','paid_and_transferred')
  AND coalesce(NEW.`request_id`, '') <> ''
BEGIN
  UPDATE `account_promotions`
     SET `status` = 'redeemed',
         `quote_id` = coalesce(NEW.`quote_id`, `quote_id`),
         `redeemed_at` = CURRENT_TIMESTAMP,
         `updated_at` = CURRENT_TIMESTAMP
   WHERE `email` = lower(NEW.`customer_email`)
     AND `promotion_key` = 'first-oil-change-fee-free'
     AND `status` = 'reserved'
     AND `request_id` = NEW.`request_id`;
END;
--> statement-breakpoint
CREATE TRIGGER `stripe_payments_redeem_first_oil_change_update`
AFTER UPDATE OF `status` ON `stripe_payments`
WHEN NEW.`status` IN ('paid_pending_completion','ready_for_release','released','paid_and_transferred')
  AND OLD.`status` <> NEW.`status`
  AND coalesce(NEW.`request_id`, '') <> ''
BEGIN
  UPDATE `account_promotions`
     SET `status` = 'redeemed',
         `quote_id` = coalesce(NEW.`quote_id`, `quote_id`),
         `redeemed_at` = CURRENT_TIMESTAMP,
         `updated_at` = CURRENT_TIMESTAMP
   WHERE `email` = lower(NEW.`customer_email`)
     AND `promotion_key` = 'first-oil-change-fee-free'
     AND `status` = 'reserved'
     AND `request_id` = NEW.`request_id`;
END;
--> statement-breakpoint
CREATE TRIGGER `customer_requests_job_status_notifications`
AFTER UPDATE OF `status` ON `customer_requests`
WHEN NEW.`status` <> OLD.`status`
  AND NEW.`status` IN ('on my way','arrived','completed')
  AND NEW.`is_test_job` = 'no'
BEGIN
  INSERT OR IGNORE INTO `account_notifications`
    (`id`,`event_key`,`email`,`role`,`title`,`body`,`href`)
  VALUES (
    lower(hex(randomblob(16))),
    'job-status:' || NEW.`id` || ':' || NEW.`status`,
    lower(NEW.`email`),
    'customer',
    CASE NEW.`status`
      WHEN 'on my way' THEN 'Your provider is on the way'
      WHEN 'arrived' THEN 'Your provider has arrived'
      ELSE 'Your vehicle is ready'
    END,
    CASE NEW.`status`
      WHEN 'on my way' THEN 'Your selected provider marked the trip as on the way. Open Tuveloz tracking to see a location only when the provider chooses to share it.'
      WHEN 'arrived' THEN 'Your selected provider marked the job as arrived. Open your request for the latest details.'
      ELSE 'Your selected provider marked the vehicle service complete. Open the request to view the completion update and finished-work photo.'
    END,
    CASE NEW.`status`
      WHEN 'on my way' THEN '/tracking'
      ELSE '/my-request?request=' || NEW.`id`
    END
  );

  INSERT OR IGNORE INTO `email_notification_outbox`
    (`id`,`event_key`,`recipient_email`,`subject`,`text_body`,`status`,`attempts`,`last_error`,`sent_at`)
  VALUES (
    lower(hex(randomblob(16))),
    'email:job-status:' || NEW.`id` || ':' || NEW.`status`,
    lower(NEW.`email`),
    CASE NEW.`status`
      WHEN 'on my way' THEN 'Your Tuveloz provider is on the way'
      WHEN 'arrived' THEN 'Your Tuveloz provider has arrived'
      ELSE 'Your Tuveloz vehicle service is complete'
    END,
    CASE NEW.`status`
      WHEN 'on my way' THEN 'Your selected provider marked the trip as on the way.' || char(10) || char(10) || 'Track the trip only while the provider is voluntarily sharing location: https://tuveloz.com/tracking'
      WHEN 'arrived' THEN 'Your selected provider marked the job as arrived.' || char(10) || char(10) || 'View the latest request details: https://tuveloz.com/my-request?request=' || NEW.`id`
      ELSE 'Thank you for using Tuveloz. Your selected provider marked the vehicle service complete.' || char(10) || char(10) || 'View the completion update and finished-work photo: https://tuveloz.com/my-request?request=' || NEW.`id`
    END,
    'pending',
    0,
    '',
    ''
  );

  UPDATE `job_location_shares`
     SET `latitude` = NULL,
         `longitude` = NULL,
         `accuracy` = NULL,
         `status` = 'stopped',
         `expires_at` = CURRENT_TIMESTAMP,
         `updated_at` = CURRENT_TIMESTAMP
   WHERE `request_id` = NEW.`id`
     AND NEW.`status` = 'completed';
END;