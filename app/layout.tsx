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
  title: "Tuveloz | Customer Choice. Provider Freedom.",
  description:
    "Post what your vehicle needs and compare real quotes from local independent providers in Montgomery County, MD. Providers join free — customer launch coming soon.",
  icons: {
    icon: "/tuveloz-favicon-v2.svg",
    shortcut: "/tuveloz-favicon-v2.svg",
    apple: "/tuveloz-google-profile-logo.png",
  },
  openGraph: {
    title: "Tuveloz | Customer Choice. Provider Freedom.",
    description:
      "The vehicle-services marketplace for Montgomery County, MD. Real quotes, your choice. Providers are joining free right now — customer launch coming soon.",
    images: [{
      url: "/tuveloz-google-profile-logo.png",
      width: 1024,
      height: 1024,
      alt: "Tuveloz — Vehicle Services. Customer Choice. Provider Freedom.",
    }],
  },
  twitter: {
    card: "summary",
    images: ["/tuveloz-google-profile-logo.png"],
  },
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
