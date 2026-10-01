import React from "react";
import { createRoot } from "react-dom/client";
import CustomerAgreementPage from "../../../app/customer-agreement/page";
import { SiteLanguageProvider } from "../../../app/components/site-language";
import "../../../app/globals.css";

createRoot(document.getElementById("root")!).render(
  <SiteLanguageProvider><CustomerAgreementPage /></SiteLanguageProvider>,
);
