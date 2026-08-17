/**
 * Which URLs have a Spanish twin, and what the twin points at.
 *
 * Spanish is applied in the browser after paint, so the server emits English on
 * every request and a crawler has never seen it. `/es/<path>` is the crawlable
 * half: the same page, translated before it is sent. See
 * `docs/product/spanish-is-invisible-to-search.md`.
 *
 * Plain module with no React, because the Worker imports it. The list lives here
 * rather than in `site-language.tsx` for the same reason the dictionary does,
 * and that file re-exports it so the browser switch is unchanged.
 *
 * Fail-closed on purpose. Only the paths below get a Spanish URL. An `/es/` URL
 * for a page without reviewed Spanish would promise a translation that does not
 * exist, which is worse than having no Spanish URL at all — the same reasoning
 * that keeps the language toggle off the legal pages.
 */

export const SPANISH_READY_PATHS = [
  "/",
  "/post-job",
  "/join",
  "/about",
  "/how-it-works",
  "/ai",
  "/faq",
  "/safety",
];

/** The Spanish prefix. One place, so the Worker and the sitemap agree. */
export const SPANISH_PREFIX = "/es";

export function pathHasSpanish(pathname: string) {
  return SPANISH_READY_PATHS.includes(pathname);
}

/**
 * The English path a Spanish URL mirrors, or null if there is no such twin.
 *
 * `/es` and `/es/` both mean the homepage. Anything whose English counterpart is
 * not on the reviewed list returns null, and the caller should 404 rather than
 * serve an untranslated page under a Spanish URL.
 */
export function englishPathFor(pathname: string): string | null {
  if (pathname !== SPANISH_PREFIX && !pathname.startsWith(`${SPANISH_PREFIX}/`)) return null;
  const remainder = pathname.slice(SPANISH_PREFIX.length);
  const english = remainder === "" || remainder === "/" ? "/" : remainder.replace(/\/$/, "");
  return pathHasSpanish(english) ? english : null;
}

/** The Spanish URL for an English path, or null when it has no reviewed twin. */
export function spanishPathFor(pathname: string): string | null {
  if (!pathHasSpanish(pathname)) return null;
  return pathname === "/" ? SPANISH_PREFIX : `${SPANISH_PREFIX}${pathname}`;
}

/** Every Spanish URL, for the sitemap. */
export function spanishPagePaths(): string[] {
  return SPANISH_READY_PATHS.map((path) => spanishPathFor(path)!).filter(Boolean);
}
