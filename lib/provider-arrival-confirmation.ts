export const PROVIDER_ARRIVAL_CONFIRMATION_VERSION =
  "provider-arrival-safety-recheck-2026-08-01" as const;

export const PROVIDER_ARRIVAL_CONFIRMATION_MAX_SKEW_MS = 5 * 60_000;

export function providerArrivalConfirmationIsFresh(
  confirmedAtValue: unknown,
  effectiveAtValue: unknown,
  decidedAtValue: unknown,
  now = Date.now(),
) {
  if (
    typeof confirmedAtValue !== "string"
    || typeof effectiveAtValue !== "string"
    || typeof decidedAtValue !== "string"
  ) return false;

  const confirmedAt = Date.parse(confirmedAtValue);
  const effectiveAt = Date.parse(effectiveAtValue);
  const decidedAt = Date.parse(decidedAtValue);
  if (
    !Number.isFinite(confirmedAt)
    || !Number.isFinite(effectiveAt)
    || !Number.isFinite(decidedAt)
  ) return false;

  return Math.abs(effectiveAt - confirmedAt)
      <= PROVIDER_ARRIVAL_CONFIRMATION_MAX_SKEW_MS
    && decidedAt >= confirmedAt
    && decidedAt - confirmedAt <= PROVIDER_ARRIVAL_CONFIRMATION_MAX_SKEW_MS
    && confirmedAt >= now - PROVIDER_ARRIVAL_CONFIRMATION_MAX_SKEW_MS
    && confirmedAt <= now;
}
