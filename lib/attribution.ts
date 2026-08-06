/**
 * First-touch traffic attribution, first-party and client-side.
 *
 * The audience growth playbook calls "provider applications, by source" the
 * only number that decides anything — but every channel hands out the same
 * bare tuveloz.com/join, so applications arrived unlabeled and that number
 * could not actually be read. This records which door a visitor came through
 * on the first page they land on and keeps it, so lib/analytics.ts can stamp
 * it onto every funnel event and the owner funnel can break signups down by
 * channel and campaign.
 *
 * First touch wins, never last. The channel that *found* a provider is the one
 * worth more money. Someone who arrives from a flyer in Wheaton, thinks it
 * over, and types the URL in directly two days later is still a flyer signup;
 * crediting that application to "direct" would defund the thing that earned it.
 *
 * Nothing here identifies a person: no visitor ID, no cross-site pixel, no
 * third party, no ad network click IDs. Only which door they came through,
 * kept in this browser alongside the A/B assignment in lib/experiments.ts.
 */

export type Attribution = {
  /** Where the visit came from: "instagram", "flyer", "google", "direct". */
  source: string;
  /** How it reached them: "social", "print", "organic", "paid", "referral". */
  medium: string;
  /** The specific piece, when the link carried one: "flyer-wheaton". */
  campaign: string;
  /** The first path they landed on, so a channel's landing page is checkable. */
  landing: string;
};

// A visit that carried no signal at all. Also the server-side fallback, so
// call sites never have to null-check.
export const DIRECT: Attribution = {
  source: "direct",
  medium: "none",
  campaign: "",
  landing: "",
};

const STORAGE_KEY = "tuveloz-attribution";

// Values arrive from the URL bar, get stored in the owner's database, and are
// rendered on the funnel page. Normalize hard: one lowercase slug shape and a
// short cap, so a hand-typed tag and a mistyped one collapse to the same row
// and nobody can wedge junk into the owner's only decision metric.
export function normalizeTag(value: string, maxLength = 40) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .slice(0, maxLength)
    .replace(/^-+|-+$/g, "");
}

// Landing paths keep their slashes so "/providers/luis" stays readable.
function normalizePath(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9/_-]+/g, "-")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

/**
 * Short codes for channels that cannot carry a utm_ string.
 *
 * Nobody retypes "?utm_source=flyer&utm_medium=print" off a printed page, and
 * a DM full of query parameters reads like spam. These are short enough to say
 * out loud: tuveloz.com/join?r=flyer.
 *
 * A trailing detail becomes the campaign on its own — "?r=flyer-wheaton" is
 * still the flyer channel, but tracked separately, which is what makes the
 * playbook's "which town converts cheapest" answerable instead of a guess.
 */
const REF_CODES: Record<string, { source: string; medium: string }> = {
  flyer: { source: "flyer", medium: "print" },
  card: { source: "card", medium: "print" },
  qr: { source: "qr", medium: "print" },
  dm: { source: "dm", medium: "outreach" },
  ig: { source: "instagram", medium: "social" },
  tt: { source: "tiktok", medium: "social" },
  fb: { source: "facebook", medium: "social" },
  yt: { source: "youtube", medium: "social" },
  rd: { source: "reddit", medium: "social" },
  nd: { source: "nextdoor", medium: "social" },
  gbp: { source: "google", medium: "profile" },
};

export const REF_CODE_KEYS = Object.keys(REF_CODES);

// Hosts worth naming. Everything else keeps its bare hostname as the source so
// an unexpected referrer still shows up as itself instead of vanishing into
// "direct" — a surprise channel is a finding, not noise.
const REFERRER_SOURCES: Array<{ match: RegExp; source: string; medium: string }> = [
  { match: /(^|\.)instagram\.com$/, source: "instagram", medium: "social" },
  { match: /(^|\.)facebook\.com$/, source: "facebook", medium: "social" },
  { match: /(^|\.)tiktok\.com$/, source: "tiktok", medium: "social" },
  { match: /(^|\.)reddit\.com$/, source: "reddit", medium: "social" },
  { match: /(^|\.)nextdoor\.com$/, source: "nextdoor", medium: "social" },
  { match: /(^|\.)youtube\.com$/, source: "youtube", medium: "social" },
  { match: /(^|\.)(x|twitter)\.com$/, source: "x", medium: "social" },
  { match: /(^|\.)t\.co$/, source: "x", medium: "social" },
  { match: /(^|\.)linkedin\.com$/, source: "linkedin", medium: "social" },
  { match: /(^|\.)google\./, source: "google", medium: "organic" },
  { match: /(^|\.)bing\.com$/, source: "bing", medium: "organic" },
  { match: /(^|\.)duckduckgo\.com$/, source: "duckduckgo", medium: "organic" },
  { match: /(^|\.)search\.yahoo\.com$/, source: "yahoo", medium: "organic" },
];

function fromRefCode(raw: string): Omit<Attribution, "landing"> | null {
  const code = normalizeTag(raw);
  if (!code) return null;
  const base = code.split("-")[0];
  const known = REF_CODES[base];
  if (!known) {
    // An unknown code is still a tag somebody deliberately printed. Keep it
    // verbatim rather than discarding the only label the visit carried.
    return { source: "tagged", medium: "unknown", campaign: code };
  }
  return { source: known.source, medium: known.medium, campaign: code };
}

function fromReferrer(referrer: string, currentHost: string): Omit<Attribution, "landing"> | null {
  if (!referrer) return null;
  let host = "";
  try {
    host = new URL(referrer).hostname.toLowerCase();
  } catch {
    return null;
  }
  // Our own pages are internal navigation, not a source.
  if (!host || host === currentHost.toLowerCase()) return null;
  for (const entry of REFERRER_SOURCES) {
    if (entry.match.test(host)) {
      return { source: entry.source, medium: entry.medium, campaign: "" };
    }
  }
  return { source: normalizeTag(host.replace(/^www\./, "")), medium: "referral", campaign: "" };
}

/**
 * Work out where a visit came from. Pure and exported so the rules are
 * testable without a browser.
 *
 * Order is most deliberate first: an explicit tag we put on a link beats a
 * short code, which beats whatever the browser happened to report.
 */
export function resolveAttribution(
  location: { search: string; pathname: string; host: string },
  referrer: string,
): Attribution {
  const params = new URLSearchParams(location.search);
  const landing = normalizePath(location.pathname);

  const utmSource = normalizeTag(params.get("utm_source") ?? "");
  if (utmSource) {
    return {
      source: utmSource,
      medium: normalizeTag(params.get("utm_medium") ?? "") || "unknown",
      campaign: normalizeTag(params.get("utm_campaign") ?? params.get("utm_content") ?? ""),
      landing,
    };
  }

  const short = fromRefCode(params.get("r") ?? "");
  if (short) return { ...short, landing };

  // /q/<slug> already redirects to /providers/<slug>?source=qr for provider QR
  // codes. Honor that existing param so those scans land in the same report
  // instead of staying a separate counter nobody cross-reads.
  const legacy = normalizeTag(params.get("source") ?? "");
  if (legacy) {
    const known = REF_CODES[legacy];
    return {
      source: known?.source ?? legacy,
      medium: known?.medium ?? "referral",
      campaign: legacy,
      landing,
    };
  }

  const referred = fromReferrer(referrer, location.host);
  if (referred) return { ...referred, landing };

  return { ...DIRECT, landing };
}

function readStored(): Attribution | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Attribution>;
    if (typeof parsed.source !== "string" || !parsed.source) return null;
    return {
      source: parsed.source,
      medium: typeof parsed.medium === "string" ? parsed.medium : "unknown",
      campaign: typeof parsed.campaign === "string" ? parsed.campaign : "",
      landing: typeof parsed.landing === "string" ? parsed.landing : "",
    };
  } catch {
    return null;
  }
}

/**
 * The visitor's first-touch attribution, capturing it on first call.
 *
 * Idempotent and safe to call from anywhere: once a visit has been credited it
 * is never re-credited, so a later page view cannot overwrite the channel that
 * earned the visit with "direct".
 */
export function attribution(): Attribution {
  if (typeof window === "undefined") return DIRECT;
  const stored = readStored();
  if (stored) return stored;
  const resolved = resolveAttribution(window.location, document.referrer);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(resolved));
  } catch {
    // Storage blocked (private mode, etc.). The visit is still attributed for
    // this page load; it just cannot survive to the next one. Never throw at a
    // visitor over a measurement detail.
  }
  return resolved;
}
