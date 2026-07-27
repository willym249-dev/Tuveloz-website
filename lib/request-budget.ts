export const CUSTOMER_BUDGET_OPTIONS = [
  "I'm flexible",
  "Under $100",
  "$100–$249",
  "$250–$499",
  "$500–$999",
  "$1,000+",
] as const;

export type CustomerBudgetRange = (typeof CUSTOMER_BUDGET_OPTIONS)[number];

export function isCustomerBudgetRange(value: string): value is CustomerBudgetRange {
  return CUSTOMER_BUDGET_OPTIONS.includes(value as CustomerBudgetRange);
}
