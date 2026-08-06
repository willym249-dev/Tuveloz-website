"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { VEHICLE_FIELD_LIMITS } from "../../lib/customer-vehicles";

type SavedVehicle = {
  id: string;
  label: string;
  year: string;
  make: string;
  model: string;
  trim: string;
  color: string;
  plate: string;
  vin: string;
  notes: string;
  displayName: string;
  description: string;
};

const EMPTY_FORM = {
  label: "",
  year: "",
  make: "",
  model: "",
  trim: "",
  color: "",
  plate: "",
  vin: "",
  notes: "",
};

type VehicleForm = typeof EMPTY_FORM;

/**
 * Saved vehicles for a customer or fleet account. These are a convenience
 * record only — saving a vehicle does not request service, hold a price, or
 * make any provider eligible to work on it.
 */
export function CustomerVehiclesTools() {
  const [vehicles, setVehicles] = useState<SavedVehicle[] | null>(null);
  const [maxVehicles, setMaxVehicles] = useState(0);
  const [form, setForm] = useState<VehicleForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/customer-vehicles", { cache: "no-store" });
      const result = await response.json() as {
        vehicles?: SavedVehicle[];
        maxVehicles?: number;
        error?: string;
      };
      if (!response.ok) throw new Error(result.error || "Unable to load your vehicles.");
      setVehicles(result.vehicles ?? []);
      setMaxVehicles(result.maxVehicles ?? 0);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load your vehicles.");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  function update(field: keyof VehicleForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function startEdit(vehicle: SavedVehicle) {
    setEditingId(vehicle.id);
    setError("");
    setForm({
      label: vehicle.label,
      year: vehicle.year,
      make: vehicle.make,
      model: vehicle.model,
      trim: vehicle.trim,
      color: vehicle.color,
      plate: vehicle.plate,
      vin: vehicle.vin,
      notes: vehicle.notes,
    });
  }

  function cancelEdit() {
    setEditingId("");
    setForm(EMPTY_FORM);
    setError("");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/customer-vehicles", {
        method: editingId ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(editingId ? { ...form, id: editingId } : form),
      });
      const result = await response.json() as { vehicles?: SavedVehicle[]; error?: string };
      if (!response.ok) throw new Error(result.error || "We could not save that vehicle.");
      setVehicles(result.vehicles ?? []);
      cancelEdit();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "We could not save that vehicle.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(vehicle: SavedVehicle) {
    setError("");
    setBusyId(vehicle.id);
    try {
      const response = await fetch(
        `/api/customer-vehicles?id=${encodeURIComponent(vehicle.id)}`,
        { method: "DELETE" },
      );
      const result = await response.json() as { vehicles?: SavedVehicle[]; error?: string };
      if (!response.ok) throw new Error(result.error || "We could not remove that vehicle.");
      setVehicles(result.vehicles ?? []);
      if (editingId === vehicle.id) cancelEdit();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "We could not remove that vehicle.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="customer-vehicles">
      <p className="admin-note">
        Save the vehicles you own so you do not retype them on every request. Running
        several? Add them all — this is how a fleet account keeps its list. Saving a
        vehicle does not request service or book anything.
      </p>

      {error && <p className="form-error" role="alert">{error}</p>}

      {vehicles === null ? (
        <p className="admin-note">Loading your vehicles…</p>
      ) : vehicles.length === 0 ? (
        <p className="admin-note">No saved vehicles yet. Add your first one below.</p>
      ) : (
        <ul className="customer-vehicle-list">
          {vehicles.map((vehicle) => (
            <li key={vehicle.id}>
              <div>
                <strong>{vehicle.displayName}</strong>
                {vehicle.description && vehicle.description !== vehicle.displayName && (
                  <span>{vehicle.description}</span>
                )}
                <small>
                  {[
                    vehicle.color,
                    vehicle.plate ? `Plate ${vehicle.plate}` : "",
                    vehicle.vin ? `VIN ${vehicle.vin}` : "",
                  ].filter(Boolean).join(" · ")}
                </small>
                {vehicle.notes && <small>{vehicle.notes}</small>}
              </div>
              <div className="customer-vehicle-actions">
                <button type="button" onClick={() => startEdit(vehicle)}>Edit</button>
                <button
                  type="button"
                  disabled={busyId === vehicle.id}
                  onClick={() => void remove(vehicle)}
                >
                  {busyId === vehicle.id ? "Removing…" : "Remove"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form className="customer-vehicle-form" onSubmit={submit}>
        <h3>{editingId ? "Edit vehicle" : "Add a vehicle"}</h3>
        <label>
          <span>Nickname <small>(optional)</small></span>
          <input
            value={form.label}
            maxLength={VEHICLE_FIELD_LIMITS.label}
            onChange={(event) => update("label", event.target.value)}
            placeholder="Van 3, my commuter…"
          />
        </label>
        <label>
          <span>Year <small>(optional)</small></span>
          <input
            value={form.year}
            maxLength={VEHICLE_FIELD_LIMITS.year}
            inputMode="numeric"
            onChange={(event) => update("year", event.target.value)}
          />
        </label>
        <label>
          <span>Make</span>
          <input
            value={form.make}
            maxLength={VEHICLE_FIELD_LIMITS.make}
            onChange={(event) => update("make", event.target.value)}
            required
          />
        </label>
        <label>
          <span>Model</span>
          <input
            value={form.model}
            maxLength={VEHICLE_FIELD_LIMITS.model}
            onChange={(event) => update("model", event.target.value)}
            required
          />
        </label>
        <label>
          <span>Trim <small>(optional)</small></span>
          <input
            value={form.trim}
            maxLength={VEHICLE_FIELD_LIMITS.trim}
            onChange={(event) => update("trim", event.target.value)}
          />
        </label>
        <label>
          <span>Color <small>(optional)</small></span>
          <input
            value={form.color}
            maxLength={VEHICLE_FIELD_LIMITS.color}
            onChange={(event) => update("color", event.target.value)}
          />
        </label>
        <label>
          <span>Plate <small>(optional)</small></span>
          <input
            value={form.plate}
            maxLength={VEHICLE_FIELD_LIMITS.plate}
            onChange={(event) => update("plate", event.target.value)}
          />
        </label>
        <label>
          <span>VIN <small>(optional)</small></span>
          <input
            value={form.vin}
            maxLength={VEHICLE_FIELD_LIMITS.vin}
            onChange={(event) => update("vin", event.target.value)}
          />
        </label>
        <label className="customer-vehicle-wide">
          <span>Notes <small>(optional)</small></span>
          <textarea
            value={form.notes}
            maxLength={VEHICLE_FIELD_LIMITS.notes}
            rows={2}
            onChange={(event) => update("notes", event.target.value)}
            placeholder="Anything a provider should know before quoting."
          />
        </label>
        <div className="customer-vehicle-form-actions">
          <button className="button primary" type="submit" disabled={busy}>
            {busy ? "Saving…" : editingId ? "Save changes" : "Add vehicle"}
          </button>
          {editingId && (
            <button className="button secondary" type="button" onClick={cancelEdit}>
              Cancel
            </button>
          )}
        </div>
        {maxVehicles > 0 && (
          <small className="admin-note">You can save up to {maxVehicles} vehicles.</small>
        )}
      </form>
    </div>
  );
}
