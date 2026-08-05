import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const readJson = async (path) => JSON.parse(await read(path));

test("migration journal preserves upstream order before renumbered provider and repair controls", async () => {
  const journal = await readJson("drizzle/meta/_journal.json");
  const expectedTail = [
    "0031_service_area_settings",
    "0032_marketplace_tools",
    "0033_provider_freedom_authorizations",
    "0034_privacy_center",
    "0035_private_job_evidence",
    "0036_retire_first_oil_change_promotion",
    "0037_provider_policy_controls",
    "0038_integrated_launch_controls",
    "0039_typical_baron_zemo",
    "0040_living_gressill",
    "0041_real_only_accepted_quote_authorizations",
    "0042_maryland_repair_records",
    "0043_signed_repair_record_gates",
    "0044_final_provider_invoice_legal_fields_immutable",
    "0045_chilly_maginty",
    "0046_volatile_liz_osborn",
    "0047_perfect_orphan",
    "0048_customer_supplied_parts_preferences",
    "0049_add_analytics_events",
    "0050_fix_stale_column_defaults",
    "0051_provider_review_reply",
  ];
  const tail = journal.entries.slice(31);

  assert.deepEqual(tail.map((entry) => entry.idx), expectedTail.map((_, offset) => offset + 31));
  assert.deepEqual(tail.map((entry) => entry.tag), expectedTail);

  const migrationFiles = new Set(await readdir(new URL("drizzle/", root)));
  for (const tag of expectedTail) {
    assert.ok(migrationFiles.has(`${tag}.sql`), `missing ${tag}.sql`);
  }
  for (const retiredCollision of [
    "0033_provider_policy_controls.sql",
    "0034_integrated_launch_controls.sql",
    "0035_typical_baron_zemo.sql",
    "0036_living_gressill.sql",
  ]) {
    assert.equal(migrationFiles.has(retiredCollision), false, `collision remains: ${retiredCollision}`);
  }
});

test("snapshot lineage ends in the combined upstream and provider-control schema", async () => {
  const snapshotNumbers = ["0026", "0037", "0038", "0039", "0040", "0041", "0045", "0046", "0047"];
  const snapshots = await Promise.all(
    snapshotNumbers.map((number) => readJson(`drizzle/meta/${number}_snapshot.json`)),
  );

  for (let index = 1; index < snapshots.length; index += 1) {
    assert.equal(
      snapshots[index].prevId,
      snapshots[index - 1].id,
      `${snapshotNumbers[index]} must follow ${snapshotNumbers[index - 1]}`,
    );
  }

  const upstreamManualTables = [
    "job_authorizations",
    "job_authorization_events",
    "account_communication_preferences",
    "privacy_requests",
    "job_evidence_items",
  ];
  for (const [snapshotIndex, snapshot] of snapshots.entries()) {
    if (snapshotNumbers[snapshotIndex] === "0026") continue;
    for (const table of upstreamManualTables) {
      assert.ok(
        snapshot.tables[table],
        `${snapshotNumbers[snapshotIndex]} combined snapshot is missing ${table}`,
      );
    }
    assert.equal(Object.keys(snapshot.tables.job_authorizations.checkConstraints).length, 8);
    assert.equal(Object.keys(snapshot.tables.job_authorization_events.checkConstraints).length, 1);
    assert.equal(Object.keys(snapshot.tables.account_communication_preferences.checkConstraints).length, 4);
    assert.equal(Object.keys(snapshot.tables.privacy_requests.checkConstraints).length, 4);
    assert.equal(Object.keys(snapshot.tables.job_evidence_items.checkConstraints).length, 4);
  }

  const finalTables = snapshots.at(-1).tables;
  for (const table of [
    ...upstreamManualTables,
    "provider_personnel",
    "provider_evidence_submissions",
    "launch_gate_decisions",
    "stripe_webhook_events",
    "stripe_connected_account_snapshots",
    "provider_application_challenges",
    "provider_application_email_claims",
    "provider_application_submission_evidence",
    "provider_identity_verification_sessions",
    "public_write_rate_limits",
  ]) {
    assert.ok(finalTables[table], `combined snapshot is missing ${table}`);
  }

  assert.equal(finalTables.job_authorizations.columns.source_quote_id.default, "''");
  assert.equal(finalTables.job_authorizations.columns.status.default, "'pending'");
  assert.equal(finalTables.job_evidence_items.columns.record_version.default, "'job-evidence-2026-07-31'");
  assert.equal(finalTables.job_authorizations.indexes.job_authorizations_source_quote_unique.isUnique, true);
  assert.match(
    finalTables.job_authorizations.indexes.job_authorizations_source_quote_unique.where,
    /source_quote_id.*<> ''/,
  );
});

test("0041 removes only test-derived quote artifacts and recreates real-only triggers", async () => {
  const migration = await read("drizzle/0041_real_only_accepted_quote_authorizations.sql");

  assert.match(migration, /DELETE FROM `account_notifications`/);
  assert.match(migration, /DELETE FROM `job_authorization_events`/);
  assert.match(migration, /DELETE FROM `job_authorizations`/);
  assert.equal((migration.match(/request\.`is_test_job` <> 'no'/g) ?? []).length, 4);
  assert.equal(
    (migration.match(/DROP TRIGGER IF EXISTS `accepted_quote_creates_initial_authorization_(?:update|insert)`/g) ?? []).length,
    2,
  );
  assert.equal(
    (migration.match(/CREATE TRIGGER `accepted_quote_creates_initial_authorization_(?:update|insert)`/g) ?? []).length,
    2,
  );
  assert.ok((migration.match(/request\.`is_test_job` = 'no'/g) ?? []).length >= 4);
  assert.doesNotMatch(migration, /CREATE TABLE/);
  assert.doesNotMatch(migration, /DELETE FROM `provider_quotes`|DELETE FROM `customer_requests`/);
});
