export const MARYLAND_REPAIR_RECORDS_VERSION = "maryland-repair-records-2026-08-01-v2";

export const MARYLAND_CUSTOMER_RIGHTS_HEADING = "Customer's Rights";

export const MARYLAND_CUSTOMER_RIGHTS_TEXT = [
  "You may request a written estimate for repairs which cost in excess of $50.",
  "You may not be charged any amount ten percent in excess of the written estimate without your consent.",
  "You are entitled to the return of any replaced parts except when parts are required to be returned to the manufacturer under a warranty agreement.",
  "Repairs not originally authorized by you may not be charged to you without your consent.",
].join(" ");

export const MONTGOMERY_COUNTY_WRITTEN_ESTIMATE_STANDARD =
  "Tuveloz requires a written estimate for every Montgomery County repair or maintenance job before work begins. This marketplace standard is stricter than relying only on a dollar threshold.";

export const MANUFACTURER_SPECIAL_POLICY_NOTICE = [
  "Manufacturer Special Policy Adjustment Programs",
  "Federal law requires manufacturers to furnish the National Highway Traffic Safety Administration (N.H.T.S.A.) with bulletins describing any defects in their vehicles. You may obtain copies of these bulletins from either the manufacturer or N.H.T.S.A. In addition, certain consumer publications or organizations publish this information, which may be available for a fee or for free.",
].join("\n");

export const REPAIR_FACILITY_RESPONSIBILITY_NOTICE =
  "Under certain circumstances, the repair facility may not be responsible for damage to the customer's vehicle while it is on the facility's premises. The customer should ask the repair facility about the extent of its responsibility and insurance coverage.";

export const ELECTRONIC_SIGNATURE_NOTICE = [
  "Electronic transaction consent: By typing your name and selecting the separate signature checkbox, you agree to conduct this specific repair authorization or invoice transaction electronically and to receive, access, download, and retain the exact electronic record through your secure Tuveloz account.",
  "You may refuse to conduct this or a future transaction electronically. If you do not agree, do not sign electronically and contact the provider to arrange a non-electronic record.",
  "Your typed name and affirmative checkbox are intended as your electronic signature on this exact stored record. This does not waive any non-waivable right or accept work outside the written record.",
].join(" ");

export const REPAIRS_NEEDED_AND_PERFORMED_STATEMENT =
  "All labor performed and parts replaced were necessary to perform the repairs described on this invoice.";

export const PROVIDER_TEST_DRIVE_CERTIFICATION =
  "I certify that this vehicle has been tested or test driven when needed and that the mechanic's work was performed satisfactorily.";

export type RepairLineType = "labor" | "part" | "sublet" | "other" | "tax";
export type RepairPartCondition =
  | "new"
  | "used"
  | "rebuilt"
  | "reconditioned"
  | "not_applicable";

export type RepairLineItem = {
  lineType: RepairLineType;
  description: string;
  partNumber: string;
  partCondition: RepairPartCondition;
  quantity: number;
  unitAmountCents: number;
  lineAmountCents: number;
  laborMinutes: number;
  mechanicIdentifier: string;
};

const LINE_TYPES = new Set<RepairLineType>([
  "labor",
  "part",
  "sublet",
  "other",
  "tax",
]);
const PART_CONDITIONS = new Set<RepairPartCondition>([
  "new",
  "used",
  "rebuilt",
  "reconditioned",
  "not_applicable",
]);

function clean(value: unknown, maximum: number) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function wholeNumber(value: unknown, minimum: number, maximum: number) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < minimum || number > maximum) {
    return null;
  }
  return number;
}

export function parseRepairLineItems(value: unknown): RepairLineItem[] | null {
  let candidate = value;
  if (typeof value === "string") {
    try {
      candidate = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(candidate) || candidate.length === 0 || candidate.length > 100) {
    return null;
  }

  const items: RepairLineItem[] = [];
  for (const entry of candidate) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
    const record = entry as Record<string, unknown>;
    const lineType = clean(record.lineType, 20) as RepairLineType;
    const description = clean(record.description, 500);
    const partNumber = clean(record.partNumber, 120);
    const partCondition = clean(record.partCondition, 30) as RepairPartCondition;
    const quantity = wholeNumber(record.quantity, 1, 10_000);
    const unitAmountCents = wholeNumber(record.unitAmountCents, 0, 10_000_000);
    const lineAmountCents = wholeNumber(record.lineAmountCents, 0, 10_000_000);
    const laborMinutes = wholeNumber(record.laborMinutes ?? 0, 0, 100_000);
    const mechanicIdentifier = clean(record.mechanicIdentifier, 120);

    if (
      !LINE_TYPES.has(lineType)
      || !description
      || !PART_CONDITIONS.has(partCondition)
      || quantity === null
      || unitAmountCents === null
      || lineAmountCents === null
      || laborMinutes === null
      || lineAmountCents !== quantity * unitAmountCents
      || (lineType === "part" && (!partNumber || partCondition === "not_applicable"))
      || (lineType !== "part" && (partNumber || partCondition !== "not_applicable"))
    ) {
      return null;
    }

    items.push({
      lineType,
      description,
      partNumber,
      partCondition,
      quantity,
      unitAmountCents,
      lineAmountCents,
      laborMinutes,
      mechanicIdentifier,
    });
  }
  return items;
}

export function repairLineItemTotals(items: readonly RepairLineItem[]) {
  const totals = {
    laborAmountCents: 0,
    partsAmountCents: 0,
    taxAmountCents: 0,
    otherAmountCents: 0,
    totalAmountCents: 0,
  };
  for (const item of items) {
    if (item.lineType === "labor") totals.laborAmountCents += item.lineAmountCents;
    else if (item.lineType === "part") totals.partsAmountCents += item.lineAmountCents;
    else if (item.lineType === "tax") totals.taxAmountCents += item.lineAmountCents;
    else totals.otherAmountCents += item.lineAmountCents;
    totals.totalAmountCents += item.lineAmountCents;
  }
  return totals;
}

export function stableRepairRecordJson(value: unknown) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableRepairRecordJson(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([first], [second]) => first.localeCompare(second))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableRepairRecordJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export async function sha256RepairRecord(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
