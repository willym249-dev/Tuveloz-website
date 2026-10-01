import React from "react";
import { createRoot } from "react-dom/client";
import { CustomerRequestForm } from "../../../app/components/customer-request-form";
import MyRequestPage from "../../../app/my-request/page";
import { customerRequestConsentPresentation } from "../../../lib/customer-job-consent";
import { SiteLanguageProvider, useSiteLanguage } from "../../../app/components/site-language";
import "../../../app/globals.css";

async function start() {
  const [en, es] = await Promise.all([customerRequestConsentPresentation("en"), customerRequestConsentPresentation("es")]);
  function Fixture() {
    const { language, setLanguage } = useSiteLanguage();
    if (location.pathname === "/my-request") return <MyRequestPage />;
    return <main style={{ padding: 16 }}>
      <button data-manual-language onClick={() => setLanguage(language === "en" ? "es" : "en")}>Switch language</button>
      <CustomerRequestForm presentations={{ en, es }} />
    </main>;
  }
  createRoot(document.getElementById("root")!).render(<SiteLanguageProvider><Fixture /></SiteLanguageProvider>);
}
void start();
