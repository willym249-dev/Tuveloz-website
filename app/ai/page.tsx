import type { Metadata } from "next";
import { TuvelozAiAssistant } from "../components/tuveloz-ai-assistant";

export const metadata: Metadata = {
  title: "Tuveloz AI",
  description:
    "Bilingual, safety-first guidance that helps you describe what your vehicle needs and prepare a future service request. Tuveloz AI does not diagnose, dispatch help, guarantee pricing, or choose a provider.",
  alternates: {
    canonical: "/ai",
  },
};

export default function TuvelozAiPage() {
  return <TuvelozAiAssistant />;
}
