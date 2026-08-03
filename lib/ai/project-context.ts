// Pure formatters for the extra context the CLI feeds every model so the
// three don't need repeated back-and-forth (and repeated tokens) to
// re-establish what Tuveloz is and what's currently going on. Gathering the
// git state and file contents lives in scripts/ai-council.ts, which has
// filesystem/process access; this module just shapes it into short,
// cheap-to-send blocks.

export const PROJECT_BRIEF =
  "Tuveloz (tuveloz.com) is a Maryland home-services marketplace: Next.js on " +
  "Cloudflare Workers, D1 (Drizzle ORM) for data, R2 for uploads, Stripe for " +
  "payments and Identity verification. Core flows: customers post job " +
  "requests, providers apply and get vetted (compliance/evidence review), " +
  "providers send quotes, an owner dashboard oversees launch readiness.";

export type GitState = {
  branch: string;
  recentCommits: string[];
  changedFiles: string[];
};

export function formatGitContext(git: GitState): string {
  const parts = [`Current branch: ${git.branch}`];
  if (git.recentCommits.length > 0) {
    parts.push(`Recent commits:\n${git.recentCommits.map((line) => `  ${line}`).join("\n")}`);
  }
  if (git.changedFiles.length > 0) {
    parts.push(`Uncommitted changes:\n${git.changedFiles.map((line) => `  ${line}`).join("\n")}`);
  }
  return parts.join("\n");
}

export type FileExcerpt = {
  path: string;
  content: string;
  truncated: boolean;
};

export function formatFileAppendix(files: FileExcerpt[]): string {
  if (files.length === 0) return "";
  const blocks = files.map(
    (file) =>
      `--- ${file.path}${file.truncated ? " (truncated)" : ""} ---\n${file.content}`,
  );
  return ["Relevant file contents for this question:", ...blocks].join("\n\n");
}
