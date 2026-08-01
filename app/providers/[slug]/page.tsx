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
  }>;
  privatePreview: boolean;
  testProvider: boolean;
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

  return (
    <main className="storefront-shell">
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
                : <span className="verified-badge">✓ Eligibility reviewed</span>}
              <span className="provider-mode-badge">
                {providerModeForWorkLocations(workLocations)}
              </span>
              <span className={`availability-chip ${profile.availabilityStatus.toLowerCase().replaceAll(" ", "-")}`}>
                {profile.availabilityStatus}
              </span>
            </div>
            <h1>{profile.businessName}</h1>
            <p>{profile.headline}</p>
            <div className="storefront-quick-facts">
              <span>{businessMunicipality}</span>
              <span>{services.length} approved {services.length === 1 ? "service" : "services"}</span>
              <span>{reviews.length ? `${average} ★ from ${reviews.length} review${reviews.length === 1 ? "" : "s"}` : "New on Tuveloz"}</span>
            </div>
          </div>
        </div>
        <aside className="storefront-action-card">
          <span>Need vehicle help?</span>
          <strong>Post one request and compare clear quotes.</strong>
          <Link className="button primary" href="/#request">Request a quote →</Link>
          <small>Contact details stay private until you select a quote.</small>
        </aside>
      </section>

      <section className="storefront-confidence" aria-labelledby="customer-confidence-heading">
        <div className="storefront-confidence-heading">
          <div>
            <span className="kicker">Customer confidence</span>
            <h2 id="customer-confidence-heading">Checked, specific information</h2>
          </div>
          <p>Tuveloz shows the exact review performed and actual completed-job activity.</p>
        </div>
        <div className="storefront-confidence-grid">
          <article>
            <TuvelozIcon name="overview" />
            <div>
              <span>Government credential review</span>
              <strong>
                {data.testProvider
                  ? "Test profile"
                  : data.credentialReview.noGovernmentCredentialTriggered
                    ? "Not legally triggered"
                    : `${data.credentialReview.credentials.length} current ${data.credentialReview.credentials.length === 1 ? "check" : "checks"}`}
              </strong>
              <small>
                {data.credentialReview.noGovernmentCredentialTriggered
                  ? "The approved services and launch jurisdiction do not trigger a government credential."
                  : "See the exact issuing authority and official source below."}
              </small>
            </div>
          </article>
          <article>
            <TuvelozIcon name="completed" />
            <div>
              <span>Completed Tuveloz jobs</span>
              <strong>{data.confidence.completedJobs.toLocaleString()}</strong>
              <small>Jobs finished through Tuveloz.</small>
            </div>
          </article>
          <article>
            <TuvelozIcon name="reviews" />
            <div>
              <span>Verified reviews</span>
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
          Tuveloz does not estimate missing history. If information is unavailable, we say so.
        </p>
      </section>

      {!data.testProvider && !data.credentialReview.noGovernmentCredentialTriggered && (
        <section className="storefront-section storefront-credentials" aria-labelledby="credential-checks-heading">
          <div className="storefront-section-heading">
            <div>
              <span className="kicker">Official sources</span>
              <h2 id="credential-checks-heading">Government credentials checked</h2>
            </div>
            <p>
              These are the specific current credentials required by the provider&apos;s approved
              services and launch jurisdiction. Tuveloz does not use a blanket licensed-provider claim.
            </p>
          </div>
          <div className="storefront-confidence-grid">
            {data.credentialReview.credentials.map((credential) => (
              <article key={credential.requirementKey}>
                <TuvelozIcon name="overview" />
                <div>
                  <span>{credential.jurisdiction}</span>
                  <strong>{credential.label}</strong>
                  <small>
                    Checked {new Date(credential.checkedAt).toLocaleDateString()} through{" "}
                    {credential.issuingAuthority}.
                    {credential.expiresAt
                      ? ` Current through ${new Date(`${credential.expiresAt}T00:00:00Z`).toLocaleDateString()}.`
                      : ""}
                  </small>
                  <span className="admin-link-actions">
                    <a href={credential.legalBasisUrl} target="_blank" rel="noreferrer">
                      Official requirement
                    </a>
                    <a href={credential.officialLookupUrl} target="_blank" rel="noreferrer">
                      Official lookup
                    </a>
                  </span>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <nav className="storefront-tabs" aria-label="Provider business page">
        <a href="#overview"><TuvelozIcon name="overview" />Overview</a>
        <a href="#services"><TuvelozIcon name="services" />Services</a>
        <a href="#work-gallery"><TuvelozIcon name="gallery" />Work Gallery</a>
        <a href="#reviews"><TuvelozIcon name="reviews" />Reviews</a>
      </nav>

      <section className="storefront-section storefront-overview" id="overview">
        <div>
          <span className="kicker">Overview</span>
          <h2>About this provider</h2>
          <p className="storefront-about">{profile.about}</p>
        </div>
        <dl className="storefront-facts">
          {profile.yearsExperience && (
            <div><dt>Experience</dt><dd>{profile.yearsExperience}</dd></div>
          )}
          <div><dt>Based in</dt><dd>{businessMunicipality}</dd></div>
          <div><dt>Availability</dt><dd>{profile.availabilityNote || profile.availabilityStatus}</dd></div>
          {profile.businessHours && (
            <div><dt>Typical hours</dt><dd>{profile.businessHours}</dd></div>
          )}
          <div><dt>Meeting options</dt><dd>{workLocations.join(" · ")}</dd></div>
        </dl>
      </section>

      <section className="storefront-section" id="services">
        <div className="storefront-section-heading">
          <div><span className="kicker">Services</span><h2>Approved work</h2></div>
          <p>These are the services Tuveloz has approved this provider to quote.</p>
        </div>
        <div className="storefront-service-grid">
          {services.map((service) => (
            <article key={service}>
              <TuvelozIcon name={serviceIcon(service)} />
              <strong>{service}</strong>
              <span>Available for customer requests</span>
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
          <p>Photos are selected and described by the provider.</p>
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
          <div><span className="kicker">Reviews</span><h2>Completed-job feedback</h2></div>
          <div className="storefront-rating">
            <strong>{reviews.length ? average.toFixed(1) : "—"}</strong>
            <span>{reviews.length ? "★★★★★".slice(0, Math.round(average)) : "No reviews yet"}</span>
            <small>{reviews.length} verified {reviews.length === 1 ? "review" : "reviews"}</small>
          </div>
        </div>
        {reviews.length ? (
          <div className="storefront-review-grid">
            {reviews.map((review) => (
              <article key={review.id}>
                <div><span>{"★★★★★".slice(0, review.rating)}</span><strong>{review.rating}.0</strong></div>
                <blockquote>{review.comment}</blockquote>
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
      </section>

      <footer className="storefront-footer">
        <Link className="brand footer-brand" href="/"><BrandMark />Tuveloz</Link>
        <p>Provider pages show approved services, provider-selected work photos, and verified completed-job reviews.</p>
      </footer>
    </main>
  );
}
