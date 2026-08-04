import type { Metadata } from "next";
import Link from "next/link";
import {
  CUSTOMER_REQUEST_ACCEPTANCE_TEXT,
  CUSTOMER_REQUEST_AGREEMENT_KEY,
  CUSTOMER_REQUEST_AGREEMENT_VERSION,
  CUSTOMER_REQUEST_PRIVACY_ACKNOWLEDGMENT_TEXT,
  CUSTOMER_REQUEST_PRIVACY_AGREEMENT_KEY,
  CUSTOMER_REQUEST_PRIVACY_AGREEMENT_VERSION,
  customerRequestAgreementHash,
  customerRequestPrivacyAgreementHash,
} from "../../lib/customer-job-scope";
import {
  CUSTOMER_JOB_POSTING_PAUSED,
  CUSTOMER_JOB_POSTING_PAUSED_DETAIL,
  CUSTOMER_JOB_POSTING_PAUSED_MESSAGE,
} from "../../lib/launch-status";
import { CustomerRequestForm } from "../components/customer-request-form";
import { SiteLanguageButton } from "../components/site-language";
import { BrandMark } from "../components/tuveloz-icons";

export const metadata: Metadata = {
  title: "Customer Launch Status",
  description:
    "Customer accounts are open; service requests are not yet available. See where Tuveloz stands and get ready for launch in Montgomery County, MD.",
};

export default async function PostJobPage() {
  if (CUSTOMER_JOB_POSTING_PAUSED) {
    return (
      <main className="account-shell">
        <header className="account-header">
          <Link className="brand" href="/" aria-label="Tuveloz home">
            <BrandMark />
            <span>Tuveloz</span>
          </Link>
          <div className="account-header-actions">
            <SiteLanguageButton />
            <Link className="account-home-link" href="/account">
              Sign up / Sign in
            </Link>
          </div>
        </header>

        <section className="account-main">
          <div className="account-welcome">
            <span className="account-kicker">Customer launch status</span>
            <h1>Customer accounts are open. Job requests are not.</h1>
            <p>Customer service requests are not yet available. {CUSTOMER_JOB_POSTING_PAUSED_MESSAGE}</p>
            <small>{CUSTOMER_JOB_POSTING_PAUSED_DETAIL}</small>
          </div>

          <section className="account-card" style={{ marginTop: 32, minHeight: 0 }}>
            <div className="account-card-heading">
              <div>
                <span className="account-role">Available now</span>
                <h2>Prepare for launch without entering job details.</h2>
              </div>
            </div>
            <p>
              Create a customer account, apply as an independent provider, or use
              Tuveloz AI for bilingual guidance. Nothing on this page submits a
              request, contacts a provider, books service, or processes a payment.
            </p>
            <div className="hero-actions" style={{ marginTop: 24 }}>
              <Link className="button primary" href="/account?role=customer&mode=create">
                Create customer account <span>→</span>
              </Link>
              <Link className="button secondary" href="/join">
                Apply as an independent provider
              </Link>
              <a className="button ai" href="https://ai.tuveloz.com/">
                Open Tuveloz AI
              </a>
            </div>
          </section>
        </section>
      </main>
    );
  }

  const [acceptanceHash, privacyHash] = await Promise.all([
    customerRequestAgreementHash(),
    customerRequestPrivacyAgreementHash(),
  ]);

  return (
    <main className="account-shell">
      <header className="account-header">
        <Link className="brand" href="/" aria-label="Tuveloz home">
          <BrandMark />
          <span>Tuveloz</span>
        </Link>
        <div className="account-header-actions">
          <SiteLanguageButton />
          <Link className="account-home-link" href="/account">
            Sign up or sign in
          </Link>
        </div>
      </header>

      <section className="account-main">
        <div className="account-welcome">
          <span className="account-kicker">Request service</span>
          <h1>Tell us what your vehicle needs.</h1>
          <p>
            Post your request, compare quotes from local independent providers,
            and choose the one that works — or accept nothing at all.
          </p>
          <small>
            TUVELOZ does not employ, hire, train, assign, or place anyone on
            payroll. Customers select an independent provider business for an
            exact approved service.
          </small>
        </div>

        <CustomerRequestForm
          acceptanceKey={CUSTOMER_REQUEST_AGREEMENT_KEY}
          acceptanceVersion={CUSTOMER_REQUEST_AGREEMENT_VERSION}
          acceptanceHash={acceptanceHash}
          acceptanceText={CUSTOMER_REQUEST_ACCEPTANCE_TEXT}
          privacyKey={CUSTOMER_REQUEST_PRIVACY_AGREEMENT_KEY}
          privacyVersion={CUSTOMER_REQUEST_PRIVACY_AGREEMENT_VERSION}
          privacyHash={privacyHash}
          privacyText={CUSTOMER_REQUEST_PRIVACY_ACKNOWLEDGMENT_TEXT}
        />

        <div className="hero-actions" style={{ marginTop: 24 }}>
          <Link className="button primary" href="/account?role=customer&mode=create">
            Create a customer account <span>→</span>
          </Link>
          <Link className="button secondary" href="/join">
            Apply as an independent provider
          </Link>
        </div>
      </section>
    </main>
  );
}
