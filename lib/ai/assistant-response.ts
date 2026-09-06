import { POLICY_ENTRIES } from "./policy-knowledge";

export type AssistantSource = { label: string; href: string };
export type AssistantReply = { reply: string; sources: AssistantSource[]; mode: "ai" | "policy-guide" };
export type AssistantProblem = "unconfirmed" | "rate-limit" | "unavailable";

const policySources = new Map(POLICY_ENTRIES.map(entry => [entry.source.href, entry.source]));
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

/** Only display a text answer and links to the guide's published policy pages. */
export function readAssistantReply(value: unknown): AssistantReply | null {
  if (!record(value) || typeof value.reply !== "string" || !value.reply.trim()
    || (value.mode !== "ai" && value.mode !== "policy-guide")) return null;
  const sources: AssistantSource[] = [];
  if (Array.isArray(value.sources)) {
    for (const item of value.sources) {
      if (!record(item) || typeof item.href !== "string" || typeof item.label !== "string" || !item.label.trim()) continue;
      const source = policySources.get(item.href);
      if (source && !sources.some(existing => existing.href === source.href)) sources.push(source);
    }
  }
  return { reply: value.reply, sources, mode: value.mode };
}

export function assistantProblem(status: number, value: unknown): AssistantProblem {
  if (status === 429) return "rate-limit";
  if (status === 503 && record(value) && value.code === "AI_UNCONFIGURED") return "unavailable";
  return "unconfirmed";
}

export function assistantProblemMessage(problem: AssistantProblem, language: "en" | "es"): string {
  if (problem === "rate-limit") return language === "es"
    ? "Espere un momento antes de volver a preguntar."
    : "Please wait a moment before asking again.";
  if (problem === "unavailable") return language === "es"
    ? "Nuestra guía no puede responder esa pregunta por ahora. Puede contactar al dueño más abajo."
    : "Our guide can't answer that question right now. You can contact the owner below.";
  return language === "es"
    ? "No pudimos obtener una respuesta. Intente de nuevo o contacte al dueño."
    : "We couldn't get an answer. Please try again or contact the owner.";
}
