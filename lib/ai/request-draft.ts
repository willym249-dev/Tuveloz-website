// Owner-only request-draft engine behind /admin/test-lab/ai. Re-cut from the
// unmergeable PR #46 onto today's AI stack: instead of a bespoke OpenAI
// client it rides the same GPT/Gemini/Claude council as the live assistant,
// so key handling, caching, and provider fallback stay defined in one place.
//
// The boundary carried over from #46 unchanged: this drafts words, nothing
// else. It cannot submit a job, write to the database, contact or choose a
// provider, set a price, diagnose a vehicle, or touch payments — and every
// result is labeled a draft requiring owner review.
//
// The pure rules (shape, parser, personal-data screen, instructions) live in
// lib/ai/request-draft-contract.ts so tests can run them under plain Node.

import { askCouncil, councilConfigured } from "../ai-council-runtime";
import {
  REQUEST_DRAFT_MAX_TOKENS,
  REQUEST_DRAFT_SYSTEM_PROMPT,
  parseRequestDraft,
  type RequestDraft,
} from "./request-draft-contract";

export class RequestDraftConfigurationError extends Error {}
export class RequestDraftUpstreamError extends Error {}

export function requestDraftingEnabled() {
  return councilConfigured();
}

export async function createRequestDraft(input: {
  vehicle: string;
  description: string;
}): Promise<RequestDraft> {
  if (!councilConfigured()) {
    throw new RequestDraftConfigurationError(
      "No AI provider key is configured, so the request-draft test cannot run.",
    );
  }

  const question = [
    `Vehicle description: ${input.vehicle || "Not provided"}`,
    `Customer's issue description: ${input.description}`,
  ].join("\n");

  let answer: string;
  try {
    const result = await askCouncil({
      question,
      system: REQUEST_DRAFT_SYSTEM_PROMPT,
      mode: "quick",
      maxTokens: REQUEST_DRAFT_MAX_TOKENS,
    });
    answer = result.answer;
  } catch (error) {
    throw new RequestDraftUpstreamError(
      error instanceof Error ? error.message : "The AI provider rejected the request.",
    );
  }

  const draft = parseRequestDraft(answer);
  if (!draft) {
    throw new RequestDraftUpstreamError("The AI provider returned an invalid draft shape.");
  }
  return draft;
}
