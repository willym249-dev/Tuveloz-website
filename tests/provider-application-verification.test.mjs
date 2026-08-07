import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import {
  PROVIDER_APPLICATION_PAYLOAD_HASH_ACCEPTANCE_MARKER,
  providerApplicationPayloadHashWithSecret,
} from "../lib/provider-application-payload-hash.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("normalized provider payload hashing is deterministic and binds every supplied value", async () => {
  const secret = "test-only-provider-hash-secret-that-is-long-enough";
  const application = {
    format: "tuveloz_provider_application_payload_v1",
    email: "provider@example.com",
    name: "Example Provider",
    serviceCodes: ["provisional_wiper_blade_replacement"],
    acknowledgements: { privacyAcknowledged: true, termsBundleAccepted: true },
  };
  const reorderedApplication = {
    acknowledgements: { termsBundleAccepted: true, privacyAcknowledged: true },
    serviceCodes: ["provisional_wiper_blade_replacement"],
    name: "Example Provider",
    email: "provider@example.com",
    format: "tuveloz_provider_application_payload_v1",
  };
  const documents = [
    { key: "terms", version: "1", hash: "a".repeat(64) },
    { key: "privacy", version: "1", hash: "b".repeat(64) },
  ];

  const first = await providerApplicationPayloadHashWithSecret(
    application,
    documents,
    secret,
  );
  const second = await providerApplicationPayloadHashWithSecret(
    reorderedApplication,
    documents,
    secret,
  );
  const changed = await providerApplicationPayloadHashWithSecret(
    { ...application, email: "different@example.com" },
    documents,
    secret,
  );

  assert.match(first, /^[a-f0-9]{64}$/);
  assert.equal(second, first, "two equivalent full-payload hash calls must be identical");
  assert.notEqual(changed, first, "changing a bound application value must change the hash");
  assert.equal(
    PROVIDER_APPLICATION_PAYLOAD_HASH_ACCEPTANCE_MARKER,
    "provider-application-payload-hash-binding-v1",
  );
});

test("both public provider writes require explicit same-origin requests and bounded JSON", async () => {
  const [challengeRoute, commitRoute, security, limitedJson] = await Promise.all([
    read("app/api/providers/challenge/route.ts"),
    read("app/api/providers/route.ts"),
    read("lib/request-security.ts"),
    read("lib/limited-json.ts"),
  ]);

  for (const route of [challengeRoute, commitRoute]) {
    assert.match(route, /if \(!isStrictSameOriginWriteRequest\(request\)\)/);
    assert.match(route, /readLimitedJsonObject\(/);
    assert.match(route, /PROVIDER_APPLICATION_MAX_JSON_BYTES/);
    assert.match(route, /RequestBodyTooLargeError/);
    assert.match(route, /status: 413/);
  }
  assert.match(security, /const origin = request\.headers\.get\("origin"\)/);
  assert.match(security, /if \(!origin\) return false/);
  assert.match(security, /new URL\(origin\)\.origin === new URL\(request\.url\)\.origin/);
  assert.match(limitedJson, /request\.body\.getReader\(\)/);
  assert.match(limitedJson, /totalBytes > maximumBytes/);
});

test("challenge issuance is HMAC-bound, short-lived, rate-limited, and non-enumerating", async () => {
  const [challengeRoute, helper, payloadHash] = await Promise.all([
    read("app/api/providers/challenge/route.ts"),
    read("lib/provider-application-verification.ts"),
    read("lib/provider-application-payload-hash.ts"),
  ]);

  assert.match(challengeRoute, /normalizeProviderApplicationPayload\(body\)/);
  assert.match(challengeRoute, /issueProviderApplicationChallenge\(application, request\)/);
  assert.doesNotMatch(challengeRoute, /providerApplications|activeApplication|existing/);
  assert.match(helper, /PROVIDER_APPLICATION_CHALLENGE_LIFETIME_MS = 10 \* 60 \* 1000/);
  assert.match(helper, /EMAIL_CHALLENGE_LIMIT = 3/);
  assert.match(helper, /SOURCE_CHALLENGE_LIMIT = 10/);
  assert.match(helper, /provider-application-code:v1:\$\{id\}:\$\{application\.email\}:\$\{payloadHash\}:\$\{code\}/);
  assert.match(helper, /provider-application-email:v1:\$\{application\.email\}/);
  assert.match(helper, /provider-application-source:v1:\$\{providerApplicationRequestIp\(request\)\}/);
  assert.match(helper, /This verifies email control only/);
  assert.match(payloadHash, /HMAC/);
  assert.match(payloadHash, /acceptedDocuments/);
});

test("each guess atomically claims one of at most five comparisons before code checking", async () => {
  const helper = await read("lib/provider-application-verification.ts");
  const claim = helper.slice(
    helper.indexOf("const claimedAttempts ="),
    helper.indexOf("const challenge = claimedAttempts[0]"),
  );
  const comparison = helper.indexOf("constantTimeEqual(challenge.codeHash, suppliedHash)");

  assert.match(helper, /PROVIDER_APPLICATION_CHALLENGE_MAX_ATTEMPTS = 5/);
  assert.match(claim, /update\(providerApplicationChallenges\)/);
  assert.match(claim, /attempts: sql<number>`\$\{providerApplicationChallenges\.attempts\} \+ 1`/);
  assert.match(claim, /lt\([\s\S]*providerApplicationChallenges\.attempts,[\s\S]*PROVIDER_APPLICATION_CHALLENGE_MAX_ATTEMPTS/);
  assert.match(claim, /\.returning\(\)/);
  assert.ok(helper.indexOf("const claimedAttempts =") < comparison);
  assert.doesNotMatch(helper, /attempts:\s*challenge\.attempts \+ 1/);
});

test("legacy duplicate emails migrate safely to one deterministic active claim", async () => {
  const migration = await read("drizzle/0046_volatile_liz_osborn.sql");
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE provider_applications (
      id TEXT PRIMARY KEY NOT NULL,
      email TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE agreement_acceptances (id TEXT PRIMARY KEY NOT NULL);
    INSERT INTO provider_applications VALUES
      ('older', ' Same@Example.com ', 'new', '2026-01-01T00:00:00.000Z'),
      ('newer', 'same@example.com', 'approved', '2026-02-01T00:00:00.000Z'),
      ('declined', 'same@example.com', 'declined', '2025-01-01T00:00:00.000Z');
  `);
  db.exec(migration);

  const claims = db.prepare(`
    SELECT normalized_email, provider_id
    FROM provider_application_email_claims
  `).all();
  assert.equal(claims.length, 1);
  assert.equal(claims[0].normalized_email, "same@example.com");
  assert.equal(claims[0].provider_id, "older");

  db.exec("UPDATE provider_applications SET status = 'declined' WHERE id = 'older'");
  assert.equal(
    db.prepare("SELECT provider_id FROM provider_application_email_claims").get().provider_id,
    "newer",
    "declining the claimed legacy row must hand the claim to the next active duplicate",
  );
  db.exec("UPDATE provider_applications SET status = 'declined' WHERE id = 'newer'");
  assert.equal(
    db.prepare("SELECT count(*) AS count FROM provider_application_email_claims").get().count,
    0,
  );

  db.exec(`
    INSERT INTO provider_applications VALUES
      ('fresh', 'fresh@example.com', 'new', '2026-03-01T00:00:00.000Z');
  `);
  assert.throws(() => db.exec(`
    INSERT INTO provider_application_email_claims
      (normalized_email, provider_id, challenge_id, claimed_at)
    VALUES
      ('fresh@example.com', 'fresh', 'not-consumed', '2026-03-01T00:01:00.000Z');
  `), /requires a consumed email challenge/);

  db.exec(`
    INSERT INTO provider_application_challenges
      (id, email, payload_hash, code_hash, source_hash, expires_at, attempts, verified_at, used_at, consumption_nonce, created_at)
    VALUES
      ('challenge', 'fresh@example.com', 'payload', 'code', 'source',
       '2026-03-01T00:11:00.000Z', 1, '2026-03-01T00:00:30.000Z',
       '2026-03-01T00:01:00.000Z', 'valid-consumption-nonce', '2026-03-01T00:00:00.000Z');
    INSERT INTO provider_application_email_claims
      (normalized_email, provider_id, challenge_id, consumption_nonce, claimed_at)
    VALUES
      ('fresh@example.com', 'fresh', 'challenge', 'valid-consumption-nonce', '2026-03-01T00:01:00.000Z');
  `);
  assert.equal(
    db.prepare("SELECT challenge_id FROM provider_application_email_claims").get().challenge_id,
    "challenge",
  );
  db.prepare(`
    INSERT INTO provider_application_submission_evidence
      (id, provider_id, normalized_email, challenge_id, consumption_nonce,
       normalized_snapshot, payload_hash, accepted_document_manifest, verified_at, consumed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    "valid-evidence",
    "fresh",
    "fresh@example.com",
    "challenge",
    "valid-consumption-nonce",
    '{"email":"fresh@example.com"}',
    "payload",
    "[]",
    "2026-03-01T00:00:30.000Z",
    "2026-03-01T00:01:00.000Z",
  );
  assert.throws(
    () => db.exec("UPDATE provider_application_submission_evidence SET normalized_snapshot = '{}'"),
    /submission evidence is immutable/,
  );
  assert.throws(
    () => db.exec("DELETE FROM provider_application_submission_evidence"),
    /submission evidence is immutable/,
  );

  db.exec(`
    INSERT INTO provider_application_challenges
      (id, email, payload_hash, code_hash, source_hash, expires_at, attempts, verified_at, used_at, consumption_nonce, created_at)
    VALUES
      ('already-used', 'other@example.com', 'other-payload', 'code', 'source',
       '2026-03-01T00:11:00.000Z', 1, '2026-03-01T00:00:30.000Z',
       '2026-03-01T00:01:00.000Z', 'winner-nonce', '2026-03-01T00:00:00.000Z');
  `);
  db.exec("BEGIN");
  const zeroRowConsume = db.prepare(`
    UPDATE provider_application_challenges
    SET used_at = ?, consumption_nonce = ?
    WHERE id = ? AND used_at = '' AND consumption_nonce = ''
  `).run("2026-03-01T00:01:00.000Z", "loser-nonce", "already-used");
  assert.equal(zeroRowConsume.changes, 0, "the replay consume must affect zero rows");
  assert.throws(() => db.prepare(`
    INSERT INTO provider_application_email_claims
      (normalized_email, provider_id, challenge_id, consumption_nonce, claimed_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    "other@example.com",
    "other-provider",
    "already-used",
    "loser-nonce",
    "2026-03-01T00:01:00.000Z",
  ), /requires a consumed email challenge/);
  assert.throws(() => db.prepare(`
    INSERT INTO provider_application_submission_evidence
      (id, provider_id, normalized_email, challenge_id, consumption_nonce,
       normalized_snapshot, payload_hash, accepted_document_manifest, verified_at, consumed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    "evidence",
    "other-provider",
    "other@example.com",
    "already-used",
    "loser-nonce",
    "{}",
    "other-payload",
    "[]",
    "2026-03-01T00:00:30.000Z",
    "2026-03-01T00:01:00.000Z",
  ), /requires the current consumed challenge nonce/);
  db.exec("ROLLBACK");
  db.close();

  assert.match(migration, /INSERT OR IGNORE INTO `provider_application_email_claims`/);
  assert.match(migration, /ORDER BY lower\(trim\(`email`\)\), datetime\(`created_at`\) ASC, `id` ASC/);
  assert.doesNotMatch(migration, /UNIQUE INDEX[^\n]*provider_applications[^\n]*email/i);
});

test("challenge and rate-limit rows have bounded scheduled retention", async () => {
  const [helper, worker] = await Promise.all([
    read("lib/provider-application-verification.ts"),
    read("worker/index.ts"),
  ]);

  assert.match(helper, /CHALLENGE_RETENTION_AFTER_EXPIRY_MS = 24 \* 60 \* 60 \* 1000/);
  assert.match(helper, /RATE_LIMIT_RETENTION_MS = 48 \* 60 \* 60 \* 1000/);
  assert.match(helper, /delete\(providerApplicationChallenges\)/);
  assert.match(helper, /delete\(publicWriteRateLimits\)/);
  assert.match(worker, /scheduledTask\("provider application verification cleanup"/);
  assert.match(worker, /Promise\.allSettled/);
});

test("limited JSON requires the exact application/json media type", async () => {
  const { InvalidJsonBodyError, readLimitedJsonObject } = await import(
    "../lib/limited-json.ts"
  );
  const accepted = await readLimitedJsonObject(new Request("https://tuveloz.com/test", {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: "{}",
  }), 1024);
  assert.deepEqual(accepted, {});
  await assert.rejects(
    readLimitedJsonObject(new Request("https://tuveloz.com/test", {
      method: "POST",
      headers: { "content-type": "application/jsonp" },
      body: "{}",
    }), 1024),
    InvalidJsonBodyError,
  );
});

test("provider UI freezes the reviewed payload and preserves the challenge while entering its code", async () => {
  const page = await read("app/components/provider-signup-form.tsx");

  assert.match(page, /pendingApplicationPayload/);
  assert.match(page, /fetch\("\/api\/providers\/challenge"/);
  assert.match(page, /\.\.\.pendingApplicationPayload,[\s\S]*challengeId: applicationChallengeId,[\s\S]*verificationCode: applicationVerificationCode/);
  assert.match(page, /onChange=\{\(event\) => event\.stopPropagation\(\)\}/);
  assert.match(page, /Last step: enter the code we emailed you/);
  // The screen must scope itself to the email and nothing more. The long list
  // of things a code does not prove moved to the Provider Agreement, so this
  // guards the claim rather than the old wording: it may say the email is
  // confirmed, and must never imply identity or eligibility were checked.
  assert.match(page, /This just confirms the email is yours/);
  assert.match(page, /Esto solo confirma que el correo es suyo/);
  assert.doesNotMatch(
    page,
    /confirms your identity|identity (is )?verified|verifies (your )?identity|proves who you are/i,
  );
  assert.match(page, /Verify email and continue/);
  assert.match(page, /If an application already existed for this email, that one was kept/);
  assert.doesNotMatch(page, /Verify email and submit application|Application saved\./);
});

test("provider JSON legal acknowledgments require exact true booleans", async () => {
  const helper = await read("lib/provider-application-verification.ts");
  assert.match(helper, /body\.termsBundleAccepted === true/);
  assert.match(helper, /body\.privacyAcknowledged === true/);
  assert.match(helper, /body\.rulesReviewed === true/);
  assert.match(helper, /body\.adultAcknowledged === true/);
  assert.match(
    helper,
    /body\.employmentWorkAuthorizationResponsibilityAcknowledged === true/,
  );
  assert.doesNotMatch(helper, /policyAccepted\(|body\.termsAccepted/);
});
