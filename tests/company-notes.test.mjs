import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  DEFAULT_NOTES_SECTION,
  MAX_NOTES_CHARS,
  appendNote,
  formatNotesForContext,
} from "../lib/ai/company-notes.ts";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

const FILE = ["# Company notes", "", "## How we measure success", "", "Four stages.", "", "## Notes", ""].join("\n");

test("a note lands in the section it was addressed to", () => {
  const next = appendNote(FILE, { section: "Notes", text: "flyers beat DMs", date: "2026-08-06" });
  assert.match(next, /## Notes\n- \*\*2026-08-06\*\* — flyers beat DMs/);
  // The other section is untouched.
  assert.match(next, /## How we measure success\n\nFour stages\./);
});

test("notes accumulate in the order they were decided", () => {
  let file = appendNote(FILE, { section: "Notes", text: "first", date: "2026-08-01" });
  file = appendNote(file, { section: "Notes", text: "second", date: "2026-08-06" });
  // Oldest first: reading them in order keeps the reasoning intact instead of
  // burying the founding ones under whatever was learned yesterday.
  assert.ok(file.indexOf("first") < file.indexOf("second"));
  assert.equal(file.match(/^- \*\*/gm).length, 2);
});

test("a note for a section that does not exist yet creates it", () => {
  const next = appendNote(FILE, { section: "Ideas worth trying", text: "spanish first", date: "2026-08-06" });
  assert.match(next, /## Ideas worth trying\n\n- \*\*2026-08-06\*\* — spanish first/);
});

test("section matching ignores case and stray spacing", () => {
  const next = appendNote(FILE, { section: "  notes  ", text: "still lands", date: "2026-08-06" });
  // One "Notes" section, not two that drift apart.
  assert.equal(next.match(/^## Notes$/gm).length, 1);
  assert.match(next, /## Notes\n- \*\*2026-08-06\*\* — still lands/);
});

test("an empty note is refused rather than written as a blank line", () => {
  assert.throws(() => appendNote(FILE, { text: "   ", date: "2026-08-06" }), /needs some text/);
});

test("a multi-line note stays one bullet", () => {
  const next = appendNote(FILE, { text: "line one\n\n   line two", date: "2026-08-06" });
  assert.match(next, /- \*\*2026-08-06\*\* — line one line two/);
});

test("notes reach the models as standing context, not as a rolling window", () => {
  const context = formatNotesForContext("## How we measure success\n\nFour stages.");
  assert.match(context, /Standing notes for Tuveloz/);
  assert.match(context, /hold across sessions/);
  assert.match(context, /Four stages\./);
  assert.equal(formatNotesForContext("   "), "");
});

test("outgrowing the context budget is announced, never silent", () => {
  const huge = `## Notes\n\n${"x".repeat(MAX_NOTES_CHARS + 500)}`;
  const context = formatNotesForContext(huge);
  // A note that quietly stopped being sent is worse than no note: nobody would
  // know to re-add it.
  assert.match(context, /Notes truncated/);
  assert.match(context, /docs\/company-notes\.md/);
});

test("the council always sends the notes, and never ages them out", async () => {
  const council = await source("scripts/ai-council.ts");
  assert.match(council, /formatNotesForContext/);
  assert.match(council, /company-notes\.md/);
  // Sent in full alongside the fixed brief — not passed through the decision
  // log's last-N-entries window, which is what would make them forgettable.
  assert.match(council, /\[PROJECT_BRIEF, standingNotes, gitContext, teamContext/);
  assert.doesNotMatch(council, /summarizeForContext\(standingNotes/);
});

test("what the company decided to remember is actually written down", async () => {
  const notes = await source("docs/company-notes.md");
  for (const stage of ["Awareness", "Interest", "Consideration", "Decision"]) {
    assert.match(notes, new RegExp(stage));
  }
  assert.match(notes, /Creating content without a clear purpose/);
  assert.match(notes, /Focusing only on awareness content/);
  assert.match(notes, /Neglecting to connect different funnel stages/);
  assert.match(notes, /Not measuring content performance/);
  assert.match(notes, /Forgetting to include clear next steps/);
  // The phase rule every idea has to clear.
  assert.match(notes, /[Nn]ever imply customers can book or pay today/);
  assert.match(notes, new RegExp(`## ${DEFAULT_NOTES_SECTION}`));
});

test("saving a note is one documented command", async () => {
  const [pkg, script] = await Promise.all([
    source("package.json"),
    source("scripts/save-note.mjs"),
  ]);
  assert.match(pkg, /"note": "node --experimental-strip-types scripts\/save-note\.mjs"/);
  assert.match(script, /appendNote/);
  assert.match(script, /--section/);
  // Loose words are joined rather than saving only the first one.
  assert.match(script, /words\.join\(" "\)/);
});
