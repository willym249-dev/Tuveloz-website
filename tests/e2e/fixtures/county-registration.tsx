import React from "react";
import { createRoot } from "react-dom/client";
import { CountyRegistrationCheck } from "../../../app/admin/provider-compliance/county-registration-check";
import "../../../app/globals.css";
createRoot(document.getElementById("root")!).render(
  <main style={{ maxWidth: 620, padding: 12, margin: "auto" }}>
    <CountyRegistrationCheck providerId="synthetic-provider" evidenceId="synthetic-document" disabled={new URLSearchParams(location.search).has("quarantined")} />
  </main>,
);
