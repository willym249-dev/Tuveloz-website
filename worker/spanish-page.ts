/**
 * Serve the reviewed Spanish to whoever cannot run JavaScript — mainly crawlers.
 *
 * The browser translates after paint, so the server emits English on every
 * request and search engines have only ever indexed English. This renders the
 * English page and rewrites its text on the way out, using the same dictionary
 * the browser uses, so `/es/join` is a real Spanish document rather than an
 * English one that becomes Spanish once a script runs.
 *
 * Deliberately narrow:
 *
 *   * Only paths in `SPANISH_READY_PATHS` have a twin. Anything else 404s
 *     rather than serving an untranslated page under a Spanish URL.
 *   * Exact-match substitution only, phrase for phrase, identical to
 *     `translatedValue` in the browser. Nothing unreviewed is ever translated,
 *     and an unknown string stays English exactly as it does client-side.
 *   * `script` and `style` are skipped, matching the browser's `ignored()`.
 *     Their contents are not language.
 */

import { translateText } from "../lib/spanish-html";
import { SPANISH_PREFIX, englishPathFor, spanishPathFor } from "../lib/spanish-routes";

const CANONICAL_ORIGIN = "https://tuveloz.com";

/** Text inside these carries no language and must never be substituted. */
const OPAQUE = new Set(["script", "style", "noscript"]);

class LanguageAttribute {
  element(element: Element) {
    element.setAttribute("lang", "es");
  }
}

/**
 * Drop the canonical the English page already carries.
 *
 * Next emits `<link rel="canonical" href="https://tuveloz.com/…">` from page
 * metadata, and it survives into the Spanish twin because the twin *is* that
 * page. Appending a second canonical leaves two, and the English one wins:
 * every Spanish URL then declares itself a duplicate of its English original
 * and asks not to be indexed — the exact opposite of why these URLs exist.
 * Verified in production on 2026-08-17, before this handler existed.
 *
 * So the inherited one is removed and the Spanish one appended in its place.
 */
class DropInheritedCanonical {
  element(element: Element) {
    element.remove();
  }
}

/**
 * Translate the copy that lives in an attribute rather than in the page.
 *
 * A meta description is the sentence a searcher reads *before* deciding whether
 * to click, so on a Spanish result it matters more than most of the page. It is
 * an attribute, and the text handler only ever sees text nodes, so it needs its
 * own pass. `<title>` does not: its contents are a text node and are already
 * covered.
 *
 * Inert until the strings exist. Every value goes through the same exact-match
 * dictionary as the body, so an untranslated description is emitted unchanged in
 * English — the same honest fallback the rest of this makes. Adding a reviewed
 * string turns it on; removing one turns it back off. No code change either way.
 */
/**
 * og:locale is a fact about the document, not copy, so it is set rather than
 * looked up. A card that says en_US while its text is Spanish is simply wrong,
 * and no dictionary entry would fix it.
 */
class TranslateLocale {
  element(element: Element) {
    element.setAttribute("content", "es_US");
  }
}

class SpanishSocialUrl {
  constructor(private readonly pathname: string) {}

  element(element: Element) {
    element.setAttribute("content", `${CANONICAL_ORIGIN}${this.pathname}`);
  }
}

class TranslateAttribute {
  constructor(private readonly attribute: string) {}

  element(element: Element) {
    const value = element.getAttribute(this.attribute);
    if (!value) return;
    const translated = translateText(value);
    if (translated !== value) element.setAttribute(this.attribute, translated);
  }
}

/**
 * Tell search engines the two URLs are the same page in two languages.
 *
 * Each side points at itself and at the other, which is what `hreflang`
 * requires — a one-way declaration is ignored. `x-default` goes to English
 * because that is what an unmatched locale should land on.
 */
class Alternates {
  constructor(
    private readonly englishPath: string,
    private readonly spanishPath: string,
    private readonly includeCanonical = true,
  ) {}

  element(element: Element) {
    const english = `${CANONICAL_ORIGIN}${this.englishPath}`;
    const spanish = `${CANONICAL_ORIGIN}${this.spanishPath}`;
    element.append(
      (this.includeCanonical ? `<link rel="canonical" href="${spanish}">` : "") +
        `<link rel="alternate" hreflang="es" href="${spanish}">` +
        `<link rel="alternate" hreflang="en" href="${english}">` +
        `<link rel="alternate" hreflang="x-default" href="${english}">`,
      { html: true },
    );
  }
}

/** Complete the reciprocal language links on the existing English page. */
export function englishPageAlternates(url: URL, response: Response): Response {
  const spanishPath = spanishPathFor(url.pathname);
  if (!spanishPath || !response.ok || !response.headers.get("content-type")?.includes("text/html")) {
    return response;
  }
  return new HTMLRewriter()
    .on("head", new Alternates(url.pathname, spanishPath, false))
    .transform(response);
}

/**
 * Replace one text node's contents, buffered.
 *
 * HTMLRewriter delivers a text node in chunks and splits wherever it likes, so
 * matching a chunk against the dictionary would miss any phrase that straddles a
 * boundary. Buffer until `lastInTextNode`, translate the whole run, then emit.
 */
class TranslateRun {
  private buffer = "";
  private depth = 0;

  enterOpaque() {
    this.depth += 1;
  }

  leaveOpaque() {
    this.depth = Math.max(0, this.depth - 1);
  }

  text(chunk: Text) {
    if (this.depth > 0) return;
    this.buffer += chunk.text;
    if (!chunk.lastInTextNode) {
      chunk.remove();
      return;
    }
    const run = this.buffer;
    this.buffer = "";
    chunk.replace(translateText(run), { html: false });
  }
}

/**
 * The Spanish twin of an English page, or null when there is no twin.
 *
 * `render` produces the ordinary English response for a path; this rewrites it.
 * A non-HTML or failed response is returned untouched, because translating an
 * error page helps nobody.
 */
export async function spanishPageResponse(
  url: URL,
  request: Request,
  render: (englishRequest: Request) => Promise<Response>,
): Promise<Response | null> {
  const englishPath = englishPathFor(url.pathname);
  if (englishPath === null) {
    return url.pathname === SPANISH_PREFIX || url.pathname.startsWith(`${SPANISH_PREFIX}/`)
      ? new Response("Not found", { status: 404 })
      : null;
  }

  const englishUrl = new URL(url.toString());
  englishUrl.pathname = englishPath;
  const response = await render(new Request(englishUrl.toString(), request));

  const type = response.headers.get("content-type") ?? "";
  if (!response.ok || !type.includes("text/html")) return response;

  const translator = new TranslateRun();
  const spanishPath = spanishPathFor(englishPath) ?? url.pathname;

  return new HTMLRewriter()
    .on("html", new LanguageAttribute())
    .on('link[rel="canonical"]', new DropInheritedCanonical())
    // The search result itself: description, and the card a shared link renders
    // as. <title> needs no handler — its contents are a text node.
    .on('meta[name="description"]', new TranslateAttribute("content"))
    .on('meta[property="og:description"]', new TranslateAttribute("content"))
    .on('meta[property="og:title"]', new TranslateAttribute("content"))
    .on('meta[name="twitter:description"]', new TranslateAttribute("content"))
    .on('meta[name="twitter:title"]', new TranslateAttribute("content"))
    .on('meta[property="og:locale"]', new TranslateLocale())
    .on('meta[property="og:url"]', new SpanishSocialUrl(spanishPath))
    .on("head", new Alternates(englishPath, spanishPath))
    .on("script, style, noscript", {
      element(element: Element) {
        if (!OPAQUE.has(element.tagName.toLowerCase())) return;
        translator.enterOpaque();
        element.onEndTag(() => translator.leaveOpaque());
      },
    })
    .on("*", {
      text: (chunk: Text) => translator.text(chunk),
    })
    .transform(response);
}
