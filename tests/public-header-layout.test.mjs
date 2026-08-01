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
  const aiLinks = page.match(/href="https:\/\/ai\.tuveloz\.com\/"/g) ?? [];

  assert.match(page, /<Link className="brand"[\s\S]*?<BrandMark \/>[\s\S]*?<span>Tuveloz<\/span>/);
  assert.doesNotMatch(navigation, /ai\.tuveloz\.com/);
  assert.equal(aiLinks.length, 3);
});
