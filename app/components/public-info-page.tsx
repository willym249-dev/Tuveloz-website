import Link from "next/link";
import { PublicSiteFooter, PublicSiteHeader } from "./public-chrome";

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
  return (
    <main className="public-info-shell">
      <PublicSiteHeader />

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
        <h2>Ready when you are.</h2>
        <div>
          <Link className="button primary" href="/post-job">Get early access — free <span>→</span></Link>
          <Link className="button secondary" href="/join">I fix cars — join free</Link>
        </div>
      </section>

      <PublicSiteFooter />
    </main>
  );
}
