import React from "react";
import { createRoot } from "react-dom/client";
import { JobPostingPauseNotice } from "../../../app/components/job-posting-pause-notice";
import ProviderOnboardingPage from "../../../app/provider-onboarding/page";
import { SiteLanguageProvider } from "../../../app/components/site-language";
import "../../../app/globals.css";
import { SERVICE_POLICY_CATALOG, PROVIDER_PATHWAY_LABELS, PROVIDER_LEVEL_LABELS } from "../../../lib/provider-policy";
import { getRequiredDocuments } from "../../../lib/service-tiers";
import { providerPolicyPresentation } from "../../../lib/provider-policy-acceptance";
import { identityConsentPresentation } from "../../../lib/identity-verification-policy";

// Test-only catalog: exercise actual service copy, never real applicant data.
Object.assign(window, { onboardingTest: {
  services: Object.values(SERVICE_POLICY_CATALOG).filter(service => service.code !== "general_auto_repair").map(service => ({
    ...service,
    requirements: [...new Map(Object.keys(PROVIDER_PATHWAY_LABELS).flatMap(pathway =>
      getRequiredDocuments(service.code, pathway as keyof typeof PROVIDER_PATHWAY_LABELS)
    ).map(doc => [doc.code, doc])).values()],
  })),
  pathways: Object.values(PROVIDER_PATHWAY_LABELS), levels: Object.values(PROVIDER_LEVEL_LABELS),
  policies: { en: providerPolicyPresentation("en"), es: providerPolicyPresentation("es") },
  identities: { en: identityConsentPresentation("en"), es: identityConsentPresentation("es") },
} });

createRoot(document.getElementById("root")!).render(
  <SiteLanguageProvider initialLanguage={window.location.search.includes("spanish") ? "es" : "en"}>
    <JobPostingPauseNotice />
    <ProviderOnboardingPage />
  </SiteLanguageProvider>,
);
