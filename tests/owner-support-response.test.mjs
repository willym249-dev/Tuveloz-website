import assert from "node:assert/strict";
import test from "node:test";
import { OwnerSupportError, ownerSupportProblemMessage, readOwnerSupportReceipt, requestOwnerSupport } from "../lib/owner-support-response.ts";

const requestId = "01234567-89ab-4cde-8fab-0123456789ab";
const receipt = { ok: true, status: "queued", reference: requestId };

test("only an affirmative receipt for the submitted message confirms owner contact", () => {
  assert.equal(readOwnerSupportReceipt(receipt, requestId), requestId);
  for (const value of [null, [], {}, { ...receipt, ok: false }, { ...receipt, ok: "true" },
    { status: "queued", reference: requestId }, { ...receipt, status: "sent" },
    { ...receipt, reference: {} }, { ...receipt, reference: [requestId] },
    { ...receipt, reference: "01234567-89ab-4cde-8fab-0123456789ac" },
    { ...receipt, error: "Not saved" }, { ...receipt, error: {} }]) {
    assert.equal(readOwnerSupportReceipt(value, requestId), null);
  }
  assert.equal(readOwnerSupportReceipt({ ...receipt, reference: "bad-id" }, "bad-id"), null);
});

test("network failures, malformed replies, and private upstream errors remain recovery guidance", async t => {
  for (const respond of [
    async () => { throw new Error("PRIVATE_NETWORK_DETAIL"); },
    async () => new Response("not JSON", { status: 502 }),
    async () => Response.json({ error: { private: "detail" } }, { status: 500 }),
    async () => Response.json({ error: "PRIVATE_ERROR" }, { status: 503 }),
  ]) {
    t.mock.method(globalThis, "fetch", respond);
    await assert.rejects(requestOwnerSupport({ requestId }, new AbortController().signal), error => {
      assert.ok(error instanceof OwnerSupportError);
      assert.equal(error.problem, "unconfirmed");
      for (const spanish of [false, true]) assert.doesNotMatch(ownerSupportProblemMessage(error.problem, spanish), /PRIVATE|detail|JSON/);
      return true;
    });
  }
});

test("the contact deadline also covers a stalled response body and never retries itself", async t => {
  let sends = 0;
  t.mock.method(globalThis, "fetch", async (_input, init) => {
    sends++;
    return { ok: true, status: 202, json: () => new Promise((_resolve, reject) => {
      init.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    }) };
  });
  await assert.rejects(requestOwnerSupport({ requestId }, new AbortController().signal, 5), { problem: "unconfirmed" });
  assert.equal(sends, 1);
});

test("leaving the help page cancels its request and completed requests release their timers", async t => {
  const parent = new AbortController();
  let started;
  const ready = new Promise(resolve => { started = resolve; });
  t.mock.method(globalThis, "fetch", async (_input, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    started();
  }));
  const pending = requestOwnerSupport({ requestId }, parent.signal);
  const rejected = assert.rejects(pending, { problem: "unconfirmed" });
  await ready;
  parent.abort();
  await rejected;
  const complete = new AbortController();
  let receivedSignal;
  t.mock.method(globalThis, "fetch", async (_input, init) => {
    receivedSignal = init.signal;
    return Response.json(receipt);
  });
  assert.equal(await requestOwnerSupport({ requestId }, complete.signal, 5), requestId);
  complete.abort();
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(receivedSignal.aborted, false);
});

test("contact validation, length, and rate-limit guidance is available in both languages", async t => {
  for (const [status, problem] of [[400, "validation"], [422, "validation"], [413, "too-long"], [429, "rate-limit"]]) {
    t.mock.method(globalThis, "fetch", async () => new Response("Temporary response", { status }));
    await assert.rejects(requestOwnerSupport({ requestId }, new AbortController().signal), { problem });
    assert.notEqual(ownerSupportProblemMessage(problem), ownerSupportProblemMessage(problem, true));
  }
});
