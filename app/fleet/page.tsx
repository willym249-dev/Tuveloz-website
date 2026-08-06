import type { Metadata } from "next";
import Link from "next/link";
import { FleetInquiryForm } from "../components/fleet-inquiry-form";
import { PublicPageShell } from "../components/public-page-shell";

const BASE_URL = "https://tuveloz.com";

export const metadata: Metadata = {
  title: "Fleet and Business Vehicle Services in Montgomery County, MD",
  description:
    "Running vans, trucks, or a company car pool in Montgomery County, MD? Tuveloz is building multi-vehicle service with independent local providers. Tell us about your fleet.",
  alternates: { canonical: `${BASE_URL}/fleet` },
  openGraph: {
    title: "Fleet and Business Vehicle Services | Tuveloz",
    description:
      "Multi-vehicle service from independent local providers in Montgomery County, MD. Customer requests open soon — tell Tuveloz about your fleet.",
    url: `${BASE_URL}/fleet`,
    type: "website",
  },
};

const FLEET_FAQS = [
  {
    question: "Can I book fleet service today?",
    answer:
      "Not yet. Tuveloz is onboarding provider businesses in Montgomery County first, and customer requests, quotes, and payments stay off until each service's legal, insurance, and payment requirements are documented and satisfied. Telling us about your fleet now means you are first to hear when it opens.",
  },
  {
    question: "How is this different from a shop account?",
    answer:
      "Tuveloz is a marketplace, not a shop. Independent provider businesses quote your work and set their own prices, and you choose which quote to accept for each job. Providers keep 100% of what they quote; Tuveloz adds a 5% customer service fee that is shown before you accept.",
  },
  {
    question: "Do you come to our vehicles?",
    answer:
      "That is the intent. Most providers onboarding with Tuveloz work at the customer's location, which for a fleet usually means your lot or depot rather than moving vehicles one at a time to a shop.",
  },
  {
    question: "Who is responsible for the work?",
    answer:
      "The independent provider business that performs the service. Tuveloz does not employ, train, assign, or supervise providers, and a provider is never a Tuveloz employee or agent.",
  },
];

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FLEET_FAQS.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: { "@type": "Answer", text: faq.answer },
  })),
};

const serviceSchema = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Fleet and business vehicle services",
  serviceType: "Fleet vehicle maintenance",
  description:
    "Multi-vehicle service from independent local provider businesses in Montgomery County, Maryland.",
  url: `${BASE_URL}/fleet`,
  areaServed: { "@type": "AdministrativeArea", name: "Montgomery County, Maryland" },
  provider: { "@type": "Organization", name: "Tuveloz", url: BASE_URL },
  audience: { "@type": "BusinessAudience", audienceType: "Fleet operators and small businesses" },
};

export default function FleetPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <PublicPageShell>
        <section className="public-info-hero">
          <span className="kicker">Fleets and businesses</span>
          <h1>Keep the whole fleet moving, without sending vehicles out one at a time.</h1>
          <p>
            If your business runs vans, trucks, or a pool of company cars in Montgomery
            County, the expensive part of maintenance is rarely the repair — it is the
            vehicle sitting idle while somebody drives it to a shop and waits. Tuveloz is
            building multi-vehicle service with independent local providers who come to
            where your vehicles already are.
          </p>
        </section>

        <section className="public-info-grid">
          <article>
            <h2>What we&apos;re building for fleets</h2>
            <ul>
              <li><span aria-hidden="true">✓</span>Save every vehicle once, then request work against any of them</li>
              <li><span aria-hidden="true">✓</span>Independent providers quote their own prices — you compare and choose</li>
              <li><span aria-hidden="true">✓</span>Service at your lot or depot instead of a shop trip per vehicle</li>
              <li><span aria-hidden="true">✓</span>Photo and completion records kept per job, per vehicle</li>
            </ul>
          </article>
          <article>
            <h2>Where this stands today</h2>
            <p>
              Provider applications are open. Customer requests, quotes, and payments are
              not available yet — a service only turns on once its legal, government, and
              insurance requirements are documented and satisfied.
            </p>
            <p>
              Fleets that tell us what they run now are the ones we design the first
              multi-vehicle release around.
            </p>
            <p>
              <Link href="/how-it-works">See how the marketplace will work →</Link>
            </p>
          </article>
        </section>

        <section className="public-info-grid" aria-labelledby="fleet-form-heading">
          <article className="fleet-inquiry-panel">
            <h2 id="fleet-form-heading">Tell us about your fleet</h2>
            <FleetInquiryForm />
          </article>
        </section>

        <section className="public-info-grid" aria-label="Fleet questions">
          {FLEET_FAQS.map((faq) => (
            <article key={faq.question}>
              <h2>{faq.question}</h2>
              <p>{faq.answer}</p>
            </article>
          ))}
        </section>

        <section className="public-info-actions">
          <h2>Run vehicles for a living? So do our providers.</h2>
          <div>
            <Link className="button primary" href="/post-job">Check customer launch status <span>→</span></Link>
            <Link className="button secondary" href="/join">Join as a provider</Link>
          </div>
        </section>
      </PublicPageShell>
    </>
  );
}
