// Server-side query of the OCP-linked public dataset. A record match is not
// evidence of current standing, service scope, insurance, or file authenticity.
export const COUNTY_REGISTRATION_SOURCE = "https://data.montgomerycountymd.gov/Consumer-Housing/Motor-Vehicle-Repair-and-Towing/dngn-wp3e";
const API = "https://data.montgomerycountymd.gov/resource/dngn-wp3e.json";
const METADATA = "https://data.montgomerycountymd.gov/api/views/dngn-wp3e.json";
const DAY = 86_400_000;
// Operational freshness ceiling, not a county promise of update frequency.
const MAX_SOURCE_AGE = 14 * DAY;

export type CountyRegistrationResult = {
  status: "record_match" | "not_found" | "name_mismatch" | "expired" | "ambiguous" | "stale_source" | "unavailable";
  message: string;
  registrationNumber: string;
  expectedLegalName: string;
  checkedAt: string;
  sourceUpdatedAt: string;
  sourceUrl: string;
  records: Array<{
    registrationNumber: string;
    legalName: string;
    tradeName: string;
    issuedOn: string;
    expiresOn: string;
  }>;
  requiresIssuerConfirmation: true;
};

export type CountyRegistrationReceipt = CountyRegistrationResult & { receiptId: string };

export function countyRegistrationRequirement(value: string) {
  return value === "ocp_vehicle_service_registration" || value === "ocp_towing_registration";
}

export function countyRegistrationInput(number: unknown, name: unknown) {
  const registrationNumber = typeof number === "string" ? number.trim().toUpperCase() : "";
  const expectedLegalName = typeof name === "string" ? name.trim() : "";
  if (!/^[A-Z0-9][A-Z0-9-]{2,39}$/.test(registrationNumber)
    || expectedLegalName.length < 2 || expectedLegalName.length > 180
    || /[\u0000-\u001f\u007f]/.test(expectedLegalName)) return null;
  return { registrationNumber, expectedLegalName };
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}

function field(value: unknown, max = 180) {
  return typeof value === "string" && value.length <= max ? value.trim() : "";
}

function date(value: unknown) {
  const valueText = field(value, 40);
  if (!/^\d{4}-\d{2}-\d{2}(T00:00:00(?:\.000)?)?$/.test(valueText)) return "";
  const day = valueText.slice(0, 10);
  const parsed = Date.parse(`${day}T00:00:00Z`);
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === day ? day : "";
}

function normalizedName(value: string) {
  // Do not discard LLC/Inc, punctuation, words or accents: a near match needs review.
  return value.normalize("NFC").toLocaleUpperCase("en-US").replace(/\s+/g, " ").trim();
}

async function boundedJson(response: Response, limit: number) {
  if (!response.ok || !response.headers.get("content-type")?.includes("application/json") || !response.body) {
    throw new Error("Official source unavailable");
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > limit) throw new Error("Official source response too large");
      chunks.push(part.value);
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  const all = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { all.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder().decode(all)) as unknown;
}

export async function lookupCountyRegistration(
  input: { registrationNumber: string; expectedLegalName: string },
  options: { fetcher?: typeof fetch; now?: number } = {},
): Promise<CountyRegistrationResult> {
  const checked = countyRegistrationInput(input.registrationNumber, input.expectedLegalName);
  if (!checked) throw new Error("Enter the registration number and complete legal business name.");
  const now = options.now ?? Date.now();
  const result: CountyRegistrationResult = {
    ...checked,
    status: "unavailable",
    message: "The county check could not be completed. Try again or confirm directly with OCP. Keep this document pending.",
    checkedAt: new Date(now).toISOString(),
    sourceUpdatedAt: "",
    sourceUrl: COUNTY_REGISTRATION_SOURCE,
    records: [],
    requiresIssuerConfirmation: true,
  };
  const url = new URL(API);
  url.searchParams.set("$select", "registration_no,corporation_name,trade_name,issue_date,expire_date");
  // Input is an allowlisted identifier, never a user-supplied query or URL.
  url.searchParams.set("$where", `upper(registration_no)='${checked.registrationNumber}'`);
  url.searchParams.set("$limit", "3");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const fetcher = options.fetcher ?? fetch;
    const requestOptions: RequestInit = {
      headers: { accept: "application/json" }, cache: "no-store",
      redirect: "error", signal: controller.signal,
    };
    const [metadata, rows] = await Promise.all([
      fetcher(METADATA, requestOptions).then(response => boundedJson(response, 512_000)),
      fetcher(url.toString(), requestOptions).then(response => boundedJson(response, 16_000)),
    ]);
    const meta = record(metadata);
    const updated = typeof meta.rowsUpdatedAt === "number" ? meta.rowsUpdatedAt * 1000 : NaN;
    if (meta.id !== "dngn-wp3e" || !Array.isArray(rows) || rows.length > 3) return result;
    if (!Number.isFinite(updated) || updated > now || now - updated > MAX_SOURCE_AGE) {
      return { ...result, status: "stale_source", message: "The county data is older than 14 days or its update date cannot be confirmed. Ask OCP for current confirmation." };
    }
    result.sourceUpdatedAt = new Date(updated).toISOString();
    const mapped = rows.map(value => {
      const row = record(value);
      return { registrationNumber: field(row.registration_no, 40), legalName: field(row.corporation_name),
        tradeName: field(row.trade_name, 300), issuedOn: date(row.issue_date), expiresOn: date(row.expire_date) };
    });
    // Incomplete, future-issued or unexpected results must never look like a match.
    if (mapped.some(row => row.registrationNumber.toUpperCase() !== checked.registrationNumber
      || !row.legalName || !row.issuedOn || !row.expiresOn || row.issuedOn > row.expiresOn
      || Date.parse(`${row.issuedOn}T00:00:00Z`) > now)) return result;
    result.records = mapped;
    if (!mapped.length) return { ...result, status: "not_found", message: "No county record was returned for this number. Recheck the number or contact OCP; this alone does not establish fraud." };
    if (mapped.length !== 1) return { ...result, status: "ambiguous", message: "The county returned more than one record. OCP needs to confirm which record applies." };
    const row = mapped[0];
    if (normalizedName(row.legalName) !== normalizedName(checked.expectedLegalName)) {
      return { ...result, status: "name_mismatch", message: "The legal business name does not match the county record. A trade name or similar name needs separate confirmation." };
    }
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(now);
    const today = ["year", "month", "day"].map(type => parts.find(part => part.type === type)?.value).join("-");
    if (row.expiresOn < today) {
      return { ...result, status: "expired", message: "The county record shows an expiration date that has passed. Ask for current registration confirmation." };
    }
    return { ...result, status: "record_match", message: "The number and legal business name match an unexpired county record. OCP still needs to confirm current standing and the services covered before acceptance." };
  } catch {
    return result;
  } finally {
    controller.abort();
    clearTimeout(timeout);
  }
}

export function countyDatasetIsReference(source: string) {
  try { return new URL(source).hostname === "data.montgomerycountymd.gov"; }
  catch { return false; }
}
