#!/usr/bin/env node
// Relay status board for the Itemized Health triad.
//
// Any of the three agents runs this and gets the same answer: what is open,
// who owns it, what just became actionable, and whether anything in this
// directory violates the public-repo boundary. Read-only. Exits non-zero when
// a claim in queue.json is not true, so "delivered" cannot be asserted the way
// the nonces cannot be asserted -- it has to be checkable.
//
//   node triad_bridge/relay.mjs

import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = dirname(fileURLToPath(import.meta.url));
const QUEUE = join(DIR, "queue.json");
const OWNERS = ["owner", "claude", "codex", "zeo"];
const STATES = ["open", "in_progress", "delivered", "verified", "blocked"];
const RESOLVED = new Set(["delivered", "verified"]);

const problems = [];
const fail = (m) => problems.push(m);

function git(args) {
  try {
    return { ok: true, out: execFileSync("git", args, { cwd: DIR, encoding: "utf8" }) };
  } catch (e) {
    return { ok: false, out: String(e.stderr || e.message) };
  }
}

// ---------------------------------------------------------------- load queue
let queue;
try {
  queue = JSON.parse(readFileSync(QUEUE, "utf8"));
} catch (e) {
  console.error(`queue.json is unreadable: ${e.message}`);
  process.exit(2);
}

const tasks = queue.tasks ?? [];
const byId = new Map();
for (const t of tasks) {
  for (const f of ["id", "title", "owner", "state", "deliverable", "branch", "blocks", "why"]) {
    if (t[f] === undefined) fail(`${t.id ?? "(no id)"}: missing field "${f}"`);
  }
  if (byId.has(t.id)) fail(`${t.id}: duplicate id`);
  if (!OWNERS.includes(t.owner)) fail(`${t.id}: unknown owner "${t.owner}"`);
  if (!STATES.includes(t.state)) fail(`${t.id}: unknown state "${t.state}"`);
  byId.set(t.id, t);
}
for (const t of tasks) {
  for (const b of t.blocks ?? []) {
    if (!byId.has(b)) fail(`${t.id}: blocks unknown task "${b}"`);
  }
}

// blockers are the inverse of blocks: B depends on every A whose blocks lists B
const blockersOf = new Map(tasks.map((t) => [t.id, []]));
for (const t of tasks) {
  for (const b of t.blocks ?? []) blockersOf.get(b)?.push(t.id);
}
const unresolved = (id) =>
  blockersOf.get(id).filter((b) => !RESOLVED.has(byId.get(b).state));

// ------------------------------------------------- verify delivery claims
function existsOnBranch(branch, path) {
  if (!branch || branch === "none" || branch === "pending") return null;
  for (const ref of [`origin/${branch}`, branch]) {
    if (git(["cat-file", "-e", `${ref}:${path}`]).ok) return ref;
  }
  return git(["rev-parse", "--verify", `origin/${branch}`]).ok ? false : "no-branch";
}

for (const t of tasks) {
  if (!RESOLVED.has(t.state)) continue;
  if (t.deliverable === "pending" || !t.deliverable.includes("/")) continue;
  const found = existsOnBranch(t.branch, t.deliverable);
  if (found === false) fail(`${t.id}: claims "${t.state}" but ${t.deliverable} is not on ${t.branch}`);
  else if (found === "no-branch") fail(`${t.id}: claims "${t.state}" but branch ${t.branch} is not fetched -- run git fetch`);
}

// ------------------------------------------------- boundary scan, public repo
const PATTERNS = [
  [/\b\d{3}-\d{2}-\d{4}\b/, "social security number shape"],
  [/\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/, "phone number shape"],
  [/\b[\w.+-]+@[\w-]+\.[a-z]{2,}\b/i, "email address"],
  [/\b\d{1,6}\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:St|Ave|Rd|Ln|Dr|Ct|Blvd|Way|Ter)\b/, "street address shape"],
  [/\b(?:MRN|DOB|acct\.?\s*#|account\s*(?:no|number))\b/i, "record or account identifier"],
  [/\b(?:sk|pk)_(?:live|test)_[A-Za-z0-9]{8,}|ghp_[A-Za-z0-9]{20,}/, "credential shape"],
];
const ALLOW = new Set(["relay.mjs"]); // this file defines the patterns

let scanned = 0;
for (const name of readdirSync(DIR)) {
  const p = join(DIR, name);
  if (!statSync(p).isFile() || ALLOW.has(name)) continue;
  scanned++;
  const text = readFileSync(p, "utf8");
  text.split("\n").forEach((line, i) => {
    for (const [re, why] of PATTERNS) {
      if (re.test(line)) fail(`BOUNDARY ${name}:${i + 1}: ${why} in a public repository`);
    }
  });
}

// ------------------------------------------------------------------- report
const label = { open: "OPEN", in_progress: "WORKING", delivered: "DELIVERED", verified: "VERIFIED", blocked: "BLOCKED" };
console.log(`\nItemized Health relay  ·  boundary: ${queue.boundary}\n`);

const actionable = [];
for (const who of OWNERS) {
  const mine = tasks.filter((t) => t.owner === who);
  if (!mine.length) continue;
  console.log(`${who.toUpperCase()}`);
  for (const t of mine) {
    const waiting = unresolved(t.id);
    const ready = waiting.length === 0 && !RESOLVED.has(t.state);
    if (ready && t.state === "blocked") {
      console.log(`  ${label[t.state].padEnd(9)} ${t.id.padEnd(13)} ${t.title}`);
      console.log(`  ${"".padEnd(9)} ${"".padEnd(13)} -> nothing blocks this any more; it can start`);
      actionable.push(t);
      continue;
    }
    if (!ready && ["open", "in_progress"].includes(t.state)) {
      console.log(`  ${label[t.state].padEnd(9)} ${t.id.padEnd(13)} ${t.title}`);
      console.log(`  ${"".padEnd(9)} ${"".padEnd(13)} -> waiting on ${waiting.join(", ")}`);
      continue;
    }
    console.log(`  ${label[t.state].padEnd(9)} ${t.id.padEnd(13)} ${t.title}`);
    if (ready) actionable.push(t);
  }
  console.log("");
}

if (actionable.length) {
  console.log("Ready to start now:");
  for (const t of actionable) console.log(`  ${t.owner.padEnd(7)} ${t.id.padEnd(13)} ${t.title}`);
  console.log("");
}

const done = tasks.filter((t) => RESOLVED.has(t.state)).length;
console.log(`${tasks.length} tasks · ${done} resolved · ${actionable.length} ready · ${scanned} files scanned`);

if (problems.length) {
  console.log(`\n${problems.length} problem${problems.length === 1 ? "" : "s"}:`);
  for (const p of problems) console.log(`  ${p}`);
  console.log("\nVERDICT: FAIL");
  process.exit(1);
}
console.log("\nVERDICT: PASS");
