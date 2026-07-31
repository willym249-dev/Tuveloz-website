import Link from "next/link";
import {
  CUSTOMER_JOB_POSTING_PAUSED_DETAIL,
  CUSTOMER_JOB_POSTING_PAUSED_MESSAGE,
} from "../../lib/launch-status";
import { SiteLanguageButton } from "../components/site-language";
import { BrandMark } from "../components/tuveloz-icons";

export default function PostJobPage() {
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
          <span className="account-kicker">Customer launch update</span>
          <h1>New job requests are temporarily paused.</h1>
          <p>{CUSTOMER_JOB_POSTING_PAUSED_MESSAGE}</p>
        </div>

        <section className="account-card">
          <div className="account-card-heading">
            <div>
              <span className="account-role">Signups remain open</span>
              <h2>You can still create your Tuveloz account.</h2>
            </div>
          </div>
          <p>{CUSTOMER_JOB_POSTING_PAUSED_DETAIL}</p>
          <p>
            Providers can still apply, complete their profiles, add approved services,
            and prepare their pricing while the local network grows.
          </p>
          <div className="hero-actions">
            <Link className="button primary" href="/account?role=customer&mode=create">
              Create a customer account <span>→</span>
            </Link>
            <Link className="button secondary" href="/join">
              Join as a provider
            </Link>
          </div>
          <p className="admin-note">
            Thank you for supporting Tuveloz while we build enough provider coverage
            to give customers useful choices.
          </p>
        </section>
      </section>
    </main>
  );
}
