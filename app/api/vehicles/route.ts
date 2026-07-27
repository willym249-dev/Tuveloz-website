const VPIC_BASE = "https://vpic.nhtsa.dot.gov/api/vehicles";
const FUEL_ECONOMY_BASE = "https://www.fueleconomy.gov/ws/rest";

type VpicMake = {
  Make_ID?: number;
  Make_Name?: string;
};

type VpicModel = {
  Model_ID?: number;
  Model_Name?: string;
};

type VpicVin = {
  Make?: string;
  Model?: string;
  ModelYear?: string;
  Trim?: string;
  Series?: string;
  DisplacementL?: string;
  EngineCylinders?: string;
  EngineModel?: string;
  VehicleType?: string;
  ErrorCode?: string;
  ErrorText?: string;
};

type VpicResponse<T> = {
  Results?: T[];
};

type FuelEconomyMenuItem = {
  text?: string;
  value?: string;
};

type FuelEconomyMenu = {
  menuItem?: FuelEconomyMenuItem | FuelEconomyMenuItem[];
};

type FuelEconomyVehicle = {
  cylinders?: string;
  displ?: string;
  drive?: string;
  eng_dscr?: string;
  evMotor?: string;
  fuelType?: string;
  trany?: string;
};

function clean(value: string | null, max: number) {
  return (value ?? "").trim().slice(0, max);
}

function knownValue(value: string | undefined, max: number) {
  const cleaned = clean(value ?? "", max);
  if (
    !cleaned
    || /^(?:0|n\/?a|not applicable|not available|unknown|null|none)$/i.test(cleaned)
  ) {
    return "";
  }
  return cleaned;
}

async function getVpic<T>(path: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

  try {
    const response = await fetch(`${VPIC_BASE}${path}`, {
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`NHTSA returned ${response.status}`);
    return await response.json() as VpicResponse<T>;
  } finally {
    clearTimeout(timeout);
  }
}

async function getFuelEconomy<T>(path: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

  try {
    const response = await fetch(`${FUEL_ECONOMY_BASE}${path}`, {
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`FuelEconomy.gov returned ${response.status}`);
    return await response.json() as T;
  } finally {
    clearTimeout(timeout);
  }
}

function compact(values: Array<string | undefined>) {
  return values.map((value) => value?.trim()).filter(Boolean) as string[];
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = clean(searchParams.get("mode"), 20);

  try {
    if (mode === "makes") {
      const vehicleTypes = ["car", "multipurpose passenger vehicle", "truck"];
      const responses = await Promise.allSettled(
        vehicleTypes.map((vehicleType) => getVpic<VpicMake>(
          `/GetMakesForVehicleType/${encodeURIComponent(vehicleType)}?format=json`,
        )),
      );
      const makes = responses
        .flatMap((response) => response.status === "fulfilled"
          ? response.value.Results ?? []
          : [])
        .map((item) => clean(item.Make_Name ?? "", 80))
        .filter(Boolean);

      if (makes.length === 0) throw new Error("No vehicle makes returned");

      return Response.json(
        { makes: [...new Set(makes)].sort((a, b) => a.localeCompare(b)) },
        { headers: { "cache-control": "public, max-age=86400" } },
      );
    }

    if (mode === "models") {
      const make = clean(searchParams.get("make"), 80);
      const year = clean(searchParams.get("year"), 4);
      if (!make || !/^\d{4}$/.test(year)) {
        return Response.json({ error: "Choose a year and make first." }, { status: 400 });
      }

      const encodedMake = encodeURIComponent(make);
      const response = Number(year) > 1995
        ? await getVpic<VpicModel>(
          `/GetModelsForMakeYear/make/${encodedMake}/modelyear/${year}?format=json`,
        )
        : await getVpic<VpicModel>(`/GetModelsForMake/${encodedMake}?format=json`);
      const models = (response.Results ?? [])
        .map((item) => clean(item.Model_Name ?? "", 100))
        .filter(Boolean);

      return Response.json(
        { models: [...new Set(models)].sort((a, b) => a.localeCompare(b)) },
        { headers: { "cache-control": "public, max-age=86400" } },
      );
    }

    if (mode === "engines") {
      const year = clean(searchParams.get("year"), 4);
      const make = clean(searchParams.get("make"), 80);
      const model = clean(searchParams.get("model"), 100);
      if (!/^\d{4}$/.test(year) || !make || !model) {
        return Response.json({
          error: "Choose a year, make, and model first.",
        }, { status: 400 });
      }

      const params = new URLSearchParams({ year, make, model });
      const menu = await getFuelEconomy<FuelEconomyMenu>(
        `/vehicle/menu/options?${params.toString()}`,
      );
      const menuItems = (Array.isArray(menu.menuItem)
        ? menu.menuItem
        : menu.menuItem
          ? [menu.menuItem]
          : [])
        .filter((item) => item.value)
        .slice(0, 24);

      const detailResponses = await Promise.allSettled(
        menuItems.map((item) => getFuelEconomy<FuelEconomyVehicle>(
          `/vehicle/${encodeURIComponent(item.value ?? "")}`,
        )),
      );
      const detailedEngines = detailResponses
        .flatMap((response) => response.status === "fulfilled" ? [response.value] : [])
        .map((vehicle) => compact([
          knownValue(vehicle.displ, 20)
            ? `${knownValue(vehicle.displ, 20)}L`
            : undefined,
          knownValue(vehicle.cylinders, 20)
            ? `${knownValue(vehicle.cylinders, 20)}-cylinder`
            : undefined,
          knownValue(vehicle.fuelType, 80) || undefined,
          knownValue(vehicle.eng_dscr, 100) || undefined,
          knownValue(vehicle.evMotor, 100) || undefined,
          knownValue(vehicle.drive, 80) || undefined,
          knownValue(vehicle.trany, 100) || undefined,
        ]).join(" "))
        .filter(Boolean);
      const fallbackEngines = menuItems
        .map((item) => clean(item.text ?? "", 160))
        .filter(Boolean);
      const engines = detailedEngines.length > 0 ? detailedEngines : fallbackEngines;

      return Response.json(
        { engines: [...new Set(engines)].sort((a, b) => a.localeCompare(b)) },
        { headers: { "cache-control": "public, max-age=86400" } },
      );
    }

    if (mode === "vin") {
      const vin = clean(searchParams.get("vin"), 17).toUpperCase();
      if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) {
        return Response.json({
          error: "Enter all 17 VIN characters. VINs do not use I, O, or Q.",
        }, { status: 400 });
      }

      const response = await getVpic<VpicVin>(
        `/DecodeVinValuesExtended/${encodeURIComponent(vin)}?format=json`,
      );
      const vehicle = response.Results?.[0];
      const errorCode = clean(vehicle?.ErrorCode ?? "", 80);
      const year = knownValue(vehicle?.ModelYear, 4);
      const make = knownValue(vehicle?.Make, 80);
      const model = knownValue(vehicle?.Model, 100);

      if ((errorCode && errorCode !== "0") || !year || !make || !model) {
        return Response.json({
          error: "NHTSA could not fully validate that VIN. Check every character or enter the vehicle manually.",
        }, { status: 422 });
      }

      const trim = knownValue(vehicle?.Trim, 100) || knownValue(vehicle?.Series, 100);
      const displacement = knownValue(vehicle?.DisplacementL, 20);
      const cylinders = knownValue(vehicle?.EngineCylinders, 20);
      const engine = compact([
        displacement ? `${displacement}L` : undefined,
        cylinders ? `${cylinders}-cylinder` : undefined,
        knownValue(vehicle?.EngineModel, 100) || undefined,
      ]).join(" ");
      const display = compact([year, make, model, trim, engine]).join(" ");

      return Response.json({
        vehicle: {
          year,
          make,
          model,
          trim,
          engine,
          engineSource: engine ? "NHTSA VIN decoder" : "",
          vehicleType: knownValue(vehicle?.VehicleType, 80),
          display,
        },
      });
    }

    return Response.json({ error: "Choose a vehicle lookup type." }, { status: 400 });
  } catch (error) {
    console.error("Vehicle lookup failed", error);
    return Response.json({
      error: "Vehicle lookup is temporarily unavailable. You can still enter the vehicle manually.",
    }, { status: 503 });
  }
}
