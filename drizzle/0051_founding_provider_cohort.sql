-- Founding provider cohort standing. Rank is assigned once, at the moment a
-- provider is first verified, and never recomputed: 1..20 are the founding
-- cohort (never charged a provider membership fee), 1..10 are additionally
-- spotlight-eligible. 0 means not in the cohort.
--
-- Hand-written rather than drizzle-generated: snapshots 0048-0050 were also
-- hand-written and are absent from drizzle's metadata, so `drizzle-kit
-- generate` re-emits those migrations. Only the two new columns and their
-- index belong here. The accompanying 0051 snapshot DOES capture the full
-- current schema, which clears that drift for future generates.
ALTER TABLE `provider_applications`
  ADD `founding_rank` integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `provider_applications`
  ADD `founding_rank_assigned_at` text NOT NULL DEFAULT '';
--> statement-breakpoint
CREATE INDEX `provider_applications_founding_rank_idx`
  ON `provider_applications` (`founding_rank`);
