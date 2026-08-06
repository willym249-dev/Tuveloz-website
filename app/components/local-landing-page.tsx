"use client";

import { useState } from "react";
import Link from "next/link";
import { SiteLanguageButton } from "./site-language";
import { BrandMark } from "./tuveloz-icons";
import { SocialLinks } from "./social-links";
import { LaunchUpdatesForm } from "./launch-updates-form";
import type { LandingFaq } from "../../lib/local-landing-pages";

export type LandingRelatedLink = { href: string; label: string };

/**
 * Shared shell for the service and town landing pages. Every call to action
 * here reflects the real launch state: join the launch list, or apply as a
 * provider. Nothing on this page implies a customer can book or pay today.
 */
export function LocalLandingPage({
  kicker,
  title,
  intro,
  bullets,
  bulletsHeading,
  faqs,
  relatedLinks,
  relatedHeading,
  launchListSource,
}: {
  kicker: string;
  title: string;
  intro: string;
  bullets: string[];
  bulletsHeading: string;
  faqs: LandingFaq[];
  relatedLinks: LandingRelatedLink[];
  relatedHeading: string;
  launchListSource: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <main className="public-info-shell">
      <header className="site-header">
        <Link className="brand" href="/" aria-label="Tuveloz home">
          <BrandMark />
          <span>Tuveloz</span>
        </Link>
        <button
          className="menu-button"
          aria-controls="landing-main-navigation"
          aria-label={menuOpen ? "Close main menu" : "Open main menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((value) => !value)}
          type="button"
        >
          <span />
          <span />
        </button>
        <nav
          className={menuOpen ? "nav open" : "nav"}
          id="landing-main-navigation"
          aria-label="Main navigation"
        >
          <Link href="/about" onClick={() => setMenuOpen(false)}>Learn about Tuveloz</Link>
          <Link href="/post-job" onClick={() => setMenuOpen(false)}>Customer launch status</Link>
          <Link href="/join" onClick={() => setMenuOpen(false)}>Join as a provider</Link>
          <Link href="/how-it-works" onClick={() => setMenuOpen(false)}>How it works</Link>
          <Link href="/safety" onClick={() => setMenuOpen(false)}>Safety &amp; trust</Link>
          <Link href="/faq" onClick={() => setMenuOpen(false)}>FAQ</Link>
        </nav>
        <div className="header-actions">
          <SiteLanguageButton />
          <Link className="header-sign-in" href="/account">Sign in</Link>
          <Link className="header-cta" href="/post-job">Launch status</Link>
        </div>
      </header>

      <section className="public-info-hero">
        <span className="kicker">{kicker}</span>
        <h1>{title}</h1>
        <p>{intro}</p>
      </section>

      <section className="public-info-grid">
        <article>
          <h2>{bulletsHeading}</h2>
          <ul>
            {bullets.map((bullet) => (
              <li key={bullet}><span aria-hidden="true">✓</span>{bullet}</li>
            ))}
          </ul>
        </article>
        <article>
          <h2>Where this stands today</h2>
          <p>
            Provider applications are open. Customer service requests, quotes, and
            payments are not available yet — a service only turns on after its legal,
            government, and insurance requirements are documented and satisfied.
          </p>
          <p>
            Want an email the moment customer requests open in Montgomery County?
          </p>
          <LaunchUpdatesForm source={launchListSource} />
        </article>
      </section>

      {faqs.length > 0 && (
        <section className="public-info-grid" aria-label="Frequently asked questions">
          {faqs.map((faq) => (
            <article key={faq.question}>
              <h2>{faq.question}</h2>
              <p>{faq.answer}</p>
            </article>
          ))}
        </section>
      )}

      {relatedLinks.length > 0 && (
        <section className="public-info-actions" aria-label={relatedHeading}>
          <h2>{relatedHeading}</h2>
          <div className="landing-related-links">
            {relatedLinks.map((link) => (
              <Link key={link.href} href={link.href}>{link.label}</Link>
            ))}
          </div>
        </section>
      )}

      <section className="public-info-actions">
        <h2>Provider applications are open. Customer service requests are not yet available.</h2>
        <div>
          <Link className="button primary" href="/post-job">Check customer launch status <span>→</span></Link>
          <Link className="button secondary" href="/join">Join as a provider</Link>
        </div>
      </section>

      <footer>
        <Link className="brand footer-brand" href="/">
          <BrandMark /><span>Tuveloz</span>
        </Link>
        <p>Vehicle services built around customer choice and provider freedom.</p>
        <div className="footer-links">
          <Link href="/about">Learn about Tuveloz</Link>
          <Link href="/how-it-works">How it works</Link>
          <Link href="/safety">Safety &amp; trust</Link>
          <Link href="/faq">FAQ</Link>
          <Link href="/account">Sign in</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/provider-agreement">Provider agreement</Link>
          <Link href="/privacy">Privacy</Link>
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
