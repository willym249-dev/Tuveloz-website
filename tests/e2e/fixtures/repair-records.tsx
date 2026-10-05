import React from "react";
import { createRoot } from "react-dom/client";
import RepairRecordsPage from "../../../app/repair-records/page";
import { SiteLanguageProvider } from "../../../app/components/site-language";
import "../../../app/globals.css";
import "../../../app/repair-records/repair-records.css";

createRoot(document.getElementById("root")!).render(
  <SiteLanguageProvider initialLanguage={window.location.search.includes("spanish") ? "es" : "en"}>
    <RepairRecordsPage />
  </SiteLanguageProvider>,
);
