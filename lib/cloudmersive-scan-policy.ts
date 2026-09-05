import type { AuthenticatedEvidenceScanResult } from "./evidence-scan-result-recorder";

export const CLOUDMERSIVE_PROVIDER = "cloudmersive";
export const CLOUDMERSIVE_ENGINE_VERSION = "cloudmersive-virus-api-v1-advanced";

const REQUIRED_FALSE_RESULT_FIELDS = [
  "ContainsExecutable",
  "ContainsInvalidFile",
  "ContainsScript",
  "ContainsPasswordProtectedFile",
  "ContainsRestrictedFileFormat",
  "ContainsMacros",
  "ContainsXmlExternalEntities",
  "ContainsInsecureDeserialization",
  "ContainsHtml",
  "ContainsUnsafeArchive",
  "ContainsOleEmbeddedObject",
  "ContainsUnwantedAction",
] as const;

export type CloudmersiveTerminalClassification = {
  terminal: true;
  status: AuthenticatedEvidenceScanResult["status"];
} | {
  terminal: false;
  reason: string;
};

function runtimeText(runtime: Record<string, unknown>, key: string) {
  const value = runtime[key];
  return typeof value === "string" ? value.trim() : "";
}

export function cloudmersiveScannerConfigured(runtime: Record<string, unknown>) {
  return runtimeText(runtime, "EVIDENCE_SCAN_PROVIDER") === CLOUDMERSIVE_PROVIDER
    && Boolean(runtimeText(runtime, "CLOUDMERSIVE_API_KEY"))
    && runtimeText(runtime, "EVIDENCE_SCAN_WEBHOOK_SECRET").length >= 32;
}

export function classifyCloudmersiveAdvancedResult(
  value: unknown,
): CloudmersiveTerminalClassification {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { terminal: false, reason: "response_not_an_object" };
  }
  const result = value as Record<string, unknown>;
  if (typeof result.CleanResult !== "boolean") {
    return { terminal: false, reason: "clean_result_missing" };
  }
  if (result.CleanResult === false) {
    const foundViruses = Array.isArray(result.FoundViruses) ? result.FoundViruses : [];
    return {
      terminal: true,
      status: foundViruses.length > 0 ? "infected" : "failed",
    };
  }

  // Cloudmersive returns an explicit null when it found no viruses. Missing
  // fields and other non-array values remain invalid; every advanced threat
  // flag must still be present and false before anything is marked clean.
  const noVirusesFound = result.FoundViruses === null
    || (Array.isArray(result.FoundViruses) && result.FoundViruses.length === 0);
  if (
    !noVirusesFound
    || typeof result.VerifiedFileFormat !== "string"
    || !result.VerifiedFileFormat.trim()
    || REQUIRED_FALSE_RESULT_FIELDS.some((field) => result[field] !== false)
  ) {
    return { terminal: false, reason: "clean_response_incomplete_or_unsafe" };
  }
  return { terminal: true, status: "clean" };
}
