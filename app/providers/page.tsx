"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PublicInfoPage } from "../components/public-info-page";
import { CURRENT_LAUNCH_AREA } from "../../lib/service-matching";

type DirectoryProvider = {
  slug: string;
  businessName: string;
  headline: string;
  businessMunicipality: string;
  workMode: string;
};

function isDirectoryProvider(value: unknown): value is DirectoryProvider {
  return typeof value === "object" && value !== null
    && ["slug", "businessName", "headline", "businessMunicipality", "workMode"]
      .every((key) => typeof (value as Record<string, unknown>)[key] === "string");
}

/**
 * The public provider directory.
 *
 * It exists so approved profiles are linked from somewhere rather than being
 * reachable only by direct link — a page nothing links to is invisible to a
 * visitor and to a crawler, and a sitemap entry does not fix that.
 *
 * While the marketplace is in onboarding mode the API returns 503 and no
 * provider data, because listing providers would route around the same
 * "discovery" control that closes individual profiles. The closed state below
 * is therefore the normal state today, and it says so plainly instead of
 * rendering an empty list that reads like nobody has joined.
 */
export default function ProvidersDirectoryPage() {
  const [providers, setProviders] = useState<DirectoryProvider[] | null>(null);
  const [closed, setClosed] = useState(false);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/public-provider-directory", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as { code?: string; providers?: unknown };
        if (controller.signal.aborted) return;
        if (response.status === 503 && payload?.code === "MARKETPLACE_ONBOARDING_ONLY") {
          setClosed(true);
          setProviders([]);
          return;
        }
        if (!response.ok || !Array.isArray(payload?.providers) || !payload.providers.every(isDirectoryProvider)) {
          throw new Error("Directory unavailable");
        }
        setProviders(payload.providers);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setError(true);
        setProviders([]);
      });
    return () => controller.abort();
  }, [attempt]);

  function retry() {
    setProviders(null);
    setClosed(false);
    setError(false);
    setAttempt((value) => value + 1);
  }

  return (
    <PublicInfoPage
      breadcrumbs={[
        { label: "Tuveloz", href: "/" },
        { label: "Providers" },
      ]}
      kicker="Provider directory"
      title="The independent businesses on Tuveloz."
      intro={`Get to know independent vehicle-service businesses in ${CURRENT_LAUNCH_AREA}. Providers set their own prices and choose which jobs to take. You decide who to hire.`}
      sections={[
        {
          title: "What we check",
          text: "Before a profile is published, we review the provider's identity, business records, and required documents for the services they offer. Those records must be current, and at least one approved service must be open for bookings.",
          points: [
            "Profiles explain which services and documents were reviewed.",
            "A listing is not an endorsement or a guarantee of the work.",
            "Reviews come from completed jobs only.",
          ],
        },
        {
          title: "How the directory is ordered",
          text: "Businesses appear alphabetically by name. Providers cannot pay for a higher position, and founding providers get no placement advantage. The order is not a quality rating.",
        },
      ]}
    >
      <section className="local-link-section" aria-labelledby="directory-heading" aria-busy={providers === null}>
        <h2 id="directory-heading">Providers</h2>
        {providers === null && (
          <p className="local-link-note" role="status">Loading the directory…</p>
        )}

        {error && (
          <>
            <p className="form-error" role="alert">
              We couldn&apos;t load the provider directory. Please try again.
            </p>
            <button className="button secondary" type="button" onClick={retry}>Try again</button>
          </>
        )}

        {closed && (
          <p className="local-link-note">
            Provider profiles are not public yet. Local businesses are applying
            and completing their checks. Approved profiles will become visible
            when customer requests open.
          </p>
        )}

        {!error && !closed && providers !== null && providers.length === 0 && (
          <p className="local-link-note">
            No provider profiles are published yet.
          </p>
        )}

        {providers !== null && providers.length > 0 && (
          <ul className="local-link-grid">
            {providers.map((provider) => (
              <li key={provider.slug}>
                <Link href={`/providers/${provider.slug}`}>
                  <strong>{provider.businessName}</strong>
                  {provider.headline && <span>{provider.headline}</span>}
                  <span>
                    {[
                      provider.workMode === "Mobile"
                        ? "Travels to customers"
                        : provider.workMode === "Shop"
                          ? "Customers come to them"
                          : "Mobile and shop",
                      provider.businessMunicipality,
                    ].filter(Boolean).join(" · ")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {closed && (
        <section className="local-provider-panel">
          <h2>Run a vehicle-service business? Applications are open.</h2>
          <p>
            Getting listed here starts with an application. You set your own
            price, your own schedule, and your own service area, and you receive
            your full quoted price — the 5% Customer Service Fee is charged to the
            customer on top of it, never deducted from your payout.
          </p>
          <div>
            <Link className="button primary" href="/join">Join as a provider <span>→</span></Link>
            <Link className="button secondary" href="/service-areas">Service areas</Link>
          </div>
        </section>
      )}
    </PublicInfoPage>
  );
}
