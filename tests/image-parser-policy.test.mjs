import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));
const policy = new URL("../scripts/image-parser-policy.mjs", import.meta.url).href;

function parseImage(buffer) {
  // A separate process bounds failures if the vulnerable parser regresses.
  return spawnSync(process.execPath, [
    "--import", policy, "--input-type=module", "-e",
    `import { imageSize } from "image-size";
     import { readFileSync } from "node:fs";
     try { console.log(JSON.stringify(imageSize(readFileSync(0)))); }
     catch (error) { console.error(error.message); process.exitCode = 2; }`,
  ], { cwd: root, input: buffer, encoding: "utf8", timeout: 5000, maxBuffer: 8192 });
}

test("build image parsing rejects the ICNS zero-length entry that can loop forever", () => {
  const image = Buffer.alloc(16);
  image.write("icns");
  image.writeUInt32BE(16, 4);
  image.write("ic08", 8);
  const result = parseImage(image);
  assert.equal(result.error, undefined, "parser must terminate within the time limit");
  assert.equal(result.status, 2, result.stderr);
  assert.match(result.stderr, /disabled file type: icns/);
});

test("build image parsing rejects HEIF and both JPEG XL formats before decoding", () => {
  const heif = Buffer.alloc(24);
  heif.writeUInt32BE(24, 0);
  heif.write("ftypheic", 4);
  const jxl = Buffer.alloc(28);
  jxl.writeUInt32BE(12, 0);
  jxl.write("JXL ", 4);
  jxl.writeUInt32BE(16, 12);
  jxl.write("ftypjxl ", 16);
  const stream = Buffer.alloc(24);
  stream[0] = 0xff;
  stream[1] = 0x0a;
  for (const [type, image] of [["heif", heif], ["jxl", jxl], ["jxl-stream", stream]]) {
    const result = parseImage(image);
    assert.equal(result.error, undefined, `${type} parser must terminate`);
    assert.equal(result.status, 2, result.stderr);
    assert.ok(result.stderr.includes(`disabled file type: ${type}`), result.stderr);
  }
});

test("build image parsing still reads the actual Tuveloz sharing image", () => {
  const result = parseImage(readFileSync(new URL("../public/og-image.png", import.meta.url)));
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
  const size = JSON.parse(result.stdout);
  assert.equal(size.type, "png");
  assert.ok(size.width > 0 && size.height > 0);
});
