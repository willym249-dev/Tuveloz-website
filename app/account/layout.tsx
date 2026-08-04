import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign Up or Sign In",
  description:
    "Create your free Tuveloz customer or provider account, or sign in to your existing account.",
};

export default function AccountLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
