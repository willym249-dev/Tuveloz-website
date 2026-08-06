import type { Metadata } from "next";
import { PublicInfoPage } from "../components/public-info-page";

export const metadata: Metadata = {
  title: "How It Works",
  description:
    "How Tuveloz works: post what your vehicle needs once, compare real quotes from local independent providers, and choose the one that works for you.",
};

export default function HowItWorksPage() {
  return (
    <PublicInfoPage
      kicker="How it works"
      title="Post once. Compare real quotes. Choose what works."
      intro="Providers across Montgomery County are signing up now, and customer requests open at launch. Here is exactly how a job runs — start to finish, with no surprises in the middle."
      sections={[
        {
          title: "1. Tell us what your vehicle needs",
          text: "You pick a service available in your area and describe the vehicle, the timing that suits you, and how you want parts handled. A short description is plenty. This step opens to customers at launch.",
        },
        {
          title: "2. Tuveloz sends it only to the right providers",
          text: "Tuveloz intends to share a request only with providers whose service, assigned worker, evidence, agreements, work area, date, and any supervision requirements meet the applicable standards — so you hear from the right pro instead of everyone. Meeting these standards does not guarantee safety, quality, or results.",
        },
        {
          title: "3. Providers remain separate businesses",
          text: "TUVELOZ does not employ, train, sponsor, assign, or supervise providers or provider personnel. Any employee or trainee works for a separate provider business that handles hiring, payroll, training, supervision, and job assignment.",
        },
        {
          title: "4. Real quotes come back to you",
          text: "Eligible providers decide whether to respond and set their own price. You compare the available quotes and precise evidence labels side by side, before anyone touches your vehicle. This step opens to customers at launch.",
        },
        {
          title: "5. You choose — and you can choose nothing",
          text: "Accept the quote that fits and the disclosed provider and assigned worker come with it, or accept none at all. Tuveloz checks eligibility again at each later job and payment stage. This step opens to customers at launch.",
        },
      ]}
    />
  );
}
