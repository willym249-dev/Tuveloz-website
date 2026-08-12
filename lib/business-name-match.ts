// Comparing business names that were typed by different people, at different
// times, from different sources.
//
// The same business is written "Willy's Auto Repair LLC" on a certificate of
// insurance, "Willys Auto Repair, L.L.C." on a county registration, and "Willy's
// Auto" on the public profile. A plain lowercase comparison calls all three
// different, which is how a real provider ends up blocked with no explanation.
//
// This module is deliberately a diagnostic, not a decision. It never widens
// what counts as a verified legal identity — provider-legal-identity.ts still
// requires the accepted evidence to agree exactly. What this adds is the
// ability to tell the owner *why* two names disagree: a punctuation difference
// is a typo to fix, and a genuinely different name is a question to ask.

/** Entity forms that carry no identifying information on their own. */
const ENTITY_SUFFIXES = new Set([
  "llc", "lc", "plc", "pllc", "ltd", "lp", "llp", "lllp",
  "inc", "incorporated", "corp", "corporation",
  "co", "company", "pa", "pc", "sc",
]);

/** Trading-name markers that introduce an alias rather than change the entity. */
const ALIAS_MARKERS = new Set(["dba", "tradingas", "ta", "aka", "fka"]);

/**
 * Reduces a name to its identifying words: lowercase, no punctuation, no
 * entity form, no trading-name marker, single-spaced.
 *
 * "Willy's Auto Repair, L.L.C." and "WILLYS AUTO REPAIR LLC" both become
 * "willys auto repair".
 */
export function normalizeBusinessName(value: string) {
  const words = value
    .toLowerCase()
    .normalize("NFKD")
    // Strip accents so "José's Garage" and "Joses Garage" agree.
    .replace(/[̀-ͯ]/g, "")
    // Ampersand is written three ways and means one thing.
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean);
  const kept = words.filter((word) => (
    !ENTITY_SUFFIXES.has(word) && !ALIAS_MARKERS.has(word)
  ));
  // A name that is *only* an entity form is not a name; keep the original
  // words rather than returning an empty string that matches everything.
  return (kept.length ? kept : words).join(" ");
}

export type BusinessNameComparison =
  /** Same string once case and surrounding space are ignored. */
  | "identical"
  /** Same business, written differently — punctuation, entity form, accents. */
  | "equivalent"
  /** One name contains the other, e.g. a shortened trading name. */
  | "contained"
  /** No evident relationship. */
  | "different"
  /** At least one side is missing, so there is nothing to compare. */
  | "incomparable";

export type BusinessNameCheck = {
  comparison: BusinessNameComparison;
  /** True only when the two names need a human to look at them. */
  needsReview: boolean;
  /** Plain-language reason, written for the owner's review queue. */
  note: string;
};

export function compareBusinessNames(
  left: string,
  right: string,
  labels: { left: string; right: string } = { left: "the first name", right: "the second name" },
): BusinessNameCheck {
  const leftRaw = left.trim();
  const rightRaw = right.trim();

  if (!leftRaw || !rightRaw) {
    return {
      comparison: "incomparable",
      needsReview: false,
      note: "There is no second name to compare against yet.",
    };
  }

  if (leftRaw.toLowerCase() === rightRaw.toLowerCase()) {
    return {
      comparison: "identical",
      needsReview: false,
      note: `${labels.left} and ${labels.right} match.`,
    };
  }

  const leftKey = normalizeBusinessName(leftRaw);
  const rightKey = normalizeBusinessName(rightRaw);

  if (leftKey && leftKey === rightKey) {
    return {
      comparison: "equivalent",
      needsReview: true,
      note: `${labels.left} ("${leftRaw}") and ${labels.right} ("${rightRaw}") are the same `
        + "business written differently — punctuation, entity form, or spacing. Make them "
        + "match the registered name exactly before accepting.",
    };
  }

  // A shortened trading name is common and legitimate, but it is not proof the
  // registration covers it, so it is always surfaced.
  const leftWords = leftKey.split(" ").filter(Boolean);
  const rightWords = rightKey.split(" ").filter(Boolean);
  const contained = leftWords.length && rightWords.length && (
    leftKey.startsWith(`${rightKey} `) || leftKey === rightKey
    || rightKey.startsWith(`${leftKey} `)
    || leftKey.endsWith(` ${rightKey}`) || rightKey.endsWith(` ${leftKey}`)
  );
  if (contained) {
    return {
      comparison: "contained",
      needsReview: true,
      note: `${labels.left} ("${leftRaw}") and ${labels.right} ("${rightRaw}") overlap but are `
        + "not the same — one looks like a shortened or trading name. Confirm the registration "
        + "actually covers the name being used.",
    };
  }

  return {
    comparison: "different",
    needsReview: true,
    note: `${labels.left} ("${leftRaw}") and ${labels.right} ("${rightRaw}") do not match. `
      + "Do not accept until you know which one the registration is issued to.",
  };
}
