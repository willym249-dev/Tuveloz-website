import type { Metadata } from "next";
import { PublicInfoPage } from "../components/public-info-page";

export const metadata: Metadata = {
  title: "How It Works",
  description:
    "How Tuveloz works: tell us what your car needs once, compare real prices from local pros, and pick the one you like.",
};

export default function HowItWorksPage() {
  return (
    <PublicInfoPage
      kicker="How it works"
      title="Ask once. Compare real prices. Pick who you like."
      intro="Local pros across Montgomery County are signing up now, and you'll be able to post a job the day we open. Here's how the whole thing goes, from your first message to the last."
      sections={[
        {
          title: "1. Tell us what your car needs",
          text: "Pick the job, tell us about your car, when you'd like it done, and how you want to handle the part. A sentence or two is plenty — you don't need to know what's wrong. This step opens to customers at launch.",
        },
        {
          title: "2. We only show it to the right pros",
          text: "Not everyone sees your job. We pass it only to pros who work in your area, are cleared for that exact work, and have already handed us whatever the law asks for. That means fewer, better replies instead of a pile of phone calls. It does not mean we can promise safety, quality, or results — nobody honestly can.",
        },
        {
          title: "3. Everyone here works for themselves, not for us",
          text: "Everyone on Tuveloz runs their own business. TUVELOZ does not employ, train, sponsor, assign, or supervise providers or provider personnel. If a pro brings a helper, that person works for the pro's business, which handles their hiring, payroll, training, and supervision.",
        },
        {
          title: "4. Their prices come back to you",
          text: "Each pro decides whether to answer and sets their own price — we never set it for them. You read the prices next to each other, and see who's behind each one, before anybody touches your car. This step opens to customers at launch.",
        },
        {
          title: "5. You pick — and picking nobody is fine",
          text: "Say yes to the one you like and you'll see exactly which business and which person is coming. Or say no to all of them; that costs you nothing. We re-check that a pro is still cleared at every step after that, right through payment. This step opens to customers at launch.",
        },
      ]}
    />
  );
}
