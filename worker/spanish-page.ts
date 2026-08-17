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
 * Tell search engines the two URLs are the same page in two languages.
 *
 * Each side points at itself and at the other, which is what `hreflang`
 * requires — a one-way declaration is ignored. `x-default` goes to English
 * because that is what an unmatched locale should land on.
 */
class Alternates {
  constructor(private readonly englishPath: string, private readonly spanishPath: string) {}

  element(element: Element) {
    const english = `${CANONICAL_ORIGIN}${this.englishPath}`;
    const spanish = `${CANONICAL_ORIGIN}${this.spanishPath}`;
    element.append(
      `<link rel="canonical" href="${spanish}">` +
        `<link rel="alternate" hreflang="es" href="${spanish}">` +
        `<link rel="alternate" hreflang="en" href="${english}">` +
        `<link rel="alternate" hreflang="x-default" href="${english}">`,
      { html: true },
    );
  }
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
