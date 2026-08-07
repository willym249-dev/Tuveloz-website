"use client";

import Link from "next/link";
import { PublicPageShell } from "./public-page-shell";
import { LaunchUpdatesForm } from "./launch-updates-form";
import type { LandingFaq } from "../../lib/local-landing-pages";

export type LandingRelatedLink = { href: string; label: string };

/**
 * Shared body for the service and town landing pages. Every call to action
 * reflects the real launch state: join the launch list, or apply as a
 * provider. Nothing here implies a customer can book or pay today.
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
  return (
    <PublicPageShell navId="landing-main-navigation">
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
    </PublicPageShell>
  );
}
