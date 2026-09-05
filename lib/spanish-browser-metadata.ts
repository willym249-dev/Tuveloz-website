import { englishPathFor, spanishPathFor } from "./spanish-routes";
import { spanishText } from "./spanish-dictionary";

/** Keep reviewed Spanish metadata intact when the client restores English JSX. */
export function synchronizeSpanishMetadata(document: Document, pathname: string) {
  const englishPath = englishPathFor(pathname);
  if (englishPath === null) return;
  const canonical = `https://tuveloz.com${spanishPathFor(englishPath)}`;
  const set = (selector: string, attribute: string, value: string) => {
    document.querySelectorAll(selector).forEach((element) => {
      if (element.getAttribute(attribute) !== value) element.setAttribute(attribute, value);
    });
  };
  set('link[rel="canonical"]', "href", canonical);
  set('meta[property="og:url"]', "content", canonical);
  set('meta[property="og:locale"]', "content", "es_US");
  document.querySelectorAll(
    'meta[name="description"], meta[property="og:title"], meta[property="og:description"], meta[name="twitter:title"], meta[name="twitter:description"]',
  ).forEach((element) => {
    const source = element.getAttribute("content");
    if (!source) return;
    const translated = spanishText[source];
    if (translated && translated !== source) element.setAttribute("content", translated);
  });
}
