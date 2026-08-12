import type { ReactNode } from "react";

import Link from "next/link";
import { PublicSiteFooter, PublicSiteHeader } from "./public-chrome";
import { SaveMySpotButton } from "./save-my-spot-button";

export type PublicInfoSection = {
  title: string;
  text: string;
  points?: string[];
};

/** The last crumb is the current page and carries no href. */
export type PublicInfoCrumb = {
  label: string;
  href?: string;
};

export function PublicInfoPage({
  kicker,
  title,
  intro,
  sections,
  breadcrumbs,
  children,
}: {
  kicker: string;
  title: string;
  intro: string;
  sections: PublicInfoSection[];
  breadcrumbs?: PublicInfoCrumb[];
  /** Rendered after the section grid, above the shared call to action. */
  children?: ReactNode;
}) {
  return (
    <main className="public-info-shell">
      <PublicSiteHeader />

      <section className="public-info-hero">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="public-info-breadcrumbs" aria-label="Breadcrumb">
            <ol>
              {breadcrumbs.map((crumb) => (
                <li key={`${crumb.href ?? ""}${crumb.label}`}>
                  {crumb.href
                    ? <Link href={crumb.href}>{crumb.label}</Link>
                    : <span aria-current="page">{crumb.label}</span>}
                </li>
              ))}
            </ol>
          </nav>
        )}
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

      {children}

      <section className="public-info-actions">
        <h2>Ready when you are.</h2>
        <div>
          <SaveMySpotButton href="/post-job" />
          <Link className="button secondary" href="/join">I do car work — apply free</Link>
        </div>
      </section>

      <PublicSiteFooter />
    </main>
  );
}
