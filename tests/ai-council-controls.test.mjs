import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";
import {
  cacheKeyFor,
  consult,
  DEFAULT_COUNCIL_MODELS,
} from "../lib/ai/council.ts";

const execFileAsync = promisify(execFile);
const repoRoot = fileURLToPath(new URL("..", import.meta.url));

test("AI council defaults use current model IDs and keep project state private", async () => {
  assert.deepEqual(DEFAULT_COUNCIL_MODELS.openai, {
    cheap: "gpt-6-luna",
    capable: "gpt-6-sol",
    frontier: "gpt-6-astra",
  });
  assert.deepEqual(DEFAULT_COUNCIL_MODELS.gemini, {
    cheap: "gemini-3.5-flash-lite",
    capable: "gemini-3.8-flash",
    frontier: "gemini-3.1-pro-preview",
  });
  assert.equal(DEFAULT_COUNCIL_MODELS.anthropic.cheap, "claude-haiku-4-5-20251001");
  assert.equal(DEFAULT_COUNCIL_MODELS.anthropic.capable, "claude-sonnet-5");
  assert.equal(DEFAULT_COUNCIL_MODELS.anthropic.frontier, "claude-fable-5");

  const [ignore, decisionLog, projectContext] = await Promise.all([
    readFile(new URL("../.gitignore", import.meta.url), "utf8"),
    readFile(new URL("../lib/ai/decision-log.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/ai/project-context.ts", import.meta.url), "utf8"),
  ]);
  assert.match(ignore, /^\/\.ai-council-log\.jsonl$/m);
  assert.match(ignore, /^\/\.ai-council-workspace\/$/m);
  assert.match(decisionLog, /private local record/i);
  assert.match(projectContext, /vehicle-services marketplace/);
  assert.match(projectContext, /customer job requests, bookings, and live payments remain closed/);
});

test("AI council cache identity includes provider availability and call cap", async () => {
  const base = { question: "same question", mode: "consensus" };
  const oneProvider = await cacheKeyFor(base, DEFAULT_COUNCIL_MODELS, ["openai"]);
  const twoProviders = await cacheKeyFor(base, DEFAULT_COUNCIL_MODELS, ["openai", "gemini"]);
  const twoCallCap = await cacheKeyFor(
    { ...base, maxProviderCalls: 2 },
    DEFAULT_COUNCIL_MODELS,
    ["openai", "gemini", "anthropic"],
  );
  const threeCallCap = await cacheKeyFor(
    { ...base, maxProviderCalls: 3 },
    DEFAULT_COUNCIL_MODELS,
    ["openai", "gemini", "anthropic"],
  );
  assert.notEqual(oneProvider, twoProviders);
  assert.notEqual(twoCallCap, threeCallCap);
});

test("consensus call cap prevents an automatic third provider request", async (t) => {
  const called = [];
  t.mock.method(globalThis, "fetch", async (input) => {
    const url = String(input);
    called.push(url);
    if (url.includes("anthropic.com")) {
      return Response.json({ content: [{ text: "Check brakes first." }] });
    }
    if (url.includes("openai.com")) {
      return Response.json({ choices: [{ message: { content: "Compare the written estimate." } }] });
    }
    throw new Error(`Unexpected provider request: ${url}`);
  });

  const result = await consult(
    { anthropic: "test", openai: "test", gemini: "test" },
    {
      question: "Which review should happen first?",
      mode: "consensus",
      maxProviderCalls: 2,
      maxTokens: 100,
    },
  );
  assert.equal(called.length, 2);
  assert.equal(result.consulted.length, 2);
  assert.equal(result.agreed, false);
  assert.ok(called.every((url) => !url.includes("googleapis.com")));
});

test("invalid consensus and token budgets fail before any provider request", async (t) => {
  const fetchMock = t.mock.method(globalThis, "fetch", async () => {
    throw new Error("fetch should not run");
  });
  const keys = { anthropic: "test", openai: "test", gemini: "test" };
  await assert.rejects(
    consult(keys, { question: "question", mode: "consensus", maxProviderCalls: 1 }),
    /at least 2/,
  );
  await assert.rejects(
    consult(keys, { question: "question", mode: "quick", maxTokens: 16001 }),
    /maxTokens must be an integer from 1 to 16000/,
  );
  assert.equal(fetchMock.mock.callCount(), 0);
});

test("CLI is preview-only unless --run is explicit", async () => {
  const { stdout, stderr } = await execFileAsync(
    process.execPath,
    [
      "--experimental-strip-types",
      fileURLToPath(new URL("../scripts/ai-council.ts", import.meta.url)),
      "Review this wording",
    ],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        OPENAI_API_KEY: "",
        GEMINI_API_KEY: "",
        ANTHROPIC_API_KEY: "",
        NODE_NO_WARNINGS: "1",
      },
    },
  );
  assert.equal(stderr, "");
  assert.match(stdout, /PREVIEW ONLY/);
  assert.match(stdout, /no provider API call was made/i);
  assert.match(stdout, /Add --run only when you want to make the listed API calls/);
});

test("CLI rejects unknown options and missing values before any provider call", async () => {
  const command = fileURLToPath(new URL("../scripts/ai-council.ts", import.meta.url));
  const options = {
    cwd: repoRoot,
    env: {
      ...process.env,
      OPENAI_API_KEY: "",
      GEMINI_API_KEY: "",
      ANTHROPIC_API_KEY: "",
      NODE_NO_WARNINGS: "1",
    },
  };
  await assert.rejects(
    execFileAsync(process.execPath, ["--experimental-strip-types", command, "--send", "question"], options),
    (error) => /Unknown option: --send/.test(error.stderr),
  );
  await assert.rejects(
    execFileAsync(process.execPath, ["--experimental-strip-types", command, "--files"], options),
    (error) => /--files requires a value/.test(error.stderr),
  );
});
