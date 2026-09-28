import React from "react";
import { createRoot } from "react-dom/client";
import StripeSuccessPage from "../../../app/success/page";
import { SiteLanguageProvider } from "../../../app/components/site-language";
import "../../../app/globals.css";

createRoot(document.getElementById("root")!).render(
  <SiteLanguageProvider><StripeSuccessPage /></SiteLanguageProvider>,
);
