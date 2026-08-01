import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const migrationUrl = new URL("../drizzle/0047_perfect_orphan.sql", import.meta.url);

function applicationSnapshot(firstName = "Jane", lastName = "Smith") {
  return JSON.stringify({
    format: "tuveloz_provider_application_payload_v2",
    performingPersonFirstName: firstName,
    performingPersonLastName: lastName,
    acknowledgements: { performingPersonIdentityAcknowledged: true },
  });
}

async function guardedDatabase() {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE provider_application_submission_evidence (
      id TEXT PRIMARY KEY NOT NULL,
      provider_id TEXT NOT NULL,
      normalized_snapshot TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE provider_pathway_profiles (
      id TEXT PRIMARY KEY NOT NULL,
      provider_id TEXT NOT NULL,
      provider_person_id TEXT NOT NULL,
      relationship_path TEXT NOT NULL,
      sponsoring_provider_id TEXT NOT NULL DEFAULT '',
      registration_holder_id TEXT NOT NULL DEFAULT '',
      pathway_version INTEGER NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE provider_personnel (
      id TEXT PRIMARY KEY NOT NULL,
      provider_id TEXT NOT NULL,
      person_id TEXT NOT NULL,
      relationship_type TEXT NOT NULL,
      roster_version INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      identity_verified_at TEXT NOT NULL DEFAULT '',
      age_verified_at TEXT NOT NULL DEFAULT '',
      identity_verification_provider TEXT NOT NULL DEFAULT '',
      identity_verification_reference TEXT NOT NULL DEFAULT '',
      identity_verification_checked_at TEXT NOT NULL DEFAULT '',
      identity_verification_valid_through TEXT NOT NULL DEFAULT '',
      age_verification_provider TEXT NOT NULL DEFAULT '',
      age_verification_reference TEXT NOT NULL DEFAULT '',
      age_verification_checked_at TEXT NOT NULL DEFAULT '',
      age_verification_valid_through TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE provider_service_eligibility (
      id TEXT PRIMARY KEY NOT NULL,
      provider_id TEXT NOT NULL,
      eligibility_state TEXT NOT NULL,
      reason_codes TEXT NOT NULL DEFAULT '[]',
      valid_through TEXT NOT NULL DEFAULT '',
      next_expiration_at TEXT NOT NULL DEFAULT '',
      calculated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE provider_applications (
      id TEXT PRIMARY KEY NOT NULL,
      verification_status TEXT NOT NULL DEFAULT 'not reviewed',
      service_eligibility_statuses TEXT NOT NULL DEFAULT '',
      approved_services TEXT NOT NULL DEFAULT '',
      verified_at TEXT NOT NULL DEFAULT '',
      verified_by TEXT NOT NULL DEFAULT '',
      alerts_enabled TEXT NOT NULL DEFAULT 'yes',
      status TEXT NOT NULL DEFAULT 'new'
    );
  `);
  const migration = await readFile(migrationUrl, "utf8");
  for (const statement of migration.split("--> statement-breakpoint")) {
    if (statement.trim()) db.exec(statement);
  }
  return db;
}

function seedOwner(db, evidenceId = "evidence-1", createdAt = "2026-08-01T10:00:00.000Z") {
  db.prepare(`
    INSERT INTO provider_application_submission_evidence
      (id, provider_id, normalized_snapshot, created_at)
    VALUES (?, 'provider-1', ?, ?)
  `).run(evidenceId, applicationSnapshot(), createdAt);
  db.exec(`
    INSERT INTO provider_applications
      (id, verification_status, approved_services, verified_at, verified_by, alerts_enabled, status)
    VALUES ('provider-1', 'verified', '["oil_change"]', '2026-08-01', 'rules', 'yes', 'approved');
    INSERT INTO provider_pathway_profiles
      (id, provider_id, provider_person_id, relationship_path, pathway_version)
    VALUES ('profile-1', 'provider-1', 'person-1', 'independent_startup', 1);
    INSERT INTO provider_personnel
      (id, provider_id, person_id, relationship_type, roster_version)
    VALUES ('personnel-1', 'provider-1', 'person-1', 'owner_operator', 1);
    INSERT INTO provider_service_eligibility
      (id, provider_id, eligibility_state, valid_through, next_expiration_at)
    VALUES ('eligibility-1', 'provider-1', 'eligible', '2027-08-01', '2027-08-01');
  `);
}

function insertAttempt(db, id = "attempt-1", evidenceId = "evidence-1", attemptNumber = 1) {
  db.prepare(`
    INSERT INTO provider_identity_verification_sessions (
      id, provider_id, person_id, application_submission_evidence_id,
      person_name_source_type, person_name_source_id, account_session_hash,
      certification_version, attempt_number, consented_at
    ) VALUES (?, 'provider-1', 'person-1', ?, 'application_evidence', ?, ?,
      'stripe-identity-owner-operator-consent-2026-08-01-v1', ?, '2026-08-01T10:01:00.000Z')
  `).run(id, evidenceId, evidenceId, "a".repeat(64), attemptNumber);
}

function bindStripeSession(db, id = "attempt-1", sessionId = "vs_verified_1") {
  db.prepare(`
    UPDATE provider_identity_verification_sessions
       SET stripe_verification_session_id = ?,
           stripe_status = 'requires_input'
     WHERE id = ?
  `).run(sessionId, id);
}

function bindManualIdentityEvidence(db) {
  db.exec(`
    UPDATE provider_personnel
       SET status = 'active',
           identity_verified_at = '2026-08-01T10:05:00.000Z',
           age_verified_at = '2026-08-01T10:05:00.000Z',
           identity_verification_provider = 'approved_manual_vendor',
           identity_verification_reference = 'manual_identity_1',
           identity_verification_checked_at = '2026-08-01T10:05:00.000Z',
           identity_verification_valid_through = '2027-08-01',
           age_verification_provider = 'approved_manual_vendor',
           age_verification_reference = 'manual_age_1',
           age_verification_checked_at = '2026-08-01T10:05:00.000Z',
           age_verification_valid_through = '2027-08-01'
     WHERE id = 'personnel-1';
  `);
}

test("0047 keeps trigger guards compatible with the remote D1 statement parser", async () => {
  const migration = await readFile(migrationUrl, "utf8");
  const wranglerRemoteQuery = `${migration}\nINSERT INTO "d1_migrations" (name)\nvalues ('0047_perfect_orphan.sql');`;

  assert.doesNotMatch(migration, /SELECT\s+CASE\s+WHEN[\s\S]*?RAISE\s*\(/i);
  assert.equal(
    (migration.match(/SELECT RAISE\(ABORT, '[^']+'\) WHERE/g) ?? []).length,
    6,
  );
  assert.ok(
    Buffer.byteLength(wranglerRemoteQuery, "utf8") < 20 * 1024,
    "0047 plus Wrangler's migration-ledger INSERT must stay below the remote D1 query budget",
  );
});

test("0047 atomically binds an approved Stripe Identity result to the latest owner", async () => {
  const db = await guardedDatabase();
  seedOwner(db);
  insertAttempt(db);
  bindStripeSession(db);
  db.exec(`
    UPDATE provider_identity_verification_sessions
       SET stripe_verification_report_id = 'vr_verified_1',
           stripe_status = 'verified',
           decision_status = 'approved',
           checked_at = '2026-08-01T10:05:00.000Z',
           verified_at = '2026-08-01T10:05:00.000Z',
           last_stripe_event_id = 'evt_verified_1',
           last_stripe_event_created = 1785593100
     WHERE id = 'attempt-1';
  `);

  assert.deepEqual(
    { ...db.prepare(`
      SELECT status, identity_verification_provider AS provider,
             identity_verification_reference AS reference,
             identity_verification_valid_through AS validThrough
        FROM provider_personnel WHERE id = 'personnel-1'
    `).get() },
    {
      status: "active",
      provider: "stripe_identity",
      reference: "vs_verified_1",
      validThrough: "2027-08-01",
    },
  );
  assert.equal(
    db.prepare("SELECT registration_holder_id AS holder FROM provider_pathway_profiles WHERE id='profile-1'").get().holder,
    "provider-1",
  );
  assert.throws(() => db.exec(
    "UPDATE provider_personnel SET person_id='person-2' WHERE id='personnel-1'",
  ), /personnel binding is immutable/);
  assert.throws(() => db.exec(
    "UPDATE provider_personnel SET provider_id='provider-2' WHERE id='personnel-1'",
  ), /personnel binding is immutable/);

  db.prepare(`
    INSERT INTO provider_application_submission_evidence
      (id, provider_id, normalized_snapshot, created_at)
    VALUES ('evidence-2', 'provider-1', ?, '2026-08-01T11:00:00.000Z')
  `).run(applicationSnapshot("Janet", "Smith"));
  assert.deepEqual(
    { ...db.prepare(`
      SELECT status, identity_verification_provider AS provider,
             identity_verification_reference AS reference
        FROM provider_personnel WHERE id='personnel-1'
    `).get() },
    { status: "pending", provider: "", reference: "" },
  );
  assert.equal(
    db.prepare("SELECT eligibility_state AS state FROM provider_service_eligibility WHERE id='eligibility-1'").get().state,
    "blocked",
  );
  assert.deepEqual(
    { ...db.prepare("SELECT status, verification_status AS verification, alerts_enabled AS alerts FROM provider_applications WHERE id='provider-1'").get() },
    { status: "new", verification: "in review", alerts: "no" },
  );
  assert.equal(
    db.prepare("SELECT decision_status AS decision FROM provider_identity_verification_sessions WHERE id='attempt-1'").get().decision,
    "approved",
  );
});

test("0047 rejects stale applications, duplicate active attempts, and direct Stripe-label spoofing", async () => {
  const db = await guardedDatabase();
  seedOwner(db);
  db.exec("DELETE FROM provider_application_submission_evidence WHERE provider_id='provider-1'");
  assert.throws(() => insertAttempt(db), /latest independent owner-operator binding/);
  db.prepare(`
    INSERT INTO provider_application_submission_evidence
      (id, provider_id, normalized_snapshot, created_at)
    VALUES ('evidence-1', 'provider-1', ?, '2026-08-01T10:00:00.000Z')
  `).run(applicationSnapshot());
  db.exec("UPDATE provider_personnel SET status='suspended' WHERE id='personnel-1'");
  assert.throws(() => insertAttempt(db), /latest independent owner-operator binding/);
  db.exec("UPDATE provider_personnel SET status='pending' WHERE id='personnel-1'");
  db.exec("UPDATE provider_pathway_profiles SET registration_holder_id='other-provider' WHERE id='profile-1'");
  assert.throws(() => insertAttempt(db), /latest independent owner-operator binding/);
  db.exec("UPDATE provider_pathway_profiles SET registration_holder_id='' WHERE id='profile-1'");
  insertAttempt(db);

  assert.throws(() => insertAttempt(db, "attempt-2", "evidence-1", 2), /UNIQUE constraint failed/);
  assert.throws(() => db.exec(`
    UPDATE provider_personnel
       SET identity_verification_provider='stripe_identity',
           identity_verification_reference='vs_fabricated',
           identity_verification_checked_at='2026-08-01T10:05:00.000Z',
           identity_verification_valid_through='2027-08-01',
           age_verification_provider='stripe_identity',
           age_verification_reference='vs_fabricated',
           age_verification_checked_at='2026-08-01T10:05:00.000Z',
           age_verification_valid_through='2027-08-01'
     WHERE id='personnel-1';
  `), /requires an approved bound session/);
  assert.throws(() => db.exec(`
    UPDATE provider_personnel
       SET identity_verification_provider=' STRIPE_IDENTITY ',
           identity_verification_reference='vs_fabricated',
           identity_verification_checked_at='2026-08-01T10:05:00.000Z',
           identity_verification_valid_through='2027-08-01',
           age_verification_provider='STRIPE_IDENTITY',
           age_verification_reference='vs_fabricated',
           age_verification_checked_at='2026-08-01T10:05:00.000Z',
           age_verification_valid_through='2027-08-01'
     WHERE id='personnel-1';
  `), /requires an approved bound session/);

  bindStripeSession(db);
  db.prepare(`
    INSERT INTO provider_application_submission_evidence
      (id, provider_id, normalized_snapshot, created_at)
    VALUES ('evidence-2', 'provider-1', ?, '2026-08-01T11:00:00.000Z')
  `).run(applicationSnapshot("Janet", "Smith"));
  assert.throws(() => db.exec(`
    UPDATE provider_identity_verification_sessions
       SET stripe_verification_report_id='vr_stale', stripe_status='verified',
           decision_status='approved', checked_at='2026-08-01T10:05:00.000Z',
           verified_at='2026-08-01T10:05:00.000Z',
           last_stripe_event_id='evt_stale', last_stripe_event_created=1785593100
     WHERE id='attempt-1';
  `), /terminal identity verification decision is immutable/);
  assert.deepEqual(
    { ...db.prepare(`
      SELECT decision_status AS decision, failure_code AS failure
        FROM provider_identity_verification_sessions WHERE id='attempt-1'
    `).get() },
    { decision: "closed", failure: "application_evidence_superseded" },
  );
});

test("0047 atomically blocks provider access whenever external identity evidence is cleared", async () => {
  const db = await guardedDatabase();
  seedOwner(db);
  bindManualIdentityEvidence(db);

  db.exec(`
    UPDATE provider_personnel
       SET identity_verification_provider = '',
           identity_verification_reference = '',
           identity_verification_checked_at = '',
           identity_verification_valid_through = '',
           age_verification_provider = '',
           age_verification_reference = '',
           age_verification_checked_at = '',
           age_verification_valid_through = ''
     WHERE id = 'personnel-1';
  `);

  assert.deepEqual(
    { ...db.prepare(`
      SELECT status, identity_verified_at AS identityVerifiedAt,
             age_verified_at AS ageVerifiedAt,
             identity_verification_provider AS identityProvider,
             age_verification_provider AS ageProvider
        FROM provider_personnel WHERE id = 'personnel-1'
    `).get() },
    {
      status: "pending",
      identityVerifiedAt: "",
      ageVerifiedAt: "",
      identityProvider: "",
      ageProvider: "",
    },
  );
  assert.deepEqual(
    { ...db.prepare(`
      SELECT eligibility_state AS state, reason_codes AS reasons,
             valid_through AS validThrough, next_expiration_at AS nextExpiration
        FROM provider_service_eligibility WHERE id = 'eligibility-1'
    `).get() },
    {
      state: "blocked",
      reasons: '["identity_verification_revoked_or_transitioned"]',
      validThrough: "",
      nextExpiration: "",
    },
  );
  assert.deepEqual(
    { ...db.prepare(`
      SELECT status, verification_status AS verification,
             approved_services AS approvedServices, verified_at AS verifiedAt,
             verified_by AS verifiedBy, alerts_enabled AS alerts
        FROM provider_applications WHERE id = 'provider-1'
    `).get() },
    {
      status: "new",
      verification: "in review",
      approvedServices: "",
      verifiedAt: "",
      verifiedBy: "",
      alerts: "no",
    },
  );
});

test("0047 revokes current manual identity evidence when the canonical application is amended", async () => {
  const db = await guardedDatabase();
  seedOwner(db);
  bindManualIdentityEvidence(db);

  db.prepare(`
    INSERT INTO provider_application_submission_evidence
      (id, provider_id, normalized_snapshot, created_at)
    VALUES ('evidence-2', 'provider-1', ?, '2026-08-01T11:00:00.000Z')
  `).run(applicationSnapshot("Janet", "Smith"));

  assert.deepEqual(
    { ...db.prepare(`
      SELECT status, identity_verification_provider AS identityProvider,
             identity_verification_reference AS identityReference,
             age_verification_provider AS ageProvider,
             age_verification_reference AS ageReference
        FROM provider_personnel WHERE id = 'personnel-1'
    `).get() },
    {
      status: "pending",
      identityProvider: "",
      identityReference: "",
      ageProvider: "",
      ageReference: "",
    },
  );
  assert.deepEqual(
    { ...db.prepare(`
      SELECT eligibility_state AS state, reason_codes AS reasons
        FROM provider_service_eligibility WHERE id = 'eligibility-1'
    `).get() },
    {
      state: "blocked",
      reasons: '["identity_reverification_required_after_application_amendment"]',
    },
  );
  assert.deepEqual(
    { ...db.prepare(`
      SELECT status, verification_status AS verification,
             approved_services AS approvedServices, alerts_enabled AS alerts
        FROM provider_applications WHERE id = 'provider-1'
    `).get() },
    {
      status: "new",
      verification: "in review",
      approvedServices: "",
      alerts: "no",
    },
  );
});

test("0047 keeps immutable identity bindings and permits a new attempt after local supersession", async () => {
  const db = await guardedDatabase();
  seedOwner(db);
  insertAttempt(db);
  assert.throws(() => db.exec(`
    UPDATE provider_identity_verification_sessions SET person_id='other-person' WHERE id='attempt-1'
  `), /binding is immutable/);

  db.exec(`
    UPDATE provider_identity_verification_sessions
       SET decision_status='closed', stripe_status='superseded',
           failure_code='application_evidence_superseded'
     WHERE id='attempt-1';
  `);
  insertAttempt(db, "attempt-2", "evidence-1", 2);
  assert.equal(
    db.prepare("SELECT count(*) AS total FROM provider_identity_verification_sessions").get().total,
    2,
  );
});

test("0047 permits only an expired same-evidence Stripe binding to renew atomically", async () => {
  const db = await guardedDatabase();
  seedOwner(db);
  insertAttempt(db);
  bindStripeSession(db, "attempt-1", "vs_old");
  db.exec(`
    UPDATE provider_identity_verification_sessions
       SET stripe_verification_report_id='vr_old', stripe_status='verified',
           decision_status='approved', checked_at='2025-07-01T10:00:00.000Z',
           verified_at='2025-07-01T10:00:00.000Z',
           last_stripe_event_id='evt_old', last_stripe_event_created=1751364000
     WHERE id='attempt-1';
  `);

  insertAttempt(db, "attempt-2", "evidence-1", 2);
  bindStripeSession(db, "attempt-2", "vs_new");
  assert.throws(() => db.exec(`
    UPDATE provider_identity_verification_sessions
       SET stripe_verification_report_id='vr_new', stripe_status='verified',
           decision_status='approved', checked_at='2026-06-30T10:00:00.000Z',
           verified_at='2026-06-30T10:00:00.000Z',
           last_stripe_event_id='evt_early', last_stripe_event_created=1782813600
     WHERE id='attempt-2';
  `), /exact latest application/);

  db.exec(`
    UPDATE provider_identity_verification_sessions
       SET stripe_verification_report_id='vr_new', stripe_status='verified',
           decision_status='approved', checked_at='2026-08-01T10:00:00.000Z',
           verified_at='2026-08-01T10:00:00.000Z',
           last_stripe_event_id='evt_new', last_stripe_event_created=1785578400
     WHERE id='attempt-2';
  `);
  assert.deepEqual(
    { ...db.prepare(`
      SELECT identity_verification_reference AS identityReference,
             age_verification_reference AS ageReference,
             identity_verification_valid_through AS validThrough
        FROM provider_personnel WHERE id='personnel-1'
    `).get() },
    {
      identityReference: "vs_new",
      ageReference: "vs_new",
      validThrough: "2027-08-01",
    },
  );
  assert.deepEqual(
    db.prepare(`
      SELECT decision_status AS decision FROM provider_identity_verification_sessions
      ORDER BY attempt_number
    `).all().map((row) => row.decision),
    ["approved", "approved"],
  );
});
