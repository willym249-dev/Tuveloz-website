-- Records which kind of optional certificate a provider declared (ASE,
-- manufacturer training, I-CAR, EV/hybrid, other) so the owner reviewing the
-- submission sees the category the provider picked, not only their free text.
-- One additive column, NOT NULL DEFAULT '' so every existing credential row --
-- including ones added by hand in provider tools, which have no category --
-- keeps a valid (empty) value. ALTER TABLE ADD COLUMN is non-destructive: no
-- table rebuild, no change to existing values or indexes. Nothing here gates a
-- service or changes what a customer sees.

ALTER TABLE `provider_submitted_credentials` ADD `category` text DEFAULT '' NOT NULL;
