// Dev-workflow CLI: ask GPT, Gemini, and Claude a question together while
// spending as few credits as possible. Wraps lib/ai/council.ts and adds:
//   - an on-disk cache (.ai-council-cache.json, gitignored) so re-running
//     the same question never re-spends credits;
//   - a git-tracked decision log (ai-council-log.jsonl) that the three
//     models are shown before answering, so whichever one you ask stays
//     consistent with what the "team" already decided about this site;
//   - a short, fixed project brief plus the current branch/recent
//     commits/uncommitted files, so every question is auto-grounded in
//     "what's going on" without you having to re-explain it each time
//     (this is cheap: a few lines, not full diffs); and
//   - an opt-in --files flag to hand over specific file contents when a
//     question actually needs them (the only part that meaningfully adds
//     tokens, so it's off unless you ask for it).
//
// Usage:
//   node --experimental-strip-types scripts/ai-council.ts "should we cache quotes for 5 minutes or 30?"
//   node --experimental-strip-types scripts/ai-council.ts --mode deep "pick a name for the invoices tab"
//   node --experimental-strip-types scripts/ai-council.ts --mode consensus --system "You are a senior TypeScript reviewer." "..."
//   node --experimental-strip-types scripts/ai-council.ts --files lib/service-matching.ts,app/page.tsx "does this matching logic look right?"
//   node --experimental-strip-types scripts/ai-council.ts --no-git --no-log "quick one-off question, don't log or add project context"
//
// Reads keys from the environment, falling back to .env.local in the repo
// root: OPENAI_API_KEY, GEMINI_API_KEY, ANTHROPIC_API_KEY.

import { readFile, writeFile, appendFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import path from "node:path";
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
import {
  PROJECT_BRIEF,
  formatFileAppendix,
  formatGitContext,
  type FileExcerpt,
} from "../lib/ai/project-context.ts";

const execFileAsync = promisify(execFile);

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));
const ENV_LOCAL_PATH = path.join(REPO_ROOT, ".env.local");
const CACHE_PATH = path.join(REPO_ROOT, ".ai-council-cache.json");
const LOG_PATH = path.join(REPO_ROOT, "ai-council-log.jsonl");
const MAX_CACHE_ENTRIES = 200;
const LOG_CONTEXT_ENTRIES = 8;
const MAX_FILE_CHARS = 6000;
const MAX_GIT_STATUS_LINES = 20;

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

async function gatherGitContext(): Promise<string> {
  try {
    const [branch, log, status] = await Promise.all([
      execFileAsync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: REPO_ROOT }),
      execFileAsync("git", ["log", "-n", "8", "--pretty=format:%h %s"], { cwd: REPO_ROOT }),
      execFileAsync("git", ["status", "--short"], { cwd: REPO_ROOT }),
    ]);
    return formatGitContext({
      branch: branch.stdout.trim(),
      recentCommits: log.stdout.split("\n").filter(Boolean),
      changedFiles: status.stdout.split("\n").filter(Boolean).slice(0, MAX_GIT_STATUS_LINES),
    });
  } catch {
    return "";
  }
}

async function readFileExcerpts(relativePaths: string[]): Promise<FileExcerpt[]> {
  const excerpts: FileExcerpt[] = [];
  for (const relativePath of relativePaths) {
    const resolved = path.resolve(REPO_ROOT, relativePath);
    if (!resolved.startsWith(REPO_ROOT)) {
      console.error(`Skipping --files entry outside the repo: ${relativePath}`);
      continue;
    }
    try {
      const raw = await readFile(resolved, "utf8");
      const truncated = raw.length > MAX_FILE_CHARS;
      excerpts.push({
        path: relativePath,
        content: truncated ? raw.slice(0, MAX_FILE_CHARS) : raw,
        truncated,
      });
    } catch (error) {
      console.error(`Could not read ${relativePath}: ${error instanceof Error ? error.message : error}`);
    }
  }
  return excerpts;
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
    noGit: false,
    files: [] as string[],
  };
  const rest: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--mode") parsed.mode = argv[(index += 1)] as CouncilMode;
    else if (arg === "--system") parsed.system = argv[(index += 1)];
    else if (arg === "--max-tokens") parsed.maxTokens = Number(argv[(index += 1)]);
    else if (arg === "--no-cache") parsed.noCache = true;
    else if (arg === "--no-log") parsed.noLog = true;
    else if (arg === "--no-git") parsed.noGit = true;
    else if (arg === "--files") {
      parsed.files = argv[(index += 1)].split(",").map((entry) => entry.trim()).filter(Boolean);
    } else rest.push(arg);
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
      'Usage: ai-council.ts [--mode quick|consensus|deep] [--system "..."] [--files a.ts,b.ts] ' +
        '[--no-cache] [--no-log] [--no-git] "question"',
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

  const [priorDecisions, gitContext, fileExcerpts] = await Promise.all([
    args.noLog ? Promise.resolve([]) : loadDecisionLog(),
    args.noGit ? Promise.resolve("") : gatherGitContext(),
    readFileExcerpts(args.files),
  ]);
  const teamContext = summarizeForContext(priorDecisions, LOG_CONTEXT_ENTRIES);
  const fileAppendix = formatFileAppendix(fileExcerpts);
  const system = [PROJECT_BRIEF, gitContext, teamContext, fileAppendix, args.system]
    .filter(Boolean)
    .join("\n\n") || undefined;

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
