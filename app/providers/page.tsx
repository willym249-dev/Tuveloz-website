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
  areas: string[];
  services: string[];
};

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

  useEffect(() => {
    let active = true;
    fetch("/api/public-provider-directory")
      .then(async (response) => {
        if (!active) return;
        if (response.status === 503) {
          setClosed(true);
          setProviders([]);
          return;
        }
        const payload = await response.json().catch(() => ({ providers: [] })) as { providers?: DirectoryProvider[] };
        setProviders(Array.isArray(payload.providers) ? payload.providers : []);
      })
      .catch(() => {
        if (active) setProviders([]);
      });
    return () => { active = false; };
  }, []);

  return (
    <PublicInfoPage
      breadcrumbs={[
        { label: "Tuveloz", href: "/" },
        { label: "Providers" },
      ]}
      kicker="Provider directory"
      title="The independent businesses on Tuveloz."
      intro={`Every approved provider with a public profile in ${CURRENT_LAUNCH_AREA}. Each one is an independent business that sets its own prices and chooses its own work — Tuveloz does not employ, train, or assign them.`}
      sections={[
        {
          title: "What being listed here means",
          text: "A profile appears once the business has been approved for at least one currently open service, its identity and business records have been verified, and any evidence that service requires is on file and current. It is not an endorsement, a ranking, or a guarantee of the work.",
          points: [
            "Approval covers specific services, never a blanket sign-off.",
            "Tuveloz shows the exact evidence checked for a service, person, and date.",
            "Reviews come from completed jobs only.",
          ],
        },
        {
          title: "How the directory is ordered",
          text: "Businesses appear alphabetically by name. Founding providers get no placement advantage, and providers cannot pay to appear higher. The order is not a quality rating. You choose the provider that fits your needs.",
        },
      ]}
    >
      <section className="local-link-section">
        <h2>Providers</h2>
        {providers === null && (
          <p className="local-link-note">Loading the directory…</p>
        )}

        {closed && (
          <p className="local-link-note">
            Provider profiles are not public yet. Local businesses are applying
            and completing their checks. Approved profiles will become visible
            when customer requests open.
          </p>
        )}

        {!closed && providers !== null && providers.length === 0 && (
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
