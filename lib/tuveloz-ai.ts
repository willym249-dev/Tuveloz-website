import { env } from "cloudflare:workers";

type RuntimeEnvironment = Record<string, string | undefined>;

export type TuvelozAiSafetyLevel =
  | "routine_review"
  | "do_not_drive_until_inspected"
  | "contact_emergency_or_roadside_help";

export type TuvelozAiRequestDraft = {
  plainLanguageSummary: string;
  suggestedServiceCategory: string;
  suggestedRequestScope: string;
  clarifyingQuestions: string[];
  safetyLevel: TuvelozAiSafetyLevel;
  safetyMessage: string;
  partsReminder: string;
  limitations: string[];
};

type OpenAiResponsePayload = {
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  error?: {
    message?: string;
  };
};

export class TuvelozAiConfigurationError extends Error {}
export class TuvelozAiUpstreamError extends Error {}

const requestDraftSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    plainLanguageSummary: {
      type: "string",
      minLength: 1,
      maxLength: 500,
    },
    suggestedServiceCategory: {
      type: "string",
      minLength: 1,
      maxLength: 120,
    },
    suggestedRequestScope: {
      type: "string",
      minLength: 1,
      maxLength: 900,
    },
    clarifyingQuestions: {
      type: "array",
      minItems: 0,
      maxItems: 6,
      items: {
        type: "string",
        minLength: 1,
        maxLength: 220,
      },
    },
    safetyLevel: {
      type: "string",
      enum: [
        "routine_review",
        "do_not_drive_until_inspected",
        "contact_emergency_or_roadside_help",
      ],
    },
    safetyMessage: {
      type: "string",
      minLength: 1,
      maxLength: 400,
    },
    partsReminder: {
      type: "string",
      minLength: 1,
      maxLength: 320,
    },
    limitations: {
      type: "array",
      minItems: 2,
      maxItems: 5,
      items: {
        type: "string",
        minLength: 1,
        maxLength: 220,
      },
    },
  },
  required: [
    "plainLanguageSummary",
    "suggestedServiceCategory",
    "suggestedRequestScope",
    "clarifyingQuestions",
    "safetyLevel",
    "safetyMessage",
    "partsReminder",
    "limitations",
  ],
} as const;

function extractOutputText(payload: OpenAiResponsePayload) {
  for (const output of payload.output ?? []) {
    for (const content of output.content ?? []) {
      if (content.type === "output_text" && typeof content.text === "string") {
        return content.text;
      }
    }
  }
  return "";
}

function isDraft(value: unknown): value is TuvelozAiRequestDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as Partial<TuvelozAiRequestDraft>;
  return Boolean(
    typeof draft.plainLanguageSummary === "string"
    && typeof draft.suggestedServiceCategory === "string"
    && typeof draft.suggestedRequestScope === "string"
    && Array.isArray(draft.clarifyingQuestions)
    && draft.clarifyingQuestions.every((item) => typeof item === "string")
    && [
      "routine_review",
      "do_not_drive_until_inspected",
      "contact_emergency_or_roadside_help",
    ].includes(draft.safetyLevel ?? "")
    && typeof draft.safetyMessage === "string"
    && typeof draft.partsReminder === "string"
    && Array.isArray(draft.limitations)
    && draft.limitations.every((item) => typeof item === "string")
  );
}

export function tuvelozAiEnabled() {
  const variables = env as unknown as RuntimeEnvironment;
  return variables.TUVELOZ_AI_ENABLED?.trim().toLowerCase() === "true";
}

export async function createTuvelozAiRequestDraft(input: {
  vehicle: string;
  description: string;
}): Promise<TuvelozAiRequestDraft> {
  const variables = env as unknown as RuntimeEnvironment;
  if (!tuvelozAiEnabled()) {
    throw new TuvelozAiConfigurationError(
      "Tuveloz AI is disabled until the owner deliberately enables it.",
    );
  }

  const apiKey = variables.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new TuvelozAiConfigurationError(
      "The server-side OpenAI API key has not been configured.",
    );
  }

  const model = variables.OPENAI_MODEL?.trim() || "gpt-5-mini";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      store: false,
      max_output_tokens: 900,
      instructions: [
        "You are Tuveloz AI, an intake-drafting assistant for an independent vehicle-service marketplace.",
        "Turn the owner's fake test description into a clear customer request draft.",
        "Do not diagnose a vehicle, guarantee a cause, guarantee a repair, select a provider, set a price, approve work, or create a booking.",
        "Use cautious wording such as 'may need inspection' and preserve uncertainty.",
        "When the description suggests a possible immediate driving danger, say not to drive until inspected. For fire, smoke, fuel odor, an active roadside danger, or another emergency, direct the person to emergency or roadside help without giving repair instructions.",
        "Do not invent vehicle facts. Ask concise clarifying questions for missing details.",
        "Tuveloz does not sell vehicle parts. OEM and aftermarket may be recorded only as customer/provider communication preferences. Do not add a provider-supplied parts charge to a Tuveloz transaction.",
        "Do not request or repeat names, email addresses, phone numbers, exact addresses, VINs, license plates, payment data, account credentials, or identity documents.",
        "The customer must review and confirm every field before any future submission.",
      ].join("\n"),
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: [
                `Vehicle description: ${input.vehicle || "Not provided"}`,
                `Customer's issue description: ${input.description}`,
              ].join("\n"),
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "tuveloz_request_draft",
          description: "A non-diagnostic vehicle-service request draft for owner testing.",
          strict: true,
          schema: requestDraftSchema,
        },
      },
    }),
  });

  const payload = await response.json() as OpenAiResponsePayload;
  if (!response.ok) {
    throw new TuvelozAiUpstreamError(
      payload.error?.message || "The AI provider rejected the request.",
    );
  }

  const outputText = extractOutputText(payload);
  if (!outputText) {
    throw new TuvelozAiUpstreamError("The AI provider returned no request draft.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(outputText);
  } catch {
    throw new TuvelozAiUpstreamError("The AI provider returned an unreadable draft.");
  }

  if (!isDraft(parsed)) {
    throw new TuvelozAiUpstreamError("The AI provider returned an invalid draft shape.");
  }

  return parsed;
}
