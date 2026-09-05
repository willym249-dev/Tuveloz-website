"use client";

import type { ComponentProps } from "react";
import Link from "next/link";
import { spanishInterfaceHref } from "../../lib/spanish-react";
import { englishPathFor } from "../../lib/spanish-routes";
import { useSiteLanguage } from "./site-language";

/** Spanish twins are served by the Worker, so use a document navigation there. */
export function SiteLink({ href, ...props }: ComponentProps<"a"> & { href: string }) {
  const { language } = useSiteLanguage();
  const destination = language === "es" ? spanishInterfaceHref(href) : href;
  if (englishPathFor(destination.split(/[?#]/, 1)[0]) !== null) {
    return <a {...props} href={destination} />;
  }
  return <Link {...props} href={destination} />;
}
