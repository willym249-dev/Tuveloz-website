import React from "react";
import { createRoot } from "react-dom/client";
import AccountPage from "../../../app/account/page";
import { SiteLanguageProvider } from "../../../app/components/site-language";
import { SiteLink } from "../../../app/components/site-link";
import { InterfaceCopy } from "../../../app/components/interface-copy";
import "../../../app/globals.css";

const spanishEntry = window.location.pathname === "/es";
const role = new URLSearchParams(window.location.search).get("role") === "provider" ? "provider" : "customer";
createRoot(document.getElementById("root")!).render(
  <SiteLanguageProvider initialLanguage={spanishEntry ? "es" : "en"}>
    {spanishEntry ? <InterfaceCopy><SiteLink href={`/account?role=${role}&mode=create`}>Create a free account</SiteLink></InterfaceCopy> : <AccountPage />}
  </SiteLanguageProvider>,
);
