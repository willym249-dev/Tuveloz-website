import React from "react";
import { createRoot } from "react-dom/client";
import ProviderOnboardingPage from "../../../app/provider-onboarding/page";
import { SiteLanguageProvider } from "../../../app/components/site-language";
import "../../../app/globals.css";

createRoot(document.getElementById("root")!).render(
  <SiteLanguageProvider initialLanguage={window.location.search.includes("spanish") ? "es" : "en"}>
    <ProviderOnboardingPage />
  </SiteLanguageProvider>,
);
