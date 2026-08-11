/**
 * What the owner can learn about Tuveloz AI without reading anyone's questions.
 *
 * The assistant handles two things that matter to the business: what people are
 * confused about, and whether its answers about money are still hedged the way
 * the policy is. Both were invisible — the hedge guard only wrote to
 * console.warn, which nobody reads.
 *
 * This records the shape of each answer, never its content. No question text,
 * no reply text, no email, no session identifier. Just: which audience asked,
 * which vetted policy topics matched, and whether the guard had to replace the
 * model's wording. That is enough to spot "everyone is asking about the fee"
 * and "the guard fired four times today", and not enough to read anyone's mail.
 */
import { getDb } from "../../db";
import { analyticsEvents } from "../../db/schema";
import type { PolicyAudience, PolicyEntry } from "./policy-knowledge";

export const ASSISTANT_EVENT = "ai_answer_served";

export type AssistantEventProps = {
  audience: PolicyAudience;
  /** Vetted entry ids, not the visitor's words. Empty for ordinary car chat. */
  topics: string[];
  /** True when the answer was grounded in policy material. */
  grounded: boolean;
  /** "replaced" means the model dropped a hedge and we served the vetted text. */
  guard: "held" | "replaced" | "not-applicable";
};

/**
 * Fire-and-forget. An assistant answer must never fail because telemetry could
 * not be written, so this swallows its own errors and the caller does not await
 * it on the response path.
 */
export async function recordAssistantAnswer(
  audience: PolicyAudience,
  entries: readonly PolicyEntry[],
  guardHeld: boolean,
) {
  const props: AssistantEventProps = {
    audience,
    topics: entries.map((entry) => entry.id),
    grounded: entries.length > 0,
    guard: entries.some((entry) => entry.hedged)
      ? (guardHeld ? "held" : "replaced")
      : "not-applicable",
  };

  try {
    await getDb().insert(analyticsEvents).values({
      id: crypto.randomUUID(),
      event: ASSISTANT_EVENT,
      props: JSON.stringify(props),
    });
  } catch (error) {
    console.error("Unable to record Tuveloz AI telemetry", error);
  }
}
