import type { Metadata } from "next";
import Link from "next/link";
import { FleetInquiryForm } from "../components/fleet-inquiry-form";
import { PublicPageShell } from "../components/public-page-shell";

const BASE_URL = "https://tuveloz.com";

export const metadata: Metadata = {
  title: "Fleet and Business Vehicle Services in Montgomery County, MD",
  description:
    "Help Tuveloz plan fleet services in Montgomery County, MD. Tell us about your business vehicles and the work you need from independent local providers.",
  // Relative, like every other page: Next resolves it against metadataBase, so
  // one place defines the origin. An absolute literal here would silently
  // disagree with metadataBase if the origin ever changes.
  alternates: { canonical: "/fleet" },
  openGraph: {
    title: "Fleet and Business Vehicle Services | Tuveloz",
    description:
      "Tell us about your business vehicles in Montgomery County, MD. Tuveloz is planning fleet services with independent providers; bookings are not open yet.",
    url: `${BASE_URL}/fleet`,
    type: "website",
  },
};

const FLEET_FAQS = [
  {
    question: "Can I book fleet service today?",
    answer:
      "Not yet. Provider applications are open, but customer requests, quotes, and payments are not available yet. Tell us about your fleet so we can follow up as plans develop.",
  },
  {
    question: "How will quotes work?",
    answer:
      "Tuveloz connects you with independent provider businesses. They set their own prices, and you choose which quote to accept for each job. Providers keep 100% of what they quote. A separate 5% Customer Service Fee is added to your total and shown before you accept.",
  },
  {
    question: "Can providers work at our location?",
    answer:
      "A provider who offers mobile service may be able to work at your lot or depot. When bookings open, confirm the location, access, and work included in the quote with that provider.",
  },
  {
    question: "Who is responsible for the work?",
    answer:
      "The independent business you choose performs the work. Tuveloz helps you connect with providers and compare their quotes. Tuveloz does not employ, train, assign, or supervise providers.",
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

const pageSchema = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Fleet and business vehicle services",
  description:
    "Help Tuveloz plan connections between businesses and independent vehicle-service providers in Montgomery County, Maryland. Fleet bookings are not open yet.",
  url: `${BASE_URL}/fleet`,
  publisher: { "@type": "Organization", name: "Tuveloz", url: BASE_URL },
  audience: { "@type": "BusinessAudience", audienceType: "Fleet operators and small businesses" },
};

export default function FleetPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pageSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <PublicPageShell>
        <section className="public-info-hero">
          <span className="kicker">Fleets and businesses</span>
          <h1>Help us plan vehicle care for your business.</h1>
          <p>
            Do you manage vans, trucks, or company cars in Montgomery County?
            Tell us what your vehicles need. We&apos;re planning a way to connect
            businesses with independent local providers, with quotes and records
            for each vehicle. Fleet bookings are not open yet.
          </p>
        </section>

        <section className="public-info-grid">
          <article>
            <h2>What we&apos;re building for fleets</h2>
            <ul>
              <li><span aria-hidden="true">✓</span>Keep your business vehicles together in one account</li>
              <li><span aria-hidden="true">✓</span>Compare quotes from independent providers and choose who to hire</li>
              <li><span aria-hidden="true">✓</span>Discuss work at your location with providers who offer mobile service</li>
              <li><span aria-hidden="true">✓</span>Keep photos and service records with each vehicle&apos;s jobs</li>
            </ul>
          </article>
          <article>
            <h2>Where this stands today</h2>
            <p>
              Provider applications are open. Customer requests, quotes, and payments are
              not available yet. We&apos;re reviewing providers and the requirements
              for each service before opening bookings.
            </p>
            <p>
              Your feedback helps us understand which vehicles, services, and
              locations businesses need us to support.
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
          <h2>Explore Tuveloz</h2>
          <div>
            <Link className="button primary" href="/post-job">Check customer launch status <span>→</span></Link>
            <Link className="button secondary" href="/join">Join as a provider</Link>
          </div>
        </section>
      </PublicPageShell>
    </>
  );
}
