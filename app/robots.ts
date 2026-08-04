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
