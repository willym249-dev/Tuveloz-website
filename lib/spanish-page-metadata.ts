import type { Metadata } from "next";
import { spanishText } from "./spanish-dictionary";
import { spanishPathFor } from "./spanish-routes";

const copy = (value: string) => spanishText[value] ?? value;

/** Resolve metadata before React renders it, so HTML and hydration agree. */
export function spanishPageMetadata(source: Metadata, englishPath: string): Metadata {
  const path = spanishPathFor(englishPath);
  if (!path) return source;
  const canonical = `https://tuveloz.com${path}`;
  let title = source.title;
  if (typeof title === "string") {
    // Page titles inherit this exact template from the root layout. The
    // dictionary contains the reviewed, fully rendered search title.
    title = { absolute: copy(`${title} | Tuveloz`) };
  } else if (title) {
    title = { ...title };
    if ("default" in title) title.default = copy(title.default);
    if ("absolute" in title) title.absolute = copy(title.absolute);
  }
  return {
    ...source,
    title,
    description: source.description ? copy(source.description) : source.description,
    alternates: { ...source.alternates, canonical },
    ...(source.openGraph ? {
      openGraph: {
        ...source.openGraph,
        ...(typeof source.openGraph.title === "string" ? { title: copy(source.openGraph.title) } : {}),
        ...(source.openGraph.description ? { description: copy(source.openGraph.description) } : {}),
        url: canonical,
        locale: "es_US",
      },
    } : {}),
    ...(source.twitter ? {
      twitter: {
        ...source.twitter,
        ...(typeof source.twitter.title === "string" ? { title: copy(source.twitter.title) } : {}),
        ...(source.twitter.description ? { description: copy(source.twitter.description) } : {}),
      },
    } : {}),
  };
}
