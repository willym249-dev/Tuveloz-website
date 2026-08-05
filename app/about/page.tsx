import type { Metadata } from "next";
import { TuvelozPublic } from "../page";

export const metadata: Metadata = {
  title: "About",
  description:
    "Tuveloz is a local vehicle-service marketplace for Montgomery County, MD — built around customer choice and independent provider freedom.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return <TuvelozPublic view="about" />;
}
