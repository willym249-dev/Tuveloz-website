/**
 * Saves something worth remembering to docs/company-notes.md.
 *
 * That file is fed to every `npm run ai` question in full, so a note written
 * here shapes future answers instead of being re-explained each time. It is
 * plain markdown and git-tracked, so a note is reviewable like any other
 * change — and editing the file by hand is equally fine.
 *
 * Usage from the repo root:
 *   npm run note -- "flyers at the Wheaton parts counter out-convert Rockville"
 *   npm run note -- --section "Ideas worth trying" "run the reels in Spanish first"
 *
 * The `--` matters: without it npm keeps the arguments for itself.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_NOTES_SECTION, appendNote } from "../lib/ai/company-notes.ts";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));
const NOTES_PATH = path.join(REPO_ROOT, "docs", "company-notes.md");

const argv = process.argv.slice(2);
let section = DEFAULT_NOTES_SECTION;
const words = [];
for (let index = 0; index < argv.length; index += 1) {
  if (argv[index] === "--section" || argv[index] === "-s") {
    section = argv[index + 1] ?? "";
    index += 1;
    continue;
  }
  words.push(argv[index]);
}

// Quoting is easy to forget, so treat loose words as one note rather than
// saving only the first one.
const text = words.join(" ").trim();
if (!text) {
  console.error('Usage: npm run note -- [--section "Section name"] "the note"');
  process.exitCode = 1;
} else {
  let existing = "";
  try {
    existing = await readFile(NOTES_PATH, "utf8");
  } catch {
    console.error(`Cannot find ${path.relative(REPO_ROOT, NOTES_PATH)}.`);
    process.exitCode = 1;
  }

  if (process.exitCode !== 1) {
    const date = new Date().toISOString().slice(0, 10);
    await writeFile(NOTES_PATH, appendNote(existing, { section, text, date }), "utf8");
    console.log(`Saved to ${path.relative(REPO_ROOT, NOTES_PATH)} under "${section}":`);
    console.log(`  - **${date}** — ${text}`);
  }
}
