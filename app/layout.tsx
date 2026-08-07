import type { Metadata, Viewport } from "next";
import { CUSTOMER_JOB_POSTING_PAUSED } from "../lib/launch-status";
import { AccountToolsDock } from "./components/account-tools-dock";
import { JobPostingPauseNotice } from "./components/job-posting-pause-notice";
import { ProviderPublicActions } from "./components/provider-public-actions";
import { ServiceWorkerRegistration } from "./components/service-worker-registration";
import { SiteLanguageProvider } from "./components/site-language";
import { StagingEnvironmentBanner } from "./components/staging-environment-banner";
import "./globals.css";

/**
 * Installed-app chrome. `themeColor` paints the Android status bar and the
 * desktop title bar, and it has to match the sticky header's real background
 * (#050505) — the manifest was still carrying an older navy from a previous
 * palette. The `viewport-fit=cover` directive below lets the page paint into
 * the iPhone's notch and home-indicator areas; the safe-area padding in
 * globals.css keeps content out of them.
 *
 * Zoom is deliberately left unrestricted. Pinch-zoom is an accessibility
 * feature, and locking it is the usual way an "app-like" viewport breaks
 * things for people who need to magnify.
 */
export const viewport: Viewport = {
  // `viewport-fit=cover` rides along inside `width` on purpose. vinext builds
  // the viewport meta by hand and its builder has no branch for Next's
  // dedicated field, so that field is silently dropped — and without it iOS
  // reports every `env(safe-area-inset-*)` as 0px, which would quietly turn all
  // the safe-area padding in globals.css into a no-op. The emitted content is
  // `width=device-width, viewport-fit=cover, initial-scale=1`; the directives
  // are order-independent, so this is exactly the intended meta.
  width: "device-width, viewport-fit=cover",
  initialScale: 1,
  themeColor: "#050505",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://tuveloz.com"),
  applicationName: "Tuveloz",
  appleWebApp: {
    capable: true,
    title: "Tuveloz",
    // The header is near-black, so the iOS status bar should sit on top of it
    // rather than reserve its own opaque strip.
    statusBarStyle: "black-translucent",
  },
  // Safari and some Android browsers turn bare numbers into "call" links,
  // which mangles prices, ZIPs, and job numbers in the marketplace copy.
  formatDetection: { telephone: false },
  other: {
    // `appleWebApp.capable` above emits only the standardised
    // `mobile-web-app-capable`. iOS still reads the vendor-prefixed name, and
    // without it "Add to Home Screen" opens a Safari tab with full browser
    // chrome instead of launching standalone.
    "apple-mobile-web-app-capable": "yes",
  },
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
        {/*
          Written out here rather than via `metadata.manifest`, which resolves
          the path against metadataBase and hard-codes https://tuveloz.com. A
          cross-origin manifest is not installable without CORS headers, so
          that absolute URL made staging and preview deployments un-installable
          and pointed their scope and start_url at production. React hoists
          this into <head>.
        */}
        <link rel="manifest" href="/manifest.webmanifest" />
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
          <ServiceWorkerRegistration />
        </SiteLanguageProvider>
      </body>
    </html>
  );
}
