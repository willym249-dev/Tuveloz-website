import releaseManifest from "../config/policy-releases.json";

export type PolicyReleaseStatus = "draft" | "inactive" | "active" | "retired";
export type PolicyReleaseKey = keyof typeof releaseManifest;

export type PolicyDocumentRelease = {
  releaseStatus: PolicyReleaseStatus;
  effectiveAt: string;
  releaseId: string;
  canonicalBodyHash: string;
};

/**
 * The JSON manifest is shared by customer and provider gates so one document
 * cannot accidentally have two release states. CI independently hashes the
 * normalized policy-page source named by each manifest entry before any active
 * release can deploy.
 */
export function policyDocumentRelease(key: PolicyReleaseKey): PolicyDocumentRelease {
  const release = releaseManifest[key];
  return Object.freeze({
    releaseStatus: release.releaseStatus as PolicyReleaseStatus,
    effectiveAt: release.effectiveAt,
    releaseId: release.releaseId,
    canonicalBodyHash: release.canonicalBodyHash,
  });
}
