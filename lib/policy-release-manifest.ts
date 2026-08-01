import releaseManifest from "../config/policy-releases.json";

export type PolicyReleaseStatus = "draft" | "inactive" | "active" | "retired";
export type PolicyReleaseKey = keyof typeof releaseManifest;

export type PolicyDocumentRelease = {
  releaseStatus: PolicyReleaseStatus;
  effectiveAt: string;
  releaseId: string;
  reviewBodyHash: string;
  canonicalBodyHash: string;
};

export type NamedPolicyDocumentRelease = PolicyDocumentRelease & {
  key: PolicyReleaseKey;
  sourceFile: string;
};

export const POLICY_RELEASE_KEYS = Object.freeze(
  Object.keys(releaseManifest) as PolicyReleaseKey[],
);

const SHA256_HEX = /^[a-f0-9]{64}$/i;

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
    reviewBodyHash: release.reviewBodyHash,
    canonicalBodyHash: release.canonicalBodyHash,
  });
}

export function allPolicyDocumentReleases(): readonly NamedPolicyDocumentRelease[] {
  return POLICY_RELEASE_KEYS.map((key) => Object.freeze({
    key,
    sourceFile: releaseManifest[key].sourceFile,
    ...policyDocumentRelease(key),
  }));
}

export function policyDocumentReleaseIsActive(
  release: PolicyDocumentRelease,
  asOf = new Date(),
) {
  const effectiveAt = Date.parse(release.effectiveAt);
  return release.releaseStatus === "active"
    && Boolean(release.releaseId.trim())
    && SHA256_HEX.test(release.canonicalBodyHash)
    && Number.isFinite(effectiveAt)
    && effectiveAt <= asOf.getTime();
}
