-- Adds an optional provider reply to a published customer review. Two additive
-- columns on job_reviews, both NOT NULL DEFAULT '' so every existing review row
-- keeps a valid (empty) value and no reply is shown until a provider writes one.
-- ALTER TABLE ADD COLUMN is non-destructive: no table rebuild, no trigger churn,
-- no change to existing values or indexes.

ALTER TABLE `job_reviews` ADD `provider_reply` text DEFAULT '' NOT NULL;
ALTER TABLE `job_reviews` ADD `provider_reply_at` text DEFAULT '' NOT NULL;
