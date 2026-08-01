import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("verified provider application records and challenge consumption commit in one D1 batch", async () => {
  const [route, migration] = await Promise.all([
    read("app/api/providers/route.ts"),
    read("drizzle/0046_volatile_liz_osborn.sql"),
  ]);
  const transactionComment = route.indexOf("The challenge is consumed in the same D1 transaction");
  const batch = route.indexOf("await db.batch([", transactionComment);
  const notification = route.lastIndexOf("await notifyProviderApplicationReceived");

  assert.notEqual(transactionComment, -1);
  assert.notEqual(batch, -1);
  for (const statement of [
    "challengeConsume",
    "db.insert(providerApplicationEmailClaims)",
    "applicationInsert",
    "submissionEvidenceInsert",
    "pathwayInsert",
    "personnelInsert",
    "...acceptanceInserts",
    "auditInsert",
  ]) {
    assert.ok(route.slice(batch).includes(statement), `missing atomic statement ${statement}`);
  }
  assert.ok(notification > batch, "best-effort delivery must happen after the database commit");
  assert.match(
    route,
    /eq\(providerApplicationChallenges\.verifiedAt, verified\.challenge\.verifiedAt\)/,
  );
  assert.match(route, /acceptanceEvidenceId: verified\.challenge\.id/);
  assert.match(route, /sessionId: verified\.challenge\.id/);
  assert.match(route, /scope: "email_control_only"/);
  assert.match(route, /consumptionNonce/);
  assert.match(route, /providerApplicationSubmissionEvidenceId: submissionEvidenceId/);
  assert.match(route, /acceptedDocumentManifest: JSON\.stringify\(acceptedDocumentManifest\)/);
  assert.match(
    migration,
    /provider_application_email_claim_requires_consumed_challenge/,
  );
  assert.match(migration, /`used_at` = NEW\.`claimed_at`/);
  assert.match(migration, /`consumption_nonce` = NEW\.`consumption_nonce`/);
  assert.match(migration, /provider_application_submission_evidence_immutable_update/);
  assert.match(migration, /provider_application_submission_evidence_immutable_delete/);
  assert.match(migration, /`expires_at` > NEW\.`claimed_at`/);
  assert.match(migration, /RAISE\(ABORT, 'provider application claim requires a consumed email challenge'\)/);
});

test("existing applications and unique-claim races return the same non-enumerating response", async () => {
  const route = await read("app/api/providers/route.ts");
  const genericStart = route.indexOf("function genericCompleteResponse()");
  const genericEnd = route.indexOf("export async function POST", genericStart);
  const generic = route.slice(genericStart, genericEnd);
  const conflictStart = route.indexOf("} catch (batchError)");
  const conflictEnd = route.indexOf("// Delivery is best-effort", conflictStart);
  const conflict = route.slice(conflictStart, conflictEnd);

  assert.match(generic, /ok: true/);
  assert.match(generic, /status: 202/);
  assert.doesNotMatch(generic, /applicationId|providerId|existing|verificationStatus/);
  assert.doesNotMatch(route, /existing:\s*true|applicationId:\s*existing/);

  assert.match(conflict, /const winner = await activeApplicationForEmail\(application\.email\)/);
  assert.match(conflict, /if \(!winner\) throw batchError/);
  assert.match(conflict, /providerId: winner\.id/);
  assert.match(conflict, /onConflictDoNothing\(\)/);
  assert.match(conflict, /return genericCompleteResponse\(\)/);
  assert.ok(
    conflict.indexOf("if (!winner) throw batchError")
      < conflict.indexOf("return genericCompleteResponse()"),
    "an unrelated batch error must not be converted into success",
  );
});

test("verification happens before any provider application lookup or write", async () => {
  const route = await read("app/api/providers/route.ts");
  const verification = route.indexOf("await verifyProviderApplicationChallenge(");
  const existingLookup = route.indexOf("await activeApplicationForEmail(application.email)");
  const applicationInsert = route.indexOf("const applicationInsert");

  assert.ok(verification >= 0 && verification < existingLookup);
  assert.ok(existingLookup < applicationInsert);
  assert.match(route, /function invalidChallengeResponse\(\)[\s\S]*status: 401/);
  assert.match(route, /if \(!verified\)[\s\S]*return invalidChallengeResponse\(\)/);
  assert.match(route, /lower\(trim\(\$\{providerApplications\.email\}\)\)/);
});
