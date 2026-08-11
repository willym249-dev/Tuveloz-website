import assert from "node:assert/strict";
import test from "node:test";

import {
  resendEmailsUrl,
  resolveResendBaseUrl,
} from "../lib/resend-endpoint.ts";

test("transactional email stays on Resend except for explicit loopback development catchers", () => {
  assert.equal(resolveResendBaseUrl(undefined), "https://api.resend.com");
  assert.equal(resolveResendBaseUrl("http://localhost:3210"), "http://localhost:3210");
  assert.equal(resolveResendBaseUrl("http://127.0.0.1:3210"), "http://127.0.0.1:3210");
  assert.equal(resolveResendBaseUrl("http://[::1]:3210"), "http://[::1]:3210");
  assert.equal(resendEmailsUrl("http://127.0.0.1:3210"), "http://127.0.0.1:3210/emails");
});

test("non-loopback and malformed overrides cannot redirect transactional email", () => {
  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    assert.equal(resolveResendBaseUrl("https://example.com"), "https://api.resend.com");
    assert.equal(resolveResendBaseUrl("not a URL"), "https://api.resend.com");
  } finally {
    console.error = originalConsoleError;
  }
});
