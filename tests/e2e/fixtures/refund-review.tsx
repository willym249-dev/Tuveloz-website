import React from "react";
import { createRoot } from "react-dom/client";
import { StripeRefundAdmin } from "../../../app/components/stripe-refund-admin";
import "../../../app/globals.css";

createRoot(document.getElementById("root")!).render(<main className="admin-shell"><StripeRefundAdmin /></main>);
