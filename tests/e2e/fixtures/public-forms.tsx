import React from "react";
import { createRoot } from "react-dom/client";
import FleetPage from "../../../app/fleet/page";
import { LaunchUpdatesForm } from "../../../app/components/launch-updates-form";
import { SiteLanguageProvider } from "../../../app/components/site-language";
import "../../../app/globals.css";

const spanish = window.location.pathname.startsWith("/es/");

createRoot(document.getElementById("root")!).render(
  <SiteLanguageProvider initialLanguage={spanish ? "es" : "en"}>
    {window.location.pathname === "/fleet" ? <FleetPage /> : (
      <main className="account-shell">
        <section className="account-main">
          <div className="account-card">
            <LaunchUpdatesForm source="browser-form-check" spanish={spanish} />
          </div>
        </section>
      </main>
    )}
  </SiteLanguageProvider>,
);
