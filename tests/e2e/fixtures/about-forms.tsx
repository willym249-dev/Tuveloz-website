import React from "react";
import { createRoot } from "react-dom/client";
import { TuvelozPublic } from "../../../app/page";
import { SiteLanguageProvider } from "../../../app/components/site-language";
import "../../../app/globals.css";
createRoot(document.getElementById("root")!).render(
  <SiteLanguageProvider initialLanguage={location.pathname.startsWith("/es/") ? "es" : "en"}>
    <TuvelozPublic view="about" />
  </SiteLanguageProvider>,
);
