"use client";

import type { ComponentProps } from "react";
import Link from "next/link";
import { spanishInterfaceHref } from "../../lib/spanish-react";
import { englishPathFor } from "../../lib/spanish-routes";
import { useSiteLanguage } from "./site-language";

/** Spanish pages and signup entry points use a full document navigation. */
export function SiteLink({ href, ...props }: ComponentProps<"a"> & { href: string }) {
  const { language } = useSiteLanguage();
  const destination = language === "es" ? spanishInterfaceHref(href) : href;
  const path = destination.split(/[?#]/, 1)[0];
  if (englishPathFor(path) !== null || path === "/account" || destination === "/join#provider-apply") {
    return <a {...props} href={destination} />;
  }
  return <Link {...props} href={destination} />;
}
