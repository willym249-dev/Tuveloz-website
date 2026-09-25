import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const previewFile = new URL("../app/components/hero-marketplace-preview.tsx", import.meta.url);

test("hero preview names the provider and never presents fake jobs or prices", async () => {
  const source = await readFile(previewFile, "utf8");

  assert.match(source, /The provider/);
  assert.match(source, /What the provider plans to do and what it costs/);
  assert.match(source, /Hire one provider or decline every quote/);
  assert.match(source, /<InterfaceCopy><aside/);
  assert.doesNotMatch(source, /\bsomeone\b/i);

  for (const fakeDetail of ["JOB #4471", "PLANNED PICK", "$118", "$96", "Illustrative image"]) {
    assert.doesNotMatch(source, new RegExp(fakeDetail.replace("$", "\\$"), "i"));
  }
});

test("generated mechanic artwork is not shipped as a public asset", async () => {
  for (const asset of [
    "../public/tuveloz-mechanic-at-work-v1.avif",
    "../public/tuveloz-mechanic-at-work-v1.webp",
  ]) {
    await assert.rejects(access(new URL(asset, import.meta.url)));
  }
});

test("customer entry pages do not repeat the removed trust-card block", async () => {
  const [home, customerLander] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/customer-lander.tsx", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(home, /className="trust-section"/);
  assert.doesNotMatch(customerLander, /className="trust-section"/);
  assert.doesNotMatch(home, /Vehicle services in Montgomery County, MD/);
  assert.doesNotMatch(customerLander, /For car owners in Montgomery County, MD/);
});
