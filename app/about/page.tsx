import { requestPageMetadata } from "../../lib/request-page-metadata";
import type { Metadata } from "next";
import { TuvelozPublic } from "../page";

const englishMetadata: Metadata = {
  title: "About",
  description:
    "Tuveloz is a local vehicle-service marketplace for Montgomery County, MD — built around customer choice and independent provider freedom.",
  alternates: {
    canonical: "/about",
  },
};

export async function generateMetadata(): Promise<Metadata> {
  return requestPageMetadata(englishMetadata);
}

export default function AboutPage() {
  return <TuvelozPublic view="about" />;
}
