import React from "react";
import { createRoot } from "react-dom/client";
import ProvidersDirectoryPage from "../../../app/providers/page";
import SystemStatusPage from "../../../app/system-status/page";
import { SiteLanguageProvider } from "../../../app/components/site-language";
import "../../../app/globals.css";

createRoot(document.getElementById("root")!).render(
  <SiteLanguageProvider initialLanguage="en">
    {window.location.pathname === "/providers"
      ? <ProvidersDirectoryPage />
      : <SystemStatusPage />}
  </SiteLanguageProvider>,
);
