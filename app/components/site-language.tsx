"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";

export type SiteLanguage = "en" | "es";

const LANGUAGE_KEY = "tuveloz-language";
const LANGUAGE_EVENT = "tuveloz-language-change";

// The dictionaries live in lib/spanish-dictionary.ts so that server-side
// code can read them without pulling this client component into the Worker
// bundle. Re-exported here because callers and the tests import them from
// this module, and because the browser half is what they were written for.
export { spanishText, spanishPlaceholders } from "../../lib/spanish-dictionary";
import { translatedValue } from "../../lib/spanish-interface-text";
import { synchronizeSpanishMetadata } from "../../lib/spanish-browser-metadata";

type TextState = { source: string; applied: string };
const textStates = new WeakMap<Text, TextState>();
const attributeStates = new WeakMap<Element, Map<string, TextState>>();

function ignored(node: Node) {
  const element = node instanceof Element ? node : node.parentElement;
  return Boolean(element?.closest(
    "script, style, [data-language-control], [data-no-interface-translation], [data-manual-language]",
  ));
}

function translateTextNode(node: Text, language: SiteLanguage) {
  if (ignored(node) || !node.nodeValue?.trim()) return;
  const current = node.nodeValue;
  const previous = textStates.get(node);
  const source = previous && (current === previous.applied || current === previous.source)
    ? previous.source
    : current;
  const applied = language === "es" ? translatedValue(source) : source;
  textStates.set(node, { source, applied });
  if (current !== applied) node.nodeValue = applied;
}

function translateAttribute(element: Element, attribute: string, language: SiteLanguage) {
  if (ignored(element)) return;
  const current = element.getAttribute(attribute);
  if (!current) return;
  const states = attributeStates.get(element) ?? new Map<string, TextState>();
  const previous = states.get(attribute);
  const source = previous && (current === previous.applied || current === previous.source)
    ? previous.source
    : current;
  const applied = language === "es"
    ? translatedValue(source, attribute as "placeholder" | "title" | "aria-label")
    : source;
  states.set(attribute, { source, applied });
  attributeStates.set(element, states);
  if (current !== applied) element.setAttribute(attribute, applied);
}

function translateInterface(root: Node & Pick<ParentNode, "querySelectorAll">, language: SiteLanguage) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let current = walker.nextNode();
  while (current) {
    translateTextNode(current as Text, language);
    current = walker.nextNode();
  }
  root.querySelectorAll?.("[placeholder], [title], [aria-label]").forEach((element) => {
    translateAttribute(element, "placeholder", language);
    translateAttribute(element, "title", language);
    translateAttribute(element, "aria-label", language);
  });
}

/**
 * Spanish is on for the pages a visitor decides on, and deliberately off for
 * the legal pages.
 *
 * It was switched off entirely because a half-translated legal page is worse
 * than an English one. That reasoning still holds — so rather than translate
 * agreements without review, the switch is per-path: every string on the paths
 * below is in the dictionary (tests/spanish-coverage.test.mjs fails if one is
 * not), and everywhere else stays English and says so on the page.
 */
// The list lives in lib/spanish-routes.ts, which the Worker also imports to
// serve the crawlable /es twins. One list, so a page cannot be Spanish-ready in
// the browser and absent from search, or the reverse.
export { SPANISH_READY_PATHS, pathHasSpanish } from "../../lib/spanish-routes";
import { englishPathFor, pathHasSpanish } from "../../lib/spanish-routes";

let inMemoryLanguage: SiteLanguage | undefined;

function getLanguageSnapshot(): SiteLanguage {
  if (typeof window === "undefined") return "en";
  // An explicit Spanish URL must survive hydration and any saved preference.
  if (englishPathFor(window.location.pathname) !== null) return "es";
  // A page without reviewed Spanish stays English no matter what is stored.
  if (!pathHasSpanish(window.location.pathname)) return "en";
  if (inMemoryLanguage) return inMemoryLanguage;
  try {
    return window.localStorage.getItem(LANGUAGE_KEY) === "es" ? "es" : "en";
  } catch {
    return "en";
  }
}

function subscribeLanguage(listener: () => void) {
  const handle = (event: Event) => {
    if (event.type === "storage") inMemoryLanguage = undefined;
    listener();
  };
  window.addEventListener("storage", handle);
  window.addEventListener(LANGUAGE_EVENT, handle);
  return () => {
    window.removeEventListener("storage", handle);
    window.removeEventListener(LANGUAGE_EVENT, handle);
  };
}

function setStoredLanguage(language: SiteLanguage) {
  inMemoryLanguage = language;
  try {
    window.localStorage.setItem(LANGUAGE_KEY, language);
  } catch {
    // The switch remains usable when browser storage is unavailable.
  }
  const englishPath = englishPathFor(window.location.pathname);
  if (language === "en" && englishPath !== null) {
    window.location.assign(`${englishPath}${window.location.search}${window.location.hash}`);
    return;
  }
  window.dispatchEvent(new Event(LANGUAGE_EVENT));
}

const SiteLanguageContext = createContext<{
  language: SiteLanguage;
  setLanguage: (language: SiteLanguage) => void;
}>({
  language: "en",
  setLanguage: () => undefined,
});

export function SiteLanguageProvider({ children, initialLanguage = "en" }: {
  children: ReactNode;
  initialLanguage?: SiteLanguage;
}) {
  const pathname = usePathname();
  const language = useSyncExternalStore<SiteLanguage>(
    subscribeLanguage,
    getLanguageSnapshot,
    (): SiteLanguage => initialLanguage,
  );

  useEffect(() => {
    // Client navigation can retain this layout while changing the URL. Notify
    // the language store after navigation, including English-only pages.
    window.dispatchEvent(new Event(LANGUAGE_EVENT));
  }, [pathname]);

  useEffect(() => {
    document.documentElement.lang = language;
    // Keep each page's title instead of replacing every title with the brand.
    const translatePage = () => {
      translateInterface(document.head, language);
      if (language === "es") synchronizeSpanishMetadata(document, window.location.pathname);
    };
    translatePage();
    let active = true;
    let queued = false;
    const observer = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      window.queueMicrotask(() => {
        queued = false;
        if (active) translatePage();
      });
    });
    const options = {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["placeholder", "title", "aria-label", "content", "href"],
    };
    observer.observe(document.head, options);
    return () => { active = false; observer.disconnect(); };
  }, [language]);

  return (
    <SiteLanguageContext.Provider value={{ language, setLanguage: setStoredLanguage }}>
      {children}
    </SiteLanguageContext.Provider>
  );
}

export function useSiteLanguage() {
  return useContext(SiteLanguageContext);
}

/**
 * Only offered where the whole page has reviewed Spanish. Showing it on a legal
 * page would promise a translation that does not exist.
 */
export function SiteLanguageButton() {
  const pathname = usePathname();
  const { language, setLanguage } = useSiteLanguage();
  const [available, setAvailable] = useState(false);
  const nextLanguage = language === "en" ? "es" : "en";

  useEffect(() => {
    // After paint, matching how the rest of the site defers client-only state,
    // so the server and client first render agree.
    const ready = pathHasSpanish(englishPathFor(window.location.pathname) ?? window.location.pathname);
    queueMicrotask(() => setAvailable(ready));
  }, [pathname]);

  if (!available) return null;

  return (
    <button
      aria-label={language === "en" ? "Cambiar toda la página a español" : "Change the whole page to English"}
      className="site-language-button"
      data-language-control
      lang={nextLanguage}
      onClick={() => setLanguage(nextLanguage)}
      type="button"
    >
      <strong>{language === "en" ? "Español" : "English"}</strong>
    </button>
  );
}
