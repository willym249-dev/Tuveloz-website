import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { QuotePaymentCard } from "../../../app/components/quote-payment-card";
// @ts-expect-error The isolated Vite test exposes this private component in memory only.
import { ActiveQuotePaymentCard } from "../../../app/components/quote-payment-card";
import { SiteLanguageProvider, useSiteLanguage } from "../../../app/components/site-language";
import "../../../app/globals.css";

function Fixture() {
  const { language, setLanguage } = useSiteLanguage();
  const [quote, setQuote] = useState({
    id: "synthetic-quote-a", providerName: "SYNTHETIC provider A",
    priceCents: "10000", laborPriceCents: "10000", partsPriceCents: "0",
    customerFeeRateBps: 500, customerFeeCents: "500", customerTotalCents: "10500", scopeVersion: 1,
  });
  const [accessToken, setAccessToken] = useState("synthetic-token-a");
  const [visible, setVisible] = useState(true);
  const Component = new URLSearchParams(location.search).has("closed") ? QuotePaymentCard : ActiveQuotePaymentCard;
  return (
    <main style={{ padding: 16 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button onClick={() => setQuote(value => ({ ...value, scopeVersion: value.scopeVersion + 1 }))}>Change scope</button>
        <button onClick={() => setQuote(value => ({ ...value, priceCents: "20000", laborPriceCents: "20000", customerFeeCents: "1000", customerTotalCents: "21000" }))}>Change price</button>
        <button onClick={() => setQuote(value => ({ ...value, id: "synthetic-quote-b", providerName: "SYNTHETIC provider B" }))}>Change quote</button>
        <button onClick={() => setAccessToken("synthetic-token-b")}>Change access</button>
        <button onClick={() => setLanguage(language === "en" ? "es" : "en")}>Change language</button>
        <button onClick={() => setVisible(false)}>Leave quote</button>
      </div>
      {visible && <Component accessToken={accessToken} quote={quote} />}
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<SiteLanguageProvider><Fixture /></SiteLanguageProvider>);
