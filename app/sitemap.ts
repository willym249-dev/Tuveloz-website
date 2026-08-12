import type { MetadataRoute } from "next";
import { localPagePaths } from "../lib/local-service-areas";

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
  // The directory itself is listed; individual profile URLs are not. They are
  // served only while marketplace discovery is open, so listing them today
  // would point crawlers at pages that return 503.
  { path: "/providers", changeFrequency: "weekly", priority: 0.8 },
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

/**
 * The local service-area pages come from lib/local-service-areas.ts rather
 * than being listed by hand, so adding an area or a service cannot leave its
 * page unlisted here. They sit below the core pages in priority: useful entry
 * points from search, but not more important than the homepage or the two
 * pages that actually convert.
 */
const LOCAL_PAGES: PublicPage[] = localPagePaths().map((path) => ({
  path,
  changeFrequency: "monthly",
  priority: 0.6,
}));

export default function sitemap(): MetadataRoute.Sitemap {
  return [...PUBLIC_PAGES, ...LOCAL_PAGES].map(({ path, changeFrequency, priority }) => ({
    url: `${BASE_URL}${path}`,
    changeFrequency,
    priority,
  }));
}
