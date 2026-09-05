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
  alternates: {
    canonical: "/",
  },
  manifest: "/manifest.webmanifest",
  title: {
    default: "Tuveloz | Customer Choice. Provider Freedom.",
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
    title: "Tuveloz | Customer Choice. Provider Freedom.",
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
    images: ["/og-image.png?v=6"],
  },
};

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Tuveloz",
  url: "https://tuveloz.com",
  logo: "https://tuveloz.com/icon-512.png?v=6",
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
