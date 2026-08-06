/**
 * Provider warranty helper logic.
 *
 * The Provider Agreement makes every warranty the provider business's own
 * choice: the Tuveloz standard labor warranty for the type of work, the
 * business's own written warranty, or no written warranty at all. This module
 * only turns that choice into clear disclosure wording for the quote and the
 * final invoice — it never sets, records, or enforces a warranty for a
 * provider, and it creates no Tuveloz-backed warranty of any kind.
 */

export type WarrantyWorkType = "repair" | "maintenance" | "cosmetic" | "inspection";
export type WarrantyChoice = "standard" | "custom" | "none";

export type StandardWarrantyTier = {
  workType: WarrantyWorkType;
  label: string;
  examples: string;
  periodStatement: string | null;
};

export const STANDARD_WARRANTY_TIERS: readonly StandardWarrantyTier[] = Object.freeze([
  Object.freeze({
    workType: "repair" as const,
    label: "Repair or replacement work",
    examples: "Battery replacement and other repair or replacement labor",
    periodStatement: "12 months or 12,000 miles, whichever comes first",
  }),
  Object.freeze({
    workType: "maintenance" as const,
    label: "Maintenance or consumable service",
    examples: "Oil changes, filters, wiper blades, bulbs, fluid top-offs",
    periodStatement: "90 days or 3,000 miles, whichever comes first",
  }),
  Object.freeze({
    workType: "cosmetic" as const,
    label: "Cosmetic work",
    examples: "Detailing and other appearance-only services",
    periodStatement: "7 days after completion",
  }),
  Object.freeze({
    workType: "inspection" as const,
    label: "Inspection, diagnostic, or photo report",
    examples: "OBD-II code capture, photo or visual condition reports",
    periodStatement: null,
  }),
]);

export function standardWarrantyTier(workType: WarrantyWorkType): StandardWarrantyTier {
  const tier = STANDARD_WARRANTY_TIERS.find((entry) => entry.workType === workType);
  if (!tier) throw new Error("Unknown warranty work type.");
  return tier;
}

const WORKMANSHIP_COVERAGE =
  "It covers defects in our workmanship on the labor performed. It does not "
  + "cover failure of a customer-supplied part itself, normal wear, a "
  + "pre-existing condition documented before or during the job, damage from "
  + "a later accident, misuse, or neglect, or work altered by someone else "
  + "after completion.";

const PROVIDER_NOT_TUVELOZ =
  "This warranty is provided and honored by our business, not by Tuveloz.";

const RIGHTS_PRESERVED =
  "Implied or statutory warranty rights under applicable law are not affected.";

export const NO_WARRANTY_DISCLOSURE =
  "No written warranty is offered on this job. "
  + RIGHTS_PRESERVED;

export const INSPECTION_DISCLOSURE =
  "No workmanship warranty applies to an inspection, diagnostic, or photo "
  + "condition report — there is no labor to re-perform. Accuracy and care "
  + "duties still apply under the Marketplace Conduct Policy. "
  + RIGHTS_PRESERVED;

export const MAX_CUSTOM_WARRANTY_LENGTH = 900;

export type WarrantyDisclosureInput = {
  workType: WarrantyWorkType;
  choice: WarrantyChoice;
  customTerms?: string;
};

export type WarrantyDisclosureResult =
  | { ok: true; disclosure: string }
  | { ok: false; error: string };

export function warrantyDisclosure(input: WarrantyDisclosureInput): WarrantyDisclosureResult {
  const tier = standardWarrantyTier(input.workType);

  if (input.choice === "none") {
    return { ok: true, disclosure: NO_WARRANTY_DISCLOSURE };
  }

  if (input.choice === "custom") {
    const terms = (input.customTerms ?? "").trim();
    if (!terms) {
      return {
        ok: false,
        error: "Write out your own warranty terms, including what is covered, what is excluded, and for how long.",
      };
    }
    if (terms.length > MAX_CUSTOM_WARRANTY_LENGTH) {
      return {
        ok: false,
        error: `Keep custom warranty terms under ${MAX_CUSTOM_WARRANTY_LENGTH} characters.`,
      };
    }
    return {
      ok: true,
      disclosure:
        `Our business offers its own written warranty on this job: ${terms} `
        + `${PROVIDER_NOT_TUVELOZ} ${RIGHTS_PRESERVED}`,
    };
  }

  if (tier.periodStatement === null) {
    return { ok: true, disclosure: INSPECTION_DISCLOSURE };
  }

  return {
    ok: true,
    disclosure:
      "Our business offers the Tuveloz standard labor warranty on this job: "
      + `our written warranty on our workmanship for ${tier.periodStatement}, `
      + "honored by re-performing the covered labor at no additional labor charge. "
      + `${WORKMANSHIP_COVERAGE} ${PROVIDER_NOT_TUVELOZ} ${RIGHTS_PRESERVED}`,
  };
}
