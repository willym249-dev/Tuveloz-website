-- Fixes three column DEFAULT values that drifted out of sync between
-- db/schema.ts and the actually-applied database: customer_requests.parts_source,
-- customer_requests.budget_range, and provider_quotes.part_type. No columns are
-- added or removed, no existing row values change — only the DEFAULT applied to
-- future inserts that omit these fields. SQLite has no ALTER COLUMN SET DEFAULT,
-- so this rebuilds both tables via the standard copy/drop/rename sequence,
-- preserving every existing row and every existing index.

PRAGMA foreign_keys=OFF;
-- ALTER TABLE RENAME normally re-validates every trigger in the schema (to
-- rewrite any that reference the renamed table), which spuriously fails here
-- because provider_quotes' accepted_quote_creates_initial_authorization_update
-- trigger references customer_requests, and customer_requests is momentarily
-- absent mid-rebuild. legacy_alter_table disables that re-validation pass.
PRAGMA legacy_alter_table=ON;

CREATE TABLE `__new_customer_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`zip` text NOT NULL,
	`launch_area` text DEFAULT '' NOT NULL,
	`jurisdiction` text DEFAULT '' NOT NULL,
	`municipality` text DEFAULT '' NOT NULL,
	`is_test_job` text DEFAULT 'no' NOT NULL,
	`vehicle` text NOT NULL,
	`service` text NOT NULL,
	`service_codes` text DEFAULT '[]' NOT NULL,
	`parts_source` text DEFAULT 'Not sure whether parts are needed — discuss with provider' NOT NULL,
	`parts_preference` text DEFAULT 'No preference' NOT NULL,
	`labor_only_parts_acknowledged_at` text DEFAULT '' NOT NULL,
	`budget_range` text DEFAULT 'Not provided' NOT NULL,
	`service_locations` text DEFAULT 'Provider comes to me' NOT NULL,
	`service_address` text DEFAULT '' NOT NULL,
	`details` text NOT NULL,
	`scheduled_for` text DEFAULT '' NOT NULL,
	`preferred_provider_email` text DEFAULT '' NOT NULL,
	`preferred_provider_name` text DEFAULT '' NOT NULL,
	`repeat_of_request_id` text DEFAULT '' NOT NULL,
	`access_token` text DEFAULT '' NOT NULL,
	`issue_image_key` text DEFAULT '' NOT NULL,
	`issue_image_type` text DEFAULT '' NOT NULL,
	`completion_image_key` text DEFAULT '' NOT NULL,
	`completion_image_type` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`assigned_person_id` text DEFAULT '' NOT NULL,
	`assigned_supervisor_person_id` text DEFAULT '' NOT NULL,
	`assignment_version` integer DEFAULT 0 NOT NULL,
	`approved_at` text DEFAULT '' NOT NULL,
	`reminder_sent_at` text DEFAULT '' NOT NULL,
	`reminder_last_attempt_at` text DEFAULT '' NOT NULL,
	`policy_version` text DEFAULT '' NOT NULL,
	`customer_provider_disclosure_accepted_at` text DEFAULT '' NOT NULL,
	`terms_accepted_at` text DEFAULT '' NOT NULL,
	`terms_version` text DEFAULT '' NOT NULL,
	`remember_email_consent` text DEFAULT 'no' NOT NULL,
	`remember_email_consent_text` text DEFAULT '' NOT NULL,
	`marketing_consent` text DEFAULT 'no' NOT NULL,
	`marketing_consent_text` text DEFAULT '' NOT NULL,
	`consent_version` text DEFAULT '' NOT NULL,
	`consent_source` text DEFAULT '' NOT NULL,
	`consent_recorded_at` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);

INSERT INTO `__new_customer_requests`("id", "name", "email", "zip", "launch_area", "jurisdiction", "municipality", "is_test_job", "vehicle", "service", "service_codes", "parts_source", "parts_preference", "labor_only_parts_acknowledged_at", "budget_range", "service_locations", "service_address", "details", "scheduled_for", "preferred_provider_email", "preferred_provider_name", "repeat_of_request_id", "access_token", "issue_image_key", "issue_image_type", "completion_image_key", "completion_image_type", "status", "assigned_person_id", "assigned_supervisor_person_id", "assignment_version", "approved_at", "reminder_sent_at", "reminder_last_attempt_at", "policy_version", "customer_provider_disclosure_accepted_at", "terms_accepted_at", "terms_version", "remember_email_consent", "remember_email_consent_text", "marketing_consent", "marketing_consent_text", "consent_version", "consent_source", "consent_recorded_at", "created_at")
SELECT "id", "name", "email", "zip", "launch_area", "jurisdiction", "municipality", "is_test_job", "vehicle", "service", "service_codes", "parts_source", "parts_preference", "labor_only_parts_acknowledged_at", "budget_range", "service_locations", "service_address", "details", "scheduled_for", "preferred_provider_email", "preferred_provider_name", "repeat_of_request_id", "access_token", "issue_image_key", "issue_image_type", "completion_image_key", "completion_image_type", "status", "assigned_person_id", "assigned_supervisor_person_id", "assignment_version", "approved_at", "reminder_sent_at", "reminder_last_attempt_at", "policy_version", "customer_provider_disclosure_accepted_at", "terms_accepted_at", "terms_version", "remember_email_consent", "remember_email_consent_text", "marketing_consent", "marketing_consent_text", "consent_version", "consent_source", "consent_recorded_at", "created_at"
FROM `customer_requests`;

DROP TABLE `customer_requests`;
ALTER TABLE `__new_customer_requests` RENAME TO `customer_requests`;

CREATE INDEX `customer_requests_created_at_idx` ON `customer_requests` (`created_at`);
CREATE INDEX `customer_requests_status_idx` ON `customer_requests` (`status`);
CREATE INDEX `customer_requests_email_idx` ON `customer_requests` (`email`);
CREATE INDEX `customer_requests_preferred_provider_idx` ON `customer_requests` (`preferred_provider_email`);
CREATE INDEX `customer_requests_jurisdiction_status_idx` ON `customer_requests` (`jurisdiction`,`status`);
CREATE INDEX `customer_requests_scheduled_for_idx` ON `customer_requests` (`scheduled_for`);
CREATE INDEX `customer_requests_assigned_person_idx` ON `customer_requests` (`assigned_person_id`);
CREATE INDEX `customer_requests_assigned_supervisor_idx` ON `customer_requests` (`assigned_supervisor_person_id`);

-- DROP TABLE removes any triggers on the table, so every trigger attached to
-- customer_requests must be recreated here, verbatim, or this rebuild would
-- silently disable them: labor-only-parts enforcement (0048) and the
-- job-status notification/email dispatch trigger (0030/later revisions).
DROP TRIGGER IF EXISTS `customer_requests_job_status_notifications`;
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

DROP TRIGGER IF EXISTS `customer_requests_labor_only_parts_insert`;
CREATE TRIGGER `customer_requests_labor_only_parts_insert`
BEFORE INSERT ON `customer_requests`
WHEN trim(NEW.`labor_only_parts_acknowledged_at`) = ''
OR NEW.`parts_source` NOT IN (
  'Customer supplies any needed parts — labor only',
  'I have the parts — labor only',
  'No parts needed — labor only',
  'Not sure whether parts are needed — discuss with provider'
)
OR NEW.`parts_preference` NOT IN (
  'OEM',
  'Aftermarket',
  'No preference',
  'Discuss with provider'
)
BEGIN
  SELECT RAISE(ABORT, 'Tuveloz customer requests must use the labor-only parts workflow');
END;

DROP TRIGGER IF EXISTS `customer_requests_labor_only_parts_update`;
CREATE TRIGGER `customer_requests_labor_only_parts_update`
BEFORE UPDATE OF `parts_source`, `parts_preference`, `labor_only_parts_acknowledged_at` ON `customer_requests`
WHEN trim(NEW.`labor_only_parts_acknowledged_at`) = ''
OR NEW.`parts_source` NOT IN (
  'Customer supplies any needed parts — labor only',
  'I have the parts — labor only',
  'No parts needed — labor only',
  'Not sure whether parts are needed — discuss with provider'
)
OR NEW.`parts_preference` NOT IN (
  'OEM',
  'Aftermarket',
  'No preference',
  'Discuss with provider'
)
BEGIN
  SELECT RAISE(ABORT, 'Tuveloz customer requests must use the labor-only parts workflow');
END;

CREATE TABLE `__new_provider_quotes` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`service_codes` text DEFAULT '[]' NOT NULL,
	`provider_name` text NOT NULL,
	`provider_email` text NOT NULL,
	`performing_person_id` text DEFAULT '' NOT NULL,
	`supervisor_person_id` text DEFAULT '' NOT NULL,
	`price_cents` text NOT NULL,
	`labor_price_cents` text DEFAULT '0' NOT NULL,
	`parts_price_cents` text DEFAULT '0' NOT NULL,
	`labor_only_parts_confirmed_at` text DEFAULT '' NOT NULL,
	`customer_fee_rate_bps` integer DEFAULT 1000 NOT NULL,
	`customer_fee_cents` text DEFAULT '0' NOT NULL,
	`customer_total_cents` text DEFAULT '0' NOT NULL,
	`part_type` text DEFAULT 'Customer supplied' NOT NULL,
	`availability` text NOT NULL,
	`scheduled_for` text DEFAULT '' NOT NULL,
	`message` text NOT NULL,
	`scope_version` integer DEFAULT 0 NOT NULL,
	`authorization_decision_id` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'submitted' NOT NULL,
	`decline_reason` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);

INSERT INTO `__new_provider_quotes`("id", "request_id", "service_codes", "provider_name", "provider_email", "performing_person_id", "supervisor_person_id", "price_cents", "labor_price_cents", "parts_price_cents", "labor_only_parts_confirmed_at", "customer_fee_rate_bps", "customer_fee_cents", "customer_total_cents", "part_type", "availability", "scheduled_for", "message", "scope_version", "authorization_decision_id", "status", "decline_reason", "created_at")
SELECT "id", "request_id", "service_codes", "provider_name", "provider_email", "performing_person_id", "supervisor_person_id", "price_cents", "labor_price_cents", "parts_price_cents", "labor_only_parts_confirmed_at", "customer_fee_rate_bps", "customer_fee_cents", "customer_total_cents", "part_type", "availability", "scheduled_for", "message", "scope_version", "authorization_decision_id", "status", "decline_reason", "created_at"
FROM `provider_quotes`;

DROP TABLE `provider_quotes`;
ALTER TABLE `__new_provider_quotes` RENAME TO `provider_quotes`;

CREATE INDEX `provider_quotes_request_id_idx` ON `provider_quotes` (`request_id`);
CREATE INDEX `provider_quotes_created_at_idx` ON `provider_quotes` (`created_at`);
CREATE INDEX `provider_quotes_performing_person_idx` ON `provider_quotes` (`performing_person_id`);
CREATE INDEX `provider_quotes_supervisor_person_idx` ON `provider_quotes` (`supervisor_person_id`);
CREATE INDEX `provider_quotes_scheduled_for_idx` ON `provider_quotes` (`scheduled_for`);
CREATE INDEX `provider_quotes_authorization_decision_idx` ON `provider_quotes` (`authorization_decision_id`);

DROP TRIGGER IF EXISTS `accepted_quote_creates_initial_authorization_update`;
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

DROP TRIGGER IF EXISTS `accepted_quote_creates_initial_authorization_insert`;
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

DROP TRIGGER IF EXISTS `provider_quotes_labor_only_insert`;
CREATE TRIGGER `provider_quotes_labor_only_insert`
BEFORE INSERT ON `provider_quotes`
WHEN trim(NEW.`labor_only_parts_confirmed_at`) = ''
OR CAST(NEW.`parts_price_cents` AS integer) <> 0
OR CAST(NEW.`labor_price_cents` AS integer) <> CAST(NEW.`price_cents` AS integer)
OR NEW.`part_type` NOT IN ('Customer supplied', 'No parts needed')
BEGIN
  SELECT RAISE(ABORT, 'Tuveloz provider quotes must be labor only');
END;

DROP TRIGGER IF EXISTS `provider_quotes_labor_only_update`;
CREATE TRIGGER `provider_quotes_labor_only_update`
BEFORE UPDATE OF `price_cents`, `labor_price_cents`, `parts_price_cents`, `part_type`, `labor_only_parts_confirmed_at`
ON `provider_quotes`
WHEN trim(NEW.`labor_only_parts_confirmed_at`) = ''
OR CAST(NEW.`parts_price_cents` AS integer) <> 0
OR CAST(NEW.`labor_price_cents` AS integer) <> CAST(NEW.`price_cents` AS integer)
OR NEW.`part_type` NOT IN ('Customer supplied', 'No parts needed')
BEGIN
  SELECT RAISE(ABORT, 'Tuveloz provider quotes must be labor only');
END;

PRAGMA legacy_alter_table=OFF;
PRAGMA foreign_keys=ON;
