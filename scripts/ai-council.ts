// Dev-workflow CLI: ask GPT, Gemini, and Claude a question together while
// spending as few credits as possible. Wraps lib/ai/council.ts and adds:
//   - an on-disk cache (.ai-council-cache.json, gitignored) so re-running
//     the same question never re-spends credits, and
//   - a git-tracked decision log (ai-council-log.jsonl) that the three
//     models are shown before answering, so whichever one you ask stays
//     consistent with what the "team" already decided about this site.
//
// Usage:
//   node --experimental-strip-types scripts/ai-council.ts "should we cache quotes for 5 minutes or 30?"
//   node --experimental-strip-types scripts/ai-council.ts --mode deep "pick a name for the invoices tab"
//   node --experimental-strip-types scripts/ai-council.ts --mode consensus --system "You are a senior TypeScript reviewer." "..."
//
// Reads keys from the environment, falling back to .env.local in the repo
// root: OPENAI_API_KEY, GEMINI_API_KEY, ANTHROPIC_API_KEY.

import { readFile, writeFile, appendFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import process from "node:process";
import {
  consult,
  type CouncilCache,
  type CouncilKeys,
  type CouncilMode,
  type CouncilResult,
} from "../lib/ai/council.ts";
import {
  parseLogLines,
  serializeLogEntry,
  summarizeForContext,
  type DecisionLogEntry,
} from "../lib/ai/decision-log.ts";

const ENV_LOCAL_PATH = fileURLToPath(new URL("../.env.local", import.meta.url));
const CACHE_PATH = fileURLToPath(new URL("../.ai-council-cache.json", import.meta.url));
const LOG_PATH = fileURLToPath(new URL("../ai-council-log.jsonl", import.meta.url));
const MAX_CACHE_ENTRIES = 200;
const LOG_CONTEXT_ENTRIES = 8;

async function loadEnvFile(path: string) {
  let content: string;
  try {
    content = await readFile(path, "utf8");
  } catch {
    return;
  }
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (key && !(key in process.env)) process.env[key] = value;
  }
}

async function loadDiskCache(): Promise<Record<string, CouncilResult>> {
  try {
    return JSON.parse(await readFile(CACHE_PATH, "utf8"));
  } catch {
    return {};
  }
}

async function loadDecisionLog(): Promise<DecisionLogEntry[]> {
  try {
    return parseLogLines(await readFile(LOG_PATH, "utf8"));
  } catch {
    return [];
  }
}

async function appendDecisionLog(entry: DecisionLogEntry) {
  await appendFile(LOG_PATH, `${serializeLogEntry(entry)}\n`, "utf8");
}

function diskCache(store: Record<string, CouncilResult>): CouncilCache {
  return {
    get(key) {
      return store[key];
    },
    set(key, value) {
      store[key] = value;
      const keys = Object.keys(store);
      if (keys.length > MAX_CACHE_ENTRIES) delete store[keys[0]];
    },
  };
}

function parseArgs(argv: string[]) {
  const parsed = {
    mode: "quick" as CouncilMode,
    system: undefined as string | undefined,
    maxTokens: undefined as number | undefined,
    noCache: false,
    noLog: false,
  };
  const rest: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--mode") parsed.mode = argv[(index += 1)] as CouncilMode;
    else if (arg === "--system") parsed.system = argv[(index += 1)];
    else if (arg === "--max-tokens") parsed.maxTokens = Number(argv[(index += 1)]);
    else if (arg === "--no-cache") parsed.noCache = true;
    else if (arg === "--no-log") parsed.noLog = true;
    else rest.push(arg);
  }
  return { ...parsed, question: rest.join(" ") };
}

function readKeys(): CouncilKeys {
  return {
    openai: process.env.OPENAI_API_KEY,
    gemini: process.env.GEMINI_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
  };
}

function printResult(result: CouncilResult) {
  console.log(`\nmode: ${result.mode}${result.cached ? " (cached, no credits spent)" : ""}`);
  if (result.agreed !== null) {
    console.log(`agreement: ${result.agreed ? "models agreed" : "models disagreed, escalated"}`);
  }
  console.log(`consulted: ${result.consulted.map((a) => `${a.provider}/${a.tier}`).join(", ")}`);
  console.log(`\n${result.answer}\n`);
}

async function main() {
  await loadEnvFile(ENV_LOCAL_PATH);
  const args = parseArgs(process.argv.slice(2));
  if (!args.question) {
    console.error(
      'Usage: ai-council.ts [--mode quick|consensus|deep] [--system "..."] [--no-cache] [--no-log] "question"',
    );
    process.exitCode = 1;
    return;
  }

  const keys = readKeys();
  if (!keys.openai && !keys.gemini && !keys.anthropic) {
    console.error(
      "No API keys found. Set OPENAI_API_KEY, GEMINI_API_KEY, and/or ANTHROPIC_API_KEY " +
        "in your environment or in a .env.local file at the repo root.",
    );
    process.exitCode = 1;
    return;
  }

  const priorDecisions = args.noLog ? [] : await loadDecisionLog();
  const teamContext = summarizeForContext(priorDecisions, LOG_CONTEXT_ENTRIES);
  const system = [teamContext, args.system].filter(Boolean).join("\n\n") || undefined;

  const store = args.noCache ? {} : await loadDiskCache();
  const result = await consult(
    keys,
    { question: args.question, system, mode: args.mode, maxTokens: args.maxTokens },
    { cache: args.noCache ? undefined : diskCache(store) },
  );
  printResult(result);

  if (!args.noCache) {
    await writeFile(CACHE_PATH, JSON.stringify(store, null, 2), "utf8");
  }
  if (!args.noLog && !result.cached) {
    await appendDecisionLog({
      timestamp: new Date().toISOString(),
      mode: result.mode,
      question: args.question,
      consulted: result.consulted.map((answer) => `${answer.provider}/${answer.tier}`),
      agreed: result.agreed,
      answer: result.answer,
    });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
