import React from "react";
import { createRoot } from "react-dom/client";
import { EvidenceUpload } from "../../../app/components/provider-evidence-upload";
import "../../../app/globals.css";

const query = new URLSearchParams(window.location.search);
createRoot(document.getElementById("root")!).render(
  <main style={{ margin: "20px auto", maxWidth: 640, padding: 16 }}>
    <EvidenceUpload
      preferredLanguage={query.has("spanish") ? "Spanish" : "English"}
      requirement={{ code: "general_liability_insurance", requiresExpiration: true }}
      serviceCode="fixture_service"
      onUploaded={async () => {
        if (query.has("refresh-fails")) throw new Error("synthetic refresh failure");
      }}
    />
  </main>,
);
