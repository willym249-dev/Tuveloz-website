import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the public header keeps the logo clear while help remains easy to find", async () => {
  const page = await readFile(
    new URL("../app/page.tsx", import.meta.url),
    "utf8",
  );

  const navigation = page.match(
    /<nav className=\{menuOpen[\s\S]*?<\/nav>/,
  )?.[0] ?? "";
  const helpButtons = page.match(/<Link className="button ai" href="\/ai">/g) ?? [];

  assert.match(page, /<Link className="brand"[\s\S]*?<BrandMark \/>[\s\S]*?<span>Tuveloz<\/span>/);
  // Help stays available without competing with the primary signup buttons.
  assert.doesNotMatch(navigation, /href="\/ai"/);
  assert.equal(helpButtons.length, 1);
  assert.match(page, /<Link className="text-link hero-text-link" href="\/ai">/);
});
