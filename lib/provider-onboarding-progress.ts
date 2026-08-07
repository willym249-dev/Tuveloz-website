/**
 * Works out the one thing a provider should do next on the onboarding page,
 * and how far along their application is.
 *
 * The page renders eight cards, and the only one the provider can act on — the
 * per-service evidence checklist — sits seventh, below a red launch notice, the
 * privacy and retention policy, and a step-by-step guide. Nothing on the page
 * answered "what do I do now?" or "how much is left?". Everything here is
 * derived from what /api/provider-onboarding already returns; no new data.
 *
 * Kept out of the page component so the ordering rules can be tested directly.
 */

export type ProgressRequirement = {
  label: string;
  status: "accepted" | "under_review" | "needs_correction" | "rejected" | "expired" | "missing";
  uploadAllowed: boolean;
};

export type ProgressService = {
  label: string;
  requirements: ProgressRequirement[];
};

export type ProgressInput = {
  services: ProgressService[];
  allAgreementsAcknowledgedForApplicationReview: boolean;
  identityVerification: { complete: boolean };
};

export type NextAction = {
  title: string;
  detail: string;
  /** Empty when there is genuinely nothing for the provider to press. */
  cta: string;
  href: string;
};

export type OnboardingProgress = {
  next: NextAction;
  documents: { accepted: number; total: number };
  checklist: Array<{ label: string; done: boolean; href: string }>;
};

/** A requirement in one of these states is waiting on the provider, not on us. */
const REQUIREMENT_NEEDS_PROVIDER: ReadonlySet<ProgressRequirement["status"]> = new Set([
  "missing",
  "needs_correction",
  "rejected",
  "expired",
]);

export const CONTACT_ABOUT_SERVICES_HREF =
  "mailto:hello@tuveloz.com?subject=Change%20the%20services%20on%20my%20provider%20application";

export function onboardingProgress(data: ProgressInput): OnboardingProgress {
  const requirements = data.services.flatMap((service) => (
    service.requirements.map((requirement) => ({ service, requirement }))
  ));
  const documents = {
    accepted: requirements.filter((item) => item.requirement.status === "accepted").length,
    total: requirements.length,
  };
  const actionable = requirements.filter((item) => (
    REQUIREMENT_NEEDS_PROVIDER.has(item.requirement.status) && item.requirement.uploadAllowed
  ));
  const underReview = requirements.filter((item) => item.requirement.status === "under_review");

  // Order matters. Agreements gate the whole review and identity gates evidence
  // review, so pointing someone at an upload while either is outstanding sends
  // them on a trip that cannot finish. Evidence is the long tail and comes last.
  const next: NextAction = data.services.length === 0
    ? {
      title: "Tell us which services to add",
      detail: "This application has no exact services on it yet, so there is nothing to verify. Email us and we'll add them.",
      cta: "Email hello@tuveloz.com",
      href: CONTACT_ABOUT_SERVICES_HREF,
    }
    : !data.allAgreementsAcknowledgedForApplicationReview
      ? {
        title: "Accept your provider agreements",
        detail: "Review can't begin until every current agreement is accepted with your signer name and title.",
        cta: "Go to policy acknowledgments",
        href: "#policy-acknowledgments",
      }
      : !data.identityVerification.complete
        ? {
          title: "Verify your identity",
          detail: "A government ID and a selfie, through Stripe. Evidence review can't finish until this is done.",
          cta: "Start identity verification",
          href: "#identity-verification",
        }
        : actionable.length > 0
          ? {
            title: `Upload ${actionable[0].requirement.label}`,
            detail: `For ${actionable[0].service.label}.${
              actionable.length > 1
                ? ` ${actionable.length - 1} other ${
                  actionable.length - 1 === 1 ? "document still needs" : "documents still need"
                } you too.`
                : ""
            }`,
            cta: "Go to my documents",
            href: "#selected-services",
          }
          : underReview.length > 0
            ? {
              // Waiting is a legitimate state, and saying so plainly stops
              // someone hunting the page for a control that is not there.
              title: "Nothing to do — we're reviewing",
              detail: `${underReview.length} item${underReview.length === 1 ? " is" : "s are"} with our team. We'll email you when there's a decision.`,
              cta: "",
              href: "",
            }
            : {
              title: "Everything we asked for is in",
              detail: "Keep your documents current — an expiry before a scheduled job blocks that job.",
              cta: "",
              href: "",
            };

  return {
    next,
    documents,
    checklist: [
      {
        label: "Provider agreements",
        done: data.allAgreementsAcknowledgedForApplicationReview,
        href: "#policy-acknowledgments",
      },
      {
        label: "Identity and adult status",
        done: data.identityVerification.complete,
        href: "#identity-verification",
      },
      {
        label: documents.total > 0
          ? `Documents accepted (${documents.accepted} of ${documents.total})`
          : "Documents",
        done: documents.total > 0 && documents.accepted === documents.total,
        href: "#selected-services",
      },
    ],
  };
}
