import type { Metadata } from "next";
import { PublicInfoPage } from "../components/public-info-page";
import { FOUNDING_COHORT_SIZE, FOUNDING_SPOTLIGHT_LIMIT } from "../../lib/founding-cohort";

export const metadata: Metadata = {
  title: "Founding Providers",
  description:
    `The first ${FOUNDING_COHORT_SIZE} providers accepted to Tuveloz in Montgomery County, MD are never charged a provider membership fee. What the founding cohort is, who counts, and what it does not mean.`,
  alternates: {
    canonical: "/founding-providers",
  },
};

/**
 * Public statement of the founding provider program.
 *
 * This page exists so the perks can be promised in outreach at all: the
 * provider outreach kit forbids promising founding-provider perks that are not
 * published on the site. Publish first, promise second — see
 * brand/outreach/founding-provider-program.md.
 */
export default function FoundingProvidersPage() {
  return (
    <PublicInfoPage
      kicker="Founding providers"
      title={`The first ${FOUNDING_COHORT_SIZE} are never charged a membership fee.`}
      intro={`The first ${FOUNDING_COHORT_SIZE} providers accepted to Tuveloz signed up for a marketplace with no customers, no reviews, and no track record. This page states exactly what they get for that, and exactly what it does not mean. It is published so it can be held to.`}
      sections={[
        {
          title: "Who counts",
          text: `The founding cohort is the first ${FOUNDING_COHORT_SIZE} provider applications accepted after review. Position is recorded automatically at the moment an application is accepted and never recalculated afterward.`,
          points: [
            "Ordered by acceptance, not by application date — an application submitted first but cleared third is third.",
            "Test accounts are never given a founding position.",
            `The cohort is a fixed group of ${FOUNDING_COHORT_SIZE}, not a rolling queue. A founding provider whose account later closes does not free a position for someone else.`,
          ],
        },
        {
          title: `No provider membership fee, permanently — first ${FOUNDING_COHORT_SIZE}`,
          text: "Tuveloz charges providers nothing today. If a provider membership fee is introduced in the future, founding providers are never charged it, for as long as their account remains in good standing. This is a permanent commitment, not an introductory rate or a trial period.",
          points: [
            "This covers the provider membership fee only. It does not change the service fee that customers pay, which is charged to the customer and is unaffected by founding status.",
            "It does not cover payment processing costs, which are set by the payment processor rather than by Tuveloz.",
            "Founding providers set their own prices and keep 100% of what they quote — the same as every other provider.",
          ],
        },
        {
          title: `A spotlight post — first ${FOUNDING_SPOTLIGHT_LIMIT}`,
          text: `The first ${FOUNDING_SPOTLIGHT_LIMIT} accepted providers are invited to be featured on Tuveloz's social accounts: their business name, their town, the work they do, and a photo they choose.`,
          points: [
            "Participation is entirely optional and is never a condition of anything else in this program.",
            "Nothing is published without written permission, and anything published is removed the same day on request, without explanation.",
            "Declining changes nothing about the account or the rest of the founding benefits.",
          ],
        },
        {
          title: "First access, and a real say",
          text: "As Tuveloz opens additional service categories beyond the launch services, founding providers are offered access first. They are also asked directly before pricing or policy changes take effect.",
        },
        {
          title: "What founding status does not mean",
          text: "Founding status describes when a provider joined. It says nothing about the quality of their work, and Tuveloz does not present it as though it does.",
          points: [
            "It is not an endorsement, recommendation, or guarantee. Acceptance means an application and the required evidence passed review — nothing more, for founding providers and everyone else alike.",
            "It does not affect where a provider appears to customers. Founding providers receive no ranking preference, no placement advantage, and no priority access to customer requests. Customers choose from every eligible provider on the same footing.",
            "It does not promise any amount of work, any income, or any number of customer requests.",
            "It does not exempt a provider from any requirement, standard, agreement, or review that applies to every other provider.",
          ],
        },
        {
          title: "Current status",
          text: "Customer requests are not open yet. Provider applications are being accepted and reviewed now, and founding positions are assigned as applications are accepted. Applying is free at tuveloz.com/join.",
        },
      ]}
    />
  );
}
