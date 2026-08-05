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
    default: "Tuveloz | Customer Choice. Provider Freedom.",
    template: "%s | Tuveloz",
  },
  description:
    "Post what your vehicle needs and compare real quotes from local independent providers in Montgomery County, MD. Providers join free — customer launch coming soon.",
  icons: {
    icon: [
      { url: "/favicon.ico?v=5", sizes: "32x32" },
      { url: "/tuveloz-favicon-v2.svg?v=5", type: "image/svg+xml" },
    ],
    apple: "/apple-touch-icon.png?v=5",
  },
  openGraph: {
    title: "Tuveloz | Customer Choice. Provider Freedom.",
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

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Tuveloz",
  url: "https://tuveloz.com",
  logo: "https://tuveloz.com/icon-512.png?v=5",
  email: "hello@tuveloz.com",
  areaServed: "Montgomery County, Maryland",
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
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
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
