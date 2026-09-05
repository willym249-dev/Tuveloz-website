import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

let moduleId = 0;
async function loadRoute({ configured = false, upstreamFails = false } = {}) {
  const stub = `export const calls = []; export const councilConfigured = () => ${configured};
    export async function askCouncil(task) { calls.push(task); ${upstreamFails
      ? 'const error = new Error("private upstream failure"); error.stack = ""; throw error;'
      : 'return {answer:"Describe the sound and when it happens. This is guidance only, not a diagnosis.",consulted:[],cached:false};'} }
    // ${moduleId++}`;
  const councilUrl = `data:text/javascript,${encodeURIComponent(stub)}`;
  const replacements = {
    "../../../lib/ai-council-runtime": councilUrl,
    "../../../lib/launch-status": "data:text/javascript,export const CUSTOMER_JOB_POSTING_PAUSED = true;",
    "../../../lib/ai/assistant-telemetry": "data:text/javascript,export async function recordAssistantAnswer() {}",
    "../../../lib/ai/policy-knowledge": new URL("../lib/ai/policy-knowledge.ts", import.meta.url).href,
  };
  let source = await readFile(new URL("../app/api/ai/route.ts", import.meta.url), "utf8");
  for (const [from, to] of Object.entries(replacements)) source = source.replaceAll(`"${from}"`, JSON.stringify(to));
  const route = await import(`data:text/javascript,${encodeURIComponent(stripTypeScriptTypes(source))}`);
  return { ...route, calls: (await import(councilUrl)).calls };
}
const request = (message, language = "en", audience = "customer") => new Request("https://tuveloz.invalid/api/ai", {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message, language, audience }),
});

test("published fee and parts answers work without an AI key and retain launch status", async () => {
  const route = await loadRoute();
  for (const audience of ["customer", "provider"]) {
    const response = await route.POST(request("What does Tuveloz charge me and who buys the parts?", "en", audience));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const data = await response.json();
    assert.equal(data.mode, "policy-guide");
    assert.match(data.reply, /5%/);
    assert.match(data.reply, /review/);
    assert.match(data.reply, /not open yet/i);
    assert.match(data.reply, /customer.*purchase|purchase.*separately/i);
    assert.ok(data.sources.some(source => source.href === "/payments"));
  }
  assert.equal(route.calls.length, 0);
});

test("Spanish policy questions receive Spanish answers without AI", async () => {
  const route = await loadRoute();
  const response = await route.POST(request("¿Cuánto cobra Tuveloz y quién compra las piezas?", "es"));
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.match(data.reply, /5%/);
  assert.match(data.reply, /revisión/);
  assert.match(data.reply, /piezas/);
  assert.doesNotMatch(data.reply, /The pro|You do\.|Customer jobs/);
});

test("policy answers do not depend on an upstream AI provider", async () => {
  const route = await loadRoute({ configured: true, upstreamFails: true });
  const response = await route.POST(request("Who buys the parts?"));
  assert.equal(response.status, 200);
  assert.equal(route.calls.length, 0);
});

test("unconfigured vehicle guidance fails honestly and in the requested language", async () => {
  const route = await loadRoute();
  const response = await route.POST(request("Hay un ruido en el motor", "es"));
  assert.equal(response.status, 503);
  const data = await response.json();
  assert.equal(data.code, "AI_UNCONFIGURED");
  assert.match(data.error, /disponible/);
  assert.equal(route.calls.length, 0);
});

test("configured vehicle guidance still calls the AI provider", async () => {
  const route = await loadRoute({ configured: true });
  const response = await route.POST(request("a warning light came on this morning"));
  assert.equal(response.status, 200);
  assert.equal(route.calls.length, 1);
});

test("upstream failures never expose private provider errors", async () => {
  const route = await loadRoute({ configured: true, upstreamFails: true });
  const response = await route.POST(request("a warning light came on this morning"));
  assert.equal(response.status, 502);
  const data = await response.json();
  assert.equal(data.code, "AI_UPSTREAM_ERROR");
  assert.doesNotMatch(JSON.stringify(data), /private upstream failure/);
});

test("availability reports policy-guide mode without claiming generated AI is online", async () => {
  const route = await loadRoute();
  assert.equal(typeof route.GET, "function");
  const response = await route.GET();
  assert.deepEqual(await response.json(), { mode: "policy-guide" });
});

test("ordinary short policy questions are covered in both languages", async () => {
  const route = await loadRoute();
  for (const [question, audience, language, expected] of [
    ["How much is the fee?", "customer", "en", /5%/],
    ["How do I apply?", "provider", "en", /\/join/],
    ["What documents are required?", "provider", "en", /competency checks/],
    ["¿Cómo puedo aplicar?", "provider", "es", /\/join/],
    ["¿Hay exclusividad?", "provider", "es", /no exige exclusividad/],
    ["What about refunds?", "customer", "en", /under review/],
  ]) {
    const response = await route.POST(request(question, language, audience));
    assert.equal(response.status, 200, question);
    assert.match((await response.json()).reply, expected, question);
  }
});
