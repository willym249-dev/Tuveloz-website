import { readFile, writeFile } from "node:fs/promises";
import process from "node:process";

// Reads the deadline tables in docs/OPEN-ITEMS.md and reports anything overdue
// or coming due. Run by .github/workflows/deadline-check.yml every Monday, and
// safe to run by hand: `node scripts/check-deadlines.mjs`.

const SOURCE_PATH = "docs/OPEN-ITEMS.md";
const REPORT_PATH = process.env.DEADLINE_REPORT_PATH || "deadline-report.md";
const WINDOW_DAYS = Number(process.env.DEADLINE_WINDOW_DAYS || "30");
const REPOSITORY = process.env.GITHUB_REPOSITORY || "willym249-dev/Tuveloz-website";
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 86_400_000;

function startOfTodayUtc() {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

// Table rows look like: | 2026-09-01 | Renew the policy | owner@example.com | open |
// Header, separator, and undated rows fail the date test and are skipped, which
// is why an item with no due date is never reported. An item cannot contain a
// pipe character.
function parseRows(markdown) {
  const dated = [];
  const malformed = [];

  for (const line of markdown.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) continue;

    const cells = trimmed.slice(1, -1).split("|").map((cell) => cell.trim());
    if (cells.length < 4) continue;

    const [due, item, owner, status] = cells;
    if (due === "—" || due === "-" || due === "Due" || due.startsWith("---")) continue;

    if (!ISO_DATE.test(due)) {
      malformed.push({ due, item, reason: "not written as YYYY-MM-DD" });
      continue;
    }

    const dueAt = Date.parse(`${due}T00:00:00Z`);
    if (Number.isNaN(dueAt)) {
      malformed.push({ due, item, reason: "not a real calendar date" });
      continue;
    }

    dated.push({ due, dueAt, item, owner, status: status.toLowerCase() });
  }

  return { dated, malformed };
}

function describeDays(days) {
  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue`;
  if (days === 0) return "due today";
  return `due in ${days} day${days === 1 ? "" : "s"}`;
}

function renderTable(rows) {
  const lines = ["| Due | Item | Owner | Status |", "| --- | --- | --- | --- |"];
  for (const row of rows) {
    lines.push(`| ${row.due} (${describeDays(row.days)}) | ${row.item} | ${row.owner} | ${row.status} |`);
  }
  return lines.join("\n");
}

const markdown = await readFile(SOURCE_PATH, "utf8").catch(() => null);
if (markdown === null) {
  console.error(`Could not read ${SOURCE_PATH}. Nothing to check.`);
  process.exit(0);
}

const { dated, malformed } = parseRows(markdown);
const today = startOfTodayUtc();

const active = dated
  .filter((row) => row.status !== "done")
  .map((row) => ({ ...row, days: Math.round((row.dueAt - today) / MS_PER_DAY) }))
  .sort((a, b) => a.days - b.days);

const overdue = active.filter((row) => row.days < 0);
const dueSoon = active.filter((row) => row.days >= 0 && row.days <= WINDOW_DAYS);
const needsAttention = overdue.length + dueSoon.length + malformed.length;

const sections = [];

if (overdue.length > 0) {
  sections.push(`## Overdue\n\n${renderTable(overdue)}`);
}

if (dueSoon.length > 0) {
  sections.push(`## Due within ${WINDOW_DAYS} days\n\n${renderTable(dueSoon)}`);
}

if (malformed.length > 0) {
  const lines = malformed.map((row) => `- \`${row.due}\` — ${row.reason} — ${row.item}`);
  sections.push(
    `## Dates that could not be read\n\nThese rows are being skipped, so nothing will remind you about them.\n\n${lines.join("\n")}`,
  );
}

const undatedNote =
  `\n\nItems with no due date are not tracked here. If one of them matters, give it a date in ` +
  `[docs/OPEN-ITEMS.md](https://github.com/${REPOSITORY}/blob/main/docs/OPEN-ITEMS.md).`;

const report =
  needsAttention === 0
    ? `Nothing is overdue and nothing is due within ${WINDOW_DAYS} days.${undatedNote}`
    : `${sections.join("\n\n")}${undatedNote}`;

await writeFile(REPORT_PATH, `${report}\n`, "utf8");
console.log(report);

if (process.env.GITHUB_OUTPUT) {
  await writeFile(
    process.env.GITHUB_OUTPUT,
    `needs_attention=${needsAttention}\noverdue=${overdue.length}\n`,
    { flag: "a" },
  );
}
