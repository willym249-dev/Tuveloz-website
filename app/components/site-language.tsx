"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

export type SiteLanguage = "en" | "es";

const LANGUAGE_KEY = "tuveloz-language";
const LANGUAGE_EVENT = "tuveloz-language-change";

// The dictionaries live in lib/spanish-dictionary.ts so that server-side
// code can read them without pulling this client component into the Worker
// bundle. Re-exported here because callers and the tests import them from
// this module, and because the browser half is what they were written for.
export { spanishText, spanishPlaceholders } from "../../lib/spanish-dictionary";
import { spanishText, spanishPlaceholders } from "../../lib/spanish-dictionary";

type TextState = { source: string; applied: string };
const textStates = new WeakMap<Text, TextState>();
const attributeStates = new WeakMap<Element, Map<string, TextState>>();

function translatedPattern(value: string) {
  let match = value.match(/^(\d+) completed-job (review|reviews)$/);
  if (match) return `${match[1]} ${match[2] === "review" ? "reseña" : "reseñas"} de trabajos completados`;
  match = value.match(/^(\d+) currently listed (service|services)$/);
  if (match) return `${match[1]} ${match[2] === "service" ? "servicio actualmente publicado" : "servicios actualmente publicados"}`;
  match = value.match(/^(\d+) currently listed vehicle services$/);
  if (match) return `${match[1]} servicios para vehículos actualmente publicados`;
  match = value.match(/^At least (\d+) characters$/);
  if (match) return `Al menos ${match[1]} caracteres`;
  match = value.match(/^(\d+) characters or fewer$/);
  if (match) return `${match[1]} caracteres o menos`;
  match = value.match(/^Use at least (\d+) characters\.$/);
  if (match) return `Use al menos ${match[1]} caracteres.`;
  match = value.match(/^Use no more than (\d+) characters\.$/);
  if (match) return `Use no más de ${match[1]} caracteres.`;
  match = value.match(/^· policy version (.+)$/);
  if (match) return `· versión de la política ${match[1]}`;
  return value;
}

function translatedValue(source: string, attribute?: "placeholder" | "title" | "aria-label") {
  const match = source.match(/^(\s*)([\s\S]*?)(\s*)$/);
  if (!match) return source;
  const [, before, core, after] = match;
  const dictionary = attribute === "placeholder" ? spanishPlaceholders : spanishText;
  return `${before}${dictionary[core] ?? translatedPattern(core)}${after}`;
}

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

function translateInterface(root: ParentNode, language: SiteLanguage) {
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
import { pathHasSpanish } from "../../lib/spanish-routes";

function getLanguageSnapshot(): SiteLanguage {
  if (typeof window === "undefined") return "en";
  // A page without reviewed Spanish stays English no matter what is stored.
  if (!pathHasSpanish(window.location.pathname)) return "en";
  return window.localStorage.getItem(LANGUAGE_KEY) === "es" ? "es" : "en";
}

function subscribeLanguage(listener: () => void) {
  const handle = () => listener();
  window.addEventListener("storage", handle);
  window.addEventListener(LANGUAGE_EVENT, handle);
  return () => {
    window.removeEventListener("storage", handle);
    window.removeEventListener(LANGUAGE_EVENT, handle);
  };
}

function setStoredLanguage(language: SiteLanguage) {
  window.localStorage.setItem(LANGUAGE_KEY, language);
  window.dispatchEvent(new Event(LANGUAGE_EVENT));
}

const SiteLanguageContext = createContext<{
  language: SiteLanguage;
  setLanguage: (language: SiteLanguage) => void;
}>({
  language: "en",
  setLanguage: () => undefined,
});

export function SiteLanguageProvider({ children }: { children: ReactNode }) {
  const language = useSyncExternalStore<SiteLanguage>(
    subscribeLanguage,
    getLanguageSnapshot,
    (): SiteLanguage => "en",
  );

  useEffect(() => {
    document.documentElement.lang = language;
    document.title = language === "es"
      ? "Tuveloz | Opciones para clientes. Libertad para proveedores."
      : "Tuveloz | Customer Choice. Provider Freedom.";
    translateInterface(document.body, language);
    const observer = new MutationObserver(() => {
      window.queueMicrotask(() => translateInterface(document.body, language));
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["placeholder", "title", "aria-label"],
    });
    return () => observer.disconnect();
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
  const { language, setLanguage } = useSiteLanguage();
  const [available, setAvailable] = useState(false);
  const nextLanguage = language === "en" ? "es" : "en";

  useEffect(() => {
    // After paint, matching how the rest of the site defers client-only state,
    // so the server and client first render agree.
    const ready = pathHasSpanish(window.location.pathname);
    queueMicrotask(() => setAvailable(ready));
  }, []);

  if (!available) return null;

  return (
    <button
      aria-label={language === "en" ? "Cambiar toda la página a español" : "Change the whole page to English"}
      className="site-language-button"
      data-language-control
      onClick={() => setLanguage(nextLanguage)}
      type="button"
    >
      <span aria-hidden="true">🌐</span>
      <strong>{language === "en" ? "Español" : "English"}</strong>
    </button>
  );
}
