import type { MetadataRoute } from "next";

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
  { path: "/about", changeFrequency: "monthly", priority: 0.8 },
  { path: "/how-it-works", changeFrequency: "monthly", priority: 0.8 },
  { path: "/safety", changeFrequency: "monthly", priority: 0.8 },
  { path: "/faq", changeFrequency: "monthly", priority: 0.7 },
  { path: "/privacy", changeFrequency: "monthly", priority: 0.5 },
  { path: "/terms", changeFrequency: "monthly", priority: 0.5 },
  { path: "/customer-agreement", changeFrequency: "monthly", priority: 0.5 },
  { path: "/provider-agreement", changeFrequency: "monthly", priority: 0.5 },
  { path: "/marketplace-conduct", changeFrequency: "monthly", priority: 0.5 },
  { path: "/provisional-provider-policy", changeFrequency: "monthly", priority: 0.5 },
  { path: "/payments", changeFrequency: "monthly", priority: 0.5 },
  { path: "/job-operations", changeFrequency: "monthly", priority: 0.5 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_PAGES.map(({ path, changeFrequency, priority }) => ({
    url: `${BASE_URL}${path}`,
    changeFrequency,
    priority,
  }));
}
