import { InterfaceCopy } from "./interface-copy";

type HeroMarketplacePreviewProps = {
  audience: "customer" | "provider";
  customerRequestsOpen?: boolean;
};

const CUSTOMER_DETAILS = [
  {
    title: "The provider",
    text: "Business details and approved services",
  },
  {
    title: "The work",
    text: "What the provider plans to do and what it costs",
  },
  {
    title: "Your choice",
    text: "Hire one provider or decline every quote",
  },
] as const;

const PROVIDER_DETAILS = [
  {
    title: "Your services",
    text: "Choose only the work you want to offer",
  },
  {
    title: "Your checklist",
    text: "See what each selected service requires",
  },
  {
    title: "Your progress",
    text: "Save your application and finish later",
  },
] as const;

export function HeroMarketplacePreview({
  audience,
  customerRequestsOpen = false,
}: HeroMarketplacePreviewProps) {
  const providerView = audience === "provider";
  const details = providerView ? PROVIDER_DETAILS : CUSTOMER_DETAILS;

  return (
    <InterfaceCopy><aside
      aria-label={providerView ? "What providers can expect" : "What customers can compare"}
      className="hero-visual marketplace-preview"
    >
      <div className="marketplace-preview-header">
        <span>{providerView ? "A simpler application" : "Before you choose"}</span>
        <strong>
          {providerView
            ? "Apply for the work you already do."
            : "See the details that matter."}
        </strong>
      </div>

      <ol className="marketplace-preview-list">
        {details.map((detail, index) => (
          <li key={detail.title}>
            <span aria-hidden="true" className="marketplace-preview-number">
              {index + 1}
            </span>
            <div>
              <strong>{detail.title}</strong>
              <p>{detail.text}</p>
            </div>
          </li>
        ))}
      </ol>

      <p className="marketplace-preview-status">
        <span aria-hidden="true" />
        {providerView
          ? "Provider applications are open. Applying is free."
          : customerRequestsOpen
            ? "Customer requests and quotes are open."
            : "Customer requests and quotes are not open yet."}
      </p>
    </aside></InterfaceCopy>
  );
}
