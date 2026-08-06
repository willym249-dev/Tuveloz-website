import type { Metadata } from "next";
import { TuvelozPublic } from "../page";

export const metadata: Metadata = {
  title: "For Customers — Compare Quotes From Local Providers",
  description:
    "See what Tuveloz will do for your vehicle in Montgomery County, MD. Describe the problem once, compare quotes from independent local providers, and choose who does the work.",
};

/**
 * The customer counterpart to /join. Providers already land on a page written
 * for them; this gives customers the same, using the request view that the
 * public site already builds. That view is pause-aware: while customer job
 * posting is off it shows account signup only and never renders the request
 * form, so this route cannot become a way to submit a job early.
 */
export default function ForCustomersPage() {
  return <TuvelozPublic view="request" />;
}
