import React from "react";
import { createRoot } from "react-dom/client";
import PrivacyCenterPage from "../../../app/privacy-center/page";
import { SiteLanguageProvider } from "../../../app/components/site-language";
import "../../../app/globals.css";

createRoot(document.getElementById("root")!).render(
  <SiteLanguageProvider initialLanguage="en">
    <PrivacyCenterPage />
  </SiteLanguageProvider>,
);
