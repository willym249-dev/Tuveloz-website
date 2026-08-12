"use client";

import { useState } from "react";
import Link from "next/link";
import { useAccountHeaderState } from "./account-header-state";
import { SiteLanguageButton } from "./site-language";
import { SocialLinks } from "./social-links";
import { BrandMark } from "./tuveloz-icons";

/**
 * One header and one footer for every public page outside the homepage, so the
 * navigation, the wording of each link, and the primary call to action stay
 * identical wherever a visitor lands. Like the homepage header, it swaps the
 * sign-in link and the sign-up call to action for the visitor's own workspace
 * once a session is present — a signed-in customer opening a public page must
 * not be shown the wording used for someone with no account.
 */
export function PublicSiteHeader({
  cta = "customer",
  navigationId = "public-main-navigation",
}: {
  cta?: "customer" | "provider";
  navigationId?: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { accountHref, accountLabel, signedIn } = useAccountHeaderState();

  return (
    <header className="site-header">
      <Link className="brand" href="/" aria-label="Tuveloz home">
        <BrandMark />
        <span>Tuveloz</span>
      </Link>
      <button
        className="menu-button"
        aria-controls={navigationId}
        aria-label={menuOpen ? "Close main menu" : "Open main menu"}
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((value) => !value)}
        type="button"
      >
        <span />
        <span />
      </button>
      <nav className={menuOpen ? "nav open" : "nav"} id={navigationId} aria-label="Main navigation">
        <Link href="/post-job" onClick={() => setMenuOpen(false)}>For customers</Link>
        <Link href="/join" onClick={() => setMenuOpen(false)}>For providers</Link>
        <Link href="/how-it-works" onClick={() => setMenuOpen(false)}>How it works</Link>
        <Link href="/safety" onClick={() => setMenuOpen(false)}>Safety &amp; trust</Link>
        <Link href="/faq" onClick={() => setMenuOpen(false)}>FAQ</Link>
        <Link href="/about" onClick={() => setMenuOpen(false)}>About</Link>
      </nav>
      <div className="header-actions">
        <SiteLanguageButton />
        <Link
          aria-label={accountLabel}
          className="header-sign-in"
          href={accountHref}
          onClick={() => setMenuOpen(false)}
        >
          {signedIn ? accountLabel : "Sign in"}
        </Link>
        {signedIn ? (
          <Link className="header-cta" href={accountHref} onClick={() => setMenuOpen(false)}>
            My workspace
          </Link>
        ) : cta === "provider" ? (
          <Link className="header-cta" href="/join">Apply free</Link>
        ) : (
          <Link className="header-cta" href="/account?role=customer&mode=create">
            Save my spot
          </Link>
        )}
      </div>
    </header>
  );
}

export function PublicSiteFooter() {
  return (
    <footer>
      <Link className="brand footer-brand" href="/">
        <BrandMark /><span>Tuveloz</span>
      </Link>
      <p>Vehicle services built around customer choice and provider freedom.</p>
      <div className="footer-links">
        <Link href="/about">About Tuveloz</Link>
        <Link href="/post-job">For customers</Link>
        <Link href="/join">For providers</Link>
        <Link href="/how-it-works">How it works</Link>
        {/* The provider directory and the local-search hubs are reached from
            here and from breadcrumbs, not from the header: that nav is already
            at the width it can hold. */}
        <Link href="/providers">Providers</Link>
        <Link href="/service-areas">Service areas</Link>
        <Link href="/services">Services</Link>
        <Link href="/safety">Safety &amp; trust</Link>
        <Link href="/faq">FAQ</Link>
        <Link href="/account">Sign in</Link>
        <Link href="/terms">Terms</Link>
        <Link href="/customer-agreement">Customer agreement</Link>
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
        <span>Signing up local pros and customers in Montgomery County, Maryland.</span>
      </div>
    </footer>
  );
}
