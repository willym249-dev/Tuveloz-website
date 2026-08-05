import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Provisional Provider & Trainee Policy",
  description:
    "Tuveloz's deny-by-default eligibility rules for startup owner-operators, sponsored trainee employees, and provider-business employees.",
};

export default function ProvisionalProviderPolicyLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
