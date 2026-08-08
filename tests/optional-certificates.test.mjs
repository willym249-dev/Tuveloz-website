import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("optional certificates from signup are normalized safely", async () => {
  const { cleanOptionalCertificates, MAX_OPTIONAL_CERTIFICATES } = await import(
    "../lib/optional-certificates.ts"
  );

  // Drops rows missing a known category or a title; trims and length-limits text.
  const cleaned = cleanOptionalCertificates([
    { category: "ase", title: "  ASE A6 Electrical  ", credentialIdentifier: " 12345 " },
    { category: "not-a-real-category", title: "Should be dropped" },
    { category: "icar", title: "" },
    { title: "No category" },
    "nonsense",
    null,
  ]);
  assert.equal(cleaned.length, 1);
  assert.deepEqual(cleaned[0], {
    category: "ase",
    title: "ASE A6 Electrical",
    credentialIdentifier: "12345",
    issuingAuthority: "",
  });

  // Non-array input is always an empty list, and the list is capped.
  assert.deepEqual(cleanOptionalCertificates("nope"), []);
  assert.deepEqual(cleanOptionalCertificates(undefined), []);
  const many = Array.from({ length: MAX_OPTIONAL_CERTIFICATES + 5 }, () => ({
    category: "other",
    title: "Cert",
  }));
  assert.equal(cleanOptionalCertificates(many).length, MAX_OPTIONAL_CERTIFICATES);
});

test("category labels only resolve for known catalog keys", async () => {
  const { optionalCertificateCategoryLabel } = await import("../lib/optional-certificates.ts");

  assert.equal(optionalCertificateCategoryLabel("ase"), "ASE certification");
  assert.equal(optionalCertificateCategoryLabel("ase", true), "Certificación ASE");
  // Hand-added marketplace-tools credentials carry no category.
  assert.equal(optionalCertificateCategoryLabel(""), "");
  assert.equal(optionalCertificateCategoryLabel("made-up"), "");
  assert.equal(optionalCertificateCategoryLabel(undefined), "");
});

test("signup optional certificates reuse the existing submitted-credentials pipeline", async () => {
  const [normalizer, providersRoute] = await Promise.all([
    read("lib/provider-application-verification.ts"),
    read("app/api/providers/route.ts"),
  ]);

  // The normalizer carries the cleaned certificates onto the application.
  assert.match(normalizer, /optionalCertificates: cleanOptionalCertificates\(body\.optionalCertificates\)/);

  // They are stored in the existing table (pending, not public) — not a new one.
  assert.match(providersRoute, /INSERT INTO provider_submitted_credentials/);
  assert.match(providersRoute, /'pending', '', 'no'/);
  assert.doesNotMatch(providersRoute, /provider_optional_certificates/);

  // The declared category is persisted, not dropped on the way to the table.
  assert.match(providersRoute, /\(id, provider_id, category, credential_name/);
  assert.match(providersRoute, /certificate\.category,/);
});

test("the category column is added by an additive migration and shown to the owner", async () => {
  const [migration, journal, ownerRoute, ownerPage] = await Promise.all([
    read("drizzle/0055_optional_certificate_category.sql"),
    read("drizzle/meta/_journal.json"),
    read("app/api/admin/marketplace-tools/route.ts"),
    read("app/admin/marketplace-tools/page.tsx"),
  ]);

  // Additive only: one ADD COLUMN with a safe default, no rebuild or drop.
  assert.match(migration, /ALTER TABLE `provider_submitted_credentials` ADD `category` text DEFAULT '' NOT NULL;/);
  assert.doesNotMatch(migration, /DROP|DELETE|CREATE TABLE/i);
  assert.match(journal, /"0055_optional_certificate_category"/);

  // The owner review queue reads and renders the category.
  assert.match(ownerRoute, /credential\.category,/);
  assert.match(ownerPage, /optionalCertificateCategoryLabel\(credential\.category\)/);
});
