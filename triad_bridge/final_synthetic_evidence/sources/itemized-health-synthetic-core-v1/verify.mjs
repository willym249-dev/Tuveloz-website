/** Fail-closed acceptance check for the synthetic core package. */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const EXPECTED_FILES = [
  "INTEGRITY.json",
  "README.md",
  "TRIAD_DECISION.md",
  "audit.mjs",
  "audit.test.mjs",
  "fixtures/01_all_rules.json",
  "fixtures/02_clean_control.json",
  "fixtures/03_boundaries_nearmiss.json",
  "fixtures/04_multiple_and_ordering.json",
  "fixtures/05_invalid_shape.json",
  "fixtures/06_invalid_semantics.json",
  "verify.mjs",
];
const EXPECTED_FIXTURES = EXPECTED_FILES.filter((path) => path.startsWith("fixtures/"));
const FORBIDDEN_IDENTITY_KEYS = new Set([
  "address", "beneficiary", "birthdate", "claimid", "claimnumber", "dob",
  "email", "firstname", "lastname", "memberid", "mrn", "name", "patient",
  "patientname", "phone", "policynumber", "subscriberid",
]);
const IDENTITY_PATTERNS = [
  ["email", /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i],
  ["phone", /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/],
  ["US SSN", /\b\d{3}-\d{2}-\d{4}\b/],
];

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

function digest(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function visitKeys(value, path, hits) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => visitKeys(item, `${path}/${index}`, hits));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, item] of Object.entries(value)) {
    const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (FORBIDDEN_IDENTITY_KEYS.has(normalized)) hits.push(`${path}/${key}`);
    visitKeys(item, `${path}/${key}`, hits);
  }
}

let failures = 0;
const fail = (message) => { failures += 1; console.log(`FAIL ${message}`); };
const actualFiles = walk(ROOT).map((path) => relative(ROOT, path).replaceAll("\\", "/")).sort();
if (JSON.stringify(actualFiles) !== JSON.stringify([...EXPECTED_FILES].sort())) {
  fail(`file set differs\n  expected ${JSON.stringify([...EXPECTED_FILES].sort())}\n  actual   ${JSON.stringify(actualFiles)}`);
}

let integrity = [];
try {
  integrity = JSON.parse(readFileSync(join(ROOT, "INTEGRITY.json"), "utf8")).files;
  if (!Array.isArray(integrity)) throw new Error("files is not an array");
} catch (error) {
  fail(`INTEGRITY.json is unreadable: ${error.message}`);
}
for (const entry of integrity) {
  const path = join(ROOT, entry.path);
  let actual;
  try { actual = digest(path); } catch { fail(`integrity target missing: ${entry.path}`); continue; }
  if (actual !== entry.sha256) fail(`hash mismatch: ${entry.path}`);
}
const hashedPaths = integrity.map(({ path }) => path).sort();
const requiredHashedPaths = EXPECTED_FILES.filter((path) => !["INTEGRITY.json", "verify.mjs"].includes(path)).sort();
if (JSON.stringify(hashedPaths) !== JSON.stringify(requiredHashedPaths)) fail("integrity path set differs");

const fixtureFiles = actualFiles.filter((path) => path.startsWith("fixtures/") && path.endsWith(".json"));
if (JSON.stringify(fixtureFiles) !== JSON.stringify(EXPECTED_FIXTURES)) fail("fixture set is not the exact six-case contract");
let identityHits = 0;
for (const fixture of fixtureFiles) {
  const raw = readFileSync(join(ROOT, fixture), "utf8");
  let parsed;
  try { parsed = JSON.parse(raw); } catch (error) { fail(`${fixture} is invalid JSON: ${error.message}`); continue; }
  if (!String(parsed._comment ?? "").toUpperCase().includes("SYNTHETIC")) fail(`${fixture} lacks a synthetic-data marker`);
  const keyHits = [];
  visitKeys(parsed, "", keyHits);
  for (const keyPath of keyHits) { identityHits += 1; fail(`${fixture} contains forbidden identity field ${keyPath}`); }
  for (const [label, pattern] of IDENTITY_PATTERNS) {
    if (pattern.test(raw)) { identityHits += 1; fail(`${fixture} contains ${label}-shaped text`); }
  }
}

const tests = spawnSync(process.execPath, ["--test", "audit.test.mjs"], {
  cwd: ROOT,
  encoding: "utf8",
  windowsHide: true,
  maxBuffer: 4 * 1024 * 1024,
});
if (tests.status !== 0) {
  fail("audit regression suite");
  if (tests.stdout) console.log(tests.stdout.trim());
  if (tests.stderr) console.log(tests.stderr.trim());
} else {
  console.log("AUDIT REGRESSION\n" + tests.stdout.trim());
}

const evidence = {
  node: process.version,
  platform: `${process.platform}-${process.arch}`,
  files: actualFiles.length,
  hashedPayloadFiles: integrity.length,
  fixtures: fixtureFiles.length,
  identityHits,
  auditRegression: tests.status === 0 ? "PASS" : "FAIL",
};
console.log(`\nEVIDENCE_JSON ${JSON.stringify(evidence)}`);
console.log(`VERDICT: ${failures === 0 ? "PASS" : `FAIL — ${failures}`}`);
process.exit(failures === 0 ? 0 : 1);
