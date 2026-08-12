import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/account",
        "/api/",
        "/appointments",
        "/my-request",
        "/notifications",
        "/privacy-center",
        // QR short links. /q/<slug> only ever 302s to the provider storefront
        // it stands for, so a crawler that follows one lands on a page it can
        // reach directly. Search Console reports every crawled one as "Page
        // with redirect"; the storefront itself is the URL worth indexing.
        "/q/",
        "/job-authorizations",
        "/job-evidence",
        "/repair-records",
        "/tracking",
        "/success",
      ],
    },
    sitemap: "https://tuveloz.com/sitemap.xml",
  };
}
