import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "System status",
  alternates: {
    canonical: "/system-status",
  },
  robots: {
    index: false,
    follow: true,
  },
};

export default function SystemStatusLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
