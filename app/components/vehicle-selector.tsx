"use client";

import { useEffect, useMemo, useState } from "react";

const commonMakes = [
  "Acura",
  "Audi",
  "BMW",
  "Buick",
  "Cadillac",
  "Chevrolet",
  "Chrysler",
  "Dodge",
  "Ford",
  "Genesis",
  "GMC",
  "Honda",
  "Hyundai",
  "Infiniti",
  "Jeep",
  "Kia",
  "Lexus",
  "Lincoln",
  "Mazda",
  "Mercedes-Benz",
  "Mitsubishi",
  "Nissan",
  "Ram",
  "Subaru",
  "Tesla",
  "Toyota",
  "Volkswagen",
  "Volvo",
];

const MANUAL_OPTION = "__manual__";
const UNKNOWN_ENGINE = "__unknown__";

type DecodedVehicle = {
  year: string;
  make: string;
  model: string;
  trim: string;
  engine: string;
  engineSource: string;
  display: string;
};

type VehicleSelectorProps = {
  onVehicleChange?: (vehicle: string) => void;
};

function normalizeVin(value: string) {
  return value.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, "").slice(0, 17);
}

export default function VehicleSelector({ onVehicleChange }: VehicleSelectorProps) {
  const currentYear = new Date().getFullYear();
  const years = useMemo(
    () => Array.from({ length: currentYear - 1994 }, (_, index) => String(currentYear + 1 - index)),
    [currentYear],
  );
  const [mode, setMode] = useState<"search" | "vin">("search");
  const [year, setYear] = useState("");
  const [make, setMake] = useState("");
  const [makeManual, setMakeManual] = useState(false);
  const [model, setModel] = useState("");
  const [modelManual, setModelManual] = useState(false);
  const [trim, setTrim] = useState("");
  const [trimUnknown, setTrimUnknown] = useState(false);
  const [engine, setEngine] = useState("");
  const [customEngine, setCustomEngine] = useState("");
  const [makes, setMakes] = useState(commonMakes);
  const [models, setModels] = useState<string[]>([]);
  const [modelsBusy, setModelsBusy] = useState(false);
  const [modelsChecked, setModelsChecked] = useState(false);
  const [engines, setEngines] = useState<string[]>([]);
  const [enginesBusy, setEnginesBusy] = useState(false);
  const [enginesChecked, setEnginesChecked] = useState(false);
  const [vin, setVin] = useState("");
  const [decodedVehicle, setDecodedVehicle] = useState<DecodedVehicle | null>(null);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupError, setLookupError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/vehicles?mode=makes", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return;
        const result = await response.json() as { makes?: string[] };
        if (result.makes?.length) {
          setMakes([...new Set([...commonMakes, ...result.makes])].sort(
            (a, b) => a.localeCompare(b),
          ));
        }
      })
      .catch(() => {
        // Common makes and manual typing remain available.
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!year || make.trim().length < 2) {
      return;
    }

    const controller = new AbortController();
    let active = true;
    const delay = window.setTimeout(() => {
      setModelsBusy(true);
      setModelsChecked(false);
      const params = new URLSearchParams({ mode: "models", year, make: make.trim() });
      fetch(`/api/vehicles?${params.toString()}`, { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) throw new Error("No confirmed model list returned.");
          const result = await response.json() as { models?: string[] };
          if (!active) return;
          const nextModels = result.models ?? [];
          setModels(nextModels);
          setModelsChecked(true);
          if (nextModels.length === 0) setModelManual(true);
        })
        .catch(() => {
          if (!active) return;
          setModels([]);
          setModelsChecked(true);
          setModelManual(true);
        })
        .finally(() => {
          if (active) setModelsBusy(false);
        });
    }, 350);

    return () => {
      active = false;
      window.clearTimeout(delay);
      controller.abort();
    };
  }, [make, year]);

  useEffect(() => {
    if (!year || !make.trim() || !model.trim()) {
      return;
    }

    const controller = new AbortController();
    let active = true;
    const delay = window.setTimeout(() => {
      setEnginesBusy(true);
      setEnginesChecked(false);
      const params = new URLSearchParams({
        mode: "engines",
        year,
        make: make.trim(),
        model: model.trim(),
      });
      fetch(`/api/vehicles?${params.toString()}`, { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) throw new Error("No official motor options returned.");
          const result = await response.json() as { engines?: string[] };
          if (!active) return;
          setEngines(result.engines ?? []);
          setEnginesChecked(true);
        })
        .catch(() => {
          if (!active) return;
          setEngines([]);
          setEnginesChecked(true);
        })
        .finally(() => {
          if (active) setEnginesBusy(false);
        });
    }, 350);

    return () => {
      active = false;
      window.clearTimeout(delay);
      controller.abort();
    };
  }, [make, model, year]);

  const selectedTrim = trimUnknown ? "" : trim.trim();
  const decodedEngineMatchesVehicle = mode === "vin"
    && decodedVehicle?.year === year
    && decodedVehicle.make === make
    && decodedVehicle.model === model;
  const availableEngines = useMemo(
    () => [...new Set(
      [
        decodedEngineMatchesVehicle ? decodedVehicle?.engine : "",
        ...engines,
      ].filter(Boolean) as string[],
    )],
    [decodedEngineMatchesVehicle, decodedVehicle?.engine, engines],
  );
  const customerEnteredEngine = customEngine.trim();
  const selectedEngine = customerEnteredEngine
    ? customerEnteredEngine
    : engine === UNKNOWN_ENGINE
      ? ""
      : engine;
  const baseVehicle = [
    year,
    make.trim(),
    model.trim(),
    selectedTrim,
  ]
    .filter(Boolean)
    .join(" ");
  const engineSource = selectedEngine
    ? customerEnteredEngine
      ? "customer entered; provider must verify"
      : decodedEngineMatchesVehicle && selectedEngine === decodedVehicle?.engine
        ? `from ${decodedVehicle?.engineSource || "NHTSA VIN data"}`
        : "customer selected from official options"
    : "";
  const engineRecord = selectedEngine
    ? `Motor/engine: ${selectedEngine} (${engineSource})`
    : "Motor/engine not provided";
  const vehicle = (
    (mode === "vin" && decodedVehicle)
    || (mode === "search" && year && make.trim() && model.trim())
  )
    ? `${baseVehicle} · ${engineRecord}`
    : "";

  useEffect(() => {
    onVehicleChange?.(vehicle);
  }, [onVehicleChange, vehicle]);

  async function decodeVin() {
    if (vin.length !== 17) {
      setLookupError("Enter all 17 VIN characters.");
      return;
    }

    setLookupBusy(true);
    setLookupError("");
    setDecodedVehicle(null);
    try {
      const params = new URLSearchParams({ mode: "vin", vin });
      const response = await fetch(`/api/vehicles?${params.toString()}`);
      const result = await response.json() as {
        error?: string;
        vehicle?: DecodedVehicle;
      };
      if (!response.ok || !result.vehicle) {
        throw new Error(result.error || "We could not identify that VIN.");
      }
      setDecodedVehicle(result.vehicle);
      setYear(result.vehicle.year);
      setMake(result.vehicle.make);
      setModel(result.vehicle.model);
      setTrim(result.vehicle.trim);
      setTrimUnknown(false);
      setEngine(result.vehicle.engine);
      setCustomEngine("");
      setEngines([]);
      setEnginesChecked(false);
      setMakeManual(false);
      setModelManual(false);
    } catch (error) {
      setLookupError(error instanceof Error ? error.message : "We could not identify that VIN.");
    } finally {
      setLookupBusy(false);
    }
  }

  function selectMode(nextMode: "search" | "vin") {
    if (nextMode === "search" && mode !== "search") {
      setDecodedVehicle(null);
      setTrim("");
      setTrimUnknown(false);
      setEngine("");
      setCustomEngine("");
      setEngines([]);
      setEnginesChecked(false);
      setMakeManual(Boolean(make) && !makes.includes(make));
      setModelManual(false);
    }
    setMode(nextMode);
    setLookupError("");
  }

  return (
    <section className="vehicle-selector" aria-labelledby="vehicle-selector-title">
      <div className="vehicle-selector-heading">
        <div>
          <strong id="vehicle-selector-title">Your vehicle</strong>
          <small>Start with the year, make, and model. Use the VIN lookup if needed.</small>
        </div>
        <details className="legal-help">
          <summary aria-label="Why does Tuveloz need vehicle details?">?</summary>
          <span>Accurate vehicle details help providers find compatible parts and compare OEM and aftermarket prices.</span>
        </details>
      </div>

      <div className="vehicle-methods" role="group" aria-label="Vehicle entry method">
        <button
          aria-pressed={mode === "search"}
          className={mode === "search" ? "selected" : ""}
          onClick={() => selectMode("search")}
          type="button"
        >
          Year, make & model <span>Recommended</span>
        </button>
        <button
          aria-pressed={mode === "vin"}
          className={mode === "vin" ? "selected" : ""}
          onClick={() => selectMode("vin")}
          type="button"
        >
          VIN lookup
        </button>
      </div>

      {mode === "search" ? (
        <>
          <p className="vehicle-entry-help">
            Can&apos;t find your vehicle? Choose “My make is not listed” or “My model is
            not listed” to type it, or use the VIN lookup.
          </p>
          <div className="vehicle-fields vehicle-fields-main">
            <div className="vehicle-field-group">
              <label htmlFor="vehicle-year">Year</label>
              <select
                id="vehicle-year"
                value={year}
                onChange={(event) => {
                  setYear(event.target.value);
                  setModel("");
                  setModels([]);
                  setModelsChecked(false);
                  setModelManual(false);
                  setTrim("");
                  setTrimUnknown(false);
                  setEngine("");
                  setCustomEngine("");
                  setEngines([]);
                  setEnginesChecked(false);
                }}
              >
                <option value="">Select year</option>
                {years.map((option) => <option key={option}>{option}</option>)}
              </select>
            </div>
            <div className="vehicle-field-group">
              <label htmlFor="vehicle-make">Make</label>
              <select
                id="vehicle-make"
                value={makeManual ? MANUAL_OPTION : make}
                onChange={(event) => {
                  const nextMake = event.target.value;
                  setMakeManual(nextMake === MANUAL_OPTION);
                  setMake(nextMake === MANUAL_OPTION ? "" : nextMake);
                  setModel("");
                  setModels([]);
                  setModelsChecked(false);
                  setModelManual(false);
                  setTrim("");
                  setTrimUnknown(false);
                  setEngine("");
                  setCustomEngine("");
                  setEngines([]);
                  setEnginesChecked(false);
                }}
              >
                <option value="">Select make</option>
                {makes.map((option) => <option key={option}>{option}</option>)}
                <option value={MANUAL_OPTION}>My make is not listed</option>
              </select>
              {makeManual && (
                <>
                  <input
                    aria-label="Type the exact make"
                    autoComplete="off"
                    id="vehicle-make-manual"
                    onChange={(event) => {
                      setMake(event.target.value);
                      setModel("");
                      setModels([]);
                      setModelsChecked(false);
                      setModelManual(false);
                      setTrim("");
                      setTrimUnknown(false);
                      setEngine("");
                      setCustomEngine("");
                      setEngines([]);
                      setEnginesChecked(false);
                    }}
                    placeholder="Type the exact make"
                    value={make}
                  />
                  <small>No confirmed choice matched, so manual entry is available.</small>
                </>
              )}
            </div>
            <div className="vehicle-field-group">
              <label htmlFor="vehicle-model">Model</label>
              <select
                disabled={!year || !make.trim() || modelsBusy}
                id="vehicle-model"
                value={modelManual ? MANUAL_OPTION : model}
                onChange={(event) => {
                  const nextModel = event.target.value;
                  setModelManual(nextModel === MANUAL_OPTION);
                  setModel(nextModel === MANUAL_OPTION ? "" : nextModel);
                  setTrim("");
                  setTrimUnknown(false);
                  setEngine("");
                  setCustomEngine("");
                  setEngines([]);
                  setEnginesChecked(false);
                }}
              >
                <option value="">
                  {!year || !make.trim()
                    ? "Choose year and make first"
                    : modelsBusy
                      ? "Loading confirmed models…"
                      : "Select model"}
                </option>
                {models.map((option) => <option key={option}>{option}</option>)}
                <option value={MANUAL_OPTION}>My model is not listed</option>
              </select>
              {modelManual && (
                <>
                  <input
                    aria-label="Type the exact model"
                    autoComplete="off"
                    disabled={!year || !make.trim()}
                    id="vehicle-model-manual"
                    onChange={(event) => {
                      setModel(event.target.value);
                      setTrim("");
                      setTrimUnknown(false);
                      setEngine("");
                      setCustomEngine("");
                      setEngines([]);
                      setEnginesChecked(false);
                    }}
                    placeholder="Type the exact model"
                    value={model}
                  />
                  <small>
                    {modelsChecked && models.length === 0
                      ? "No confirmed model choice was returned, so manual entry is available."
                      : "Use this only when the exact model is not in the list."}
                  </small>
                </>
              )}
            </div>
          </div>
          <div className="vehicle-extra-details">
            <div className="vehicle-fields">
              <div className="vehicle-detail-field">
                <label>
                  Exact trim <span>(optional)</span>
                  <input
                    disabled={!model.trim() || trimUnknown}
                    onChange={(event) => setTrim(event.target.value)}
                    placeholder={model.trim() ? "Example: EX-L" : "Choose model first"}
                    value={trim}
                  />
                  <small>
                    Type the exact badge only because a confirmed trim choice is not available
                    here. VIN lookup may fill it.
                  </small>
                </label>
                <label className="vehicle-unknown-option">
                  <input
                    checked={trimUnknown}
                    disabled={!model.trim()}
                    onChange={(event) => {
                      setTrimUnknown(event.target.checked);
                      if (event.target.checked) setTrim("");
                    }}
                    type="checkbox"
                  />
                  I&apos;m not sure of the trim
                </label>
              </div>
              {availableEngines.length > 0 || !enginesChecked ? (
                <label>
                  Motor / engine configuration <span>(optional)</span>
                  <select
                    disabled={!model.trim() || enginesBusy}
                    onChange={(event) => {
                      setEngine(event.target.value);
                      setCustomEngine("");
                    }}
                    value={engine}
                  >
                    <option value="">
                      {!model.trim()
                        ? "Choose model first"
                        : enginesBusy
                          ? "Loading official options…"
                          : "Select motor / engine"}
                    </option>
                    <option value={UNKNOWN_ENGINE}>I&apos;m not sure</option>
                    {availableEngines.map((option) => <option key={option}>{option}</option>)}
                  </select>
                  <small>
                    Options come from official vehicle data. Tap one only if it matches
                    your vehicle.
                  </small>
                </label>
              ) : (
                <div className="vehicle-missing-data">
                  <strong>No confirmed motor / engine choice was returned.</strong>
                  <small>Type it below only if you know it, or leave it blank.</small>
                </div>
              )}
            </div>
            <label>
              Type the motor / engine <span>(optional)</span>
              <input
                disabled={!model.trim()}
                onChange={(event) => setCustomEngine(event.target.value)}
                placeholder={model.trim() ? "Example: 2.0L turbo" : "Choose model first"}
                value={customEngine}
              />
              <small>
                {customerEnteredEngine
                  ? "This typed value overrides the official choice and is marked customer-entered for provider verification."
                  : availableEngines.length > 0
                    ? "Choose an official option above or type the engine here from the vehicle badge or records."
                    : "Type it only if the vehicle badge or records provide it, or leave it blank."}
              </small>
            </label>
            <p className="vehicle-data-note">
              Tuveloz does not guess motor or engine details. Missing information stays
              marked as not provided, and providers must verify fit before purchasing parts.
            </p>
          </div>
        </>
      ) : (
        <div className="vin-lookup">
          <label>
            <span className="field-label-with-help">
              17-character VIN
              <details className="legal-help">
                <summary aria-label="Where can I find my VIN?">?</summary>
                <span>Look through the windshield at the driver-side dashboard, or check the driver-door label, registration, or insurance card.</span>
              </details>
            </span>
            <div className="vin-input-row">
              <input
                autoCapitalize="characters"
                autoComplete="off"
                inputMode="text"
                maxLength={17}
                onChange={(event) => {
                  setVin(normalizeVin(event.target.value));
                  setDecodedVehicle(null);
                  setLookupError("");
                }}
                placeholder="Enter VIN"
                value={vin}
              />
              <button disabled={lookupBusy} onClick={decodeVin} type="button">
                {lookupBusy ? "Finding…" : "Find vehicle"}
              </button>
            </div>
            <small>{vin.length}/17 characters · Lookup uses NHTSA vehicle data.</small>
          </label>
          {lookupError && (
            <p className="vehicle-lookup-error" role="alert">{lookupError}</p>
          )}
          {decodedVehicle && (
            <div className="vin-result" aria-live="polite">
              <div className="vin-result-heading">
                <span>✓</span>
                <div>
                  <strong>VIN decoded by NHTSA</strong>
                  <small>Review the details before continuing.</small>
                </div>
              </div>
              <div className="vin-result-summary">
                <div><small>Year</small><strong>{decodedVehicle.year}</strong></div>
                <div><small>Make</small><strong>{decodedVehicle.make}</strong></div>
                <div><small>Model</small><strong>{decodedVehicle.model}</strong></div>
              </div>
              <div className="vehicle-extra-details vin-extra-details">
                <div className="vehicle-fields">
                  <div className="vehicle-detail-field">
                    <label>
                      Exact trim <span>(optional)</span>
                      <input
                        disabled={trimUnknown}
                        onChange={(event) => setTrim(event.target.value)}
                        placeholder="Example: EX-L"
                        value={trim}
                      />
                      <small>
                        {decodedVehicle.trim
                          ? "Filled from NHTSA VIN data. Correct it only if the vehicle badge or records differ."
                          : "This VIN did not return a trim. Type it only if the vehicle badge or records provide it."}
                      </small>
                    </label>
                    <label className="vehicle-unknown-option">
                      <input
                        checked={trimUnknown}
                        onChange={(event) => {
                          setTrimUnknown(event.target.checked);
                          if (event.target.checked) setTrim("");
                        }}
                        type="checkbox"
                      />
                      I&apos;m not sure of the trim
                    </label>
                  </div>
                  {availableEngines.length > 0 || !enginesChecked ? (
                    <label>
                      Motor / engine configuration <span>(optional)</span>
                      <select
                        disabled={enginesBusy}
                        onChange={(event) => {
                          setEngine(event.target.value);
                          setCustomEngine("");
                        }}
                        value={engine}
                      >
                        <option value="">
                          {enginesBusy
                            ? "Loading official options…"
                            : "Select motor / engine"}
                        </option>
                        <option value={UNKNOWN_ENGINE}>I&apos;m not sure</option>
                        {availableEngines.map((option) => (
                          <option key={option}>{option}</option>
                        ))}
                      </select>
                      <small>
                        {decodedVehicle.engine
                          ? "The NHTSA VIN result is selected. Tap a different official option only if your vehicle records match it."
                          : "The VIN did not identify the motor. Tap an official option only if your vehicle records match it."}
                      </small>
                    </label>
                  ) : (
                    <div className="vehicle-missing-data">
                      <strong>The VIN did not return a motor / engine.</strong>
                      <small>Type it below only if your vehicle badge or records provide it.</small>
                    </div>
                  )}
                </div>
                <label>
                  Type the motor / engine <span>(optional)</span>
                  <input
                    onChange={(event) => setCustomEngine(event.target.value)}
                    placeholder="Example: 2.0L turbo"
                    value={customEngine}
                  />
                  <small>
                    {customerEnteredEngine
                      ? "This typed value overrides the VIN or official choice and is marked customer-entered for provider verification."
                      : decodedVehicle.engine
                        ? "Keep the VIN result above or type a correction from the vehicle badge or records."
                        : "Type it only if the vehicle badge or records provide it, or leave it blank."}
                  </small>
                </label>
                <p className="vehicle-data-note">
                  Tuveloz shows sourced vehicle data and labels customer-entered details.
                  It never fills a made-up motor. The selected provider must still verify
                  the VIN, motor, trim, and part number before purchasing parts.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <input name="vehicle" readOnly type="hidden" value={vehicle} />
      {vehicle && (
        <div className="vehicle-selected" aria-live="polite">
          <span>✓</span>
          <div>
            <small>Vehicle selected</small>
            <strong>{vehicle}</strong>
          </div>
        </div>
      )}
    </section>
  );
}
