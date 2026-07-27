export const QUOTE_DECLINE_REASONS = [
  { value: "price", label: "Price was too high" },
  { value: "experience", label: "I wanted more experience" },
  { value: "preferred-provider", label: "I preferred another provider" },
  { value: "timing", label: "Timing did not work" },
  { value: "other", label: "Other" },
] as const;

export const QUOTE_DECLINE_REASON_VALUES: ReadonlySet<string> = new Set(
  QUOTE_DECLINE_REASONS.map((reason) => reason.value),
);
