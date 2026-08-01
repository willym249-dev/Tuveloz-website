export const PARTS_BILLING_TERMS_VERSION = "2026-08-01";

export const PARTS_BILLING_MODELS = [
  "customer_supplied",
  "provider_all_inclusive",
  "no_parts_needed",
] as const;

export type PartsBillingModel = (typeof PARTS_BILLING_MODELS)[number];

export const ALL_INCLUSIVE_PART_QUALITY_OPTIONS = [
  "OEM",
  "Aftermarket",
] as const;

export type AllInclusivePartQuality =
  (typeof ALL_INCLUSIVE_PART_QUALITY_OPTIONS)[number];

export const PROVIDER_ALL_INCLUSIVE_NO_SEPARATE_CHARGE_TEXT =
  "I confirm that this quote is one all-inclusive repair-service price. I am not separately charging the customer through Tuveloz for parts, materials, reimbursements, parts markups, core charges, tire fees, or other goods.";

export const PROVIDER_ALL_INCLUSIVE_TAX_CERTIFICATION_TEXT =
  "I confirm that I paid, or will pay, all applicable sales or use tax on the parts and supplies used in this lump-sum repair and will not claim a resale exemption for those items under this billing method.";

export const PROVIDER_CUSTOMER_SUPPLIED_PARTS_TEXT =
  "I confirm that the customer supplies all required parts and that no provider-supplied part, fluid, material, reimbursement, or other good is included in this Tuveloz service price.";

export const PROVIDER_NO_PARTS_NEEDED_TEXT =
  "I confirm that this service does not require or include a new part, fluid, material, reimbursement, or other good.";

const STORED_CUSTOMER_SUPPLIED = "Customer supplied";
const STORED_NO_PARTS_NEEDED = "No parts needed";
const STORED_ALL_INCLUSIVE_PREFIX = "All-inclusive provider parts: ";

const ALL_INCLUSIVE_BLOCKED_SERVICE_CODES = new Set([
  "fuel_delivery",
  "official_vehicle_inspection",
  "provisional_temporary_spare_install",
  "tire_repair_or_installation",
  "towing_or_storage",
  "vehicle_lockout",
]);

export type StoredPartsBillingClassification =
  | PartsBillingModel
  | "legacy_itemized"
  | "legacy_unclassified";

export function isPartsBillingModel(value: unknown): value is PartsBillingModel {
  return typeof value === "string"
    && PARTS_BILLING_MODELS.some((model) => model === value);
}

export function isAllInclusivePartQuality(
  value: unknown,
): value is AllInclusivePartQuality {
  return typeof value === "string"
    && ALL_INCLUSIVE_PART_QUALITY_OPTIONS.some((quality) => quality === value);
}

export function storedPartTypeFor(
  model: PartsBillingModel,
  quality: AllInclusivePartQuality | "" = "",
) {
  if (model === "customer_supplied") return STORED_CUSTOMER_SUPPLIED;
  if (model === "no_parts_needed") return STORED_NO_PARTS_NEEDED;
  if (!isAllInclusivePartQuality(quality)) {
    throw new Error("An OEM or aftermarket quality selection is required.");
  }
  return `${STORED_ALL_INCLUSIVE_PREFIX}${quality}`;
}

export function partQualityFromStoredPartType(
  partType: string,
): AllInclusivePartQuality | "" {
  if (!partType.startsWith(STORED_ALL_INCLUSIVE_PREFIX)) return "";
  const quality = partType.slice(STORED_ALL_INCLUSIVE_PREFIX.length).trim();
  return isAllInclusivePartQuality(quality) ? quality : "";
}

export function partsBillingModelFromStoredPartType(
  partType: string,
  partsPriceCents: string | number,
): StoredPartsBillingClassification {
  const partsAmount = Number(partsPriceCents);
  if (!Number.isSafeInteger(partsAmount) || partsAmount < 0) {
    return "legacy_unclassified";
  }
  if (partsAmount > 0) return "legacy_itemized";
  if (partType === STORED_CUSTOMER_SUPPLIED) return "customer_supplied";
  if (partType === STORED_NO_PARTS_NEEDED) return "no_parts_needed";
  return partQualityFromStoredPartType(partType)
    ? "provider_all_inclusive"
    : "legacy_unclassified";
}

export function partsBillingLabel(
  model: StoredPartsBillingClassification,
  quality: AllInclusivePartQuality | "" = "",
) {
  if (model === "customer_supplied") return "Customer-supplied parts";
  if (model === "no_parts_needed") return "No new parts needed";
  if (model === "provider_all_inclusive") {
    return quality
      ? `Provider-supplied ${quality} parts included in one service price`
      : "Provider-supplied parts included in one service price";
  }
  if (model === "legacy_itemized") return "Legacy separately itemized parts quote";
  return "Legacy parts arrangement requires review";
}

export function customerPartsDisclosure(
  model: PartsBillingModel,
  quality: AllInclusivePartQuality | "" = "",
) {
  if (model === "customer_supplied") {
    return "The customer supplies all required parts. No provider-supplied parts or materials are included in the Tuveloz service price.";
  }
  if (model === "no_parts_needed") {
    return "No new part, fluid, material, reimbursement, or other good is included in this Tuveloz service price.";
  }
  const qualityLabel = quality ? `${quality} ` : "";
  return `Provider-supplied ${qualityLabel}parts and materials described in the quote are included in one all-inclusive repair-service price. No separate parts, materials, reimbursement, parts-markup, core-charge, tire-fee, or other goods amount is charged through Tuveloz.`;
}

export function composeQuoteMessage(input: {
  model: PartsBillingModel;
  quality?: AllInclusivePartQuality | "";
  partsDescription?: string;
  providerMessage: string;
}) {
  const quality = input.quality ?? "";
  const providerMessage = input.providerMessage.trim();
  const partsDescription = input.partsDescription?.trim() ?? "";
  const sections = [customerPartsDisclosure(input.model, quality)];

  if (input.model === "provider_all_inclusive") {
    sections.push(`Included parts/materials: ${partsDescription}.`);
    sections.push(
      "Provider certification recorded: the provider is responsible for applicable sales or use tax on the parts and supplies used in this lump-sum repair and will not use a resale exemption for those items under this billing method.",
    );
  }
  if (providerMessage) sections.push(`Provider note: ${providerMessage}`);
  return sections.join(" ");
}

export function allInclusivePartsAllowedForServiceCodes(
  serviceCodes: readonly string[],
) {
  return serviceCodes.length > 0
    && serviceCodes.every((serviceCode) => (
      !ALL_INCLUSIVE_BLOCKED_SERVICE_CODES.has(serviceCode)
    ));
}
