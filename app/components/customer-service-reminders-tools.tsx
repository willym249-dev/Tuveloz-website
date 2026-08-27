"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { REMINDER_FIELD_LIMITS } from "../../lib/customer-service-reminders";

type ServiceReminder = {
  id: string;
  vehicle: string;
  service: string;
  dueDate: string;
  dueMileage: number;
  currentMileage: number;
  note: string;
  sourceRequestId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type CompletedJob = {
  id: string;
  vehicle: string;
  service: string;
  createdAt: string;
};

const EMPTY_FORM = {
  vehicle: "",
  service: "",
  dueDate: "",
  dueMileage: "",
  currentMileage: "",
  note: "",
  sourceRequestId: "",
};

type ReminderForm = typeof EMPTY_FORM;

function isOverdue(reminder: ServiceReminder) {
  return reminder.status === "active"
    && reminder.dueDate !== ""
    && reminder.dueDate < new Date().toISOString().slice(0, 10);
}

/**
 * Private maintenance reminders for a customer account. The customer sets the
 * due date, the mileage, or both — Tuveloz never suggests an interval — and a
 * reminder never requests service, books anything, or contacts a provider.
 */
export function CustomerServiceRemindersTools() {
  const [reminders, setReminders] = useState<ServiceReminder[] | null>(null);
  const [completedJobs, setCompletedJobs] = useState<CompletedJob[]>([]);
  const [maxReminders, setMaxReminders] = useState(0);
  const [form, setForm] = useState<ReminderForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  const applyResult = useCallback((result: {
    reminders?: ServiceReminder[];
    completedJobs?: CompletedJob[];
    maxReminders?: number;
  }) => {
    setReminders(result.reminders ?? []);
    setCompletedJobs(result.completedJobs ?? []);
    setMaxReminders(result.maxReminders ?? 0);
  }, []);

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/service-reminders", { cache: "no-store" });
      const result = await response.json() as {
        reminders?: ServiceReminder[];
        completedJobs?: CompletedJob[];
        maxReminders?: number;
        error?: string;
      };
      if (!response.ok) throw new Error(result.error || "Unable to load your reminders.");
      applyResult(result);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load your reminders.");
    }
  }, [applyResult]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  function update(field: keyof ReminderForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function startFromJob(jobId: string) {
    const job = completedJobs.find((item) => item.id === jobId);
    setForm((current) => ({
      ...current,
      vehicle: job?.vehicle ?? current.vehicle,
      service: job?.service ?? current.service,
      sourceRequestId: job?.id ?? "",
    }));
  }

  function startEdit(reminder: ServiceReminder) {
    setEditingId(reminder.id);
    setError("");
    setForm({
      vehicle: reminder.vehicle,
      service: reminder.service,
      dueDate: reminder.dueDate,
      dueMileage: reminder.dueMileage > 0 ? String(reminder.dueMileage) : "",
      currentMileage: reminder.currentMileage > 0 ? String(reminder.currentMileage) : "",
      note: reminder.note,
      sourceRequestId: reminder.sourceRequestId,
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
      const response = await fetch("/api/service-reminders", {
        method: editingId ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(editingId ? { ...form, id: editingId } : form),
      });
      const result = await response.json() as {
        reminders?: ServiceReminder[];
        completedJobs?: CompletedJob[];
        maxReminders?: number;
        error?: string;
      };
      if (!response.ok) throw new Error(result.error || "We could not save that reminder.");
      applyResult(result);
      cancelEdit();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "We could not save that reminder.");
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(reminder: ServiceReminder, status: string) {
    setError("");
    setBusyId(reminder.id);
    try {
      const response = await fetch("/api/service-reminders", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: reminder.id, status }),
      });
      const result = await response.json() as {
        reminders?: ServiceReminder[];
        completedJobs?: CompletedJob[];
        maxReminders?: number;
        error?: string;
      };
      if (!response.ok) throw new Error(result.error || "We could not update that reminder.");
      applyResult(result);
      if (editingId === reminder.id) cancelEdit();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "We could not update that reminder.");
    } finally {
      setBusyId("");
    }
  }

  async function remove(reminder: ServiceReminder) {
    setError("");
    setBusyId(reminder.id);
    try {
      const response = await fetch(
        `/api/service-reminders?id=${encodeURIComponent(reminder.id)}`,
        { method: "DELETE" },
      );
      const result = await response.json() as {
        reminders?: ServiceReminder[];
        completedJobs?: CompletedJob[];
        maxReminders?: number;
        error?: string;
      };
      if (!response.ok) throw new Error(result.error || "We could not delete that reminder.");
      applyResult(result);
      if (editingId === reminder.id) cancelEdit();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "We could not delete that reminder.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="customer-vehicles">
      <p className="admin-note">
        Keep your own maintenance schedule. You choose the due date, the mileage,
        or both — Tuveloz never fills in a manufacturer interval for you. Reminders
        are private to your account and never request service or contact a provider.
      </p>

      {error && <p className="form-error" role="alert">{error}</p>}

      {reminders === null ? (
        <p className="admin-note">Loading your reminders…</p>
      ) : reminders.length === 0 ? (
        <p className="admin-note">No reminders yet. Add your first one below.</p>
      ) : (
        <ul className="customer-vehicle-list">
          {reminders.map((reminder) => (
            <li key={reminder.id}>
              <div>
                <strong>{reminder.service}</strong>
                <span>{reminder.vehicle}</span>
                <small>
                  {[
                    reminder.dueDate ? `Due ${reminder.dueDate}` : "",
                    reminder.dueMileage > 0 ? `Due at ${reminder.dueMileage.toLocaleString()} mi` : "",
                    reminder.currentMileage > 0 ? `Now ${reminder.currentMileage.toLocaleString()} mi` : "",
                    isOverdue(reminder) ? "Overdue" : "",
                    reminder.status !== "active" ? reminder.status : "",
                  ].filter(Boolean).join(" · ")}
                </small>
                {reminder.note && <small>{reminder.note}</small>}
              </div>
              <div className="customer-vehicle-actions">
                {reminder.status === "active" ? (
                  <>
                    <button
                      type="button"
                      disabled={busyId === reminder.id}
                      onClick={() => void setStatus(reminder, "completed")}
                    >
                      Mark done
                    </button>
                    <button
                      type="button"
                      disabled={busyId === reminder.id}
                      onClick={() => void setStatus(reminder, "dismissed")}
                    >
                      Dismiss
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={busyId === reminder.id}
                    onClick={() => void setStatus(reminder, "active")}
                  >
                    Reactivate
                  </button>
                )}
                <button type="button" onClick={() => startEdit(reminder)}>Edit</button>
                <button
                  type="button"
                  disabled={busyId === reminder.id}
                  onClick={() => void remove(reminder)}
                >
                  {busyId === reminder.id ? "Deleting…" : "Delete"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form className="customer-vehicle-form" onSubmit={submit}>
        <h3>{editingId ? "Edit reminder" : "Add a reminder"}</h3>
        {completedJobs.length > 0 && (
          <label className="customer-vehicle-wide">
            <span>Start from a completed job <small>(optional)</small></span>
            <select
              value={form.sourceRequestId}
              onChange={(event) => startFromJob(event.target.value)}
            >
              <option value="">Start blank</option>
              {completedJobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.service} — {job.vehicle}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          <span>Vehicle</span>
          <input
            value={form.vehicle}
            maxLength={REMINDER_FIELD_LIMITS.vehicle}
            onChange={(event) => update("vehicle", event.target.value)}
            placeholder="2019 Ford Transit"
            required
          />
        </label>
        <label>
          <span>Service</span>
          <input
            value={form.service}
            maxLength={REMINDER_FIELD_LIMITS.service}
            onChange={(event) => update("service", event.target.value)}
            placeholder="Oil change, brake check…"
            required
          />
        </label>
        <label>
          <span>Due date <small>(date, mileage, or both)</small></span>
          <input
            type="date"
            value={form.dueDate}
            onChange={(event) => update("dueDate", event.target.value)}
          />
        </label>
        <label>
          <span>Due mileage <small>(optional)</small></span>
          <input
            value={form.dueMileage}
            inputMode="numeric"
            onChange={(event) => update("dueMileage", event.target.value)}
            placeholder="60000"
          />
        </label>
        <label>
          <span>Current mileage <small>(optional)</small></span>
          <input
            value={form.currentMileage}
            inputMode="numeric"
            onChange={(event) => update("currentMileage", event.target.value)}
            placeholder="52000"
          />
        </label>
        <label className="customer-vehicle-wide">
          <span>Note <small>(optional)</small></span>
          <textarea
            value={form.note}
            maxLength={REMINDER_FIELD_LIMITS.note}
            rows={2}
            onChange={(event) => update("note", event.target.value)}
            placeholder="Anything future-you should remember about this."
          />
        </label>
        <div className="customer-vehicle-form-actions">
          <button className="button primary" type="submit" disabled={busy}>
            {busy ? "Saving…" : editingId ? "Save changes" : "Add reminder"}
          </button>
          {editingId && (
            <button className="button secondary" type="button" onClick={cancelEdit}>
              Cancel
            </button>
          )}
        </div>
        {maxReminders > 0 && (
          <small className="admin-note">You can keep up to {maxReminders} reminders.</small>
        )}
      </form>
    </div>
  );
}
