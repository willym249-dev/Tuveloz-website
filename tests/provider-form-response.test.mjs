import assert from "node:assert/strict";
import test from "node:test";
import { providerFormFailure, readProviderFormReply, requestProviderForm } from "../lib/provider-form-response.ts";

test("provider application completion needs the expected affirmative receipt", () => {
  for (const value of [null, [], {}, { ok: false }, { ok: "true" }, { ok: true },
    { ok: true, onboardingUrl: {} }, { ok: true, onboardingUrl: "https://example.test/" },
    { ok: true, onboardingUrl: "/provider-onboarding", message: {} },
    { ok: true, onboardingUrl: "/provider-onboarding", error: "Not saved" }]) {
    assert.equal(readProviderFormReply(value, "application"), null);
  }
  assert.deepEqual(readProviderFormReply({ ok: true, onboardingUrl: "/provider-onboarding" }, "application"), { ok: true });
});

test("provider verification requires a valid challenge before advancing or replacing the old one", () => {
  for (const challengeId of [null, {}, [], 1, "", "   ", "code\n", "code\u0000", "a".repeat(257)]) {
    assert.equal(readProviderFormReply({ ok: true, challengeId }, "challenge"), null);
  }
  assert.equal(readProviderFormReply({ challengeId: "fixture" }, "challenge"), null);
  assert.equal(readProviderFormReply({ ok: false, challengeId: "fixture" }, "challenge"), null);
  assert.deepEqual(readProviderFormReply({ ok: true, challengeId: "fixture-code-1" }, "challenge"), { ok: true, challengeId: "fixture-code-1" });
});

test("malformed JSON, error objects, and network errors become bilingual recovery guidance", async t => {
  for (const stage of ["challenge", "application"]) for (const spanish of [false, true]) {
    const expected = providerFormFailure(stage, spanish);
    for (const respond of [
      async () => new Response("not JSON", { status: 502 }),
      async () => Response.json({ error: { internal: "detail" } }, { status: 500 }),
      async () => { throw new TypeError("Failed to fetch"); },
    ]) {
      t.mock.method(globalThis, "fetch", respond);
      await assert.rejects(requestProviderForm(stage, {}, new AbortController().signal, spanish), { message: expected });
    }
  }
});

test("stalled response bodies time out without confirming or resending the application", async t => {
  let requests = 0;
  t.mock.method(globalThis, "fetch", async (_input, init) => {
    requests++;
    return { ok: true, status: 202, json: () => new Promise((_resolve, reject) => {
      init.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    }) };
  });
  await assert.rejects(requestProviderForm("application", {}, new AbortController().signal, false, 5), {
    message: providerFormFailure("application"),
  });
  assert.equal(requests, 1);
});

test("leaving the form cancels pending requests and successful requests release listeners", async t => {
  const parent = new AbortController();
  let started;
  const ready = new Promise(resolve => { started = resolve; });
  t.mock.method(globalThis, "fetch", async (_input, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    started();
  }));
  const pending = requestProviderForm("challenge", {}, parent.signal);
  const rejected = assert.rejects(pending, { message: providerFormFailure("challenge") });
  await ready;
  parent.abort();
  await rejected;
  const completed = new AbortController();
  let receivedSignal;
  t.mock.method(globalThis, "fetch", async (_input, init) => {
    receivedSignal = init.signal;
    return Response.json({ ok: true, onboardingUrl: "/provider-onboarding" });
  });
  await requestProviderForm("application", {}, completed.signal, false, 5);
  completed.abort();
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(receivedSignal.aborted, false);
});

test("invalid codes and rate limits give useful guidance in both languages", async t => {
  for (const [status, en, es] of [
    [401, /code is invalid or expired/, /código no es válido o ya venció/],
    [429, /Please wait/, /Espere un poco/],
    [403, /reload the page/, /cargar la página/],
  ]) for (const spanish of [false, true]) {
    t.mock.method(globalThis, "fetch", async () => Response.json({ error: "Fixture response" }, { status }));
    await assert.rejects(requestProviderForm("application", {}, new AbortController().signal, spanish), spanish ? es : en);
  }
});
