import type { MetadataRoute } from "next";
import { publicProviderSitemapEntries } from "../lib/public-provider-page";
import { SERVICE_LANDING_PAGES, TOWN_LANDING_PAGES } from "../lib/local-landing-pages";

const BASE_URL = "https://tuveloz.com";

type PublicPage = {
  path: string;
  changeFrequency: "weekly" | "monthly";
  priority: number;
};

const PUBLIC_PAGES: PublicPage[] = [
  { path: "/", changeFrequency: "weekly", priority: 1.0 },
  { path: "/post-job", changeFrequency: "weekly", priority: 0.9 },
  { path: "/join", changeFrequency: "weekly", priority: 0.9 },
  { path: "/fleet", changeFrequency: "monthly", priority: 0.9 },
  { path: "/ai", changeFrequency: "monthly", priority: 0.8 },
  { path: "/about", changeFrequency: "monthly", priority: 0.8 },
  { path: "/how-it-works", changeFrequency: "monthly", priority: 0.8 },
  { path: "/founding-providers", changeFrequency: "monthly", priority: 0.8 },
  { path: "/safety", changeFrequency: "monthly", priority: 0.8 },
  { path: "/faq", changeFrequency: "monthly", priority: 0.7 },
  { path: "/privacy", changeFrequency: "monthly", priority: 0.5 },
  { path: "/terms", changeFrequency: "monthly", priority: 0.5 },
  { path: "/arbitration-opt-out", changeFrequency: "monthly", priority: 0.5 },
  { path: "/customer-agreement", changeFrequency: "monthly", priority: 0.5 },
  { path: "/provider-agreement", changeFrequency: "monthly", priority: 0.5 },
  { path: "/marketplace-conduct", changeFrequency: "monthly", priority: 0.5 },
  { path: "/provisional-provider-policy", changeFrequency: "monthly", priority: 0.5 },
  { path: "/payments", changeFrequency: "monthly", priority: 0.5 },
  { path: "/job-operations", changeFrequency: "monthly", priority: 0.5 },
];

function lastModified(value: string) {
  const parsed = Date.parse(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);
  return Number.isFinite(parsed) ? new Date(parsed) : undefined;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = PUBLIC_PAGES.map(
    ({ path, changeFrequency, priority }) => ({
      url: `${BASE_URL}${path}`,
      changeFrequency,
      priority,
    }),
  );
  const landingEntries: MetadataRoute.Sitemap = [
    ...SERVICE_LANDING_PAGES.map((page) => ({
      url: `${BASE_URL}/services/${page.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    ...TOWN_LANDING_PAGES.map((page) => ({
      url: `${BASE_URL}/areas/${page.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];

  // Provider pages are listed only while they are actually publicly servable.
  // A database or binding failure must never take the whole sitemap down.
  let providerEntries: MetadataRoute.Sitemap = [];
  try {
    const providers = await publicProviderSitemapEntries();
    providerEntries = providers.map((entry) => ({
      url: `${BASE_URL}/providers/${entry.slug}`,
      lastModified: lastModified(entry.updatedAt),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));
  } catch (error) {
    console.error("Unable to add provider pages to the sitemap", error);
  }

  return [...staticEntries, ...landingEntries, ...providerEntries];
}
