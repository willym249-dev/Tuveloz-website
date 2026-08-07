import type { ServiceCode } from "./provider-policy";

/**
 * Work history a provider enters and signs.
 *
 * Called "work history" throughout, never resume or CV. A resume is what a
 * person sends a prospective employer, and TUVELOZ does not employ providers —
 * a position the Terms, the Provider Agreement, and the signup form all state,
 * and that tests guard. The word is part of that position, not a style choice.
 *
 * This module is pure: parsing, category mapping, and duration maths. Storage
 * lives in db/schema.ts and the signed acceptance goes through the existing
 * agreementAcceptances table.
 */
export const WORK_HISTORY_ATTESTATION_VERSION = "work-history-2026-08-07";
export const WORK_HISTORY_AGREEMENT_KEY = "work_history_attestation";

/**
 * Plain-language attestation. It names the one consequence that lands on the
 * provider and stops there; the enforceable detail lives in the Provider
 * Agreement, which is where a term is actually binding.
 */
export const WORK_HISTORY_ATTESTATION_TEXT =
  "This is my real work history, filled in as best I remember. I understand Tuveloz may contact the people I listed, and that made-up experience means my account is closed.";

export const WORK_HISTORY_ATTESTATION_TEXT_ES =
  "Este es mi historial de trabajo real, completado lo mejor que recuerdo. Entiendo que Tuveloz puede comunicarse con las personas que anoté, y que inventar experiencia significa que se cierra mi cuenta.";

/**
 * Coarse buckets so a provider describes a job once instead of ticking eleven
 * service codes for the same shift. Competency is still scored per service —
 * these only decide which entries count toward which service.
 */
export const WORK_HISTORY_CATEGORIES = [
  {
    code: "roadside",
    label: "Roadside help",
    labelEs: "Ayuda en la carretera",
  },
  {
    code: "maintenance",
    label: "Routine maintenance and simple swaps",
    labelEs: "Mantenimiento de rutina y cambios sencillos",
  },
  {
    code: "repair",
    label: "Repair work",
    labelEs: "Trabajo de reparación",
  },
  {
    code: "diagnostics",
    label: "Diagnostics and inspection",
    labelEs: "Diagnóstico e inspección",
  },
  {
    code: "cosmetic",
    label: "Cleaning, detailing, and cosmetic work",
    labelEs: "Limpieza, detallado y trabajo cosmético",
  },
  {
    code: "specialty",
    label: "Licensed specialty work",
    labelEs: "Trabajo especializado con licencia",
  },
] as const;

export type WorkHistoryCategory = (typeof WORK_HISTORY_CATEGORIES)[number]["code"];

const CATEGORY_CODES = new Set<string>(
  WORK_HISTORY_CATEGORIES.map((category) => category.code),
);

export function isWorkHistoryCategory(value: string): value is WorkHistoryCategory {
  return CATEGORY_CODES.has(value);
}

/**
 * Which bucket each service draws its experience from. A service may draw on
 * more than one: air-conditioning service is specialty work, but general repair
 * experience is genuinely relevant to it too.
 */
export const WORK_HISTORY_SERVICE_CATEGORIES: Record<
  ServiceCode,
  readonly WorkHistoryCategory[]
> = {
  general_auto_repair: ["repair"],
  photo_documentation_only: ["diagnostics"],
  provisional_visual_observation_report: ["diagnostics"],
  provisional_obd_read_only: ["diagnostics"],
  provisional_wiper_blade_replacement: ["maintenance"],
  provisional_engine_or_cabin_air_filter: ["maintenance"],
  provisional_conventional_bulb_replacement: ["maintenance"],
  provisional_fluid_topoff_limited: ["maintenance"],
  provisional_12v_jump_start: ["roadside"],
  provisional_12v_battery_replacement: ["roadside", "maintenance"],
  provisional_temporary_spare_install: ["roadside"],
  provisional_basic_detailing: ["cosmetic"],
  sponsored_oil_filter_service: ["maintenance"],
  battery_replacement: ["maintenance", "repair"],
  tire_repair_or_installation: ["repair", "roadside"],
  basic_vehicle_diagnostics: ["diagnostics", "repair"],
  mobile_car_wash: ["cosmetic"],
  motor_vehicle_ac_service: ["specialty", "repair"],
  body_paint_refinishing: ["specialty", "cosmetic"],
  window_tint_installation: ["specialty", "cosmetic"],
  towing_or_storage: ["specialty", "roadside"],
  vehicle_lockout: ["specialty", "roadside"],
  official_vehicle_inspection: ["specialty", "diagnostics"],
  fuel_delivery: ["specialty", "roadside"],
  ev_high_voltage_service: ["specialty", "repair"],
};

// Keying on ServiceCode makes a new catalog service a compile error here, so a
// service can never ship without a category that work history could back. A
// test walks SERVICE_CODES to confirm none maps to an empty list.

export function categoriesForService(serviceCode: ServiceCode) {
  return WORK_HISTORY_SERVICE_CATEGORIES[serviceCode] ?? [];
}

export type WorkHistoryEntryInput = {
  employerName: string;
  selfEmployed: boolean;
  city: string;
  /** "YYYY-MM". */
  startMonth: string;
  /** "YYYY-MM", or empty when stillWorkingHere. */
  endMonth: string;
  stillWorkingHere: boolean;
  workPerformed: string;
  serviceCategory: string;
  referenceName: string;
  referencePhone: string;
  referenceContactConsent: boolean;
};

export class WorkHistoryValidationError extends Error {
  readonly messageEs: string;

  constructor(message: string, es = "") {
    super(message);
    this.messageEs = es;
  }
}

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

function monthIndex(month: string) {
  const [year, monthPart] = month.split("-");
  return Number(year) * 12 + Number(monthPart) - 1;
}

/**
 * Months covered by one entry, inclusive of both ends — someone who worked a
 * single month has one month of experience, not zero.
 */
export function entryMonths(
  entry: Pick<WorkHistoryEntryInput, "startMonth" | "endMonth" | "stillWorkingHere">,
  now = new Date(),
) {
  const start = monthIndex(entry.startMonth);
  const end = entry.stillWorkingHere
    ? now.getUTCFullYear() * 12 + now.getUTCMonth()
    : monthIndex(entry.endMonth);
  return Math.max(0, end - start + 1);
}

/**
 * Years of relevant experience for one service.
 *
 * Overlapping entries are merged rather than added: someone moonlighting at two
 * shops in the same year has one year of experience, not two. Months are the
 * unit throughout so a rounding choice never inflates a total.
 */
export function yearsForService(
  entries: readonly (WorkHistoryEntryInput & { serviceCategory: string })[],
  serviceCode: ServiceCode,
  now = new Date(),
) {
  const relevant = new Set<string>(categoriesForService(serviceCode));
  const spans: Array<[number, number]> = [];
  for (const entry of entries) {
    if (!relevant.has(entry.serviceCategory)) continue;
    if (!MONTH_PATTERN.test(entry.startMonth)) continue;
    const start = monthIndex(entry.startMonth);
    const end = entry.stillWorkingHere
      ? now.getUTCFullYear() * 12 + now.getUTCMonth()
      : MONTH_PATTERN.test(entry.endMonth)
        ? monthIndex(entry.endMonth)
        : start;
    if (end < start) continue;
    spans.push([start, end]);
  }
  if (!spans.length) return 0;

  spans.sort((left, right) => left[0] - right[0]);
  let months = 0;
  let [spanStart, spanEnd] = spans[0];
  for (const [start, end] of spans.slice(1)) {
    if (start <= spanEnd + 1) {
      spanEnd = Math.max(spanEnd, end);
      continue;
    }
    months += spanEnd - spanStart + 1;
    [spanStart, spanEnd] = [start, end];
  }
  months += spanEnd - spanStart + 1;
  return Math.floor(months / 12);
}

function clean(value: unknown, maximum: number) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

/**
 * Validate and normalize one submitted entry. Rejects only what makes an entry
 * unusable — a provider who cannot remember an exact month should still be able
 * to record the job.
 */
export function normalizeWorkHistoryEntry(
  body: Record<string, unknown>,
  now = new Date(),
): WorkHistoryEntryInput {
  const selfEmployed = body.selfEmployed === true;
  const stillWorkingHere = body.stillWorkingHere === true;
  const employerName = clean(body.employerName, 160);
  const startMonth = clean(body.startMonth, 7);
  const endMonth = stillWorkingHere ? "" : clean(body.endMonth, 7);
  const serviceCategory = clean(body.serviceCategory, 40);

  if (!employerName && !selfEmployed) {
    throw new WorkHistoryValidationError(
      "Enter where you worked, or mark it as your own business.",
      "Escriba dónde trabajó, o marque que fue su propio negocio.",
    );
  }
  if (!MONTH_PATTERN.test(startMonth)) {
    throw new WorkHistoryValidationError(
      "Enter the month and year you started.",
      "Escriba el mes y el año en que empezó.",
    );
  }
  if (!stillWorkingHere && !MONTH_PATTERN.test(endMonth)) {
    throw new WorkHistoryValidationError(
      "Enter the month and year you finished, or mark that you still work there.",
      "Escriba el mes y el año en que terminó, o marque que todavía trabaja ahí.",
    );
  }
  if (!stillWorkingHere && monthIndex(endMonth) < monthIndex(startMonth)) {
    throw new WorkHistoryValidationError(
      "The end month comes before the start month.",
      "El mes final es anterior al mes inicial.",
    );
  }
  const currentMonth = now.getUTCFullYear() * 12 + now.getUTCMonth();
  if (monthIndex(startMonth) > currentMonth) {
    throw new WorkHistoryValidationError(
      "The start month is in the future.",
      "El mes inicial está en el futuro.",
    );
  }
  if (!isWorkHistoryCategory(serviceCategory)) {
    throw new WorkHistoryValidationError(
      "Choose which kind of work this was.",
      "Elija qué tipo de trabajo fue.",
    );
  }

  const referencePhone = clean(body.referencePhone, 40);
  if (referencePhone && !/^\+?[\d\s().-]{7,}$/.test(referencePhone)) {
    throw new WorkHistoryValidationError(
      "Enter a valid reference phone number, or leave it blank.",
      "Escriba un teléfono de referencia válido, o déjelo en blanco.",
    );
  }

  return {
    employerName: selfEmployed && !employerName ? "Self-employed" : employerName,
    selfEmployed,
    city: clean(body.city, 100),
    startMonth,
    endMonth,
    stillWorkingHere,
    workPerformed: clean(body.workPerformed, 600),
    serviceCategory,
    referenceName: clean(body.referenceName, 120),
    referencePhone,
    // Consent to be contacted is only meaningful with someone to contact.
    referenceContactConsent: body.referenceContactConsent === true
      && Boolean(clean(body.referenceName, 120) || referencePhone),
  };
}
