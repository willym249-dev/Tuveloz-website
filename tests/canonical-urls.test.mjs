import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

async function readIfPresent(path) {
  try {
    return await read(path);
  } catch {
    return "";
  }
}

/** Every path the sitemap lists by hand, plus the generated local pages. */
async function sitemapStaticPaths() {
  const source = await read("app/sitemap.ts");
  return [...source.matchAll(/\{ path: "([^"]+)"/g)].map((match) => match[1]);
}

test("every indexable page declares its own canonical URL", async () => {
  const paths = await sitemapStaticPaths();
  assert.ok(paths.length > 15, "the sitemap should still list the public pages");

  for (const path of paths) {
    if (path === "/") {
      // The homepage is a client component, so its canonical comes from the
      // root layout — which is also what any unlisted page inherits.
      assert.match(await read("app/layout.tsx"), /canonical: "\/"/);
      continue;
    }
    const directory = path.slice(1);
    const declared = [
      await readIfPresent(`app/${directory}/page.tsx`),
      await readIfPresent(`app/${directory}/layout.tsx`),
    ].join("\n");

    assert.match(
      declared,
      new RegExp(`canonical: "${path}"`),
      `${path} inherits the homepage canonical instead of declaring its own`,
    );
  }
});

test("dynamic public routes build a canonical from their own params", async () => {
  const routes = [
    ["app/service-areas/[area]/page.tsx", /canonical: areaPath\(/],
    ["app/services/[service]/page.tsx", /canonical: servicePath\(/],
    ["app/service-areas/[area]/[service]/page.tsx", /canonical: areaServicePath\(/],
  ];

  for (const [file, pattern] of routes) {
    assert.match(await read(file), pattern, `${file} has no per-page canonical`);
  }
});

test("a provider profile never inherits the directory's canonical", async () => {
  // app/providers/layout.tsx sets canonical "/providers" and would otherwise
  // apply to every profile beneath it, marking each one a duplicate.
  assert.match(await read("app/providers/layout.tsx"), /canonical: "\/providers"/);

  const profileLayout = await read("app/providers/[slug]/layout.tsx");
  assert.match(profileLayout, /generateMetadata/);
  assert.match(profileLayout, /canonical/);
  assert.match(profileLayout, /\/providers\/\$\{encodeURIComponent\(/);
  // Closed discovery means the crawler gets a "not public yet" shell.
  assert.match(profileLayout, /robots: \{ index: false, follow: false \}/);
  assert.match(profileLayout, /MARKETPLACE_MODE/);
});

test("released policy pages keep metadata out of the hashed page file", async () => {
  const manifest = JSON.parse(await read("config/policy-releases.json"));

  for (const [key, release] of Object.entries(manifest)) {
    if (release.releaseStatus !== "active") continue;
    assert.doesNotMatch(
      await read(release.sourceFile),
      /export const metadata/,
      `${key} puts metadata in ${release.sourceFile}, which is pinned to a reviewed hash`,
    );
    assert.match(
      await read(release.sourceFile.replace(/page\.tsx$/, "layout.tsx")),
      /export const metadata: Metadata = \{/,
      `${key} has no metadata layout beside its pinned page`,
    );
  }
});
