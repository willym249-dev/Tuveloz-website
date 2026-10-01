import { checkoutModule } from "./checkout-evidence.mjs";

export const consentApi = checkoutModule("./lib/customer-job-consent");
export const scopeApi = checkoutModule("./lib/customer-job-scope");
export const policyApi = checkoutModule("./lib/customer-policy-acceptance");
export const factsApi = checkoutModule("./lib/job-scope-facts");
export const matchingApi = checkoutModule("./lib/service-matching");
export const providerApi = checkoutModule("./lib/provider-policy");
const requirements = factsApi.jobScopeRequirementsForService("battery_replacement");
export const syntheticRequestScope = {
  requestId: "synthetic-request", scopeVersion: 1, serviceCodes: ["battery_replacement"],
  jurisdiction: "US-MD-MontgomeryCounty", municipality: "Rockville",
  scheduledFor: "2030-10-01T16:00:00.000Z", vehicle: "SYNTHETIC vehicle", zip: "20850",
  launchArea: "Montgomery County", serviceLocations: matchingApi.CUSTOMER_SERVICE_LOCATION_OPTIONS[0],
  serviceAddress: "123 Synthetic Test Lane, Rockville, MD 20850",
  partsSource: matchingApi.PARTS_SOURCE_OPTIONS[0], partsPreference: "No preference",
  details: "SYNTHETIC local test only", hasIssueImage: false,
  jobFacts: factsApi.jobScopeFactsFromInput({ serviceCode: "battery_replacement", operationCode: requirements.allowedOperations[0],
    prohibitedOperationsAttestedAbsent: requirements.prohibitedOperations, locationType: "customer_private_property",
    address: "123 Synthetic Test Lane, Rockville, MD 20850", municipality: "Rockville", county: "Montgomery County", state: "Maryland",
    postalCode: "20850", jurisdiction: "US-MD-MontgomeryCounty", propertyPermission: "customer_confirmed_authority",
    vehicleDriveability: "driveable", vehicleState: "normal_stationary", highVoltageStatus: "not_applicable_or_not_involved",
    safetyAttestations: factsApi.JOB_SAFETY_ATTESTATION_CODES }),
};
export const syntheticSelectionScope = { request: syntheticRequestScope, quote: {
  quoteId: "synthetic-quote", providerId: "synthetic-provider", providerName: "SYNTHETIC Álvarez & Sons <Test>",
  performingPersonId: "synthetic-person", performingPersonDisplay: "SYNTHETIC Álvarez — owner-operator",
  supervisorPersonId: "", serviceCodes: ["battery_replacement"], scheduledFor: syntheticRequestScope.scheduledFor,
  scopeVersion: 1, laborPriceCents: "10000", partsPriceCents: "0", providerSubtotalCents: "10000",
  customerFeeRateBps: 500, customerFeeCents: "500", customerTotalCents: "10500", partType: "Customer supplied",
  availability: "SYNTHETIC availability", message: "SYNTHETIC provider message", workmanshipWarranty: "",
  confirmedCredentialLabels: [], yearsExperience: "",
} };
export const syntheticSelectionConsent = async (language, overrides = {}) => ({
  ...await consentApi.customerConsentPresentation(consentApi.customerSelectionConsentEvidence(
    { ...syntheticSelectionScope, quote: { ...syntheticSelectionScope.quote, ...overrides } }, language)),
  scopeVersion: 1, performingPersonDisplay: syntheticSelectionScope.quote.performingPersonDisplay,
  scheduledFor: syntheticRequestScope.scheduledFor, serviceCodes: ["battery_replacement"],
});
