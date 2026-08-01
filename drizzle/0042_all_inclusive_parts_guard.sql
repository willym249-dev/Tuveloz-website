CREATE TRIGGER `provider_quotes_all_inclusive_parts_insert_guard`
BEFORE INSERT ON `provider_quotes`
WHEN
  CAST(coalesce(nullif(NEW.`parts_price_cents`, ''), '0') AS INTEGER) <> 0
  OR CAST(coalesce(nullif(NEW.`labor_price_cents`, ''), '0') AS INTEGER)
     <> CAST(coalesce(nullif(NEW.`price_cents`, ''), '0') AS INTEGER)
  OR NEW.`part_type` NOT IN (
    'Customer supplied',
    'No parts needed',
    'All-inclusive provider parts: OEM',
    'All-inclusive provider parts: Aftermarket'
  )
BEGIN
  SELECT RAISE(
    ABORT,
    'Separate provider parts charges are disabled. Use one guarded all-inclusive service price.'
  );
END;
--> statement-breakpoint
CREATE TRIGGER `provider_quotes_all_inclusive_parts_update_guard`
BEFORE UPDATE OF `price_cents`, `labor_price_cents`, `parts_price_cents`, `part_type`
ON `provider_quotes`
WHEN
  CAST(coalesce(nullif(NEW.`parts_price_cents`, ''), '0') AS INTEGER) <> 0
  OR CAST(coalesce(nullif(NEW.`labor_price_cents`, ''), '0') AS INTEGER)
     <> CAST(coalesce(nullif(NEW.`price_cents`, ''), '0') AS INTEGER)
  OR NEW.`part_type` NOT IN (
    'Customer supplied',
    'No parts needed',
    'All-inclusive provider parts: OEM',
    'All-inclusive provider parts: Aftermarket'
  )
BEGIN
  SELECT RAISE(
    ABORT,
    'Separate provider parts charges are disabled. Use one guarded all-inclusive service price.'
  );
END;
