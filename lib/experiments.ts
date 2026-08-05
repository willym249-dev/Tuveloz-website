/**
 * Minimal first-party A/B assignment. No third-party experimentation tool is
 * wired in (matching lib/analytics.ts's philosophy): a visitor is assigned a
 * stable variant per named experiment, remembered in localStorage so they
 * always see the same copy, and that variant rides along on funnel events as a
 * prop. The owner funnel then reads real conversion per variant, so wording is
 * decided by data instead of guesswork. Swap the assignment for a server-side
 * split later without changing call sites.
 */

export type ExperimentName = "provider_hero";

// First entry is the control. Keep these in sync with the copy rendered for
// each variant and with the labels shown on the owner funnel page.
export const EXPERIMENT_VARIANTS: Record<ExperimentName, readonly string[]> = {
  provider_hero: ["A", "B"],
};

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
