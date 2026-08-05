// Tuveloz AI: the customer-facing assistant behind the "Open Tuveloz AI"
// buttons. It reuses the GPT/Gemini/Claude council (lib/ai-council-runtime.ts)
// in its cheapest "quick" mode and wraps every answer in a safety-first,
// onboarding-only system prompt so the assistant helps a customer put words to
// what their vehicle is doing without diagnosing, dispatching help, quoting a
// price, or picking a provider.

import { askCouncil, councilConfigured } from "../../../lib/ai-council-runtime";
import { CUSTOMER_JOB_POSTING_PAUSED } from "../../../lib/launch-status";

const NO_STORE_HEADERS = { "cache-control": "no-store" } as const;

const MAX_MESSAGE_CHARS = 1500;
const MAX_HISTORY_TURNS = 8;
const MAX_HISTORY_CHARS = 700;
const ANSWER_MAX_TOKENS = 600;

type ChatTurn = { role: "user" | "assistant"; content: string };

function noStoreJson(body: unknown, status = 200) {
  return Response.json(body, { status, headers: NO_STORE_HEADERS });
}

function cleanText(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function parseHistory(value: unknown): ChatTurn[] {
  if (!Array.isArray(value)) return [];
  const turns: ChatTurn[] = [];
  for (const entry of value.slice(-MAX_HISTORY_TURNS)) {
    if (!entry || typeof entry !== "object") continue;
    const role = (entry as { role?: unknown }).role;
    const content = cleanText((entry as { content?: unknown }).content, MAX_HISTORY_CHARS);
    if ((role === "user" || role === "assistant") && content) {
      turns.push({ role, content });
    }
  }
  return turns;
}

function systemPrompt(language: "en" | "es") {
  const replyLanguage =
    language === "es"
      ? "Respond in Spanish. If the customer clearly writes in English, mirror their language instead."
      : "Respond in English. If the customer clearly writes in Spanish, mirror their language instead.";
  const launchLine = CUSTOMER_JOB_POSTING_PAUSED
    ? "Tuveloz is in provider-onboarding mode: customer service requests, quotes, bookings, and payments are not open yet. Never promise service, a provider, a price, a booking, or a timeline."
    : "Never promise a specific provider, price, booking, or timeline.";
  return [
    "You are Tuveloz AI, a bilingual (English/Spanish) assistant for Tuveloz, a local vehicle-service marketplace in Montgomery County, Maryland.",
    "Your only job is to help a customer describe, in clear plain language, what their vehicle is doing, and to help them organize their observations so a future service request would be easy for a provider to read.",
    "Hard limits — never cross these:",
    "- Do NOT diagnose the mechanical fault or name the failed part as a conclusion. You may note what a symptom *could* relate to, always as a possibility to confirm with a professional.",
    "- Do NOT dispatch help, roadside assistance, tow trucks, or emergency services yourself.",
    "- Do NOT estimate, guarantee, or range any price, cost, or quote.",
    "- Do NOT choose, rank, or recommend a specific provider or business.",
    "- Do NOT ask for or store sensitive data: payment details, passwords, full VIN if the person is hesitant, or government-ID numbers.",
    "Safety first: if the situation sounds dangerous — brakes not working, smoke, fire, fuel or gas smell, severe overheating, loss of steering, or being stranded in a live traffic lane or on a highway — tell the person to stop driving when safe, get clear of traffic, and contact emergency services (911) or a professional right away. Do not walk them through a risky roadside repair.",
    launchLine,
    "Style: warm, brief, plain language. Prefer a short answer with a few bullet points. When useful, offer 2–4 short questions that would make their future request clearer (vehicle year/make/model, when the symptom happens, any sounds/lights/smells). End with a short reminder that this is guidance only, not a diagnosis or a quote.",
    replyLanguage,
  ].join("\n");
}

function buildQuestion(message: string, history: ChatTurn[]) {
  if (history.length === 0) return message;
  const transcript = history
    .map((turn) => `${turn.role === "user" ? "Customer" : "Tuveloz AI"}: ${turn.content}`)
    .join("\n");
  return `Conversation so far:\n${transcript}\n\nCustomer: ${message}`;
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return noStoreJson({ error: "Send a JSON body with a message." }, 400);
  }

  const message = cleanText(body.message, MAX_MESSAGE_CHARS);
  const language = body.language === "es" ? "es" : "en";
  const history = parseHistory(body.history);

  if (!message) {
    return noStoreJson({ error: "Type what your vehicle is doing to get started." }, 400);
  }

  if (!councilConfigured()) {
    return noStoreJson(
      {
        error: "Tuveloz AI is not available right now. Please try again later.",
        code: "AI_UNCONFIGURED",
      },
      503,
    );
  }

  try {
    const result = await askCouncil({
      question: buildQuestion(message, history),
      system: systemPrompt(language),
      mode: "quick",
      maxTokens: ANSWER_MAX_TOKENS,
    });
    return noStoreJson({
      reply: result.answer,
      consulted: result.consulted.map((answer) => answer.provider),
      cached: result.cached,
    });
  } catch (error) {
    console.error("Tuveloz AI council request failed", error);
    return noStoreJson(
      {
        error: "Tuveloz AI could not answer that just now. Please try again in a moment.",
        code: "AI_UPSTREAM_ERROR",
      },
      502,
    );
  }
}
