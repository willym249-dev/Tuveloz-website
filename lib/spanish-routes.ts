/**
 * Which URLs have a Spanish twin, and what the twin points at.
 *
 * `/es/<path>` uses the same reviewed copy when React renders on the server and
 * in the browser. The Worker supplies the initial language and search metadata.
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
  "/terms",
  "/customer-agreement",
  "/provider-agreement",
  "/payments",
  "/marketplace-conduct",
  "/privacy",
  "/provisional-provider-policy",
];

/** The Spanish prefix. One place, so the Worker and the sitemap agree. */
export const SPANISH_PREFIX = "/es";

export function pathHasSpanish(pathname: string) {
  // Private account interfaces translate in place. They must not gain a
  // public /es alias, sitemap entry, or changed cache behavior.
  return SPANISH_READY_PATHS.includes(pathname)
    || ["/account", "/privacy-center", "/success", "/provider-onboarding"].includes(pathname);
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
  return SPANISH_READY_PATHS.includes(english) ? english : null;
}

/** The Spanish URL for an English path, or null when it has no reviewed twin. */
export function spanishPathFor(pathname: string): string | null {
  if (!SPANISH_READY_PATHS.includes(pathname)) return null;
  return pathname === "/" ? SPANISH_PREFIX : `${SPANISH_PREFIX}${pathname}`;
}

/** Every Spanish URL, for the sitemap. */
export function spanishPagePaths(): string[] {
  return SPANISH_READY_PATHS.map((path) => spanishPathFor(path)!).filter(Boolean);
}
