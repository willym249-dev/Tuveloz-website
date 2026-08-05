import type { Metadata } from "next";
import { CUSTOMER_JOB_POSTING_PAUSED } from "../lib/launch-status";
import { AccountToolsDock } from "./components/account-tools-dock";
import { JobPostingPauseNotice } from "./components/job-posting-pause-notice";
import { ProviderPublicActions } from "./components/provider-public-actions";
import { SiteLanguageProvider } from "./components/site-language";
import { StagingEnvironmentBanner } from "./components/staging-environment-banner";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://tuveloz.com"),
  manifest: "/manifest.webmanifest",
  title: {
    default: "Tuveloz — Vehicle-Service Marketplace in Montgomery County, MD",
    template: "%s | Tuveloz",
  },
  description:
    "Compare quotes from local independent vehicle-service providers in Montgomery County, MD. Providers join free and keep 100% of their quoted price — customer launch coming soon.",
  alternates: { canonical: "/" },
  icons: {
    icon: [
      { url: "/favicon.ico?v=5", sizes: "32x32" },
      { url: "/tuveloz-favicon-v2.svg?v=5", type: "image/svg+xml" },
    ],
    apple: "/apple-touch-icon.png?v=5",
  },
  openGraph: {
    title: "Tuveloz — Vehicle-Service Marketplace in Montgomery County, MD",
    description:
      "The vehicle-services marketplace for Montgomery County, MD. Real quotes, your choice. Providers are joining free right now — customer launch coming soon.",
    url: "https://tuveloz.com/",
    type: "website",
    images: [{
      url: "/og-image.png?v=5",
      width: 1200,
      height: 630,
      alt: "Tuveloz — Vehicle Services. Customer Choice. Provider Freedom.",
    }],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/og-image.png?v=5"],
  },
};

/**
 * Organization plus WebSite, in one graph so search engines read them as the
 * same entity. Tuveloz is described as the marketplace operator — never as an
 * auto-repair business, which it is not.
 */
const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://tuveloz.com/#organization",
      name: "Tuveloz",
      legalName: "TUVELOZ LLC",
      url: "https://tuveloz.com",
      logo: "https://tuveloz.com/icon-512.png?v=5",
      email: "hello@tuveloz.com",
      description:
        "Tuveloz operates an online marketplace connecting customers with independent vehicle-service providers in Montgomery County, Maryland.",
      areaServed: {
        "@type": "AdministrativeArea",
        name: "Montgomery County, Maryland",
      },
      contactPoint: [{
        "@type": "ContactPoint",
        contactType: "customer support",
        email: "hello@tuveloz.com",
        areaServed: "US-MD",
        availableLanguage: ["English", "Spanish"],
      }],
    },
    {
      "@type": "WebSite",
      "@id": "https://tuveloz.com/#website",
      name: "Tuveloz",
      url: "https://tuveloz.com",
      inLanguage: ["en-US", "es-US"],
      publisher: { "@id": "https://tuveloz.com/#organization" },
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className="antialiased"
        data-customer-job-posting-paused={
          CUSTOMER_JOB_POSTING_PAUSED ? "true" : undefined
        }
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <SiteLanguageProvider>
          <StagingEnvironmentBanner />
          {CUSTOMER_JOB_POSTING_PAUSED && <JobPostingPauseNotice />}
          {children}
          <ProviderPublicActions />
          <AccountToolsDock />
        </SiteLanguageProvider>
      </body>
    </html>
  );
}
