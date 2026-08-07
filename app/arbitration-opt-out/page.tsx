import type { Metadata } from "next";
import Link from "next/link";
import { ArbitrationOptOutForm } from "../components/arbitration-opt-out-form";
import { PublicPageShell } from "../components/public-page-shell";
import { TERMS_VERSION } from "../../lib/policies";

const BASE_URL = "https://tuveloz.com";

export const metadata: Metadata = {
  title: "Opt out of arbitration",
  description:
    "Decline the arbitration agreement in the Tuveloz Terms of Use. Free, takes one form, and has no effect on your account. You have 30 days from first accepting the Terms.",
  alternates: { canonical: `${BASE_URL}/arbitration-opt-out` },
};

export default function ArbitrationOptOutPage() {
  return (
    <PublicPageShell>
      <section className="public-info-hero">
        <span className="kicker">Your rights under the Terms</span>
        <h1>You can say no to arbitration. Here&apos;s the button.</h1>
        <p>
          Section 13 of our <Link href="/terms">Terms of Use</Link> says disputes
          go to arbitration instead of court. You don&apos;t have to agree to
          that. Tell us within <strong>30 days</strong> of first accepting the
          Terms and it doesn&apos;t apply to you — no cost, no forms to chase, no
          reason required.
        </p>
        <p>
          We built this page because a right you have to write an email to
          exercise is a right that&apos;s a little bit hidden. This is the same
          promise, made easy to use.
        </p>
      </section>

      <section className="public-info-grid" aria-labelledby="arbitration-opt-out-form-heading">
        <article className="fleet-inquiry-panel">
          <h2 id="arbitration-opt-out-form-heading">Opt out</h2>
          <ArbitrationOptOutForm />
        </article>
        <article>
          <h2>What happens after you do</h2>
          <ul>
            <li>
              <span aria-hidden="true">✓</span>
              Disputes between you and Tuveloz go to the state or federal courts
              in Montgomery County, Maryland
            </li>
            <li>
              <span aria-hidden="true">✓</span>
              The class-action waiver stops applying to you as well
            </li>
            <li>
              <span aria-hidden="true">✓</span>
              You get a written confirmation by email — keep it
            </li>
            <li>
              <span aria-hidden="true">✓</span>
              Nothing changes about your account, your pricing, or how your jobs
              are handled
            </li>
          </ul>
          <p>
            We won&apos;t treat you differently for opting out, and there is
            nothing you need to do afterward.
          </p>
        </article>
      </section>

      <section className="public-info-grid" aria-label="Questions about opting out">
        <article>
          <h2>Does this have to be the form?</h2>
          <p>
            No. Emailing{" "}
            <a href="mailto:hello@tuveloz.com">hello@tuveloz.com</a> with the
            subject &quot;Arbitration opt-out&quot; and the email address or
            phone number on your account works exactly the same. The Terms
            accept either one. The form just means you don&apos;t have to wait on
            us to read it.
          </p>
        </article>
        <article>
          <h2>When do the 30 days start?</h2>
          <p>
            From the first time you accepted these Terms — not from when a
            dispute comes up. If you&apos;re inside the window, opt out now rather
            than deciding later, because later is when it stops being available.
          </p>
        </article>
        <article>
          <h2>Do I have to do this again?</h2>
          <p>
            If we publish a new version of the Terms, yes. Your opt-out is
            recorded against the version you accepted — currently{" "}
            <strong>{TERMS_VERSION}</strong> — and a new version gives you a
            fresh 30 days to decline arbitration under that one. We&apos;ll say so
            when we post a change.
          </p>
        </article>
        <article>
          <h2>What if I want to change my mind?</h2>
          <p>
            Email <a href="mailto:hello@tuveloz.com">hello@tuveloz.com</a> and
            we&apos;ll note it. We won&apos;t reverse an opt-out on our own, and
            we&apos;ll never ask you to withdraw one as a condition of anything.
          </p>
        </article>
      </section>

      <section className="public-info-actions">
        <h2>Want to read the whole thing first?</h2>
        <div>
          <Link className="button primary" href="/terms">Read the Terms of Use <span>→</span></Link>
          <Link className="button secondary" href="/privacy">Privacy Policy</Link>
        </div>
      </section>
    </PublicPageShell>
  );
}
