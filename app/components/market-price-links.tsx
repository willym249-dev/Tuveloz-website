import { marketplacePartsSearchUrl } from "../../lib/service-matching";

type MarketPriceLinksProps = {
  context?: "decision" | "quote";
  vehicle: string;
  service: string;
  preference: string;
};

export function MarketPriceLinks({
  context = "quote",
  vehicle,
  service,
  preference,
}: MarketPriceLinksProps) {
  return (
    <aside className="market-price-check" aria-label="Marketplace part-price comparison">
      <div className="market-price-heading">
        <strong>
          {context === "decision"
            ? "Compare parts before you decide"
            : "Check current marketplace prices"}
        </strong>
        <details className="legal-help">
          <summary aria-label="How does the marketplace price check work?">?</summary>
          <span>
            These buttons open current marketplace listings based on the vehicle and
            service. Prices are a comparison guide only. Confirm the exact engine,
            trim, part number, condition, shipping, and vehicle fit before buying.
          </span>
        </details>
      </div>
      <p>
        {context === "decision"
          ? "See current OEM and aftermarket listings before choosing whether you or the provider should supply the parts."
          : "Compare the provider’s parts amount with current listings."}
      </p>
      <div className="market-price-actions">
        <a
          className={preference === "OEM" ? "preferred" : ""}
          href={marketplacePartsSearchUrl(vehicle, service, "OEM")}
          target="_blank"
          rel="noreferrer"
        >
          Check OEM prices ↗
          {preference === "OEM" && <small>Customer preference</small>}
        </a>
        <a
          className={preference === "Aftermarket" ? "preferred" : ""}
          href={marketplacePartsSearchUrl(vehicle, service, "Aftermarket")}
          target="_blank"
          rel="noreferrer"
        >
          Check aftermarket prices ↗
          {preference === "Aftermarket" && <small>Customer preference</small>}
        </a>
      </div>
    </aside>
  );
}
