"use client";

import { useEffect } from "react";
import Link from "next/link";
import { track } from "../../lib/analytics";
import { AudienceSwitch } from "../components/audience-switch";
import { ProviderSignupForm } from "../components/provider-signup-form";
import { SiteLanguageButton } from "../components/site-language";
import { SocialLinks } from "../components/social-links";
import { BrandMark } from "../components/tuveloz-icons";

const OFFER_POINTS = [
  {
    title: "Free to join",
    text: "No listing fee and no subscription — now or after launch.",
  },
  {
    title: "Keep 100% of your quoted price",
    text: "You set the price. The customer pays a proposed 5% service fee on top of it.",
  },
  {
    title: "No exclusivity",
    text: "Keep your own customers and work any other platform at the same time.",
  },
  {
    title: "Apply in about 5 minutes",
    text: "Four short steps, saved as you go, finished whenever you like.",
  },
];

const CHECKS = [
  "Control of the email on the application, through a one-time code",
  "A government registration or license only where the law requires one for your exact service",
  "Broker-confirmed insurance where a service requires coverage",
  "A separate identity check before any payout is set up",
  "Approval service by service — never one blanket “approved” badge",
];

/**
 * The provider conversion path. Everything a customer needs to read lives on
 * the homepage; this page carries the offer, the application, and nothing
 * that competes with it.
 */
export function ProviderLanding() {
  useEffect(() => {
    track("provider_signup_started");
  }, []);

  return (
    <main className="public-site provider-landing">
      <header className="site-header">
        <Link className="brand" href="/" aria-label="Tuveloz home">
          <BrandMark />
          <span>Tuveloz</span>
        </Link>
        <div className="header-actions">
          <AudienceSwitch active="providers" />
          <SiteLanguageButton />
          <Link className="header-sign-in" href="/account?role=provider">
            Provider sign in
          </Link>
        </div>
      </header>

      <section className="provider-landing-hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="pulse" />
            Now onboarding in Montgomery County, Maryland
          </div>
          <h1>Get local vehicle-service opportunities.</h1>
          <p>
            Join Tuveloz free, set your own prices, and choose the jobs that fit
            your schedule. Applications are open now; customer jobs open after
            launch review.
          </p>
          <div className="hero-actions">
            <a className="button primary" href="#provider-apply">
              Start my application <span>→</span>
            </a>
            <Link className="button secondary" href="/provider-requirements">
              See what&apos;s required <span>→</span>
            </Link>
          </div>
        </div>

        <ul className="provider-offer-grid">
          {OFFER_POINTS.map((point) => (
            <li key={point.title}>
              <strong>{point.title}</strong>
              <span>{point.text}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="section provider-apply-section" id="provider-apply">
        <div className="provider-apply-copy">
          <span className="kicker">The application</span>
          <h2>Four steps, then verify your email.</h2>
          <ol className="provider-apply-steps">
            <li><strong>Pick your category.</strong> The one that describes your work.</li>
            <li><strong>Pick the exact jobs.</strong> Only what you actually do.</li>
            <li><strong>See what those jobs require.</strong> Skipped when nothing applies.</li>
            <li><strong>Enter your business details.</strong> Then confirm your email.</li>
          </ol>
          <p className="provider-apply-note">
            Requirements depend on your services. We&apos;ll show you exactly what
            applies before activation — and skip the step when your selections
            require nothing.{" "}
            <Link href="/provider-requirements">Read the full requirements</Link>
          </p>
          <p className="provider-apply-note">
            Your answers save on your device as you go, so you can stop and come
            back to this page to finish.
          </p>
        </div>

        <div className="provider-apply-form">
          <ProviderSignupForm />
        </div>
      </section>

      <section className="section provider-trust-section" aria-labelledby="provider-trust-heading">
        <div className="section-heading">
          <div>
            <span className="kicker">Who you&apos;re applying to</span>
            <h2 id="provider-trust-heading">A new marketplace, stated plainly.</h2>
          </div>
          <p>
            Tuveloz has not run customer jobs yet, so there are no completed-job
            reviews to show. Here is what we can tell you instead.
          </p>
        </div>
        <div className="trust-grid">
          <article className="trust-card">
            <span className="trust-card-label">The company</span>
            <p>
              Tuveloz is operated by TUVELOZ LLC and is building one launch area
              first: Montgomery County, Maryland. It is a marketplace — it does
              not employ providers, assign work, or perform repairs.
            </p>
          </article>
          <article className="trust-card">
            <span className="trust-card-label">Reaching a person</span>
            <p>
              Provider questions go to{" "}
              <a href="mailto:hello@tuveloz.com">hello@tuveloz.com</a>. We aim to
              answer within two business days, and we email you at each step of
              your application review.
            </p>
          </article>
          <article className="trust-card">
            <span className="trust-card-label">Payments and disputes</span>
            <p>
              Payments run through Stripe; Tuveloz never stores full card or bank
              numbers. Payout, fee, refund, and dispute handling are written down
              before launch — read the{" "}
              <Link href="/payments">payment policy</Link> and{" "}
              <Link href="/provider-agreement">provider agreement</Link>.
            </p>
          </article>
        </div>
        <div className="provider-checks">
          <strong>What Tuveloz checks before a service goes live</strong>
          <ul>
            {CHECKS.map((check) => (
              <li key={check}><span aria-hidden="true">✓</span>{check}</li>
            ))}
          </ul>
        </div>
      </section>

      <footer>
        <Link className="brand footer-brand" href="/">
          <BrandMark /><span>Tuveloz</span>
        </Link>
        <p>Independent providers set their own prices and choose their own jobs.</p>
        <div className="footer-links">
          <Link href="/">For customers</Link>
          <Link href="/provider-requirements">Provider requirements</Link>
          <Link href="/how-it-works">How it works</Link>
          <Link href="/faq">FAQ</Link>
          <Link href="/account?role=provider">Provider sign in</Link>
          <a href="/terms">Terms</a>
          <a href="/provider-agreement">Provider agreement</a>
          <a href="/payments">Payment policy</a>
          <a href="/privacy">Privacy</a>
          <a href="mailto:hello@tuveloz.com">hello@tuveloz.com</a>
        </div>
        <div className="footer-bottom">
          <SocialLinks />
          <span>© 2026 Tuveloz. All rights reserved.</span>
          <span>Provider onboarding is open in Montgomery County, Maryland.</span>
        </div>
      </footer>
    </main>
  );
}
