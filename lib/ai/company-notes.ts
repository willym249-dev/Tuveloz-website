// The company's standing notes: things that stay true between sessions and
// should shape every answer, not just the next one.
//
// This exists because the decision log next door cannot do this job. That log
// is a rolling window — scripts/ai-council.ts shows the models only the last
// few entries — which is right for "what did we decide last week" and wrong
// for "how this company works". A principle written into a rolling log is
// forgotten a handful of questions later, silently, exactly when someone is
// relying on it being remembered.
//
// So these notes are always sent in full, and they are a plain markdown file
// a person can read and edit. Pure formatting/parsing only; reading and
// writing the file lives in scripts/, matching decision-log.ts.

/** Where a note lands when no section is named. */
export const DEFAULT_NOTES_SECTION = "Notes";

// Always-sent context has to stay affordable. If the notes ever outgrow this,
// truncation is announced rather than silent — a note that quietly stopped
// being sent is worse than no note, because nobody would know to re-add it.
export const MAX_NOTES_CHARS = 12000;

export function formatNotesForContext(markdown: string): string {
  const trimmed = markdown.trim();
  if (!trimmed) return "";
  const body = trimmed.length > MAX_NOTES_CHARS
    ? `${trimmed.slice(0, MAX_NOTES_CHARS)}\n\n[Notes truncated — docs/company-notes.md has grown past ` +
      `${MAX_NOTES_CHARS} characters. Split or prune it so nothing is silently dropped.]`
    : trimmed;
  return [
    "Standing notes for Tuveloz — how this company measures success and the " +
      "mistakes it has decided to avoid. These hold across sessions. Follow " +
      "them unless the question is explicitly asking to change one, and say so " +
      "plainly if a request conflicts with them:",
    body,
  ].join("\n\n");
}

function headingMatches(line: string, section: string) {
  return line.trim().toLowerCase() === `## ${section.trim().toLowerCase()}`;
}

/**
 * Add a note under a section, creating the section if it is new.
 *
 * Appends to the end of the section rather than the top: these are notes to
 * live by, and reading them in the order they were decided keeps the reasoning
 * intact instead of burying the founding ones.
 */
export function appendNote(
  markdown: string,
  entry: { section?: string; text: string; date: string },
): string {
  const section = (entry.section ?? DEFAULT_NOTES_SECTION).trim() || DEFAULT_NOTES_SECTION;
  const text = entry.text.trim().replace(/\s+/g, " ");
  if (!text) throw new Error("A note needs some text.");
  const line = `- **${entry.date}** — ${text}`;

  const lines = markdown.replace(/\s+$/, "").split("\n");
  const headingIndex = lines.findIndex((candidate) => headingMatches(candidate, section));
  if (headingIndex === -1) {
    return [...lines, "", `## ${section}`, "", line, ""].join("\n");
  }

  // Insert at the end of this section: scan to the next heading, then back up
  // over trailing blank lines so the note joins the list rather than floating
  // below it.
  let end = lines.length;
  for (let index = headingIndex + 1; index < lines.length; index += 1) {
    if (lines[index].startsWith("## ")) {
      end = index;
      break;
    }
  }
  while (end > headingIndex + 1 && lines[end - 1].trim() === "") end -= 1;

  return [...lines.slice(0, end), line, ...lines.slice(end), ""].join("\n");
}
