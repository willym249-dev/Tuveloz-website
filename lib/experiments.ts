/**
 * Minimal first-party A/B assignment. No third-party experimentation tool is
 * wired in (matching lib/analytics.ts's philosophy): a visitor is assigned a
 * stable variant per named experiment, remembered in localStorage so they
 * always see the same copy, and that variant rides along on funnel events as a
 * prop. The owner funnel then reads real conversion per variant, so wording is
 * decided by data instead of guesswork. Swap the assignment for a server-side
 * split later without changing call sites.
 */

export type ExperimentName = "provider_hero" | "provider_pitch";

// First entry is the control. Keep these in sync with the copy rendered for
// each variant and with the labels shown on the owner funnel page.
export const EXPERIMENT_VARIANTS: Record<ExperimentName, readonly string[]> = {
  provider_hero: ["A", "B"],
  provider_pitch: ["A", "B"],
};

export const EXPERIMENT_NAMES = Object.keys(EXPERIMENT_VARIANTS) as ExperimentName[];

const STORAGE_PREFIX = "tuveloz-exp-";

export function getVariant(name: ExperimentName): string {
  const variants = EXPERIMENT_VARIANTS[name];
  const control = variants[0];
  if (typeof window === "undefined") return control;
  const key = `${STORAGE_PREFIX}${name}`;
  try {
    const stored = window.localStorage.getItem(key);
    if (stored && variants.includes(stored)) return stored;
    const chosen = variants[Math.floor(Math.random() * variants.length)] ?? control;
    window.localStorage.setItem(key, chosen);
    return chosen;
  } catch {
    // Storage blocked (private mode, etc.) — fall back to control so the copy
    // stays deterministic and no error reaches the visitor.
    return control;
  }
}

// Every active experiment's assignment for this visitor, stamped onto funnel
// events as `props.variants` so the owner funnel can read conversion per
// variant for each experiment independently.
export function activeVariants(): Record<string, string> {
  const result: Record<string, string> = {};
  for (const name of EXPERIMENT_NAMES) result[name] = getVariant(name);
  return result;
}
