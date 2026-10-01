import { requestPageMetadata } from "../../lib/request-page-metadata";
import { CustomerLander } from "../components/customer-lander";
import { InterfaceCopy } from "../components/interface-copy";
import type { Metadata } from "next";
import { SiteLink as Link } from "../components/site-link";
import { customerRequestConsentPresentation } from "../../lib/customer-job-consent";
import { CUSTOMER_JOB_POSTING_PAUSED } from "../../lib/launch-status";
import { CustomerRequestForm } from "../components/customer-request-form";
import { PublicSiteHeader } from "../components/public-chrome";

const englishMetadata: Metadata = {
  title: "For Customers — Real Quotes From Local Pros",
  description:
    "Tell us what your car needs once and compare real prices from local pros in Montgomery County, MD. Free to ask, free to compare, and you can always say no.",
  alternates: {
    canonical: "/post-job",
  },
};

export async function generateMetadata(): Promise<Metadata> {
  return requestPageMetadata(englishMetadata);
}

export default async function PostJobPage() {
  if (CUSTOMER_JOB_POSTING_PAUSED) {
    return <CustomerLander />;
  }

  const [en, es] = await Promise.all([
    customerRequestConsentPresentation("en"),
    customerRequestConsentPresentation("es"),
  ]);

  return (
    <InterfaceCopy><main className="account-shell">
      <PublicSiteHeader />

      <section className="account-main">
        <div className="account-welcome">
          <span className="account-kicker">Request service</span>
          <h1>Tell us what your car needs.</h1>
          <p>
            Post it once, compare prices from local pros, and pick the one you
            like — or none of them. Up to you.
          </p>
          <small>
            TUVELOZ does not employ, hire, train, assign, or place anyone on
            payroll. Customers select an independent provider business for an
            exact approved service.
          </small>
        </div>

        <CustomerRequestForm
          presentations={{ en, es }}
        />

        <div className="hero-actions" style={{ marginTop: 24 }}>
          <Link className="button primary" href="/account?role=customer&mode=create">
            Create a customer account <span>→</span>
          </Link>
          <Link className="button secondary" href="/join#provider-apply">
            Apply as an independent provider
          </Link>
        </div>
      </section>
    </main></InterfaceCopy>
  );
}
