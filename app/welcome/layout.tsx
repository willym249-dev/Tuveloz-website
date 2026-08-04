import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Welcome",
  description: "Welcome to Tuveloz — get started with your new account.",
};

export default function WelcomeLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
