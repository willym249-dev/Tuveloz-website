import React from "react";
import { createRoot } from "react-dom/client";
import { CustomerAccountTools } from "../../../app/components/customer-account-tools";
import "../../../app/globals.css";

createRoot(document.getElementById("root")!).render(
  <main style={{ padding: 16, maxWidth: 900, margin: "auto" }}>
    <h1>Customer account</h1>
    <CustomerAccountTools view={window.location.search.includes("saved") ? "saved" : "settings"} />
  </main>,
);
