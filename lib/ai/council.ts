// Orchestrates GPT, Gemini, and Claude behind one call so callers spend the
// fewest tokens needed for the task at hand instead of always asking all
// three:
//   - "quick"     one cheap-tier model, picked deterministically per question.
//   - "consensus" two cheap-tier models in parallel; a third (capable-tier)
//                 tiebreaker is only called if the first two disagree.
//   - "deep"      all three cheap-tier models, for decisions worth the spend.
//   - "frontier"  one frontier-tier model (Claude Fable 5), for the hardest
//                 questions where a single top-tier answer beats a vote.
// Results are cache-keyed on (mode, tokens, models, system, question) so a
// repeated question never re-spends credits.

import {
  callClaude,
  callGemini,
  callOpenAI,
  type CouncilProvider,
  type ProviderCallAttachment,
  type ProviderCallResult,
} from "./providers.ts";

export type CouncilKeys = Partial<Record<CouncilProvider, string>>;

export type CouncilTier = "cheap" | "capable" | "frontier";

export type CouncilModels = Record<
  CouncilProvider,
  { cheap: string; capable: string; frontier?: string }
>;

export const DEFAULT_COUNCIL_MODELS: CouncilModels = {
  openai: { cheap: "gpt-4o-mini", capable: "gpt-4o" },
  gemini: { cheap: "gemini-2.0-flash", capable: "gemini-2.0-pro" },
  anthropic: {
    cheap: "claude-haiku-4-5-20251001",
    capable: "claude-sonnet-5",
    frontier: "claude-fable-5",
  },
};

export type CouncilMode = "quick" | "consensus" | "deep" | "frontier";

export type CouncilTask = {
  question: string;
  system?: string;
  mode?: CouncilMode;
  maxTokens?: number;
  /**
   * Documents for the model to read alongside the question.
   *
   * These are part of the cache identity (see cacheKeyFor). Two different
   * documents asked the same question must never share an answer — that would
   * report one provider's certificate as another's.
   */
  attachments?: readonly ProviderCallAttachment[];
};

export type CouncilAnswer = ProviderCallResult & { tier: CouncilTier };

export type CouncilResult = {
  mode: CouncilMode;
  answer: string;
  agreed: boolean | null;
  consulted: CouncilAnswer[];
  cached: boolean;
};

export type CouncilCache = {
  get(key: string): CouncilResult | undefined | Promise<CouncilResult | undefined>;
  set(key: string, value: CouncilResult): void | Promise<void>;
};

const DEFAULT_MAX_TOKENS = 400;
// Fable 5 always thinks before answering, and thinking tokens count against
// max_tokens — a tight cap risks truncating the visible reply after thinking
// spend. Billing is per token actually generated, so the high cap only costs
// what a given answer uses.
const FRONTIER_MAX_TOKENS = 16000;
const AGREEMENT_THRESHOLD = 0.28;
const PROVIDER_ORDER: CouncilProvider[] = ["anthropic", "openai", "gemini"];

function jaccardSimilarity(a: string, b: string) {
  const tokenize = (value: string) => new Set(value.toLowerCase().match(/[a-z0-9]+/g) ?? []);
  const setA = tokenize(a);
  const setB = tokenize(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const token of setA) if (setB.has(token)) intersection += 1;
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function cacheKeyFor(task: CouncilTask, models: CouncilModels) {
  const mode = task.mode ?? "quick";
  const maxTokens = task.maxTokens ?? DEFAULT_MAX_TOKENS;
  // Attachment bytes are hashed into the key. Leaving them out would let two
  // different documents asked the same question collide and return each
  // other's answer.
  const attachmentKey = task.attachments?.length
    ? await sha256Hex(task.attachments
      .map((attachment) => `${attachment.mediaType}:${attachment.data}`)
      .join("|"))
    : "";
  return sha256Hex(
    `${mode}::${maxTokens}::${JSON.stringify(models)}::${task.system ?? ""}::${attachmentKey}::${task.question}`,
  );
}

function callerFor(provider: CouncilProvider) {
  if (provider === "openai") return callOpenAI;
  if (provider === "gemini") return callGemini;
  return callClaude;
}

function availableProviders(keys: CouncilKeys): CouncilProvider[] {
  return PROVIDER_ORDER.filter((provider) => Boolean(keys[provider]));
}

function pickPrimary(providers: CouncilProvider[], question: string): CouncilProvider {
  let hash = 0;
  for (let index = 0; index < question.length; index += 1) {
    hash = (hash * 31 + question.charCodeAt(index)) >>> 0;
  }
  return providers[hash % providers.length];
}

function pickLongest(answers: CouncilAnswer[]) {
  return answers.reduce((best, current) => (current.text.length > best.text.length ? current : best));
}

async function callTier(
  provider: CouncilProvider,
  tier: CouncilTier,
  keys: CouncilKeys,
  models: CouncilModels,
  task: CouncilTask,
): Promise<CouncilAnswer> {
  const apiKey = keys[provider];
  if (!apiKey) throw new Error(`Missing API key for ${provider}.`);
  const model = models[provider][tier];
  if (!model) throw new Error(`No ${tier}-tier model is configured for ${provider}.`);
  const result = await callerFor(provider)({
    apiKey,
    model,
    system: task.system,
    prompt: task.question,
    maxTokens: task.maxTokens ?? DEFAULT_MAX_TOKENS,
    attachments: task.attachments,
  });
  return { ...result, tier };
}

async function runMode(
  mode: CouncilMode,
  keys: CouncilKeys,
  models: CouncilModels,
  task: CouncilTask,
): Promise<CouncilResult> {
  const providers = availableProviders(keys);
  if (providers.length === 0) throw new Error("No AI provider API keys are configured.");

  if (mode === "frontier") {
    const provider = providers.find((candidate) => models[candidate].frontier);
    if (!provider) {
      throw new Error(
        "Frontier mode needs a provider with a frontier-tier model and an API key (Anthropic by default).",
      );
    }
    const answer = await callTier(provider, "frontier", keys, models, {
      ...task,
      maxTokens: task.maxTokens ?? FRONTIER_MAX_TOKENS,
    });
    return { mode, answer: answer.text, agreed: null, consulted: [answer], cached: false };
  }

  if (mode === "quick" || providers.length < 2) {
    const provider = pickPrimary(providers, task.question);
    const answer = await callTier(provider, "cheap", keys, models, task);
    return { mode, answer: answer.text, agreed: null, consulted: [answer], cached: false };
  }

  if (mode === "deep") {
    const answers = await Promise.all(providers.map((provider) => callTier(provider, "cheap", keys, models, task)));
    const agreed = answers.every((answer) => jaccardSimilarity(answer.text, answers[0].text) >= AGREEMENT_THRESHOLD);
    return { mode, answer: pickLongest(answers).text, agreed, consulted: answers, cached: false };
  }

  // consensus: two cheap-tier opinions; only pay for a third, stronger model
  // when they actually disagree.
  const [first, second, ...rest] = providers;
  const [answerA, answerB] = await Promise.all([
    callTier(first, "cheap", keys, models, task),
    callTier(second, "cheap", keys, models, task),
  ]);
  const similarity = jaccardSimilarity(answerA.text, answerB.text);
  if (similarity >= AGREEMENT_THRESHOLD || rest.length === 0) {
    return {
      mode,
      answer: pickLongest([answerA, answerB]).text,
      agreed: similarity >= AGREEMENT_THRESHOLD,
      consulted: [answerA, answerB],
      cached: false,
    };
  }

  const tiebreaker = await callTier(rest[0], "capable", keys, models, task);
  return {
    mode,
    answer: tiebreaker.text,
    agreed: false,
    consulted: [answerA, answerB, tiebreaker],
    cached: false,
  };
}

export async function consult(
  keys: CouncilKeys,
  task: CouncilTask,
  options: { models?: CouncilModels; cache?: CouncilCache } = {},
): Promise<CouncilResult> {
  const models = options.models ?? DEFAULT_COUNCIL_MODELS;
  const mode = task.mode ?? "quick";
  const cacheKey = options.cache ? await cacheKeyFor(task, models) : null;

  if (options.cache && cacheKey) {
    const cached = await options.cache.get(cacheKey);
    if (cached) return { ...cached, cached: true };
  }

  const result = await runMode(mode, keys, models, task);

  if (options.cache && cacheKey) {
    await options.cache.set(cacheKey, result);
  }
  return result;
}
