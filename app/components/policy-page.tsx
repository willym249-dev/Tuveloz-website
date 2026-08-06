import type { ReactNode } from "react";
import Link from "next/link";
import { SiteLanguageButton } from "./site-language";
import { BrandMark } from "./tuveloz-icons";

type PolicyPageProps = {
  children: ReactNode;
  eyebrow: string;
  summary: string;
  title: string;
  updated: string;
};

export function PolicyPage({
  children,
  eyebrow,
  summary,
  title,
  updated,
}: PolicyPageProps) {
  return (
    <main className="policy-shell">
      <header className="policy-header">
        <Link className="brand" href="/" aria-label="Tuveloz home">
          <BrandMark />
          <span>Tuveloz</span>
        </Link>
        <div className="policy-header-actions">
          <SiteLanguageButton />
          <Link className="account-home-link" href="/">Home</Link>
        </div>
      </header>

      <article className="policy-page">
        <div className="policy-intro">
          <span>{eyebrow}</span>
          <h1>{title}</h1>
          <p>{summary}</p>
          <small>Last updated {updated}</small>
        </div>
        <nav className="policy-links" aria-label="Tuveloz policies">
          <Link href="/terms">Terms</Link>
          <Link href="/customer-agreement">Customers</Link>
          <Link href="/provider-agreement">Providers</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/payments">Payments</Link>
          <Link href="/job-operations">Job controls</Link>
        </nav>
        <div className="policy-content">{children}</div>
        <footer className="policy-contact">
          <strong>Questions?</strong>
          <Link href="/ai">Ask Tuveloz AI about this page</Link>
          <a href="mailto:hello@tuveloz.com">hello@tuveloz.com</a>
        </footer>
      </article>
    </main>
  );
}
