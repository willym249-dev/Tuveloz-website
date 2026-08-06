import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  prohibitedProviderProfileClaims,
  prohibitedProviderWrittenClaims,
} from "../lib/provider-written-claims.ts";

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

test("providers may make their own truthful credential and warranty claims", () => {
  const allowed = [
    "Licensed Maryland auto repair facility, MVA registration on file.",
    "Fully insured with $1M garage liability coverage.",
    "ASE-certified master technician on every job.",
    "All of our employees are background-checked before hire.",
    "12-month / 12,000-mile warranty on labor. Satisfaction guaranteed.",
    "Bonded and factory-trained on hybrid drivetrains.",
  ];
  for (const copy of allowed) {
    assert.deepEqual(
      prohibitedProviderWrittenClaims([copy]),
      [],
      `provider self-claim should be allowed: ${copy}`,
    );
  }
});

test("claims spoken in TUVELOZ's voice or as platform badges stay blocked", () => {
  const blocked = [
    "Tuveloz approved!",
    "Tuveloz-certified mobile mechanic.",
    "Background-checked by Tuveloz.",
    "Screened and insured through the platform.",
    "Licensed by this marketplace.",
    "Verified pro — book with confidence.",
    "A fully vetted local shop.",
    "Official Tuveloz partner.",
    "We are Tuveloz's team for brakes in MoCo.",
    "Your car is 100% safe with us.",
    "Completely safe, every time.",
  ];
  for (const copy of blocked) {
    assert.ok(
      prohibitedProviderWrittenClaims([copy]).length > 0,
      `platform-voice claim should be blocked: ${copy}`,
    );
  }
});

test("profile screening covers descriptive fields but not the business name", () => {
  const base = {
    businessName: "Verified Auto Works LLC",
    headline: "Mobile brake service with upfront quotes",
    about: "Family shop. ASE-certified lead tech, insured, and we warranty our labor.",
    yearsExperience: "8 years",
    availabilityStatus: "Available now",
    availabilityNote: "Open Saturday 9-4",
    businessHours: "Mon-Fri 8-6",
  };
  assert.deepEqual(prohibitedProviderProfileClaims(base), []);

  const overclaimed = { ...base, headline: "Tuveloz verified — the platform's recommended shop" };
  assert.ok(prohibitedProviderProfileClaims(overclaimed).length > 0);
});
