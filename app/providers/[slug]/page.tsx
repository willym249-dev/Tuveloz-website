"use client";
/* eslint-disable @next/next/no-img-element -- provider images are served from public R2 routes */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  BrandMark,
  TuvelozIcon,
  type TuvelozIconName,
} from "../../components/tuveloz-icons";
import { SiteLanguageButton } from "../../components/site-language";
import { providerModeForWorkLocations } from "../../../lib/service-matching";
import { providerProfileJsonLd } from "../../../lib/provider-structured-data";

type StorefrontData = {
  profile: {
    id: string;
    businessName: string;
    headline: string;
    about: string;
    yearsExperience: string;
    availabilityStatus: string;
    availabilityNote: string;
    businessHours: string;
    customerSuppliedPartsPolicy: string;
    hasLogo: boolean;
  };
  services: string[];
  areas: string[];
  workLocations: string[];
  businessMunicipality: string;
  gallery: Array<{ id: string; caption: string; service: string }>;
  reviews: Array<{
    id: string;
    customerDisplayName: string;
    service: string;
    rating: number;
    comment: string;
    providerReply?: string;
  }>;
  privatePreview: boolean;
  testProvider: boolean;
  /** Tenure, not a quality signal — see lib/founding-cohort.ts. */
  foundingProvider: boolean;
  reviewSummary: { average: number; count: number };
  credentialReview: {
    requirementsSatisfied: boolean;
    noGovernmentCredentialTriggered: boolean;
    credentials: Array<{
      requirementKey: string;
      label: string;
      jurisdiction: string;
      issuingAuthority: string;
      legalBasisUrl: string;
      officialLookupUrl: string;
      checkedAt: string;
      expiresAt: string;
    }>;
  };
  confidence: { completedJobs: number };
  error?: string;
};

function initials(value: string) {
  return value.trim().split(/\s+/).slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "T";
}

function serviceIcon(service: string): TuvelozIconName {
  const normalized = service.toLowerCase();
  if (normalized.includes("battery") || normalized.includes("jump")) return "battery";
  if (normalized.includes("tire") || normalized.includes("spare")) return "tire";
  if (normalized.includes("diagnostic")) return "diagnostics";
  if (normalized.includes("tint")) return "tint";
  if (normalized.includes("rain guard") || normalized.includes("vent visor") || normalized.includes("window deflector")) return "rain-guard";
  if (normalized.includes("sunshade")) return "sunshade";
  if (normalized.includes("wash") || normalized.includes("detail")) return "detailing";
  return "quote";
}

function StorefrontLoading() {
  return (
    <main className="storefront-shell">
      <header className="storefront-header">
        <Link className="brand" href="/"><BrandMark />Tuveloz</Link>
        <SiteLanguageButton />
      </header>
      <section className="storefront-loading">
        <BrandMark />
        <strong>Loading provider page…</strong>
      </section>
    </main>
  );
}

export default function ProviderStorefrontPage() {
  const params = useParams<{ slug: string }>();
  const slug = typeof params?.slug === "string" ? params.slug : "";
  const [data, setData] = useState<StorefrontData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/public-provider?slug=${encodeURIComponent(slug)}`, { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json() as StorefrontData;
        if (!response.ok) throw new Error(result.error || "Provider page not found.");
        setData(result);
      })
      .catch((reason) => setError(reason.message || "Provider page not found."));
  }, [slug]);

  if (!data && !error) return <StorefrontLoading />;
  if (!data) {
    return (
      <main className="storefront-shell">
        <header className="storefront-header">
          <Link className="brand" href="/"><BrandMark />Tuveloz</Link>
          <SiteLanguageButton />
        </header>
        <section className="storefront-not-found">
          <span className="kicker">Provider page</span>
          <h1>This page is not public yet.</h1>
          <p>{error}</p>
          <Link className="button primary" href="/">Return to Tuveloz</Link>
        </section>
      </main>
    );
  }

  const { profile, services, areas, workLocations, businessMunicipality, gallery, reviews } = data;
  const average = data.reviewSummary.average;

  // Structured data describes only what is on the page. A private draft preview
  // and a test provider are not public records, so neither gets marked up at
  // all; `publicAddress` is deliberately not supplied because no provider
  // address is rendered here, which is what keeps mobile providers out of
  // LocalBusiness. See lib/provider-structured-data.ts.
  const structuredData = data.privatePreview || data.testProvider
    ? null
    : providerProfileJsonLd({
      slug,
      businessName: profile.businessName,
      headline: profile.headline,
      about: profile.about,
      workLocations,
      businessMunicipality,
      areas,
      services,
      reviewSummary: data.reviewSummary,
    });

  return (
    <main className="storefront-shell">
      {structuredData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      )}
      <header className="storefront-header">
        <Link className="brand" href="/"><BrandMark />Tuveloz</Link>
        <SiteLanguageButton />
        <Link className="button primary" href="/post-job">Customer jobs closed</Link>
      </header>
      {data.privatePreview && (
        <div className="storefront-preview-banner">
          <strong>{data.testProvider ? "TEST PROVIDER · FICTIONAL" : "PRIVATE DRAFT PREVIEW"}</strong>
          <span>This draft is visible only while you are signed in to the matching provider account.</span>
        </div>
      )}

      <section className="storefront-hero">
        <div className="storefront-identity">
          {profile.hasLogo ? (
            <img
              className="storefront-logo"
              src={`/api/provider-media?profileId=${encodeURIComponent(profile.id)}`}
              alt={`${profile.businessName} logo`}
            />
          ) : (
            <div className="storefront-logo storefront-initials" aria-hidden="true">
              {initials(profile.businessName)}
            </div>
          )}
          <div>
            <div className="storefront-eyebrow">
              {data.testProvider
                ? <span className="test-badge">TEST PROFILE</span>
                : <span className="verified-badge">✓ Listed-service records reviewed</span>}
              <span className="provider-mode-badge">
                {providerModeForWorkLocations(workLocations)}
              </span>
              <span className={`availability-chip ${profile.availabilityStatus.toLowerCase().replaceAll(" ", "-")}`}>
                {profile.availabilityStatus}
              </span>
              {data.foundingProvider && !data.testProvider && (
                <span className="founding-badge" title="Joined Tuveloz before the marketplace launched">
                  ★ Founding provider · joined before launch
                </span>
              )}
            </div>
            <h1>{profile.businessName}</h1>
            <p>{profile.headline}</p>
            <div className="storefront-quick-facts">
              <span>{businessMunicipality}</span>
              <span>{services.length} profile-listed {services.length === 1 ? "service" : "services"}</span>
              <span>{reviews.length ? `${average} ★ from ${reviews.length} review${reviews.length === 1 ? "" : "s"}` : "New on Tuveloz"}</span>
            </div>
            <small>
              Business name, logo, headline, availability, experience, hours, service areas,
              description, and gallery content are supplied by the provider unless specifically
              labeled as a Tuveloz platform record.
            </small>
          </div>
        </div>
        <aside className="storefront-action-card">
          <span>Customer jobs remain closed.</span>
          <strong>Provider profiles are available for launch preparation only.</strong>
          <Link className="button primary" href="/post-job">Review the planned request flow →</Link>
          <small>No request, quote, payment, or payout can be submitted in onboarding-only mode.</small>
        </aside>
      </section>

      <section className="storefront-confidence" aria-labelledby="customer-confidence-heading">
        <div className="storefront-confidence-heading">
          <div>
            <span className="kicker">Customer confidence</span>
            <h2 id="customer-confidence-heading">Specific records, with clear limits</h2>
          </div>
          <p>
            Tuveloz separates provider-supplied claims from dated platform records and
            government-source checks when those records are available.
          </p>
        </div>
        <div className="storefront-confidence-grid">
          <article>
            <TuvelozIcon name="overview" />
            <div>
              <span>Government credential records</span>
              <strong>
                {data.testProvider
                  ? "Test profile"
                  : data.credentialReview.noGovernmentCredentialTriggered
                    ? "No credential record displayed for this scope"
                    : `${data.credentialReview.credentials.length} dated ${data.credentialReview.credentials.length === 1 ? "record" : "records"}`}
              </strong>
              <small>
                {data.testProvider
                  ? "Fictional data for testing only."
                  : data.credentialReview.noGovernmentCredentialTriggered
                    ? "For only the listed services, work locations, and launch jurisdiction, Tuveloz's current rules matrix did not identify a government credential record to display. This is not a legal determination, and no check date is published for this result; confirm current requirements with the responsible government authority before work."
                    : "See each issuing authority, Tuveloz check date, recorded expiration, and official lookup below."}
              </small>
            </div>
          </article>
          <article>
            <TuvelozIcon name="completed" />
            <div>
              <span>Completed Tuveloz jobs</span>
              <strong>{data.confidence.completedJobs.toLocaleString()}</strong>
              <small>Completed-job records in Tuveloz; not a quality or safety guarantee.</small>
            </div>
          </article>
          <article>
            <TuvelozIcon name="reviews" />
            <div>
              <span>Reviews linked to completed Tuveloz jobs</span>
              <strong>{reviews.length ? average.toFixed(1) : "—"}</strong>
              <small>
                {reviews.length
                  ? `${reviews.length} completed-job ${reviews.length === 1 ? "review" : "reviews"}`
                  : "No reviews yet"}
              </small>
            </div>
          </article>
          <article>
            <TuvelozIcon name="storefront" />
            <div>
              <span>Provider experience</span>
              <strong>{profile.yearsExperience || "Not listed yet"}</strong>
              <small>Provider-supplied experience.</small>
            </div>
          </article>
        </div>
        <p className="storefront-confidence-note">
          Tuveloz does not estimate missing history. Records and evidence can become incomplete
          or outdated and do not guarantee identity, licensing, insurance, skill, quality, safety,
          lawful conduct, or future performance. Recheck official sources and use your own judgment.
        </p>
      </section>

      <section className="storefront-section storefront-trust-panel" aria-labelledby="trust-panel-heading">
        <div className="storefront-section-heading">
          <div>
            <span className="kicker">What&apos;s confirmed vs. shared</span>
            <h2 id="trust-panel-heading">Confirmed records and provider-shared info, kept separate</h2>
          </div>
          <p>
            A cheaper, newer, or less-credentialed provider isn&apos;t blocked or ranked lower here —
            compare price, reviews, and completed jobs to decide what&apos;s the right fit for you.
          </p>
        </div>
        <div className="storefront-trust-columns">
          <article className="storefront-trust-column" aria-labelledby="confirmed-heading">
            <h3 id="confirmed-heading">Confirmed for this service</h3>
            {data.testProvider ? (
              <p className="admin-note">Test profile — fictional data for testing only.</p>
            ) : data.credentialReview.credentials.length > 0 ? (
              <>
                <p className="storefront-trust-note">
                  Each record is limited to the listed service, work mode, and jurisdiction. Tuveloz
                  checked the shown source on the displayed date; status can change afterward. These
                  records are not a blanket licensed-provider claim or a guarantee of competence,
                  quality, safety, insurance, or legal compliance.
                </p>
                <ul className="storefront-confirmed-list">
                  {data.credentialReview.credentials.map((credential) => (
                    <li key={credential.requirementKey}>
                      <strong>{credential.label}</strong>
                      <span>{credential.jurisdiction}</span>
                      <small>
                        Tuveloz checked the {credential.issuingAuthority} source on{" "}
                        {new Date(credential.checkedAt).toLocaleDateString()}.
                        {credential.expiresAt
                          ? ` Recorded expiration: ${new Date(`${credential.expiresAt}T00:00:00Z`).toLocaleDateString()}.`
                          : " No expiration date is displayed."}
                        {" "}Status can change after the check; recheck the official lookup before work.
                      </small>
                      <span className="admin-link-actions">
                        <a href={credential.legalBasisUrl} target="_blank" rel="noreferrer">
                          Official requirement
                        </a>
                        <a href={credential.officialLookupUrl} target="_blank" rel="noreferrer">
                          Official lookup
                        </a>
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="admin-note">
                No license, registration, or insurance is legally required for this provider&apos;s
                listed services in this jurisdiction, so nothing is confirmed here.
              </p>
            )}
          </article>
          <article className="storefront-trust-column" aria-labelledby="shared-heading">
            <h3 id="shared-heading">Additional info the provider has shared</h3>
            <p className="storefront-trust-note">Optional — not legally required for this service.</p>
            <dl className="storefront-facts">
              <div>
                <dt>Years of experience</dt>
                <dd>{data.testProvider ? "Test profile" : (profile.yearsExperience || "Not provided")}</dd>
              </div>
            </dl>
          </article>
        </div>
      </section>

      <nav className="storefront-tabs" aria-label="Provider business page">
        <a href="#overview"><TuvelozIcon name="overview" />Overview</a>
        <a href="#services"><TuvelozIcon name="services" />Services</a>
        <a href="#work-gallery"><TuvelozIcon name="gallery" />Work Gallery</a>
        <a href="#reviews"><TuvelozIcon name="reviews" />Reviews</a>
      </nav>

      <section className="storefront-section storefront-overview" id="overview">
        <div>
          <span className="kicker">Provider-supplied profile</span>
          <h2>About this provider, in their own words</h2>
          <p className="storefront-about">{profile.about}</p>
        </div>
        <dl className="storefront-facts">
          <div><dt>Based in</dt><dd>{businessMunicipality}</dd></div>
          <div><dt>Availability</dt><dd>{profile.availabilityNote || profile.availabilityStatus}</dd></div>
          {profile.businessHours && (
            <div><dt>Typical hours</dt><dd>{profile.businessHours}</dd></div>
          )}
          <div><dt>Meeting options</dt><dd>{workLocations.join(" · ")}</dd></div>
          <div>
            <dt>Customer-supplied parts</dt>
            <dd>{profile.customerSuppliedPartsPolicy}</dd>
          </div>
        </dl>
      </section>

      <section className="storefront-section" id="services">
        <div className="storefront-section-heading">
          <div><span className="kicker">Exact service scope</span><h2>Profile-listed services</h2></div>
          <p>
            These exact services are recorded on this profile for possible labor-quote eligibility after
            marketplace launch. Any required parts are purchased separately by the customer. A listing is
            not a guarantee of licensing, insurance, skill, quality, safety, or lawful performance; review
            the dated records and official sources above.
          </p>
        </div>
        <div className="storefront-service-grid">
          {services.map((service) => (
            <article key={service}>
              <TuvelozIcon name={serviceIcon(service)} />
              <strong>{service}</strong>
              <span>Listed for launch review; customer requests are closed</span>
            </article>
          ))}
        </div>
        <div className="storefront-areas">
          <strong>Job areas</strong>
          <span>{areas.join(" · ")}</span>
        </div>
      </section>

      <section className="storefront-section" id="work-gallery">
        <div className="storefront-section-heading">
          <div><span className="kicker">Work Gallery</span><h2>See the work</h2></div>
          <p>
            Photos and descriptions are supplied by the provider. Tuveloz has not independently
            confirmed that they show this provider&apos;s work, results, or workmanship.
          </p>
        </div>
        {gallery.length ? (
          <div className="storefront-gallery">
            {gallery.map((item) => (
              <figure key={item.id}>
                <img
                  src={`/api/provider-media?galleryId=${encodeURIComponent(item.id)}`}
                  alt={item.caption || `${item.service || "Provider"} work example`}
                />
                {(item.caption || item.service) && (
                  <figcaption>
                    {item.service && <span>{item.service}</span>}
                    {item.caption && <strong>{item.caption}</strong>}
                  </figcaption>
                )}
              </figure>
            ))}
          </div>
        ) : (
          <div className="storefront-empty">
            <TuvelozIcon name="gallery" />
            <strong>Work photos are coming soon.</strong>
            <span>This provider has not added gallery photos yet.</span>
          </div>
        )}
      </section>

      <section className="storefront-section" id="reviews">
        <div className="storefront-section-heading">
          <div><span className="kicker">Customer feedback</span><h2>Reviews linked to a completed Tuveloz job</h2></div>
          <div className="storefront-rating">
            <strong>{reviews.length ? average.toFixed(1) : "—"}</strong>
            <span>{reviews.length ? "★★★★★".slice(0, Math.round(average)) : "No reviews yet"}</span>
            <small>{reviews.length} job-linked {reviews.length === 1 ? "review" : "reviews"}</small>
          </div>
        </div>
        {reviews.length ? (
          <div className="storefront-review-grid">
            {reviews.map((review) => (
              <article key={review.id}>
                <div><span>{"★★★★★".slice(0, review.rating)}</span><strong>{review.rating}.0</strong></div>
                <blockquote>{review.comment}</blockquote>
                {review.providerReply ? (
                  <div className="storefront-review-reply">
                    <span>Response from the provider</span>
                    <p>{review.providerReply}</p>
                  </div>
                ) : null}
                <footer>
                  <strong>{review.customerDisplayName}</strong>
                  <span>{review.service}</span>
                </footer>
              </article>
            ))}
          </div>
        ) : (
          <div className="storefront-empty">
            <TuvelozIcon name="reviews" />
            <strong>No completed-job reviews yet.</strong>
            <span>Only feedback from completed Tuveloz jobs appears here.</span>
          </div>
        )}
        <p className="storefront-confidence-note">
          A completed-job link confirms a Tuveloz job record. It does not verify every statement
          in a review or guarantee repair quality, safety, or future performance.
        </p>
      </section>

      <footer className="storefront-footer">
        <Link className="brand footer-brand" href="/"><BrandMark />Tuveloz</Link>
        <p>
          Provider pages distinguish provider-supplied claims, profile-listed service scope,
          dated credential records when available, and reviews linked to completed Tuveloz jobs.
        </p>
      </footer>
    </main>
  );
}
