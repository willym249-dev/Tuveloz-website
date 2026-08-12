/**
 * Saved-vehicle validation.
 *
 * A saved vehicle is customer-entered convenience data. It never authorizes a
 * service, sets a price, or affects provider eligibility — the job's own scope
 * facts still decide that at every stage.
 */

export const MAX_SAVED_VEHICLES = 50;

export const VEHICLE_FIELD_LIMITS = {
  label: 60,
  year: 4,
  make: 40,
  model: 60,
  trim: 40,
  color: 30,
  plate: 12,
  vin: 17,
  notes: 500,
} as const;

export type SavedVehicleInput = {
  label: string;
  year: string;
  make: string;
  model: string;
  trim: string;
  color: string;
  plate: string;
  vin: string;
  notes: string;
};

export type SavedVehicleValidation =
  | { ok: true; vehicle: SavedVehicleInput }
  | { ok: false; error: string };

function clean(value: unknown, max: number) {
  return typeof value === "string"
    ? value.trim().replace(/\s+/g, " ").slice(0, max)
    : "";
}

const CURRENT_MODEL_YEAR_CEILING = 2100;

/** VIN checksum is not validated — only the shape, so a real VIN is never rejected. */
function vinIsWellFormed(vin: string) {
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(vin);
}

export function validateSavedVehicle(body: unknown): SavedVehicleValidation {
  const input = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const make = clean(input.make, VEHICLE_FIELD_LIMITS.make);
  const model = clean(input.model, VEHICLE_FIELD_LIMITS.model);
  if (!make || !model) {
    return { ok: false, error: "Enter at least the make and model." };
  }

  const year = clean(input.year, VEHICLE_FIELD_LIMITS.year);
  if (year) {
    const parsed = Number(year);
    if (!/^\d{4}$/.test(year) || parsed < 1900 || parsed > CURRENT_MODEL_YEAR_CEILING) {
      return { ok: false, error: "Enter a four-digit model year, or leave it blank." };
    }
  }

  const vin = clean(input.vin, VEHICLE_FIELD_LIMITS.vin).toUpperCase();
  if (vin && !vinIsWellFormed(vin)) {
    return {
      ok: false,
      error: "A VIN is 17 characters and cannot contain I, O, or Q. Leave it blank if you are unsure.",
    };
  }

  return {
    ok: true,
    vehicle: {
      label: clean(input.label, VEHICLE_FIELD_LIMITS.label),
      year,
      make,
      model,
      trim: clean(input.trim, VEHICLE_FIELD_LIMITS.trim),
      color: clean(input.color, VEHICLE_FIELD_LIMITS.color),
      plate: clean(input.plate, VEHICLE_FIELD_LIMITS.plate).toUpperCase(),
      vin,
      notes: clean(input.notes, VEHICLE_FIELD_LIMITS.notes),
    },
  };
}

/** The single-line description a request form carries into the job record. */
export function vehicleDescription(vehicle: {
  year: string;
  make: string;
  model: string;
  trim: string;
}) {
  return [vehicle.year, vehicle.make, vehicle.model, vehicle.trim]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");
}

/** The name a customer sees in a vehicle picker. */
export function vehicleDisplayName(vehicle: {
  label: string;
  year: string;
  make: string;
  model: string;
  trim: string;
}) {
  return vehicle.label.trim() || vehicleDescription(vehicle) || "Saved vehicle";
}
