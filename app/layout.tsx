import type { Metadata } from "next";
import { AccountToolsDock } from "./components/account-tools-dock";
import { SiteLanguageProvider } from "./components/site-language";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://tuveloz.com"),
  manifest: "/manifest.webmanifest",
  title: "Tuveloz | Customer Choice. Provider Freedom.",
  description:
    "A local vehicle-service marketplace currently operating in Montgomery County, Maryland. Customers compare quotes while providers choose their schedule, prices, and work.",
  icons: {
    icon: "/tuveloz-favicon-v2.svg",
    shortcut: "/tuveloz-favicon-v2.svg",
    apple: "/tuveloz-google-profile-logo.png",
  },
  openGraph: {
    title: "Tuveloz | Customer Choice. Provider Freedom.",
    description:
      "Local vehicle services, now operating in Montgomery County, Maryland. Customers compare providers and quotes while providers choose how they work.",
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
      <body className="antialiased">
        <SiteLanguageProvider>
          {children}
          <AccountToolsDock />
        </SiteLanguageProvider>
      </body>
    </html>
  );
}
