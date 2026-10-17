import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";

test("privacy file availability checks are bounded, metadata-only and do not grant deletion", async t => {
  const repo = resolve(import.meta.dirname, ".."), scratch = mkdtempSync(join(tmpdir(), "tuveloz-file-head-"));
  let runtime;
  const row = (objectKey, recordId) => ({ source: "job_messages", field: "image_key", recordId, objectKey, otherReferences: 0 });
  const serialize = keys => JSON.stringify(keys.map((key, index) => row(key, `fixture-${index}`)));
  try {
    const bundle = join(scratch, "storage.cjs");
    await build({ absWorkingDir: repo, entryPoints: ["lib/privacy-file-storage.ts"], outfile: bundle,
      bundle: true, platform: "node", format: "cjs", logLevel: "silent" });
    const { checkPrivacyFileStorage: check } = createRequire(import.meta.url)(bundle);

    await t.test("exact keys and aliases get one read; null alone means missing; private metadata stays server-side", async () => {
      const calls = [];
      const keys = ["SECRET-Key", "SECRET-Key", " SECRET-Key ", "secret-key", "SECRET-error", "SECRET-malformed", "SECRET-wrong"];
      const result = await check(serialize(keys), { async head(key) {
        calls.push(key);
        if (key === " SECRET-Key ") return null;
        if (key === "SECRET-error") throw Error("SECRET storage failure");
        if (key === "SECRET-malformed") return undefined;
        return { key: key === "SECRET-wrong" ? "other" : key, version: "SECRET-version", size: 0,
          customMetadata: { owner: "SECRET-owner" }, etag: "SECRET-etag" };
      } });
      assert.deepEqual(calls.sort(), [...new Set(keys)].sort());
      assert.deepEqual(result.items.map(item => item.storage), ["found", "found", "missing", "found", "unavailable", "unavailable", "unavailable"]);
      assert.equal(result.storageChecked, false);
      assert.equal(result.canExecute, false); assert.equal(result.coverageComplete, false);
      assert.doesNotMatch(JSON.stringify(result), /SECRET|objectKey|customMetadata|etag|version/);
      assert.ok(Number.isFinite(Date.parse(result.storageCheck.finishedAt)));
    });

    await t.test("unavailable binding and malformed input cannot claim missing or read storage", async () => {
      for (const bucket of [undefined, {}]) {
        const result = await check(serialize(["SECRET"]), bucket);
        assert.equal(result.items[0].storage, "unavailable"); assert.equal(result.storageChecked, false);
      }
      let calls = 0;
      for (const input of [undefined, "{}", "[null]", JSON.stringify([row("SECRET", "a"), row("SECRET", "a")])]) {
        await assert.rejects(check(input, { async head() { calls++; return null; } }));
      }
      assert.equal(calls, 0);
      const empty = await check("[]", { async head() { throw Error("Must not read empty inventory"); } });
      assert.equal(empty.storageChecked, false); assert.equal(empty.coverageComplete, false);
    });

    await t.test("caps unique object reads and concurrent work; no sentinel read or false coverage", async () => {
      const calls = [], keys = Array.from({ length: 101 }, (_, i) => `SECRET-${i}`);
      let active = 0, peak = 0;
      const result = await check(serialize(keys), { async head(key) {
        calls.push(key); active++; peak = Math.max(peak, active);
        await new Promise(resolve => setTimeout(resolve, 1)); active--;
        return { key, version: "v1", size: 1 };
      } });
      assert.equal(calls.length, 20); assert.ok(peak <= 4);
      assert.equal(result.items.length, 100); assert.equal(result.truncated, true);
      assert.equal(result.items.filter(item => item.storage === "found").length, 20);
      assert.equal(result.items.filter(item => item.storage === "not-checked").length, 80);
      assert.equal(result.storageChecked, false);
    });

    await t.test("stalled storage returns uncertainty within the deadline and starts no further reads", async () => {
      let calls = 0;
      const start = Date.now();
      const result = await check(serialize(Array.from({ length: 10 }, (_, i) => `SECRET-${i}`)), {
        head() { calls++; return new Promise(() => {}); },
      });
      assert.ok(Date.now() - start < 6000); assert.equal(calls, 4);
      assert.ok(result.items.every(item => item.storage === "unavailable"));
      assert.equal(result.storageChecked, false);
    });

    await t.test("actual local R2 HEAD distinguishes present and absent without reading or removing contents", async () => {
      const compiled = await build({ absWorkingDir: repo, stdin: { resolveDir: repo, loader: "ts", contents: `
        import { checkPrivacyFileStorage } from './lib/privacy-file-storage';
        export default { async fetch(request, env) {
          return Response.json(await checkPrivacyFileStorage(await request.text(), { head: key => env.BUCKET.head(key) }));
        } };
      ` }, write: false, bundle: true, format: "esm", platform: "browser", logLevel: "silent" });
      runtime = new Miniflare(convertV4MiniflareOptions({ modules: true, script: compiled.outputFiles[0].text,
        compatibilityDate: "2026-09-01", r2Buckets: ["BUCKET"] }));
      const bucket = await runtime.getR2Bucket("BUCKET");
      await bucket.put("SECRET-present", "SYNTHETIC FILE CONTENT");
      const response = await runtime.dispatchFetch("http://fixture.invalid/", { method: "POST", body: serialize(["SECRET-present", "SECRET-absent"]) });
      const result = await response.json();
      assert.deepEqual(result.items.map(item => item.storage), ["found", "missing"]);
      assert.equal(result.storageChecked, true); assert.equal(result.coverageComplete, false);
      assert.equal(await (await bucket.get("SECRET-present")).text(), "SYNTHETIC FILE CONTENT");
      assert.equal((await bucket.list()).objects.length, 1);
      assert.doesNotMatch(JSON.stringify(result), /SECRET|SYNTHETIC FILE CONTENT/);
    });
  } finally { await runtime?.dispose(); rmSync(scratch, { recursive: true, force: true }); }
});
