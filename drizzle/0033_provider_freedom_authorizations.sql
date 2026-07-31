CREATE TABLE `job_authorizations` (
  `id` text PRIMARY KEY NOT NULL,
  `request_id` text NOT NULL,
  `source_quote_id` text NOT NULL DEFAULT '',
  `provider_email` text NOT NULL,
  `provider_name` text NOT NULL,
  `customer_email` text NOT NULL,
  `authorization_type` text NOT NULL,
  `title` text NOT NULL,
  `description` text NOT NULL,
  `labor_cents` integer NOT NULL DEFAULT 0,
  `parts_cents` integer NOT NULL DEFAULT 0,
  `other_fees_cents` integer NOT NULL DEFAULT 0,
  `total_cents` integer NOT NULL DEFAULT 0,
  `estimated_completion_at` text NOT NULL DEFAULT '',
  `diagnostic_only` text NOT NULL DEFAULT 'no',
  `workmanship_warranty` text NOT NULL DEFAULT '',
  `parts_warranty` text NOT NULL DEFAULT '',
  `replaced_parts_return` text NOT NULL DEFAULT 'not-requested',
  `status` text NOT NULL DEFAULT 'pending',
  `provider_terms_version` text NOT NULL DEFAULT '',
  `customer_terms_version` text NOT NULL DEFAULT '',
  `supersedes_authorization_id` text NOT NULL DEFAULT '',
  `response_note` text NOT NULL DEFAULT '',
  `created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `responded_at` text NOT NULL DEFAULT '',
  `withdrawn_at` text NOT NULL DEFAULT '',
  `updated_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (`authorization_type` IN ('accepted-quote','work-order','change-order','diagnostic-follow-up','scope-update')),
  CHECK (`status` IN ('pending','accepted','declined','withdrawn','superseded')),
  CHECK (`diagnostic_only` IN ('yes','no')),
  CHECK (`replaced_parts_return` IN ('requested','not-requested','not-applicable')),
  CHECK (`labor_cents` >= 0),
  CHECK (`parts_cents` >= 0),
  CHECK (`other_fees_cents` >= 0),
  CHECK (`total_cents` = `labor_cents` + `parts_cents` + `other_fees_cents`)
);
--> statement-breakpoint
CREATE INDEX `job_authorizations_request_created_idx`
  ON `job_authorizations` (`request_id`, `created_at`);
--> statement-breakpoint
CREATE INDEX `job_authorizations_provider_status_idx`
  ON `job_authorizations` (`provider_email`, `status`);
--> statement-breakpoint
CREATE INDEX `job_authorizations_customer_status_idx`
  ON `job_authorizations` (`customer_email`, `status`);
--> statement-breakpoint
CREATE UNIQUE INDEX `job_authorizations_source_quote_unique`
  ON `job_authorizations` (`source_quote_id`)
  WHERE `source_quote_id` <> '';
--> statement-breakpoint
CREATE TABLE `job_authorization_events` (
  `id` text PRIMARY KEY NOT NULL,
  `authorization_id` text NOT NULL,
  `request_id` text NOT NULL,
  `actor_email` text NOT NULL,
  `actor_role` text NOT NULL,
  `action` text NOT NULL,
  `note` text NOT NULL DEFAULT '',
  `created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (`actor_role` IN ('customer','provider','system'))
);
--> statement-breakpoint
CREATE INDEX `job_authorization_events_authorization_idx`
  ON `job_authorization_events` (`authorization_id`, `created_at`);
--> statement-breakpoint
CREATE INDEX `job_authorization_events_request_idx`
  ON `job_authorization_events` (`request_id`, `created_at`);
--> statement-breakpoint
INSERT OR IGNORE INTO `job_authorizations` (
  `id`, `request_id`, `source_quote_id`, `provider_email`, `provider_name`,
  `customer_email`, `authorization_type`, `title`, `description`,
  `labor_cents`, `parts_cents`, `other_fees_cents`, `total_cents`,
  `estimated_completion_at`, `diagnostic_only`, `workmanship_warranty`,
  `parts_warranty`, `replaced_parts_return`, `status`,
  `provider_terms_version`, `customer_terms_version`,
  `created_at`, `responded_at`, `updated_at`
)
SELECT
  'accepted-quote:' || quote.`id`,
  quote.`request_id`,
  quote.`id`,
  lower(quote.`provider_email`),
  quote.`provider_name`,
  lower(request.`email`),
  'accepted-quote',
  'Accepted quote for ' || request.`service`,
  'The customer accepted the provider quote. Availability: ' || quote.`availability` ||
    CASE WHEN trim(quote.`message`) <> '' THEN char(10) || char(10) || 'Provider message: ' || quote.`message` ELSE '' END,
  CASE
    WHEN CAST(coalesce(nullif(quote.`labor_price_cents`, ''), '0') AS INTEGER)
       + CAST(coalesce(nullif(quote.`parts_price_cents`, ''), '0') AS INTEGER)
       = CAST(coalesce(nullif(quote.`price_cents`, ''), '0') AS INTEGER)
    THEN CAST(coalesce(nullif(quote.`labor_price_cents`, ''), '0') AS INTEGER)
    ELSE CAST(coalesce(nullif(quote.`price_cents`, ''), '0') AS INTEGER)
  END,
  CASE
    WHEN CAST(coalesce(nullif(quote.`labor_price_cents`, ''), '0') AS INTEGER)
       + CAST(coalesce(nullif(quote.`parts_price_cents`, ''), '0') AS INTEGER)
       = CAST(coalesce(nullif(quote.`price_cents`, ''), '0') AS INTEGER)
    THEN CAST(coalesce(nullif(quote.`parts_price_cents`, ''), '0') AS INTEGER)
    ELSE 0
  END,
  0,
  CAST(coalesce(nullif(quote.`price_cents`, ''), '0') AS INTEGER),
  '',
  'no',
  '',
  '',
  'not-requested',
  'accepted',
  'accepted-quote-record-2026-07-31',
  'customer-quote-acceptance',
  quote.`created_at`,
  quote.`created_at`,
  quote.`created_at`
FROM `provider_quotes` quote
INNER JOIN `customer_requests` request ON request.`id` = quote.`request_id`
WHERE quote.`status` = 'accepted';
--> statement-breakpoint
INSERT OR IGNORE INTO `job_authorization_events` (
  `id`, `authorization_id`, `request_id`, `actor_email`, `actor_role`, `action`, `note`, `created_at`
)
SELECT
  'accepted-quote-event:' || quote.`id`,
  'accepted-quote:' || quote.`id`,
  quote.`request_id`,
  lower(request.`email`),
  'customer',
  'accepted-quote-recorded',
  'The accepted provider quote was preserved as the initial work authorization.',
  quote.`created_at`
FROM `provider_quotes` quote
INNER JOIN `customer_requests` request ON request.`id` = quote.`request_id`
WHERE quote.`status` = 'accepted';
--> statement-breakpoint
CREATE TRIGGER `accepted_quote_creates_initial_authorization_update`
AFTER UPDATE OF `status` ON `provider_quotes`
WHEN NEW.`status` = 'accepted' AND OLD.`status` <> 'accepted'
BEGIN
  INSERT OR IGNORE INTO `job_authorizations` (
    `id`, `request_id`, `source_quote_id`, `provider_email`, `provider_name`,
    `customer_email`, `authorization_type`, `title`, `description`,
    `labor_cents`, `parts_cents`, `other_fees_cents`, `total_cents`,
    `estimated_completion_at`, `diagnostic_only`, `workmanship_warranty`,
    `parts_warranty`, `replaced_parts_return`, `status`,
    `provider_terms_version`, `customer_terms_version`,
    `created_at`, `responded_at`, `updated_at`
  )
  SELECT
    'accepted-quote:' || NEW.`id`,
    NEW.`request_id`,
    NEW.`id`,
    lower(NEW.`provider_email`),
    NEW.`provider_name`,
    lower(request.`email`),
    'accepted-quote',
    'Accepted quote for ' || request.`service`,
    'The customer accepted the provider quote. Availability: ' || NEW.`availability` ||
      CASE WHEN trim(NEW.`message`) <> '' THEN char(10) || char(10) || 'Provider message: ' || NEW.`message` ELSE '' END,
    CASE
      WHEN CAST(coalesce(nullif(NEW.`labor_price_cents`, ''), '0') AS INTEGER)
         + CAST(coalesce(nullif(NEW.`parts_price_cents`, ''), '0') AS INTEGER)
         = CAST(coalesce(nullif(NEW.`price_cents`, ''), '0') AS INTEGER)
      THEN CAST(coalesce(nullif(NEW.`labor_price_cents`, ''), '0') AS INTEGER)
      ELSE CAST(coalesce(nullif(NEW.`price_cents`, ''), '0') AS INTEGER)
    END,
    CASE
      WHEN CAST(coalesce(nullif(NEW.`labor_price_cents`, ''), '0') AS INTEGER)
         + CAST(coalesce(nullif(NEW.`parts_price_cents`, ''), '0') AS INTEGER)
         = CAST(coalesce(nullif(NEW.`price_cents`, ''), '0') AS INTEGER)
      THEN CAST(coalesce(nullif(NEW.`parts_price_cents`, ''), '0') AS INTEGER)
      ELSE 0
    END,
    0,
    CAST(coalesce(nullif(NEW.`price_cents`, ''), '0') AS INTEGER),
    '',
    'no',
    '',
    '',
    'not-requested',
    'accepted',
    'accepted-quote-record-2026-07-31',
    'customer-quote-acceptance',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  FROM `customer_requests` request
  WHERE request.`id` = NEW.`request_id`;

  INSERT OR IGNORE INTO `job_authorization_events` (
    `id`, `authorization_id`, `request_id`, `actor_email`, `actor_role`, `action`, `note`
  ) VALUES (
    'accepted-quote-event:' || NEW.`id`,
    'accepted-quote:' || NEW.`id`,
    NEW.`request_id`,
    lower((SELECT `email` FROM `customer_requests` WHERE `id` = NEW.`request_id` LIMIT 1)),
    'customer',
    'accepted-quote-recorded',
    'The accepted provider quote was preserved as the initial work authorization.'
  );

  INSERT OR IGNORE INTO `account_notifications`
    (`id`, `event_key`, `email`, `role`, `title`, `body`, `href`)
  SELECT
    lower(hex(randomblob(16))),
    'authorization:accepted-quote:customer:' || NEW.`id`,
    lower(request.`email`),
    'customer',
    'Your accepted quote is saved as a work authorization',
    'The accepted provider quote is preserved in Job agreements. Any additional work or additional charge still requires a separate change order for you to accept or decline.',
    '/job-authorizations'
  FROM `customer_requests` request
  WHERE request.`id` = NEW.`request_id`;

  INSERT OR IGNORE INTO `account_notifications`
    (`id`, `event_key`, `email`, `role`, `title`, `body`, `href`)
  VALUES (
    lower(hex(randomblob(16))),
    'authorization:accepted-quote:provider:' || NEW.`id`,
    lower(NEW.`provider_email`),
    'provider',
    'The accepted quote is saved as the initial work authorization',
    'The customer accepted only the quoted scope and amount. Use Job agreements before performing additional work or adding charges.',
    '/job-authorizations'
  );
END;
--> statement-breakpoint
CREATE TRIGGER `accepted_quote_creates_initial_authorization_insert`
AFTER INSERT ON `provider_quotes`
WHEN NEW.`status` = 'accepted'
BEGIN
  INSERT OR IGNORE INTO `job_authorizations` (
    `id`, `request_id`, `source_quote_id`, `provider_email`, `provider_name`,
    `customer_email`, `authorization_type`, `title`, `description`,
    `labor_cents`, `parts_cents`, `other_fees_cents`, `total_cents`,
    `estimated_completion_at`, `diagnostic_only`, `workmanship_warranty`,
    `parts_warranty`, `replaced_parts_return`, `status`,
    `provider_terms_version`, `customer_terms_version`,
    `created_at`, `responded_at`, `updated_at`
  )
  SELECT
    'accepted-quote:' || NEW.`id`,
    NEW.`request_id`,
    NEW.`id`,
    lower(NEW.`provider_email`),
    NEW.`provider_name`,
    lower(request.`email`),
    'accepted-quote',
    'Accepted quote for ' || request.`service`,
    'The customer accepted the provider quote. Availability: ' || NEW.`availability` ||
      CASE WHEN trim(NEW.`message`) <> '' THEN char(10) || char(10) || 'Provider message: ' || NEW.`message` ELSE '' END,
    CASE
      WHEN CAST(coalesce(nullif(NEW.`labor_price_cents`, ''), '0') AS INTEGER)
         + CAST(coalesce(nullif(NEW.`parts_price_cents`, ''), '0') AS INTEGER)
         = CAST(coalesce(nullif(NEW.`price_cents`, ''), '0') AS INTEGER)
      THEN CAST(coalesce(nullif(NEW.`labor_price_cents`, ''), '0') AS INTEGER)
      ELSE CAST(coalesce(nullif(NEW.`price_cents`, ''), '0') AS INTEGER)
    END,
    CASE
      WHEN CAST(coalesce(nullif(NEW.`labor_price_cents`, ''), '0') AS INTEGER)
         + CAST(coalesce(nullif(NEW.`parts_price_cents`, ''), '0') AS INTEGER)
         = CAST(coalesce(nullif(NEW.`price_cents`, ''), '0') AS INTEGER)
      THEN CAST(coalesce(nullif(NEW.`parts_price_cents`, ''), '0') AS INTEGER)
      ELSE 0
    END,
    0,
    CAST(coalesce(nullif(NEW.`price_cents`, ''), '0') AS INTEGER),
    '',
    'no',
    '',
    '',
    'not-requested',
    'accepted',
    'accepted-quote-record-2026-07-31',
    'customer-quote-acceptance',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  FROM `customer_requests` request
  WHERE request.`id` = NEW.`request_id`;
END;