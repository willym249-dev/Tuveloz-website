-- Providers may optionally offer a written workmanship warranty on a quote.
-- An empty value means the provider business offers no workmanship warranty
-- for the job, and the customer explicitly acknowledges that at selection
-- and checkout. Additive column only — no existing rows change.
ALTER TABLE `provider_quotes` ADD `workmanship_warranty` text DEFAULT '' NOT NULL;
