import { requestPageMetadata } from "../lib/request-page-metadata";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { CUSTOMER_JOB_POSTING_PAUSED } from "../lib/launch-status";
import { TUVELOZ_SOCIAL_PROFILES } from "../lib/brand-profile";
import { AccountToolsDock } from "./components/account-tools-dock";
import { JobPostingPauseNotice } from "./components/job-posting-pause-notice";
import { ProviderPublicActions } from "./components/provider-public-actions";
import { SiteLanguageProvider } from "./components/site-language";
import { StagingEnvironmentBanner } from "./components/staging-environment-banner";
import "./globals.css";

const englishMetadata: Metadata = {
  metadataBase: new URL("https://tuveloz.com"),
  alternates: {
    canonical: "/",
  },
  manifest: "/manifest.webmanifest",
  title: {
    default: "Tuveloz | Vehicle Services in Montgomery County, MD",
    template: "%s | Tuveloz",
  },
  description:
    "Tuveloz is preparing to launch vehicle services in Montgomery County, MD. Provider applications are open and free. Customer bookings are not open yet.",
  icons: {
    icon: [
      { url: "/favicon.ico?v=6", sizes: "32x32" },
      { url: "/tuveloz-favicon-v3.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-touch-icon.png?v=6",
  },
  openGraph: {
    title: "Tuveloz | Vehicle Services in Montgomery County, MD",
    siteName: "Tuveloz",
    description:
      "Tuveloz is preparing to launch vehicle services in Montgomery County, MD. Provider applications are open and free. Customer bookings are not open yet.",
    url: "https://tuveloz.com/",
    type: "website",
    locale: "en_US",
    images: [{
      url: "/og-image.png?v=6",
      width: 1200,
      height: 630,
      alt: "Tuveloz — Vehicle Services. Customer Choice. Provider Freedom.",
    }],
  },
  twitter: {
    card: "summary_large_image",
    site: "@TuvelozApp",
    images: ["/og-image.png?v=6"],
  },
};

export async function generateMetadata(): Promise<Metadata> {
  return requestPageMetadata(englishMetadata);
}

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": "https://tuveloz.com/#organization",
  name: "Tuveloz",
  legalName: "TUVELOZ LLC",
  url: "https://tuveloz.com",
  logo: "https://tuveloz.com/icon-512.png?v=6",
  email: "hello@tuveloz.com",
  areaServed: "Montgomery County, Maryland",
  sameAs: TUVELOZ_SOCIAL_PROFILES.map(({ href }) => href),
};

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": "https://tuveloz.com/#website",
  name: "Tuveloz",
  url: "https://tuveloz.com/",
  publisher: { "@id": "https://tuveloz.com/#organization" },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The Worker sets this only for a reviewed Spanish route, replacing any
  // visitor-supplied value before the request reaches the renderer.
  const language = (await headers()).get("x-tuveloz-render-language") === "es" ? "es" : "en";
  return (
    <html lang={language}>
      <body
        className="antialiased"
        data-customer-job-posting-paused={
          CUSTOMER_JOB_POSTING_PAUSED ? "true" : undefined
        }
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
        <SiteLanguageProvider initialLanguage={language}>
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
