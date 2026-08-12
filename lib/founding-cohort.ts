/**
 * Founding provider cohort.
 *
 * The first providers to be accepted took a bet on a marketplace with no
 * customers, no reviews, and no track record. Two promotional tiers reward
 * that, both derived from one number — the provider's founding rank, assigned
 * once at first verification and never recomputed.
 *
 * Rank is by ACCEPTANCE, not application: someone who applied first but
 * cleared review third is third. Rank 0 means "not in the cohort", either
 * because the provider was verified after the cohort filled or because they
 * are a test record.
 *
 * See brand/outreach/founding-provider-program.md for the program rules and
 * the perks deliberately refused (ranking preference, job routing priority,
 * territory locks) — none of which are represented here, on purpose. Nothing
 * in this module may ever influence what a customer is shown or the order
 * providers appear in. It is promotional standing only.
 */

/**
 * Providers ranked 1..20 are never charged a provider membership fee, for as
 * long as their account is in good standing. This is a permanent commitment
 * made as part of the pre-launch promotion.
 *
 * Scope is exactly the provider-side membership fee, if and when one is
 * introduced. It has nothing to do with the Customer Service Fee, which is
 * paid by customers and is unaffected by founding standing.
 */
export const FOUNDING_COHORT_SIZE = 20;

/**
 * The first 10 are additionally eligible for a spotlight post. Capped because
 * a spotlight everyone gets is a content format; a spotlight ten people get
 * is a reason to be one of the ten.
 */
export const FOUNDING_SPOTLIGHT_LIMIT = 10;

export function isFoundingMember(foundingRank: number): boolean {
  return Number.isInteger(foundingRank)
    && foundingRank >= 1
    && foundingRank <= FOUNDING_COHORT_SIZE;
}

export function isSpotlightEligible(foundingRank: number): boolean {
  return Number.isInteger(foundingRank)
    && foundingRank >= 1
    && foundingRank <= FOUNDING_SPOTLIGHT_LIMIT;
}

/**
 * Public-facing badge text. Deliberately states TENURE, never quality — a
 * customer must not be able to read this as Tuveloz vouching for the
 * provider's work. Acceptance means the application and required evidence
 * passed review; it is not an endorsement.
 */
export function foundingBadgeLabel(foundingRank: number): string {
  return isFoundingMember(foundingRank) ? "Founding provider · joined before launch" : "";
}

export function foundingBadgeLabelEs(foundingRank: number): string {
  return isFoundingMember(foundingRank) ? "Proveedor fundador · se unió antes del lanzamiento" : "";
}

/**
 * Whether a newly verified provider should be given the next rank. Called at
 * the moment of first verification only; already-ranked and test providers
 * never re-enter.
 */
export function shouldAssignFoundingRank(options: {
  currentRank: number;
  assignedCount: number;
  isTestProvider: boolean;
}): boolean {
  const { currentRank, assignedCount, isTestProvider } = options;
  if (isTestProvider) return false;
  if (currentRank > 0) return false;
  return assignedCount < FOUNDING_COHORT_SIZE;
}
