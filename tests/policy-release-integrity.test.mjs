import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("every active policy release is bound to the exact deployed page source", async () => {
  const manifest = JSON.parse(await read("config/policy-releases.json"));
  const allowedStatuses = new Set(["draft", "inactive", "active", "retired"]);
  const activeReleaseIds = new Set();

  for (const [key, release] of Object.entries(manifest)) {
    assert.ok(allowedStatuses.has(release.releaseStatus), `${key} has an invalid status`);
    assert.match(release.sourceFile, /^app\/[a-z0-9-]+\/page\.tsx$/);

    if (release.releaseStatus !== "active") {
      if (release.releaseStatus === "draft") {
        assert.equal(release.effectiveAt, "", `${key} draft cannot have an effective date`);
        assert.equal(release.releaseId, "", `${key} draft cannot have a release id`);
        assert.equal(release.canonicalBodyHash, "", `${key} draft cannot have a body hash`);
      }
      continue;
    }

    assert.ok(!activeReleaseIds.has(release.releaseId), `${key} reuses an active release id`);
    activeReleaseIds.add(release.releaseId);
    assert.ok(Number.isFinite(Date.parse(release.effectiveAt)), `${key} needs an effective date`);
    assert.match(release.canonicalBodyHash, /^[a-f0-9]{64}$/i);

    const normalizedSource = (await read(release.sourceFile)).replaceAll("\r\n", "\n");
    const actualHash = createHash("sha256").update(normalizedSource).digest("hex");
    assert.equal(
      release.canonicalBodyHash.toLowerCase(),
      actualHash,
      `${key} release hash does not match ${release.sourceFile}`,
    );
  }
});

test("customer and provider gates use the one shared release manifest", async () => {
  const [customerGate, providerGate] = await Promise.all([
    read("lib/customer-policy-acceptance.ts"),
    read("lib/provider-policy-acceptance.ts"),
  ]);
  for (const key of ["terms", "customer_agreement", "privacy", "payment_policy"]) {
    assert.match(customerGate, new RegExp(`policyDocumentRelease\\(\\"${key}\\"\\)`));
  }
  for (const key of [
    "terms",
    "provider_agreement",
    "payment_policy",
    "marketplace_conduct",
    "provisional_provider_policy",
    "privacy",
  ]) {
    assert.match(providerGate, new RegExp(`policyDocumentRelease\\(\\"${key}\\"\\)`));
  }
  assert.doesNotMatch(customerGate, /DRAFT_RELEASE/);
  assert.doesNotMatch(providerGate, /DRAFT_RELEASE/);
});
