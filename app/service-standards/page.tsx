import Link from "next/link";
import {
  CUSTOMER_AUTHORIZATION_PRINCIPLES,
  PROVIDER_FREEDOM_PRINCIPLES,
  SERVICE_SAFETY_POLICIES,
  type ServiceAvailability,
} from "../../lib/service-safety-policy";
import { CUSTOMER_JOB_POSTING_PAUSED, MARKETPLACE_MODE } from "../../lib/launch-status";
import { SiteLanguageButton } from "../components/site-language";
import { BrandMark } from "../components/tuveloz-icons";

const availabilityCopy: Record<ServiceAvailability, {
  label: string;
  heading: string;
  description: string;
}> = {
  standard: {
    label: "Planning category",
    heading: "Potential standard-review services",
    description: "These are planning classifications, not active Tuveloz services. A future release could activate an exact service only after the provider, area, customer-document process, and applicable registration and insurance requirements are approved.",
  },
  gated: {
    label: "Extra-review planning category",
    heading: "Would require service-specific review",
    description: "These are not currently available. Tuveloz could activate an exact category in a future release only after the applicable legal, safety, credential, insurance, and environmental checks are completed.",
  },
  paused: {
    label: "Not available",
    heading: "Paused pending separate review",
    description: "These categories are intentionally unavailable during the launch pilot because their fire, custody, transportation, insurance, or other risks need a separate legal and operational framework.",
  },
};

export default function ServiceStandardsPage() {
  const marketplaceIsOnboardingOnly = CUSTOMER_JOB_POSTING_PAUSED || String(MARKETPLACE_MODE) !== "live";

  return (
    <main className="account-shell">
      <header className="account-header">
        <Link className="brand" href="/" aria-label="Tuveloz home">
          <BrandMark />
          <span>Tuveloz</span>
        </Link>
        <div className="account-header-actions">
          <SiteLanguageButton />
          <Link className="account-home-link" href="/account">Sign up or sign in</Link>
        </div>
      </header>

      <section className="account-main">
        <div className="account-welcome">
          <span className="account-kicker">Freedom with specific safety gates</span>
          <h1>Tuveloz service standards.</h1>
          <p>
            Providers remain independent businesses. For any future transaction launch, Tuveloz
            would approve each exact service individually, record customer authorization, and
            require the applicable legal, credential, safety, insurance, and environmental gates.
          </p>
          {marketplaceIsOnboardingOnly && (
            <p className="admin-note">
              Current status: provider onboarding only. All real services, customer job requests,
              quotes, bookings, appointments, and payments are disabled. The categories below
              explain possible future review levels; they do not show live availability.
            </p>
          )}
        </div>

        <div className="account-grid">
          <section className="account-card">
            <div className="account-card-heading">
              <div>
                <span className="account-role">Independent-provider model</span>
                <h2>What providers continue to control</h2>
              </div>
            </div>
            <ul>
              {PROVIDER_FREEDOM_PRINCIPLES.map((principle) => <li key={principle}>{principle}</li>)}
            </ul>
            <p className="admin-note">
              Credential, privacy, documentation, safety, and customer-authorization rules do
              not give Tuveloz control over a provider&apos;s lawful repair method or independent business.
            </p>
          </section>

          <section className="account-card">
            <div className="account-card-heading">
              <div>
                <span className="account-role">Customer control</span>
                <h2>What customers authorize</h2>
              </div>
            </div>
            <ul>
              {CUSTOMER_AUTHORIZATION_PRINCIPLES.map((principle) => <li key={principle}>{principle}</li>)}
            </ul>
            <p>
              Customers and selected providers may also add private, dated condition records.
              A photo or note does not approve extra work, increase the price, replace an itemized
              invoice, guarantee a result, or waive either party&apos;s rights.
            </p>
            <div className="hero-actions">
              <Link className="button secondary" href="/job-authorizations">
                Open Job agreements <span>→</span>
              </Link>
              <Link className="button secondary" href="/job-evidence">
                Open private job records <span>→</span>
              </Link>
            </div>
          </section>

          {(["standard", "gated", "paused"] as ServiceAvailability[]).map((availability) => {
            const copy = availabilityCopy[availability];
            const policies = SERVICE_SAFETY_POLICIES.filter((policy) => policy.availability === availability);
            return (
              <section className="account-card" key={availability}>
                <div className="account-card-heading">
                  <div>
                    <span className="account-role">{copy.label}</span>
                    <h2>{copy.heading}</h2>
                  </div>
                  <span className="account-count">{policies.length}</span>
                </div>
                <p>{copy.description}</p>
                <div className="account-request-list">
                  {policies.map((policy) => (
                    <article className="account-request" key={policy.key}>
                      <span>
                        <strong>{policy.title}</strong>
                        <small>{policy.riskTier.replaceAll("-", " ")} review</small>
                        <p>{policy.activationSummary}</p>
                        <details className="workspace-tools">
                          <summary>Required checks</summary>
                          <div className="workspace-tool-content">
                            <ul>
                              {policy.requiredChecks.map((check) => <li key={check}>{check}</li>)}
                            </ul>
                          </div>
                        </details>
                        <details className="workspace-tools">
                          <summary>Customer disclosures</summary>
                          <div className="workspace-tool-content">
                            <ul>
                              {policy.customerDisclosures.map((disclosure) => <li key={disclosure}>{disclosure}</li>)}
                            </ul>
                          </div>
                        </details>
                      </span>
                      <span className="account-status">
                        {availability === "standard" ? "planning" : availability}
                      </span>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}

          <section className="account-card">
            <div className="account-card-heading">
              <div>
                <span className="account-role">Marketplace boundary</span>
                <h2>What Tuveloz does not promise</h2>
              </div>
            </div>
            <p>
              Tuveloz does not perform vehicle services, guarantee a diagnosis or repair result,
              control a provider&apos;s lawful work method, provide the provider&apos;s warranty, guarantee
              arrival times, or authorize work on a customer&apos;s behalf.
            </p>
            <div className="hero-actions">
              <Link className="button primary" href="/join">Join as a provider</Link>
              <Link className="button secondary" href="/account?role=customer&mode=create">Create customer account</Link>
              <Link className="button secondary" href="/privacy-center">Privacy and data choices</Link>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
