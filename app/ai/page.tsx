import type { Metadata } from "next";
import { TuvelozAiAssistant } from "../components/tuveloz-ai-assistant";

export const metadata: Metadata = {
  title: "Tuveloz AI",
  description:
    "Questions about Tuveloz? Find answers about fees, parts, and provider applications in English or Spanish, or send your question to the owner.",
  alternates: {
    canonical: "/ai",
  },
};

export default function TuvelozAiPage() {
  return <TuvelozAiAssistant />;
}
