"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { SiteLanguageButton } from "./site-language";
import { BrandMark } from "./tuveloz-icons";
import { SocialLinks } from "./social-links";

/**
 * Public marketing chrome — header, navigation, footer — around arbitrary page
 * content. The footer's launch statement is deliberately fixed here so a new
 * public page cannot quietly claim a launch state that is not real.
 */
export function PublicPageShell({
  children,
  navId = "public-page-navigation",
}: {
  children: ReactNode;
  navId?: string;
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
          aria-controls={navId}
          aria-label={menuOpen ? "Close main menu" : "Open main menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((value) => !value)}
          type="button"
        >
          <span />
          <span />
        </button>
        <nav className={menuOpen ? "nav open" : "nav"} id={navId} aria-label="Main navigation">
          <Link href="/about" onClick={() => setMenuOpen(false)}>Learn about Tuveloz</Link>
          <Link href="/post-job" onClick={() => setMenuOpen(false)}>Customer launch status</Link>
          <Link href="/join" onClick={() => setMenuOpen(false)}>Join as a provider</Link>
          <Link href="/fleet" onClick={() => setMenuOpen(false)}>Fleets</Link>
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

      {children}

      <footer>
        <Link className="brand footer-brand" href="/">
          <BrandMark /><span>Tuveloz</span>
        </Link>
        <p>Vehicle services built around customer choice and provider freedom.</p>
        <div className="footer-links">
          <Link href="/about">Learn about Tuveloz</Link>
          <Link href="/how-it-works">How it works</Link>
          <Link href="/fleet">Fleets and businesses</Link>
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
