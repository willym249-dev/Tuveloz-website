import assert from "node:assert/strict";
import test from "node:test";
import { readAccountReply, requestAccountResponse } from "../lib/account-response.ts";

test("malformed account replies cannot become visible messages or success flags", () => {
  for (const value of [null, [], "ok", { error: {} }, { message: [] }, { destination: 3 },
    { ok: "true" }, { challengeRequired: {} }, { phoneSignIn: 1 }, { role: "owner" }]) {
    assert.throws(() => readAccountReply(value));
  }
  assert.deepEqual(readAccountReply({ ok: false, error: "Please check your code." }),
    { ok: false, error: "Please check your code." });
});

test("account destinations stay on the site instead of accepting coerced or external values", () => {
  for (const destination of ["https://example.test/", "//example.test", "/\\example.test", "javascript:alert(1)", "/customer\n", "/customer\u0000"]) {
    assert.throws(() => readAccountReply({ destination }));
  }
  for (const destination of ["/customer", "/provider-onboarding", "/provider-jobs", "/privacy-center?view=provider"]) {
    assert.equal(readAccountReply({ destination }).destination, destination);
  }
});

test("account responses retain HTTP failures and valid passkey payloads", async t => {
  const options = { challenge: "local-fixture", rpId: "localhost", timeout: 60000 };
  t.mock.method(globalThis, "fetch", async () => Response.json({ options, message: "Choose a passkey." }));
  assert.deepEqual((await requestAccountResponse("/api/auth/passkeys/authenticate/options")).data.options, options);
  t.mock.method(globalThis, "fetch", async () => Response.json({ error: "Please wait before requesting another code." }, { status: 429 }));
  const limited = await requestAccountResponse("/api/auth/request-code", { method: "POST" });
  assert.equal(limited.status, 429);
  assert.equal(limited.ok, false);
  assert.equal(limited.data.error, "Please wait before requesting another code.");
});

test("the request deadline still applies after headers arrive and the body stalls", async t => {
  let receivedSignal;
  t.mock.method(globalThis, "fetch", async (_input, init) => {
    receivedSignal = init.signal;
    return { ok: true, status: 200, json: () => new Promise((_resolve, reject) => {
      init.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    }) };
  });
  await assert.rejects(requestAccountResponse("/api/account", {}, 5), { name: "AbortError" });
  assert.equal(receivedSignal.aborted, true);
});

test("leaving the account page cancels an outstanding session lookup", async t => {
  const parent = new AbortController();
  let started;
  const ready = new Promise(resolve => { started = resolve; });
  t.mock.method(globalThis, "fetch", async (_input, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    started();
  }));
  const request = requestAccountResponse("/api/account", { signal: parent.signal });
  const rejected = assert.rejects(request, { name: "AbortError" });
  await ready;
  parent.abort();
  await rejected;
});

test("a completed request releases its timeout and parent cancellation listener", async t => {
  const parent = new AbortController();
  let receivedSignal;
  t.mock.method(globalThis, "fetch", async (_input, init) => {
    receivedSignal = init.signal;
    return Response.json({ ok: true, challengeRequired: true });
  });
  const response = await requestAccountResponse("/api/auth/password", { signal: parent.signal }, 5);
  parent.abort();
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(response.data.challengeRequired, true);
  assert.equal(receivedSignal.aborted, false);
});
