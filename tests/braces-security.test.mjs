import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, realpathSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const vendor = join(root, "vendor/braces");
const require = createRequire(join(root, "package.json"));
const braces = require("braces");
const read = path => JSON.parse(readFileSync(path, "utf8"));
const manifest = read(join(vendor, "patch-provenance.json"));
const sha = path => createHash("sha256").update(readFileSync(path, "utf8").replaceAll("\r\n", "\n")).digest("hex");

test("braces local patch retains its reviewed source, license and private provenance", () => {
  assert.equal(manifest.upstreamPatchCommit, "d0d575e55e74a4e0218e5248fafb79efc3e54ebb");
  assert.equal(manifest.upstreamVersion, "3.0.3");
  assert.match(readFileSync(join(vendor, "LICENSE"), "utf8"), /MIT License/);
  const actual = ["index.js", "LICENSE", "package.json", ...readdirSync(join(vendor, "lib")).map(name => `lib/${name}`)].sort();
  assert.deepEqual(Object.keys(manifest.files).sort(), actual);
  for (const [path, hashes] of Object.entries(manifest.files)) assert.equal(sha(join(vendor, path)), hashes.patchedSha256, path);
  const pkg = read(join(vendor, "package.json"));
  assert.equal(pkg.name, "@tuveloz/braces"); assert.equal(pkg.version, "3.0.3-tuveloz.1"); assert.equal(pkg.private, true);
  assert.equal(pkg.scripts, undefined); assert.equal(pkg.devDependencies, undefined);
});

test("every installed braces consumer resolves the pinned local patch", () => {
  const pkg = read(join(root, "package.json")), lock = read(join(root, "package-lock.json"));
  assert.equal(pkg.devDependencies.braces, "file:vendor/braces");
  assert.equal(pkg.overrides.braces, "$braces");
  assert.match(pkg.scripts["security:check"], /node --test tests\/braces-security\.test\.mjs && npm audit --audit-level=high$/);
  const target = realpathSync(join(vendor, "index.js"));
  assert.equal(realpathSync(require.resolve("braces")), target);
  let consumers = 0, copies = 0;
  for (const [path, entry] of Object.entries(lock.packages)) {
    if (path.endsWith("node_modules/braces")) {
      copies++;
      assert.equal(entry.link, true, `unreviewed braces copy: ${path}`);
      assert.equal(entry.resolved, "vendor/braces");
    }
    if (!entry.dependencies?.braces) continue;
    consumers++;
    const consumer = createRequire(join(root, path, "package.json"));
    assert.equal(realpathSync(consumer.resolve("braces")), target, path);
  }
  assert.ok(copies > 0 && consumers > 0, "the replacement must actually be in use");
  assert.equal(lock.packages["vendor/braces"].name, "@tuveloz/braces");
  assert.equal(lock.packages["vendor/braces"].version, "3.0.3-tuveloz.1");
});

test("deep brace and parenthesis patterns are rejected before stack exhaustion", () => {
  const patterns = ["{".repeat(101) + "a,b" + "}".repeat(101), "(".repeat(101) + "a" + ")".repeat(101),
    "{".repeat(4000) + "a,b" + "}".repeat(4000), "{".repeat(60) + "(".repeat(41) + "a" + ")".repeat(41) + "}".repeat(60)];
  for (const method of [braces, braces.parse, braces.compile, braces.expand, braces.stringify]) {
    for (const pattern of patterns) {
      for (const maxDepth of [undefined, 100, 10000, Infinity, NaN]) {
        assert.throws(() => method(pattern, { maxDepth }), /Input depth .* exceeds max depth \(100\)/);
      }
    }
  }
  assert.throws(() => braces(["{a,b}", patterns[0]]), /exceeds max depth/);
});

function ast(depth, type = "brace") {
  let node = { type: "text", value: "a" };
  for (let i = 0; i < depth; i++) node = { type, nodes: [node] };
  return { type: "root", nodes: [node] };
}

test("direct AST calls cannot bypass the depth bound", () => {
  for (const method of [braces.compile, braces.expand, braces.stringify]) {
    for (const type of ["brace", "paren"]) {
      for (const depth of [101, 4000]) {
        for (const options of [{}, { maxDepth: 10000 }, { maxDepth: Infinity }]) {
          assert.throws(() => method(ast(depth, type), options), /AST depth .* exceeds max depth \(100\)/);
        }
      }
    }
  }
});

test("normal patterns, escapes and allowed depth boundaries stay usable", () => {
  assert.deepEqual(braces.expand("src/{app,lib}/*.{ts,tsx}"), ["src/app/*.ts", "src/app/*.tsx", "src/lib/*.ts", "src/lib/*.tsx"]);
  assert.deepEqual(braces.expand("item-{01..03}"), ["item-01", "item-02", "item-03"]);
  assert.deepEqual(braces.expand("{a,{b,c}}"), ["a", "b", "c"]);
  assert.deepEqual(braces("{a,b}"), ["(a|b)"]);
  assert.deepEqual(braces.expand("\\{a,b\\}"), ["{a,b}"]);
  for (const method of [braces, braces.parse, braces.compile, braces.expand, braces.stringify]) {
    assert.doesNotThrow(() => method("{".repeat(100) + "a" + "}".repeat(100)));
    assert.throws(() => method("{{a,b},c}", { maxDepth: 1 }), /exceeds max depth/);
    assert.doesNotThrow(() => method("{{a,b},c}", { maxDepth: 2 }));
  }
});

test("build-tool consumers reject the payload and match ordinary source globs", () => {
  const micromatch = require("micromatch"), fastGlob = require("fast-glob");
  const malicious = "{".repeat(4000) + "a,b" + "}".repeat(4000);
  assert.throws(() => micromatch.braces(malicious), /exceeds max depth/);
  assert.throws(() => fastGlob.sync(malicious, { cwd: root }), /exceeds max depth/);
  assert.deepEqual(micromatch(["app/page.tsx", "lib/jobs.ts", "docs/guide.md"], "{app,lib}/**/*.{ts,tsx}"), ["app/page.tsx", "lib/jobs.ts"]);
  assert.deepEqual(fastGlob.sync("lib/{test-cancellation-decision,customer-fee}.ts", { cwd: root }).sort(), ["lib/customer-fee.ts", "lib/test-cancellation-decision.ts"]);
});
