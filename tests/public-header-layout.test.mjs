import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the public header keeps the logo clear while Tuveloz AI remains prominent", async () => {
  const page = await readFile(
    new URL("../app/page.tsx", import.meta.url),
    "utf8",
  );

  const navigation = page.match(
    /<nav className=\{menuOpen[\s\S]*?<\/nav>/,
  )?.[0] ?? "";
  const aiLinks = page.match(/href="\/ai"/g) ?? [];

  assert.match(page, /<Link className="brand"[\s\S]*?<BrandMark \/>[\s\S]*?<span>Tuveloz<\/span>/);
  // Tuveloz AI stays a prominent standalone call to action, not a buried nav link.
  assert.doesNotMatch(navigation, /href="\/ai"/);
  assert.equal(aiLinks.length, 3);
});
