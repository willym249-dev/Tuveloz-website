import type { Metadata } from "next";
import { TuvelozPublic } from "../page";

export const metadata: Metadata = {
  title: "Join as a Provider — Free Signup",
  description:
    "Apply free to offer vehicle services on Tuveloz in Montgomery County, MD. Keep 100% of your quoted price, set your own schedule, no exclusivity.",
  alternates: {
    canonical: "/join",
  },
};

export default function JoinPage() {
  return <TuvelozPublic view="provider" />;
}
