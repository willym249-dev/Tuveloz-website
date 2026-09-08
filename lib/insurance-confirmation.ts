export const INSURANCE_REQUIREMENTS = [
  "general_liability_coi", "business_auto_coverage", "broker_coverage_determination",
  "workers_comp_coverage", "towing_custody_coverage",
] as const;

export function insuranceRequirement(key: string) {
  return (INSURANCE_REQUIREMENTS as readonly string[]).includes(key);
}

export type InsuranceConfirmation = {
  organization: string;
  contact: string;
  independentlySourced: boolean;
  insuredAndPolicyConfirmed: boolean;
  datesAndLimitsConfirmed: boolean;
  serviceAndLocationConfirmed: boolean;
};

// This captures the reviewer's actual external confirmation; it is not an
// insurer integration and cannot establish truth from an uploaded certificate.
export function parseInsuranceConfirmation(value: unknown): InsuranceConfirmation {
  const fields = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const text = (key: string) => typeof fields[key] === "string" ? (fields[key] as string).trim().slice(0, 180) : "";
  return {
    organization: text("organization"), contact: text("contact"),
    independentlySourced: fields.independentlySourced === true,
    insuredAndPolicyConfirmed: fields.insuredAndPolicyConfirmed === true,
    datesAndLimitsConfirmed: fields.datesAndLimitsConfirmed === true,
    serviceAndLocationConfirmed: fields.serviceAndLocationConfirmed === true,
  };
}

export function insuranceConfirmationError(method: string, confirmation: InsuranceConfirmation) {
  if (method !== "insurer_or_broker_confirmation") {
    return "Insurance requires confirmation from the insurer or licensed broker. A business registry or document scan does not confirm coverage.";
  }
  if (confirmation.organization.length < 2 || confirmation.contact.length < 5
    || !confirmation.independentlySourced || !confirmation.insuredAndPolicyConfirmed
    || !confirmation.datesAndLimitsConfirmed || !confirmation.serviceAndLocationConfirmed) {
    return "Record the insurer or broker, an independently sourced contact, and their confirmation of the named insured, policy, dates, limits, services, locations and relevant exclusions before accepting coverage.";
  }
  return "";
}
