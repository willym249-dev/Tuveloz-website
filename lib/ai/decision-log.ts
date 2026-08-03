// A shared, git-tracked record of what the GPT/Gemini/Claude council has
// already decided about this site, so the three stay in sync across
// sessions instead of contradicting each other. Pure formatting/parsing
// only — reading and writing the file lives in scripts/ai-council.ts.

export type DecisionLogEntry = {
  timestamp: string;
  mode: "quick" | "consensus" | "deep";
  question: string;
  consulted: string[];
  agreed: boolean | null;
  answer: string;
};

export function serializeLogEntry(entry: DecisionLogEntry): string {
  return JSON.stringify(entry);
}

export function parseLogLines(content: string): DecisionLogEntry[] {
  const entries: DecisionLogEntry[] = [];
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed.question === "string" && typeof parsed.answer === "string") {
        entries.push(parsed as DecisionLogEntry);
      }
    } catch {
      // skip a malformed line rather than fail the whole log
    }
  }
  return entries;
}

export function summarizeForContext(entries: DecisionLogEntry[], limit = 8): string {
  const recent = entries.slice(-limit);
  if (recent.length === 0) return "";
  const lines = recent.map((entry) => {
    const preview = entry.answer.length > 240 ? `${entry.answer.slice(0, 240)}…` : entry.answer;
    return `- [${entry.timestamp}] Q: ${entry.question}\n  A: ${preview}`;
  });
  return [
    "Prior decisions already made by this AI team (GPT, Gemini, Claude) for " +
      "the Tuveloz site. Stay consistent with these unless the question is " +
      "explicitly asking you to revisit one:",
    ...lines,
  ].join("\n");
}
