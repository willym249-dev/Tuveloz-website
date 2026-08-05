import type { Metadata } from "next";
import { PublicInfoPage } from "../components/public-info-page";

export const metadata: Metadata = {
  title: "Provider Requirements",
  description:
    "What Tuveloz asks independent vehicle-service providers to document in Montgomery County, MD — registration, insurance, customer paperwork, and service-specific rules.",
  alternates: { canonical: "/provider-requirements" },
};

/**
 * The full legal detail lives here rather than on the marketing pages and the
 * application itself. Applicants see a one-line summary near the form and the
 * exact documents their own selections require; anyone who wants the whole
 * picture before starting can read it here.
 */
export default function ProviderRequirementsPage() {
  return (
    <PublicInfoPage
      kicker="Provider requirements"
      title="What's required depends on the services you choose."
      intro="Nothing here is asked of every provider. When you apply, Tuveloz shows you the exact documents your selected jobs require — and skips the step entirely when your selections require none. This page is the complete reference behind that."
      sections={[
        {
          title: "Applications are accepted for review",
          text: "Applying and selecting services does not authorize real customer work. Each service opens to real jobs only after its legal, insurance, and launch requirements are documented and approved.",
          points: [
            "Free to apply — no listing fee and no subscription",
            "No exclusivity: you can work other platforms at the same time",
            "You keep 100% of the price you quote",
          ],
        },
        {
          title: "Montgomery County repair registration",
          text: "Montgomery County has no unregistered simple-repair lane. A mobile repair or maintenance business must hold the County Office of Consumer Protection registration, and Tuveloz must verify a current certificate before approving those services. You can still apply before you have it — we will show you what to obtain.",
          points: [
            "Applies to motor-vehicle repair, maintenance, and towing services",
            "Montgomery County OCP registration guidance and County Code Chapter 31A are the official sources",
            "Independent owner-operators need a real business and current registration",
          ],
        },
        {
          title: "Maryland customer paperwork",
          text: "Montgomery County requires a customer authorization before work begins and an invoice afterward. It also requires an estimate when a customer requests one for work over $25, and the return of replaced parts.",
        },
        {
          title: "Insurance and coverage",
          text: "Where a service requires insurance, coverage must be confirmed by your broker for each exact service before that service is activated. Tuveloz does not provide, arrange, or substitute for your coverage.",
        },
        {
          title: "Environmental rules",
          text: "Paid car-wash water cannot run into a storm drain or stream. Montgomery County requires wash water to reach the sanitary sewer through an allowed connection, or to be captured for off-site disposal.",
        },
        {
          title: "Service-specific rules",
          text: "A few services carry their own limits that apply as soon as you offer them.",
          points: [
            "Window tint must stay inside the legal limits for the vehicle and state",
            "Diagnostics and pre-purchase checks may not be advertised as official state inspections",
            "A removed tire stays with the customer unless a lawful warranty or trade-in return applies",
          ],
        },
        {
          title: "Identity, tax, and payout setup",
          text: "Every approved provider completes a separate identity check and tax and payout setup before a first payout. That is where the required tax form (IRS Form W-9) is signed; Tuveloz issues a 1099 for applicable annual earnings, as the Provider Agreement requires.",
        },
        {
          title: "You remain an independent business",
          text: "TUVELOZ does not employ, hire, train, assign, or supervise providers. Lawful employment classification, work authorization, wages, payroll taxes, workers' compensation, supervision, and personnel records remain the provider business's responsibility.",
        },
      ]}
    />
  );
}
