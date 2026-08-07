import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

/**
 * Every party that receives personal information is named in section 5 of the
 * Privacy Policy. Tuveloz AI sends what a customer types to a model provider,
 * so those providers belong in that list — this pins the disclosure to the
 * code that actually makes the call.
 */

test("every model provider the code can call is named in the privacy policy", async () => {
  const runtime = await source("lib/ai-council-runtime.ts");
  const privacy = await source("app/privacy/page.tsx");

  // The runtime reads one key per provider. Each must be disclosed by name.
  const keys = [...runtime.matchAll(/optionalEnvText\("([A-Z_]+)_API_KEY"\)/g)]
    .map((match) => match[1]);
  assert.deepEqual([...keys].sort(), ["ANTHROPIC", "GEMINI", "OPENAI"]);

  const section = privacy.slice(
    privacy.indexOf("5. Service providers and other disclosures"),
    privacy.indexOf("6. No sale"),
  );
  for (const vendor of ["OpenAI", "Google", "Anthropic"]) {
    assert.ok(section.includes(vendor), `${vendor} is not disclosed in section 5`);
  }
});

test("the disclosure states the scope of what is sent, both ways", async () => {
  const privacy = await source("app/privacy/page.tsx");

  // Customer side: only what they type, and only if they use the assistant.
  assert.match(privacy, /What you type into it/);
  assert.match(privacy, /if you never open it, nothing goes to them from you/);
  // Provider side: evidence documents, and explicitly never customer data.
  assert.match(privacy, /provider evidence only, never to a customer&apos;s information/);
  // And that reading is not deciding.
  assert.match(privacy, /never decides whether a document is accepted/);
});

test("the no-automated-decisions section stays true now that AI reads applications", async () => {
  const privacy = await source("app/privacy/page.tsx");
  const assistant = await source("lib/evidence-review-assistant.ts");

  // The policy claims a person makes every approve/reject/limit decision.
  assert.match(privacy, /a person makes every decision that\s*\n?\s*approves, rejects, or limits a provider/);
  // The only self-completing step named is the re-upload request.
  assert.match(privacy, /expired or undated/);

  // And the code keeps that claim true: the sole auto-applied outcome is a
  // correction request, never an acceptance or a rejection.
  assert.match(assistant, /status: "needs_correction"/);
  assert.doesNotMatch(assistant, /status: "accepted"/);
  assert.doesNotMatch(assistant, /status: "rejected"/);
});
