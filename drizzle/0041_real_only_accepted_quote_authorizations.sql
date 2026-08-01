-- Migration 0033 predated the persisted-test-fixture boundary. Remove only
-- deterministic accepted-quote artifacts whose source request is synthetic,
-- then replace the triggers with fail-closed real-request guards.
DELETE FROM `account_notifications`
WHERE `event_key` IN (
  SELECT 'authorization:accepted-quote:customer:' || quote.`id`
  FROM `provider_quotes` quote
  INNER JOIN `customer_requests` request ON request.`id` = quote.`request_id`
  WHERE request.`is_test_job` <> 'no'
  UNION ALL
  SELECT 'authorization:accepted-quote:provider:' || quote.`id`
  FROM `provider_quotes` quote
  INNER JOIN `customer_requests` request ON request.`id` = quote.`request_id`
  WHERE request.`is_test_job` <> 'no'
);
--> statement-breakpoint
DELETE FROM `job_authorization_events`
WHERE `authorization_id` IN (
  SELECT authorization.`id`
  FROM `job_authorizations` authorization
  INNER JOIN `provider_quotes` quote ON quote.`id` = authorization.`source_quote_id`
  INNER JOIN `customer_requests` request ON request.`id` = quote.`request_id`
  WHERE authorization.`authorization_type` = 'accepted-quote'
    AND request.`is_test_job` <> 'no'
);
--> statement-breakpoint
DELETE FROM `job_authorizations`
WHERE `id` IN (
  SELECT authorization.`id`
  FROM `job_authorizations` authorization
  INNER JOIN `provider_quotes` quote ON quote.`id` = authorization.`source_quote_id`
  INNER JOIN `customer_requests` request ON request.`id` = quote.`request_id`
  WHERE authorization.`authorization_type` = 'accepted-quote'
    AND request.`is_test_job` <> 'no'
);
--> statement-breakpoint
DROP TRIGGER IF EXISTS `accepted_quote_creates_initial_authorization_update`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `accepted_quote_creates_initial_authorization_insert`;
--> statement-breakpoint
CREATE TRIGGER `accepted_quote_creates_initial_authorization_update`
AFTER UPDATE OF `status` ON `provider_quotes`
WHEN NEW.`status` = 'accepted'
  AND OLD.`status` <> 'accepted'
  AND EXISTS (
    SELECT 1
    FROM `customer_requests` request
    WHERE request.`id` = NEW.`request_id`
      AND request.`is_test_job` = 'no'
  )
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
  WHERE request.`id` = NEW.`request_id`
    AND request.`is_test_job` = 'no';

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
  WHERE request.`id` = NEW.`request_id`
    AND request.`is_test_job` = 'no';

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
  AND EXISTS (
    SELECT 1
    FROM `customer_requests` request
    WHERE request.`id` = NEW.`request_id`
      AND request.`is_test_job` = 'no'
  )
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
  WHERE request.`id` = NEW.`request_id`
    AND request.`is_test_job` = 'no';
END;
