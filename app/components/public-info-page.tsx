"use client";

import { useState } from "react";
import Link from "next/link";
import { SiteLanguageButton } from "./site-language";
import { BrandMark } from "./tuveloz-icons";
import { SocialLinks } from "./social-links";

export type PublicInfoSection = {
  title: string;
  text: string;
  points?: string[];
};

export function PublicInfoPage({
  kicker,
  title,
  intro,
  sections,
}: {
  kicker: string;
  title: string;
  intro: string;
  sections: PublicInfoSection[];
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
          aria-controls="public-main-navigation"
          aria-label={menuOpen ? "Close main menu" : "Open main menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((value) => !value)}
          type="button"
        >
          <span />
          <span />
        </button>
        <nav className={menuOpen ? "nav open" : "nav"} id="public-main-navigation" aria-label="Main navigation">
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
        {sections.map((section) => (
          <article key={section.title}>
            <h2>{section.title}</h2>
            <p>{section.text}</p>
            {section.points && (
              <ul>
                {section.points.map((point) => (
                  <li key={point}><span aria-hidden="true">✓</span>{point}</li>
                ))}
              </ul>
            )}
          </article>
        ))}
      </section>

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
          <Link href="/marketplace-conduct">Marketplace conduct</Link>
          <Link href="/provisional-provider-policy">Provider pathways</Link>
          <Link href="/payments">Payments</Link>
          <Link href="/job-operations">Job controls</Link>
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
