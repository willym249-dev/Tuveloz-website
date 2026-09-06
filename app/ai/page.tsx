import { requestPageMetadata } from "../../lib/request-page-metadata";
import type { Metadata } from "next";
import { TuvelozAiAssistant } from "../components/tuveloz-ai-assistant";

const englishMetadata: Metadata = {
  title: "Tuveloz Help",
  description:
    "Questions about Tuveloz? Find answers about fees, parts, and provider applications in English or Spanish, or send your question to the owner.",
  alternates: {
    canonical: "/ai",
  },
};

export async function generateMetadata(): Promise<Metadata> {
  return requestPageMetadata(englishMetadata);
}

export default function TuvelozAiPage() {
  return <TuvelozAiAssistant />;
}
