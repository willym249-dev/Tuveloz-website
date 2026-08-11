// Checksum manifest and restore check for the private brand-video archive.
//
// The rendered ad video is deliberately out of git, so R2 is the only durable
// copy. "Upload succeeded" is not the same claim as "the bytes in R2 match the
// bytes on disk", and only the second one matters when restoring.
//
//   node scripts/r2-video-manifest.mjs write    build the manifest from disk
//   node scripts/r2-video-manifest.mjs verify   compare disk against the manifest
//   node scripts/r2-video-manifest.mjs restore  download a sample and checksum it
//
// `restore` is the one worth running periodically: it proves the archive can
// actually be read back, which a manifest alone never establishes.

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const BUCKET = "tuveloz-brand-video";
const PREFIX = "ads";
const MANIFEST = join(repoRoot, "brand", "ads", "R2-MANIFEST.json");
const wrangler = join(repoRoot, "node_modules", "wrangler", "bin", "wrangler.js");

// How many objects `restore` pulls back. Downloading all 57 on every check
// would be slow enough that nobody runs it, which is worse than sampling.
const RESTORE_SAMPLE = 3;

const sha256 = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");

const videoFiles = () => {
  const roots = [join(repoRoot, "brand", "ads")];
  const found = [];
  while (roots.length) {
    const dir = roots.pop();
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "_work" || entry.name === "_unzip") continue;
        roots.push(full);
      } else if (entry.name.endsWith(".mp4")) {
        found.push(full);
      }
    }
  }
  return found.sort();
};

const keyFor = (file) =>
  `${PREFIX}/${relative(join(repoRoot, "brand"), file).split("\\").join("/").replace(/^ads\//, "")}`;

const buildEntries = () => videoFiles().map((file) => ({
  key: keyFor(file),
  path: relative(repoRoot, file).split("\\").join("/"),
  bytes: statSync(file).size,
  sha256: sha256(file),
}));

const loadManifest = () => JSON.parse(readFileSync(MANIFEST, "utf8"));

const command = process.argv[2] ?? "verify";

if (command === "write") {
  const entries = buildEntries();
  writeFileSync(MANIFEST, `${JSON.stringify({
    bucket: BUCKET,
    note: "Private archive. Checksums of the local originals, for restore verification.",
    generatedFrom: "scripts/r2-video-manifest.mjs write",
    fileCount: entries.length,
    totalBytes: entries.reduce((sum, e) => sum + e.bytes, 0),
    entries,
  }, null, 2)}\n`);
  console.log(`wrote ${entries.length} entries (${(entries.reduce((s, e) => s + e.bytes, 0) / 1048576).toFixed(1)} MB) to ${relative(repoRoot, MANIFEST)}`);
} else if (command === "verify") {
  const manifest = loadManifest();
  const onDisk = new Map(buildEntries().map((e) => [e.key, e]));
  let drift = 0;
  for (const entry of manifest.entries) {
    const local = onDisk.get(entry.key);
    if (!local) { console.error(`MISSING locally: ${entry.key}`); drift++; continue; }
    if (local.sha256 !== entry.sha256) { console.error(`CHANGED: ${entry.key}`); drift++; }
    onDisk.delete(entry.key);
  }
  for (const key of onDisk.keys()) { console.error(`NOT IN MANIFEST: ${key}`); drift++; }
  console.log(drift === 0
    ? `ok — ${manifest.entries.length} files match the manifest`
    : `${drift} difference(s); run "write" if the change was intended`);
  process.exit(drift === 0 ? 0 : 1);
} else if (command === "restore") {
  const manifest = loadManifest();
  // Largest first: a truncated multipart upload shows up there, not in a 200KB
  // slate that fits in a single part.
  const sample = [...manifest.entries].sort((a, b) => b.bytes - a.bytes).slice(0, RESTORE_SAMPLE);
  const scratch = mkdtempSync(join(tmpdir(), "r2-restore-"));
  let failures = 0;
  try {
    for (const entry of sample) {
      const target = join(scratch, entry.key.split("/").pop());
      execFileSync("node", [wrangler, "r2", "object", "get", `${BUCKET}/${entry.key}`, "--file", target, "--remote"], { stdio: "pipe" });
      const actual = sha256(target);
      const ok = actual === entry.sha256 && statSync(target).size === entry.bytes;
      console.log(`${ok ? "ok  " : "FAIL"} ${entry.key} (${(entry.bytes / 1048576).toFixed(1)} MB)`);
      if (!ok) failures++;
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
  console.log(failures === 0
    ? `restore verified: ${sample.length} objects round-tripped byte-identical`
    : `${failures} object(s) did not match`);
  process.exit(failures === 0 ? 0 : 1);
} else {
  console.error(`unknown command "${command}" — use write, verify, or restore`);
  process.exit(2);
}
