function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function strings(value: unknown, keys: string[]): value is Record<string, unknown> {
  return record(value) && keys.every(key => typeof value[key] === "string");
}

function optionalFields(value: Record<string, unknown>, keys: string[], type: "string" | "boolean") {
  return keys.every(key => value[key] === undefined || typeof value[key] === type);
}

function list(value: unknown, check: (item: unknown) => boolean) {
  return Array.isArray(value) && value.every(check);
}

// Validate the fields consumed by the checklist before replacing its saved view.
// Extra server fields are allowed; missing collections must not look like an
// empty checklist or an approved application.
export function validProviderOnboardingSnapshot(value: unknown): boolean {
  if (!record(value) || (value.ok !== undefined && value.ok !== true)
    || (value.error !== undefined && value.error !== "")) return false;
  const identity = value.identityVerification;
  return strings(value.policy, ["version", "status", "jurisdiction", "marketplaceMode", "notice"])
    && strings(value.provider, ["id", "name", "email", "preferredLanguage", "applicationStatus", "verificationStatus"])
    && Boolean(String(value.provider.id).trim())
    && (value.pathway === null || strings(value.pathway, ["code", "label", "providerLevelLabel", "personId"]))
    && strings(identity, ["status", "method"])
    && ["complete", "canStart", "ownerOperatorEligible"].every(key => typeof identity[key] === "boolean")
    && ["attemptsUsed", "attemptsRemaining"].every(key => Number.isInteger(identity[key]) && Number(identity[key]) >= 0)
    && optionalFields(identity, ["failureCode"], "string")
    && optionalFields(identity, ["manualReattestationRequired", "expiredManualVerificationRequiresReplacement",
      "conflictingExternalVerificationRequiresReview", "configuredForThisProvider"], "boolean")
    && list(value.services, service => strings(service, ["code", "label", "description", "statusLabel"])
      && optionalFields(service, ["status", "reason"], "string")
      && optionalFields(service, ["canTakeJobs"], "boolean")
      && list(service.requirements, requirement => strings(requirement, ["code", "label", "status"])
        && ["accepted", "under_review", "needs_correction", "rejected", "expired", "missing"].includes(String(requirement.status))
        && typeof requirement.uploadAllowed === "boolean"
        && optionalFields(requirement, ["requiresExpiration", "private"], "boolean")
        && (requirement.submission === null || (strings(requirement.submission,
          ["id", "status", "submittedAt", "expiresAt", "scanStatus", "scanLabel"])
          && typeof requirement.submission.downloadAllowed === "boolean"
          && ["not_applicable", "current", "expiring_soon", "expired"].includes(String(requirement.submission.expirationStatus))
          && optionalFields(requirement.submission, ["reviewNotes", "supersedesEvidenceId", "scanUpdatedAt",
            "expirationLabel", "reminderStatus", "reminderLabel"], "string")
          && (requirement.submission.daysUntilExpiration === undefined
            || requirement.submission.daysUntilExpiration === null
            || Number.isFinite(requirement.submission.daysUntilExpiration))))))
    && list(value.agreements, agreement => strings(agreement, ["key", "title", "href", "requiredVersion", "releaseStatus"])
      && ["acceptedForApplicationReview", "eligibilityCurrent"].every(key => typeof agreement[key] === "boolean")
      && optionalFields(agreement, ["current"], "boolean")
      && optionalFields(agreement, ["acceptedAt"], "string"))
    && list(value.appeals, appeal => strings(appeal,
      ["id", "evidenceId", "requestType", "status", "statement", "submittedAt", "dueAt", "resolvedAt", "resolutionNotes"]))
    && list(value.dataRightsRequests, request => strings(request,
      ["id", "requestType", "status", "submittedAt", "dueAt", "legalHold", "completedAt", "responseNotes"]))
    && strings(value.privacy, ["storage", "access", "retention", "deletion", "prohibitedUploads"])
    && ["allAgreementsCurrent", "allAgreementsAcknowledgedForApplicationReview", "allAgreementsEligibilityCurrent"]
      .every(key => typeof value[key] === "boolean")
    && list(value.guide, item => typeof item === "string");
}
