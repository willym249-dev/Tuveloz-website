"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CUSTOMER_JOB_POSTING_PAUSED } from "../../lib/launch-status";

type PublicProvider = {
  providerId: string;
  profile: { businessName: string };
  services: string[];
  catalog: Array<{
    id: string;
    service: string;
    priceType: string;
    startingPriceCents: number;
    maximumPriceCents: number;
    description: string;
    durationMinutes: number;
  }>;
  optionalCredentials: Array<{
    id: string;
    credentialName: string;
    issuingAuthority: string;
    jurisdiction: string;
    expiresAt: string;
    reviewNote: string;
  }>;
};

function priceLabel(item: PublicProvider["catalog"][number]) {
  if (item.priceType === "quote") return "Custom quote";
  const formatter = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  });
  const amount = formatter.format(item.startingPriceCents / 100);
  if (item.priceType === "starting_at") return `Starting at ${amount}`;
  if (item.priceType === "range") {
    const maximum = Math.max(item.maximumPriceCents, item.startingPriceCents);
    return `Typically ${amount}–${formatter.format(maximum / 100)}`;
  }
  if (item.priceType === "hourly") return `${amount} per hour`;
  return amount;
}

function ProviderPublicClosedActions() {
  return (
    <details style={{
      position: "fixed",
      left: "1rem",
      bottom: "1rem",
      zIndex: 79,
      maxWidth: "min(25rem, calc(100vw - 2rem))",
      maxHeight: "70vh",
      overflow: "auto",
      border: "1px solid rgba(255,255,255,.18)",
      borderRadius: "1rem",
      background: "rgba(7, 24, 45, .96)",
      boxShadow: "0 1rem 3rem rgba(0,0,0,.3)",
      color: "white",
      padding: ".7rem .85rem",
    }}>
      <summary style={{ cursor: "pointer", fontWeight: 800 }}>
        Requests and appointments are not open yet
      </summary>
      <div style={{ display: "grid", gap: ".75rem", marginTop: ".75rem" }}>
        <p>
          Provider profiles are available for onboarding and review. Customer jobs,
          quotes, bookings, appointments, and payments remain closed.
        </p>
        <Link className="button primary" href="/account">Create or open an account</Link>
        <Link className="button secondary" href="/join">Apply as a provider</Link>
      </div>
    </details>
  );
}

function LiveProviderPublicActions({ pathname }: { pathname: string }) {
  const [provider, setProvider] = useState<PublicProvider | null>(null);
  const slug = pathname.startsWith("/providers/")
    ? decodeURIComponent(pathname.slice("/providers/".length).split("/")[0] ?? "")
    : "";

  useEffect(() => {
    if (!slug) return;
    let active = true;
    const timer = window.setTimeout(() => {
      void fetch(`/api/public-provider?slug=${encodeURIComponent(slug)}`, { cache: "no-store" })
        .then(async (response) => response.ok ? await response.json() as PublicProvider : null)
        .then((result) => {
          if (active && result) setProvider(result);
        })
        .catch(() => undefined);
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [slug]);

  if (!slug || !provider) return null;
  const appointmentService = provider.catalog[0]?.service || provider.services[0] || "";
  const appointmentHref = `/appointments?provider=${encodeURIComponent(provider.providerId)}&service=${encodeURIComponent(appointmentService)}`;

  return (
    <details style={{
      position: "fixed",
      left: "1rem",
      bottom: "1rem",
      zIndex: 79,
      maxWidth: "min(25rem, calc(100vw - 2rem))",
      maxHeight: "70vh",
      overflow: "auto",
      border: "1px solid rgba(255,255,255,.18)",
      borderRadius: "1rem",
      background: "rgba(7, 24, 45, .96)",
      boxShadow: "0 1rem 3rem rgba(0,0,0,.3)",
      color: "white",
      padding: ".7rem .85rem",
    }}>
      <summary style={{ cursor: "pointer", fontWeight: 800 }}>
        Prices & appointment · {provider.profile.businessName}
      </summary>
      <div style={{ display: "grid", gap: ".75rem", marginTop: ".75rem" }}>
        {provider.catalog.length ? provider.catalog.map((item) => (
          <article key={item.id} style={{ borderTop: "1px solid rgba(255,255,255,.15)", paddingTop: ".6rem" }}>
            <strong>{item.service}</strong>
            <div>{priceLabel(item)}{item.durationMinutes ? ` · about ${item.durationMinutes} min` : ""}</div>
            {item.description && <small>{item.description}</small>}
          </article>
        )) : (
          <p>This provider has not published standard prices. Request a quote for exact job pricing.</p>
        )}
        <small>
          Provider-published prices may be starting estimates or standard rates. The customer must approve the final quote before work.
        </small>
        <Link className="button primary" href={appointmentHref}>Request an appointment</Link>
        <Link className="button secondary" href="/post-job">Request a quote</Link>
        {provider.optionalCredentials.length > 0 && (
          <section>
            <strong>Tuveloz-reviewed optional credentials</strong>
            {provider.optionalCredentials.map((credential) => (
              <p key={credential.id}>
                {credential.credentialName}
                {credential.issuingAuthority ? ` · ${credential.issuingAuthority}` : ""}
                {credential.jurisdiction ? ` · ${credential.jurisdiction}` : ""}
                {credential.expiresAt ? ` · expires ${credential.expiresAt}` : ""}
              </p>
            ))}
            <small>
              Optional credentials are separate from any government credential that is legally required and shown in the provider page&apos;s official-source section.
            </small>
          </section>
        )}
      </div>
    </details>
  );
}

export function ProviderPublicActions() {
  const pathname = usePathname();
  if (!pathname.startsWith("/providers/")) return null;
  return CUSTOMER_JOB_POSTING_PAUSED
    ? <ProviderPublicClosedActions />
    : <LiveProviderPublicActions pathname={pathname} />;
}
