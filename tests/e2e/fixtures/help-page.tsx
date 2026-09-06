import React from "react";
import { createRoot } from "react-dom/client";
import { TuvelozAiAssistant } from "../../../app/components/tuveloz-ai-assistant";
import { SiteLanguageProvider } from "../../../app/components/site-language";
import "../../../app/globals.css";

createRoot(document.getElementById("root")!).render(
  <SiteLanguageProvider initialLanguage={window.location.pathname.startsWith("/es/") ? "es" : "en"}>
    <TuvelozAiAssistant />
  </SiteLanguageProvider>,
);
