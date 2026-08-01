import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("provider-authored profile claims remain private until exact-version review", async () => {
  const [profile, publicRoute, mediaRoute, ownerRoute, claims] = await Promise.all([
    read("app/api/provider-profile/route.ts"),
    read("app/api/public-provider/route.ts"),
    read("app/api/provider-media/route.ts"),
    read("app/api/admin/providers/route.ts"),
    read("lib/provider-profile-claims.ts"),
  ]);

  assert.match(profile, /publicationRequested[\s\S]*"pending_review"/);
  assert.ok(profile.includes("PROVIDER_PROFILE_PROHIBITED_CLAIM"));
  assert.match(profile, /upload-gallery[\s\S]*prohibitedProviderWrittenClaims/);
  assert.match(profile, /upload-logo[\s\S]*publicStatus:[^\n]*"pending_review"/);
  assert.match(profile, /remove-gallery[\s\S]*publicStatus:[^\n]*"pending_review"/);

  assert.ok(publicRoute.includes("providerProfileHasCurrentContentApproval"));
  assert.match(publicRoute, /publicAccess = \([\s\S]*currentProfileContentApproved/);
  assert.ok(mediaRoute.includes("providerProfileHasCurrentContentApproval"));
  assert.ok(claims.includes("contentFingerprint"));
  assert.ok(claims.includes("providerGalleryItems"));
  assert.ok(claims.includes("PROVIDER_PROFILE_REVIEW_EVENT"));

  assert.ok(ownerRoute.includes('body.action === "review-profile"'));
  assert.ok(ownerRoute.includes('profile.publicStatus !== "pending_review"'));
  assert.ok(ownerRoute.includes("providerProfileClaimsFingerprint(profile, gallery)"));
  assert.ok(ownerRoute.includes('eq(providerProfiles.updatedAt, profile.updatedAt)'));
  assert.ok(ownerRoute.includes("recordProviderAuditEvent"));
});

test("provider business tools use factual evidence-scoped copy", async () => {
  const page = await read("app/components/provider-business-page.tsx");

  for (const broadClaim of [
    "approved vehicle services",
    "verified reviews",
    "Verified customer feedback",
    "Approved services and verified completed-job reviews",
  ]) {
    assert.ok(!page.includes(broadClaim), `broad claim remains: ${broadClaim}`);
  }
  assert.ok(page.includes("Publication requires TUVELOZ content review"));
  assert.ok(page.includes("reviews linked to completed Tuveloz jobs"));
  assert.ok(page.includes("currently eligible service listings"));
});
