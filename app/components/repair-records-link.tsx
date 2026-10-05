"use client";

import Link from "next/link";
import { useSiteLanguage, type SiteLanguage } from "./site-language";

export function RepairRecordsLink({ requestId, language: selectedLanguage }: {
  requestId?: string;
  language?: SiteLanguage;
}) {
  const { language } = useSiteLanguage();
  const currentLanguage = selectedLanguage ?? language;
  const spanish = currentLanguage === "es";
  const query = new URLSearchParams({ lang: currentLanguage });
  if (requestId) query.set("requestId", requestId);
  return (
    <Link className="button secondary" data-manual-language
      href={`/repair-records?${query}`}>
      {spanish ? "Ver presupuesto y factura" : "Review estimate and invoice"}
    </Link>
  );
}
