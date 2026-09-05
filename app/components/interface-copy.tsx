"use client";

import type { ReactNode } from "react";
import { spanishInterfaceTree } from "../../lib/spanish-react";
import { useSiteLanguage } from "./site-language";

/** Use the same reviewed text for server rendering and browser updates. */
export function InterfaceCopy({ children }: { children: ReactNode }) {
  const { language } = useSiteLanguage();
  return language === "es" ? spanishInterfaceTree(children) : children;
}
