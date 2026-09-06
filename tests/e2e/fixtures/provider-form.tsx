import React from "react";
import { createRoot } from "react-dom/client";
import { ProviderSignupForm } from "../../../app/components/provider-signup-form";
import { SiteLanguageButton, SiteLanguageProvider } from "../../../app/components/site-language";
import "../../../app/globals.css";

// The actual form and language controls, without database or mail credentials.
createRoot(document.getElementById("root")!).render(
  <SiteLanguageProvider initialLanguage={window.location.pathname.startsWith("/es/") ? "es" : "en"}>
    <main style={{ margin: "20px auto", maxWidth: 720, padding: 16 }}>
      <SiteLanguageButton />
      <div id="provider-apply" data-manual-language>
        <ProviderSignupForm />
      </div>
    </main>
  </SiteLanguageProvider>,
);
