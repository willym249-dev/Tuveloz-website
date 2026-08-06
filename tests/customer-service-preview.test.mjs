import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// lib/provider-policy.ts loads the eligibility matrix the way the bundler does,
// so this suite reads the same matrix and module source directly rather than
// importing through it.
const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const matrix = JSON.parse(await source("config/provider-eligibility-matrix.json"));
const previewSource = await source("lib/customer-service-preview.ts");
const page = await source("app/post-job/page.tsx");

const labelledCodes = [...previewSource.matchAll(/^\s{2}([a-z0-9_]+):\s*\{$/gm)].map((m) => m[1]);

test("customers are shown services, and every one is a real policy service", () => {
  assert.ok(labelledCodes.length > 0, "the customer list should not be empty");
  for (const code of labelledCodes) {
    assert.ok(matrix.services[code], `${code} must exist in the eligibility matrix`);
  }
});

test("availability is read from the matrix and never asserted by the copy", () => {
  // The one place availability is decided. If this ever becomes a literal or a
  // hand-maintained flag, a service could be advertised as open while the
  // server still refuses it.
  assert.match(
    previewSource,
    /available:\s*service\.launchState === "enabled" && service\.customerVisible/,
  );
  assert.doesNotMatch(previewSource, /available:\s*true/);
});

test("a service the rules prohibit outright is never listed", () => {
  assert.match(previewSource, /launchState !== "prohibited_broad_category"/);
  for (const [code, service] of Object.entries(matrix.services)) {
    if (service.launch_state === "prohibited_broad_category") {
      assert.ok(!labelledCodes.includes(code), `${code} is prohibited and must not be offered`);
    }
  }
});

test("nothing is currently advertised as open, because nothing is enabled", () => {
  // A tripwire on the real configuration: if a service is enabled and made
  // customer-visible, this expectation should be updated deliberately rather
  // than discovered by a customer.
  const open = Object.entries(matrix.services)
    .filter(([, service]) => service.launch_state === "enabled" && service.customer_visible)
    .map(([code]) => code);
  assert.deepEqual(open, [], `these services are now live to customers: ${open.join(", ")}`);
});

test("the paused request page shows the list without offering to submit anything", () => {
  // JSX wraps prose across lines, so compare on collapsed whitespace.
  const paused = page
    .slice(0, page.indexOf("customerRequestAgreementHash()"))
    .replace(/\s+/g, " ");

  assert.match(paused, /customerServicePreview\(\)/);
  assert.match(paused, /What you&apos;ll be able to request/);

  // Seeing the catalogue must not read as a promise.
  assert.match(paused, /not a promise that it is available/);
  assert.match(paused, /Nothing on this page submits a request/);
});
