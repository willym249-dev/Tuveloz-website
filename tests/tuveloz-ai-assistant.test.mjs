import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Tuveloz AI is served in-app at /ai instead of an external subdomain", async () => {
  const [page, homepage, postJob] = await Promise.all([
    source("app/ai/page.tsx"),
    source("app/page.tsx"),
    source("app/components/customer-lander.tsx"),
  ]);

  assert.match(page, /TuvelozAiAssistant/);
  assert.match(page, /title:\s*"Tuveloz AI"/);

  // Every "Tuveloz AI" call-to-action points at the in-app route, not the
  // old external host.
  for (const file of [homepage, postJob]) {
    assert.doesNotMatch(file, /ai\.tuveloz\.com/);
    assert.match(file, /href="\/ai"/);
  }
});

test("the assistant route wraps the GPT/Gemini/Claude council with launch guardrails", async () => {
  const route = await source("app/api/ai/route.ts");

  assert.match(route, /askCouncil/);
  assert.match(route, /councilConfigured/);
  assert.match(route, /CUSTOMER_JOB_POSTING_PAUSED/);
  assert.match(route, /mode:\s*"quick"/);

  // Hard product limits must be spelled out to the model.
  assert.match(route, /Do NOT diagnose/);
  assert.match(route, /Do NOT estimate, guarantee, or range any price/);
  assert.match(route, /Do NOT choose, rank, or recommend a specific provider/);
  assert.match(route, /Safety first/);

  // Fail closed when no provider keys are configured; never leak upstream errors.
  assert.match(route, /AI_UNCONFIGURED/);
  assert.match(route, /AI_UPSTREAM_ERROR/);
  assert.match(route, /cache-control["']?:\s*["']no-store/);
});

test("the assistant UI states it does not diagnose, quote, or choose a provider", async () => {
  const component = await source("app/components/tuveloz-ai-assistant.tsx");

  assert.match(component, /does not diagnose/i);
  assert.match(component, /guarantee pricing/i);
  assert.match(component, /choose a provider/i);
  assert.match(component, /Safety first/);
  assert.match(component, /call 911/);
  // It sends the active site language so replies come back bilingual.
  assert.match(component, /language/);
  assert.match(component, /fetch\("\/api\/ai"/);
});

test("Spanish speakers get translated Tuveloz AI page copy", async () => {
  // The dictionaries moved to lib/spanish-dictionary.ts so server-side code can
  // read them without pulling a "use client" component into the Worker bundle.
  const language = await source("lib/spanish-dictionary.ts");

  for (const phrase of [
    "Ask Tuveloz AI",
    "Ask us anything. In English or Spanish.",
    "Safety first.",
    "Describe what your vehicle is doing…",
    // Both audience choices and the source links are translated too, so the
    // policy guidance is not English-only the moment Spanish is switched on.
    "I need work done on my car",
    "I do car work",
    "Read it yourself:",
  ]) {
    assert.match(language, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});
