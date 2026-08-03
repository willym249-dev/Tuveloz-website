// Workers-runtime entry point for the GPT/Gemini/Claude council. Reads keys
// from environment secrets (`wrangler secret put OPENAI_API_KEY` etc.) and
// keeps an in-memory, per-isolate cache so repeated questions within the
// same isolate don't re-spend credits. See lib/ai/council.ts for the
// quick/consensus/deep routing this wraps.

import { env } from "cloudflare:workers";
import {
  consult,
  type CouncilCache,
  type CouncilKeys,
  type CouncilResult,
  type CouncilTask,
} from "./ai/council";

const CACHE_TTL_MS = 30 * 60 * 1000;
const memoryCache = new Map<string, { value: CouncilResult; expiresAt: number }>();

const runtimeCache: CouncilCache = {
  get(key) {
    const entry = memoryCache.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt < Date.now()) {
      memoryCache.delete(key);
      return undefined;
    }
    return entry.value;
  },
  set(key, value) {
    memoryCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  },
};

function optionalEnvText(key: string) {
  const runtime = env as unknown as Record<string, unknown>;
  const value = runtime[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function runtimeKeys(): CouncilKeys {
  return {
    openai: optionalEnvText("OPENAI_API_KEY"),
    gemini: optionalEnvText("GEMINI_API_KEY"),
    anthropic: optionalEnvText("ANTHROPIC_API_KEY"),
  };
}

export function councilConfigured() {
  const keys = runtimeKeys();
  return Boolean(keys.openai || keys.gemini || keys.anthropic);
}

export async function askCouncil(task: CouncilTask): Promise<CouncilResult> {
  return consult(runtimeKeys(), task, { cache: runtimeCache });
}
