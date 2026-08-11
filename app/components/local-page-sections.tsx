import Link from "next/link";
import {
  areaLabel,
  areaPath,
  areaServicePath,
  servicePath,
  LOCAL_PAGE_LAUNCH_NOTICE,
  LOCAL_SERVICES,
  type LocalServiceDefinition,
  type ServiceAreaDefinition,
} from "../../lib/local-service-areas";
import {
  CUSTOMER_FEE_DISCLOSURE,
  CUSTOMER_FEE_WORKED_EXAMPLE,
  PROVIDER_PAYOUT_DISCLOSURE,
} from "../../lib/customer-fee";
import { SERVICE_CODES } from "../../lib/provider-policy";
import { LaunchUpdatesForm } from "./launch-updates-form";

/**
 * Shared blocks for the local service-area pages.
 *
 * Everything here is a server component on purpose. These pages exist to be
 * crawled, so their content — the links especially — has to be in the HTML a
 * crawler receives, not assembled after hydration. Only the launch-list form
 * reaches for a client component, because it posts.
 */

// Every local page imports this module, so a page can never advertise work the
// marketplace cannot route: a drifted code fails the build here. The homepage
// guards its own service list the same way (app/page.tsx). The check lives at
// the app layer rather than beside the data because lib/provider-policy.ts
// loads a JSON config, which would make the data module untestable under Node.
{
  const codes: readonly string[] = SERVICE_CODES;
  for (const service of LOCAL_SERVICES) {
    for (const code of service.serviceCodes) {
      if (!codes.includes(code)) {
        throw new Error(
          `Local service "${service.name}" references unknown service code ${code}.`,
        );
      }
    }
  }
}

/**
 * The launch status plus the notification form, stated on every local page.
 *
 * The form's `source` carries the area and service the visitor was reading
 * when they signed up, which is what turns this from a mailing list into a
 * demand signal: it is the evidence for which area × service pages get
 * published next, and where there are enough customers to open at all.
 */
export function LocalLaunchPanel({
  source,
  serviceName,
  areaName,
}: {
  source: string;
  serviceName?: string;
  areaName?: string;
}) {
  const what = serviceName
    ? (areaName ? `${serviceName} in ${areaName}` : serviceName)
    : (areaName ? `services in ${areaName}` : "the launch");

  return (
    <section className="local-launch-panel">
      <div>
        <h2>Where this actually stands</h2>
        <p>{LOCAL_PAGE_LAUNCH_NOTICE}</p>
        <p className="local-launch-panel-secondary">
          Creating an account does not submit a service request or charge you.
          There is no waiting list to pay for and no position to lose.
        </p>
        <div className="local-launch-panel-links">
          <Link className="button secondary" href="/how-it-works">How it works</Link>
          <Link className="button secondary" href="/post-job">Customer launch status</Link>
        </div>
      </div>
      <div className="local-launch-panel-form">
        <h3>Tell us you want {what}</h3>
        <p className="local-launch-panel-form-note">
          We record which service and area you asked about. That is how we decide
          where to open first — and you will hear when it does.
        </p>
        <LaunchUpdatesForm source={source} />
      </div>
    </section>
  );
}

/** Recruitment block. These pages are read by providers searching for work too. */
export function LocalProviderPanel({
  areaName,
  serviceNote,
}: {
  areaName: string;
  serviceNote?: string;
}) {
  return (
    <section className="local-provider-panel">
      <h2>Work in {areaName}? Applications are open.</h2>
      <p>
        {serviceNote ? `${serviceNote} ` : ""}
        Tuveloz does not employ, train, or assign providers — you set your own
        price, your own schedule, and your own service area. There is no
        subscription and no lead fee.
      </p>
      <p>{PROVIDER_PAYOUT_DISCLOSURE}</p>
      <p className="local-provider-panel-note">
        Applications are reviewed before any account is approved, and approval
        covers specific services rather than a blanket sign-off. No provider can
        accept real jobs until customer requests open.
      </p>
      <div>
        <Link className="button primary" href="/join">Join as a provider <span>→</span></Link>
        <Link className="button secondary" href="/founding-providers">Founding providers</Link>
      </div>
    </section>
  );
}

/**
 * What a quote would cost, stated the same way everywhere. Imported from
 * lib/customer-fee.ts rather than retyped, so a page cannot drift from the
 * arithmetic or from the agreements.
 */
export function LocalPricingNote() {
  return (
    <section className="local-link-section">
      <h2>What it would cost</h2>
      <p className="local-link-note">
        Nothing is charged for asking, and no quote obliges you to anything. Each
        provider sets their own price and receives it in full. {CUSTOMER_FEE_DISCLOSURE}
      </p>
      <p className="local-link-note">{CUSTOMER_FEE_WORKED_EXAMPLE}</p>
      <p className="local-link-note">
        Accepting a quote is what creates a written authorisation. Work beyond it
        needs your approval as a change order.
      </p>
    </section>
  );
}

/** Link grid to services, optionally scoped to one area. */
export function LocalServiceLinks({
  services,
  area,
  heading,
  /** Services with their own page in this area; the rest link county-wide. */
  publishedInArea,
}: {
  services: readonly LocalServiceDefinition[];
  area?: ServiceAreaDefinition;
  heading: string;
  publishedInArea?: readonly LocalServiceDefinition[];
}) {
  const published = new Set((publishedInArea ?? []).map((service) => service.slug));
  return (
    <section className="local-link-section">
      <h2>{heading}</h2>
      <ul className="local-link-grid">
        {services.map((service) => (
          <li key={service.slug}>
            <Link
              href={area && published.has(service.slug)
                ? areaServicePath(area, service)
                : servicePath(service)}
            >
              <strong>{service.searchName}</strong>
              <span>{service.summary}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Link list to areas that have a page. */
export function LocalAreaLinks({
  areas,
  service,
  heading,
  note,
  /** Areas with a page for `service`; the rest link to the area page. */
  publishedForService,
}: {
  areas: readonly ServiceAreaDefinition[];
  service?: LocalServiceDefinition;
  heading: string;
  note?: string;
  publishedForService?: readonly ServiceAreaDefinition[];
}) {
  if (areas.length === 0) return null;
  const published = new Set((publishedForService ?? []).map((area) => area.slug));
  return (
    <section className="local-link-section">
      <h2>{heading}</h2>
      {note && <p className="local-link-note">{note}</p>}
      <ul className="local-area-links">
        {areas.map((area) => (
          <li key={area.slug}>
            <Link
              href={service && published.has(area.slug)
                ? areaServicePath(area, service)
                : areaPath(area)}
            >
              {areaLabel(area)}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The ZIP codes Tuveloz covers for an area — real data, stated as coverage. */
export function LocalZipCodes({ area }: { area: ServiceAreaDefinition }) {
  return (
    <section className="local-link-section">
      <h2>ZIP codes covered for {area.name}</h2>
      <p className="local-link-note">
        These are the ZIP codes Tuveloz treats as part of {areaLabel(area)}. Place
        names and postal boundaries overlap across Montgomery County, so a
        neighbouring area may share one — this is Tuveloz&apos;s coverage list, not
        an official boundary.
      </p>
      <ul className="local-zip-list">
        {area.zipCodes.map((zip) => <li key={zip}>{zip}</li>)}
      </ul>
    </section>
  );
}

/** The full coverage map as text on the hub — 36 areas, not 36 pages. */
export function LocalCoverageStatement({
  areas,
  published,
}: {
  areas: readonly ServiceAreaDefinition[];
  published: readonly ServiceAreaDefinition[];
}) {
  const publishedSlugs = new Set(published.map((area) => area.slug));
  return (
    <section className="local-link-section">
      <h2>Every area in the launch</h2>
      <p className="local-link-note">
        Tuveloz covers all {areas.length} of these, including the small and rural
        ones. The {published.length} with their own page below are where we have
        written something worth reading; the rest are covered just the same, and
        get a page when there is a reason for one.
      </p>
      <ul className="local-area-links">
        {published.map((area) => (
          <li key={area.slug}>
            <Link href={areaPath(area)}>{areaLabel(area)}</Link>
          </li>
        ))}
      </ul>
      <p className="local-coverage-list">
        Also covered:{" "}
        {areas
          .filter((area) => !publishedSlugs.has(area.slug))
          .map((area) => area.name)
          .join(", ")}.
      </p>
    </section>
  );
}

/**
 * Structured data for the page. Breadcrumb plus a Service description so a
 * search engine can read the hierarchy — deliberately no business listing, no
 * rating markup, and no offer: there are no completed jobs, no reviews, and
 * nothing purchasable, and marking any of those up would be a lie told to a
 * crawler. The test asserts their absence.
 */
export function LocalStructuredData({
  breadcrumbs,
  service,
  areaName,
}: {
  breadcrumbs: Array<{ name: string; path: string }>;
  service?: LocalServiceDefinition;
  areaName?: string;
}) {
  const graph: Record<string, unknown>[] = [{
    "@type": "BreadcrumbList",
    itemListElement: breadcrumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: `https://tuveloz.com${crumb.path}`,
    })),
  }];

  if (service) {
    graph.push({
      "@type": "Service",
      name: areaName ? `${service.searchName} in ${areaName}` : service.searchName,
      description: service.summary,
      serviceType: service.searchName,
      provider: { "@type": "Organization", name: "Tuveloz", url: "https://tuveloz.com" },
      areaServed: {
        "@type": "AdministrativeArea",
        name: areaName ?? "Montgomery County, Maryland",
      },
    });
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({ "@context": "https://schema.org", "@graph": graph }),
      }}
    />
  );
}
