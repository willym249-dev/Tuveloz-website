"use client";

import type { CustomerConsentPresentation } from "../../lib/customer-job-consent";

export function CustomerConsentDocuments({ consent, privacy = false }: {
  consent: CustomerConsentPresentation; privacy?: boolean;
}) {
  return <div data-manual-language lang={consent.language}>
    <small>{consent.language === "es" ? "Los enlaces se abren en otra pestaña." : "Links open in a new tab."}</small>
    <ul>
      {consent.documents.filter(document => privacy ? document.key === "privacy" : document.key !== "privacy")
        .map(document => <li key={document.key}>
          <a href={document.href} target="_blank" rel="noopener noreferrer">{document.title}</a>
        </li>)}
    </ul>
  </div>;
}
