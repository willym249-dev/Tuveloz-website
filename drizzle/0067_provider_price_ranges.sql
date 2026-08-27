ALTER TABLE `provider_catalog_items` ADD COLUMN `maximum_price_cents` integer DEFAULT 0 NOT NULL CHECK (`maximum_price_cents` >= 0);
