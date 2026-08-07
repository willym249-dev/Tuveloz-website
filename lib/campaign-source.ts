/**
 * First-touch campaign attribution, in the same spirit as lib/experiments.ts:
 * no third-party tool, one small first-party primitive. A link carrying
 * `?src=<tag>` records that tag once, in localStorage, and it then rides along
 * on provider funnel events as a prop. The owner funnel can therefore answer
 * "which post produced applications", which was previously unanswerable —
 * `analytics_events.props` accepted arbitrary JSON but nothing ever wrote a
 * source into it.
 *
 * First touch wins. Someone who sees a reel, leaves, and comes back directly a
 * week later is still that reel's application; overwriting on the last visit
 * would credit the wrong post.
 */

const STORAGE_KEY = "tuveloz-src";

// Tags are pasted into bios and captions by hand, so they get sanitized rather
// than trusted: lowercase, short, and limited to characters that survive a URL
// and a spreadsheet column. Anything else is treated as absent.
const TAG_PATTERN = /^[a-z0-9_-]{1,32}$/;

function sanitize(raw: string | null): string | null {
  if (!raw) return null;
  const tag = raw.trim().toLowerCase();
  return TAG_PATTERN.test(tag) ? tag : null;
}

/**
 * The campaign tag for this visitor, recording it on the first visit that
 * carries one. Safe to call on every page view; returns null when the visitor
 * arrived without a tag and never has.
 */
export function campaignSource(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = sanitize(window.localStorage.getItem(STORAGE_KEY));
    if (stored) return stored;
    const incoming = sanitize(new URLSearchParams(window.location.search).get("src"));
    if (!incoming) return null;
    window.localStorage.setItem(STORAGE_KEY, incoming);
    return incoming;
  } catch {
    // Storage blocked (private mode, etc.). Attribution is supporting data —
    // losing it must never affect what the visitor sees or can do.
    return null;
  }
}

// Merged into the props of funnel events so a source, when there is one, is
// stamped alongside the A/B variants without changing any event's shape.
export function campaignProps(): Record<string, string> {
  const src = campaignSource();
  return src ? { src } : {};
}
