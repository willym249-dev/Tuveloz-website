import type { MetadataRoute } from "next";
import { publicProviderDirectory } from "../lib/public-provider-directory";

const BASE_URL = "https://tuveloz.com";

/**
 * Provider entries are read at request time. While discovery is paused the
 * directory is empty and this is the same static list it has always been.
 */
export const dynamic = "force-dynamic";

type PublicPage = {
  path: string;
  changeFrequency: "weekly" | "monthly";
  priority: number;
};

const PUBLIC_PAGES: PublicPage[] = [
  { path: "/", changeFrequency: "weekly", priority: 1.0 },
  { path: "/post-job", changeFrequency: "weekly", priority: 0.9 },
  { path: "/join", changeFrequency: "weekly", priority: 0.9 },
  { path: "/ai", changeFrequency: "monthly", priority: 0.8 },
  { path: "/about", changeFrequency: "monthly", priority: 0.8 },
  { path: "/how-it-works", changeFrequency: "monthly", priority: 0.8 },
  { path: "/founding-providers", changeFrequency: "monthly", priority: 0.8 },
  { path: "/safety", changeFrequency: "monthly", priority: 0.8 },
  { path: "/faq", changeFrequency: "monthly", priority: 0.7 },
  { path: "/privacy", changeFrequency: "monthly", priority: 0.5 },
  { path: "/terms", changeFrequency: "monthly", priority: 0.5 },
  { path: "/customer-agreement", changeFrequency: "monthly", priority: 0.5 },
  { path: "/provider-agreement", changeFrequency: "monthly", priority: 0.5 },
  { path: "/marketplace-conduct", changeFrequency: "monthly", priority: 0.5 },
  { path: "/provisional-provider-policy", changeFrequency: "monthly", priority: 0.5 },
  { path: "/payments", changeFrequency: "monthly", priority: 0.5 },
  { path: "/copyright", changeFrequency: "monthly", priority: 0.5 },
  { path: "/sms-terms", changeFrequency: "monthly", priority: 0.5 },
  { path: "/job-operations", changeFrequency: "monthly", priority: 0.5 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages = PUBLIC_PAGES.map(({ path, changeFrequency, priority }) => ({
    url: `${BASE_URL}${path}`,
    changeFrequency,
    priority,
  }));

  let providerPages: MetadataRoute.Sitemap = [];
  try {
    const directory = await publicProviderDirectory();
    providerPages = directory.map((entry) => ({
      url: `${BASE_URL}/providers/${encodeURIComponent(entry.slug)}`,
      lastModified: entry.updatedAt ? new Date(entry.updatedAt) : undefined,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));
  } catch (error) {
    // A sitemap that omits provider pages is still valid; one that fails to
    // render at all costs the static pages their indexing too.
    console.error("Unable to list provider profiles for the sitemap", error);
  }

  return [...staticPages, ...providerPages];
}
