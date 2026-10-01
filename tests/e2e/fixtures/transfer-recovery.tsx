import React from "react";
import { createRoot } from "react-dom/client";
import { StripePaymentAdmin } from "../../../app/components/stripe-payment-admin";
import "../../../app/globals.css";

createRoot(document.getElementById("root")!).render(<main className="admin-shell"><StripePaymentAdmin /></main>);
