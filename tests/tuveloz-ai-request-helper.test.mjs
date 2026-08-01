import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Tuveloz AI uses the server-side Responses API with structured draft output", async () => {
  const ai = await source("lib/tuveloz-ai.ts");

  assert.match(ai, /https:\/\/api\.openai\.com\/v1\/responses/);
  assert.match(ai, /authorization: `Bearer \$\{apiKey\}`/);
  assert.match(ai, /store: false/);
  assert.match(ai, /type: "json_schema"/);
  assert.match(ai, /strict: true/);
  assert.match(ai, /OPENAI_API_KEY/);
  assert.match(ai, /OPENAI_MODEL/);
  assert.match(ai, /TUVELOZ_AI_ENABLED/);
  assert.match(ai, /gpt-5-mini/);
  assert.doesNotMatch(ai, /sk-[A-Za-z0-9_-]{10,}/);
});

test("Tuveloz AI remains non-diagnostic and cannot perform marketplace actions", async () => {
  const [ai, route, page] = await Promise.all([
    source("lib/tuveloz-ai.ts"),
    source("app/api/admin/test-lab/ai-request-draft/route.ts"),
    source("app/admin/test-lab/ai/page.tsx"),
  ]);

  assert.match(ai, /Do not diagnose a vehicle/);
  assert.match(ai, /Do not add a provider-supplied parts charge/);
  assert.match(ai, /The customer must review and confirm every field/);
  assert.match(route, /isVerifiedOwnerRequest/);
  assert.match(route, /isSameOriginRequest/);
  assert.match(route, /databaseWrites: false/);
  assert.match(route, /jobSubmission: false/);
  assert.match(route, /providerContact: false/);
  assert.match(route, /payments: false/);
  assert.match(route, /repairDiagnosis: false/);
  assert.doesNotMatch(route, /getDb\(/);
  assert.doesNotMatch(route, /stripe/i);
  assert.doesNotMatch(route, /sendMarketplaceUpdateEmail/);

  assert.match(page, /OWNER-ONLY AI TESTING/);
  assert.match(page, /cannot diagnose the vehicle/);
  assert.match(page, /cannot.*submit a job/i);
  assert.match(page, /AI-GENERATED DRAFT — OWNER REVIEW REQUIRED/);
  assert.match(page, /No result is saved or submitted to the marketplace/);
  assert.doesNotMatch(page, /api\/requests/);
  assert.doesNotMatch(page, /api\/stripe/);
});

test("Tuveloz AI is off by default and the API key is documented as a secret", async () => {
  const [wrangler, environment, layout] = await Promise.all([
    source("wrangler.jsonc"),
    source(".env.example"),
    source("app/admin/test-lab/layout.tsx"),
  ]);

  assert.match(wrangler, /"TUVELOZ_AI_ENABLED": "false"/);
  assert.match(wrangler, /"OPENAI_MODEL": "gpt-5-mini"/);
  assert.doesNotMatch(wrangler, /OPENAI_API_KEY/);
  assert.match(environment, /wrangler secret put OPENAI_API_KEY/);
  assert.match(environment, /TUVELOZ_AI_ENABLED=false/);
  assert.match(environment, /OPENAI_MODEL=gpt-5-mini/);
  assert.match(layout, /href="\/admin\/test-lab\/ai"/);
  assert.match(layout, /Tuveloz AI Test/);
});
