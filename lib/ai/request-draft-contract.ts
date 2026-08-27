// The pure half of the owner-only request-draft helper: the draft shape, the
// input limits, the personal-data screen, the drafting instructions, and the
// parser that enforces the JSON contract on whatever a model returns.
//
// Kept free of any Cloudflare-specific imports, like lib/ai/council.ts, so
// tests and CLIs can exercise every rule here under plain Node. The Workers
// runtime half lives in lib/ai/request-draft.ts.

export const REQUEST_DRAFT_SAFETY_LEVELS = [
  "routine_review",
  "do_not_drive_until_inspected",
  "contact_emergency_or_roadside_help",
] as const;

export type RequestDraftSafetyLevel = (typeof REQUEST_DRAFT_SAFETY_LEVELS)[number];

export type RequestDraft = {
  plainLanguageSummary: string;
  suggestedServiceCategory: string;
  suggestedRequestScope: string;
  clarifyingQuestions: string[];
  safetyLevel: RequestDraftSafetyLevel;
  safetyMessage: string;
  partsReminder: string;
  limitations: string[];
};

export const REQUEST_DRAFT_INPUT_LIMITS = {
  vehicle: 320,
  description: 1500,
} as const;

export const REQUEST_DRAFT_MAX_TOKENS = 900;

/**
 * The owner test refuses input that looks like real personal data: email
 * addresses, card-length digit runs, Social Security numbers, and VINs. The
 * tool exists to draft wording from fake descriptions, never to move a real
 * customer's identifying details through an AI provider.
 */
export function containsRestrictedPersonalData(value: string) {
  return (
    /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/i.test(value)
    || /\b(?:\d[ -]*?){13,19}\b/.test(value)
    || /\b\d{3}-\d{2}-\d{4}\b/.test(value)
    || /\b[A-HJ-NPR-Z0-9]{17}\b/i.test(value)
  );
}

export const REQUEST_DRAFT_SYSTEM_PROMPT = [
  "You are Tuveloz AI, an intake-drafting assistant for an independent vehicle-service marketplace in Montgomery County, Maryland.",
  "Turn the owner's fake test description into a clear customer request draft.",
  "Hard limits — never cross these:",
  "- Do not diagnose the vehicle, guarantee a cause, or name a failed part as a conclusion; use cautious wording such as 'may need inspection' and preserve uncertainty.",
  "- Do not select, rank, or recommend a provider; do not set, estimate, or range a price; do not approve work or create a booking.",
  "- Tuveloz does not sell vehicle parts. OEM and aftermarket may be recorded only as customer/provider communication preferences. Do not add a provider-supplied parts charge to a Tuveloz transaction.",
  "- Do not request or repeat names, email addresses, phone numbers, exact addresses, VINs, license plates, payment data, account credentials, or identity documents.",
  "- Do not invent vehicle facts. Ask concise clarifying questions for missing details.",
  "Safety: when the description suggests a possible immediate driving danger, set safetyLevel to do_not_drive_until_inspected. For fire, smoke, fuel odor, an active roadside danger, or another emergency, set safetyLevel to contact_emergency_or_roadside_help and direct the person to emergency or roadside help without repair instructions. Otherwise use routine_review.",
  "The customer must review and confirm every field before any future submission; say so in the limitations.",
  "Reply with ONLY a JSON object — no markdown, no code fence, no commentary — with exactly these keys:",
  '{"plainLanguageSummary": string, "suggestedServiceCategory": string, "suggestedRequestScope": string, "clarifyingQuestions": string[] (0-6), "safetyLevel": "routine_review" | "do_not_drive_until_inspected" | "contact_emergency_or_roadside_help", "safetyMessage": string, "partsReminder": string, "limitations": string[] (2-5)}',
].join("\n");

function clampText(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function clampList(value: unknown, maxItems: number, maxLength: number) {
  if (!Array.isArray(value)) return null;
  return value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .slice(0, maxItems)
    .map((item) => item.trim().slice(0, maxLength));
}

/**
 * Council answers are plain text, so the JSON contract is enforced here: strip
 * any fence the model added anyway, parse, then rebuild the draft field by
 * field so nothing outside the declared shape survives.
 */
export function parseRequestDraft(raw: string): RequestDraft | null {
  const unfenced = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = unfenced.indexOf("{");
  const end = unfenced.lastIndexOf("}");
  if (start === -1 || end <= start) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(unfenced.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const value = parsed as Record<string, unknown>;

  const plainLanguageSummary = clampText(value.plainLanguageSummary, 500);
  const suggestedServiceCategory = clampText(value.suggestedServiceCategory, 120);
  const suggestedRequestScope = clampText(value.suggestedRequestScope, 900);
  const safetyMessage = clampText(value.safetyMessage, 400);
  const partsReminder = clampText(value.partsReminder, 320);
  const clarifyingQuestions = clampList(value.clarifyingQuestions, 6, 220);
  const limitations = clampList(value.limitations, 5, 220);
  const safetyLevel = value.safetyLevel;

  if (
    !plainLanguageSummary
    || !suggestedServiceCategory
    || !suggestedRequestScope
    || !safetyMessage
    || !partsReminder
    || clarifyingQuestions === null
    || limitations === null
    || limitations.length < 2
    || !(REQUEST_DRAFT_SAFETY_LEVELS as readonly string[]).includes(safetyLevel as string)
  ) {
    return null;
  }

  return {
    plainLanguageSummary,
    suggestedServiceCategory,
    suggestedRequestScope,
    clarifyingQuestions,
    safetyLevel: safetyLevel as RequestDraftSafetyLevel,
    safetyMessage,
    partsReminder,
    limitations,
  };
}
