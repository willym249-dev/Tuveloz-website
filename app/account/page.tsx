import Link from "next/link";
import { SiteLanguageButton } from "../components/site-language";
import { BrandMark } from "../components/tuveloz-icons";

export default function PrivateAccessPage() {
  return (
    <main className="account-shell">
      <header className="account-header">
        <Link className="brand" href="/" aria-label="Tuveloz home">
          <BrandMark />
          <span>Tuveloz</span>
        </Link>
        <div className="account-header-actions">
          <SiteLanguageButton />
          <Link className="account-home-link" href="/">
            Home
          </Link>
        </div>
      </header>

      <section className="account-main">
        <div className="account-welcome">
          <span className="account-kicker">Private Tuveloz access</span>
          <h1>Your workspace stays on Tuveloz.</h1>
          <p>
            Customers and approved providers use private Tuveloz links. No
            outside account or extra password is required.
          </p>
        </div>

        <div className="account-grid">
          <section className="account-card">
            <span className="account-role">Customer access</span>
            <h2>Keep your request link.</h2>
            <p>
              After you post a job, Tuveloz opens your private request page.
              Use that link to review provider quotes and job updates.
            </p>
            <div className="account-feature-list">
              <span>Review quotes and job updates</span>
              <span>Choose the provider that works for you</span>
              <span>Book the same provider again</span>
            </div>
            <Link className="button primary account-button" href="/#request">
              Post a job <span>→</span>
            </Link>
          </section>

          <section className="account-card">
            <span className="account-role">Provider access</span>
            <h2>Use your provider workspace link.</h2>
            <p>
              Tuveloz gives approved providers a private workspace link for
              matching jobs, quotes, schedules, and business tools.
            </p>
            <div className="account-feature-list">
              <span>Matching jobs, quotes, and schedule</span>
              <span>Business page and work gallery</span>
              <span>QR code and printable business cards</span>
            </div>
            <Link className="button secondary account-button" href="/#providers">
              Apply to join <span>→</span>
            </Link>
          </section>

          <section className="account-card account-help-card">
            <div>
              <span className="account-role">Workspace help</span>
              <h2>Need your private link again?</h2>
              <p>
                Email us from the same address used for your request or provider
                application so we can verify and help you.
              </p>
            </div>
            <a
              className="button secondary account-button"
              href="mailto:hello@tuveloz.com?subject=Private%20workspace%20link"
            >
              Email Tuveloz <span>→</span>
            </a>
          </section>
        </div>

        <p className="account-private-note">
          Keep every private link to yourself. Anyone with the link can open
          that workspace.
        </p>
      </section>
    </main>
  );
}
