/**
 * Maintenance-reminder validation.
 *
 * A reminder is customer-entered convenience data: the customer chooses the
 * due date, the mileage, or both. Tuveloz never invents a manufacturer
 * interval, and a reminder never requests service, sets a price, contacts a
 * provider, or affects eligibility — the job's own scope facts still decide
 * all of that if the customer later posts a request.
 */

export const MAX_SERVICE_REMINDERS = 100;

export const REMINDER_FIELD_LIMITS = {
  vehicle: 140,
  service: 160,
  note: 500,
  sourceRequestId: 80,
} as const;

export const REMINDER_STATUSES = ["active", "completed", "dismissed"] as const;

export type ReminderStatus = (typeof REMINDER_STATUSES)[number];

export function isReminderStatus(value: unknown): value is ReminderStatus {
  return typeof value === "string"
    && (REMINDER_STATUSES as readonly string[]).includes(value);
}

/** High enough for any odometer that will ever visit; low enough to catch typos. */
const MAX_MILEAGE = 2_000_000;

export type ServiceReminderInput = {
  vehicle: string;
  service: string;
  dueDate: string;
  dueMileage: number;
  currentMileage: number;
  note: string;
  sourceRequestId: string;
};

export type ServiceReminderValidation =
  | { ok: true; reminder: ServiceReminderInput }
  | { ok: false; error: string };

function clean(value: unknown, max: number) {
  return typeof value === "string"
    ? value.trim().replace(/\s+/g, " ").slice(0, max)
    : "";
}

function parseMileage(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return 0;
  const parsed = Math.round(Number(String(value).trim()));
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > MAX_MILEAGE) return null;
  return parsed;
}

function isRealCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime())
    && parsed.toISOString().slice(0, 10) === value;
}

export function validateServiceReminder(body: unknown): ServiceReminderValidation {
  const input = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;

  const vehicle = clean(input.vehicle, REMINDER_FIELD_LIMITS.vehicle);
  const service = clean(input.service, REMINDER_FIELD_LIMITS.service);
  if (!vehicle || !service) {
    return { ok: false, error: "Enter the vehicle and the service to be reminded about." };
  }

  const dueDate = clean(input.dueDate, 10);
  if (dueDate && !isRealCalendarDate(dueDate)) {
    return { ok: false, error: "Choose a valid due date, or leave it blank." };
  }

  const dueMileage = parseMileage(input.dueMileage);
  const currentMileage = parseMileage(input.currentMileage);
  if (dueMileage === null || currentMileage === null) {
    return { ok: false, error: "Enter mileage as a plain non-negative number." };
  }

  // The customer supplies the schedule. Tuveloz never fills one in.
  if (!dueDate && dueMileage === 0) {
    return { ok: false, error: "Enter a due date, a due mileage, or both." };
  }
  if (dueMileage > 0 && currentMileage > dueMileage) {
    return { ok: false, error: "Due mileage should not be below the current mileage." };
  }

  return {
    ok: true,
    reminder: {
      vehicle,
      service,
      dueDate,
      dueMileage,
      currentMileage,
      note: clean(input.note, REMINDER_FIELD_LIMITS.note),
      sourceRequestId: clean(input.sourceRequestId, REMINDER_FIELD_LIMITS.sourceRequestId),
    },
  };
}
