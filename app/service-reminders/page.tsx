"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BrandMark } from "../components/tuveloz-icons";
import { parseJobServices } from "../../lib/service-matching";

type ServiceReminder = {
  id: string;
  vehicle: string;
  service: string;
  dueDate: string;
  dueMileage: number;
  currentMileage: number;
  note: string;
  sourceRequestId: string;
  status: "active" | "completed" | "dismissed";
  createdAt: string;
  updatedAt: string;
};

type CompletedJob = {
  id: string;
  vehicle: string;
  service: string;
  completedAt: string;
};

type ReminderData = {
  accountEmail: string;
  reminders: ServiceReminder[];
  completedJobs: CompletedJob[];
  error?: string;
};

type Draft = {
  id: string;
  vehicle: string;
  service: string;
  dueDate: string;
  dueMileage: string;
  currentMileage: string;
  note: string;
  sourceRequestId: string;
};

const EMPTY_DRAFT: Draft = {
  id: "",
  vehicle: "",
  service: "",
  dueDate: "",
  dueMileage: "",
  currentMileage: "",
  note: "",
  sourceRequestId: "",
};

function readableDate(value: string) {
  if (!value) return "No date selected";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function reminderTiming(reminder: ServiceReminder) {
  const messages: string[] = [];
  if (reminder.dueDate) {
    const due = new Date(`${reminder.dueDate}T23:59:59`).getTime();
    const today = Date.now();
    messages.push(Number.isFinite(due) && due < today
      ? `Date passed: ${readableDate(reminder.dueDate)}`
      : `Due ${readableDate(reminder.dueDate)}`);
  }
  if (reminder.dueMileage > 0) {
    const remaining = reminder.dueMileage - reminder.currentMileage;
    messages.push(remaining <= 0
      ? `Mileage reached: ${reminder.dueMileage.toLocaleString()} miles`
      : `${remaining.toLocaleString()} miles until ${reminder.dueMileage.toLocaleString()}`);
  }
  return messages.join(" · ");
}

export default function ServiceRemindersPage() {
  const [data, setData] = useState<ReminderData | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/service-reminders", { cache: "no-store" });
    const result = await response.json().catch(() => ({})) as ReminderData;
    if (response.status === 401) {
      window.location.replace("/account?role=customer");
      return;
    }
    if (!response.ok) throw new Error(result.error || "Unable to load service reminders.");
    setData(result);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load().catch((reason) => setError(
        reason instanceof Error ? reason.message : "Unable to load service reminders.",
      ));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function saveReminder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy("save");
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/service-reminders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "save-reminder", ...draft }),
      });
      const result = await response.json().catch(() => ({})) as ReminderData;
      if (!response.ok) throw new Error(result.error || "Unable to save this service reminder.");
      setData(result);
      setDraft(EMPTY_DRAFT);
      setNotice("Service reminder saved to your private customer account.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save this service reminder.");
    } finally {
      setBusy("");
    }
  }

  async function updateReminder(action: "set-status" | "delete-reminder", id: string, status = "") {
    setBusy(`${action}:${id}`);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/service-reminders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, id, status }),
      });
      const result = await response.json().catch(() => ({})) as ReminderData;
      if (!response.ok) throw new Error(result.error || "Unable to update this service reminder.");
      setData(result);
      setPendingDeleteId("");
      if (draft.id === id) setDraft(EMPTY_DRAFT);
      setNotice(action === "delete-reminder" ? "Service reminder deleted." : "Service reminder updated.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to update this service reminder.");
    } finally {
      setBusy("");
    }
  }

  function editReminder(reminder: ServiceReminder) {
    setDraft({
      id: reminder.id,
      vehicle: reminder.vehicle,
      service: reminder.service,
      dueDate: reminder.dueDate,
      dueMileage: reminder.dueMileage ? String(reminder.dueMileage) : "",
      currentMileage: reminder.currentMileage ? String(reminder.currentMileage) : "",
      note: reminder.note,
      sourceRequestId: reminder.sourceRequestId,
    });
    setNotice("Editing this reminder will reactivate it when saved.");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startFromJob(job: CompletedJob) {
    setDraft({
      ...EMPTY_DRAFT,
      vehicle: job.vehicle,
      service: parseJobServices(job.service).join(" + "),
      sourceRequestId: job.id,
    });
    setNotice("Add the date or mileage recommended for this vehicle and service. Tuveloz does not choose the interval for you.");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const activeCount = data?.reminders.filter((reminder) => reminder.status === "active").length ?? 0;

  return (
    <main className="account-shell">
      <header className="account-header">
        <Link className="brand" href="/"><BrandMark /><span>Tuveloz</span></Link>
        <div className="account-header-actions">
          <Link className="account-home-link" href="/customer">Customer workspace</Link>
          <Link className="account-home-link" href="/privacy-center">Privacy center</Link>
        </div>
      </header>

      <section className="account-main">
        <div className="account-welcome">
          <span className="account-kicker">Private customer tool</span>
          <h1>Service history & reminders.</h1>
          <p>
            Create your own date or mileage reminders and use completed Tuveloz jobs as a starting point.
          </p>
        </div>

        {error && <p className="form-error" role="alert">{error}</p>}
        {notice && <p className="portal-success" role="status">{notice}</p>}
        {!data && !error && <p className="admin-note">Loading service reminders…</p>}

        {data && (
          <div className="account-grid">
            <section className="account-card">
              <div className="account-card-heading">
                <div><span className="account-role">Customer-selected timing</span><h2>{draft.id ? "Edit reminder" : "Add a reminder"}</h2></div>
                <span className="account-count">{activeCount}</span>
              </div>

              <form onSubmit={saveReminder}>
                <label>
                  Vehicle
                  <input
                    maxLength={140}
                    onChange={(event) => setDraft((current) => ({ ...current, vehicle: event.target.value }))}
                    placeholder="Example: 2018 Honda Accord"
                    required
                    value={draft.vehicle}
                  />
                </label>
                <label>
                  Service or maintenance item
                  <input
                    maxLength={160}
                    onChange={(event) => setDraft((current) => ({ ...current, service: event.target.value }))}
                    placeholder="Example: Oil change"
                    required
                    value={draft.service}
                  />
                </label>
                <div className="field-row">
                  <label>
                    Due date, optional
                    <input
                      onChange={(event) => setDraft((current) => ({ ...current, dueDate: event.target.value }))}
                      type="date"
                      value={draft.dueDate}
                    />
                  </label>
                  <label>
                    Due mileage, optional
                    <input
                      inputMode="numeric"
                      min="0"
                      onChange={(event) => setDraft((current) => ({ ...current, dueMileage: event.target.value }))}
                      placeholder="50000"
                      step="1"
                      type="number"
                      value={draft.dueMileage}
                    />
                  </label>
                </div>
                <label>
                  Current mileage, optional
                  <input
                    inputMode="numeric"
                    min="0"
                    onChange={(event) => setDraft((current) => ({ ...current, currentMileage: event.target.value }))}
                    placeholder="45000"
                    step="1"
                    type="number"
                    value={draft.currentMileage}
                  />
                  <small>Enter this only when you want Tuveloz to show miles remaining.</small>
                </label>
                <label>
                  Private note, optional
                  <textarea
                    maxLength={800}
                    onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))}
                    placeholder="Example: Use the interval listed in my owner manual or provider invoice."
                    rows={4}
                    value={draft.note}
                  />
                </label>
                <p className="records-disclaimer">
                  Enter at least a due date or due mileage. Tuveloz stores the reminder but does not diagnose the vehicle,
                  choose the manufacturer interval, or guarantee that waiting until the reminder is safe.
                </p>
                <div className="hero-actions">
                  <button className="button primary" disabled={busy === "save"} type="submit">
                    {busy === "save" ? "Saving…" : draft.id ? "Save reminder changes" : "Save reminder"}
                  </button>
                  {draft.id && (
                    <button className="button secondary" onClick={() => setDraft(EMPTY_DRAFT)} type="button">Cancel editing</button>
                  )}
                </div>
              </form>
            </section>

            <section className="account-card">
              <div className="account-card-heading">
                <div><span className="account-role">Your reminders</span><h2>Active and past records</h2></div>
                <span className="account-count">{data.reminders.length}</span>
              </div>

              {data.reminders.length === 0 ? (
                <div className="account-empty">
                  <strong>No service reminders yet</strong>
                  <span>Add one manually or start from a completed job below.</span>
                </div>
              ) : (
                <div className="account-request-list">
                  {data.reminders.map((reminder) => (
                    <article className="account-request" key={reminder.id}>
                      <span>
                        <strong>{reminder.service} · {reminder.vehicle}</strong>
                        <small>{reminderTiming(reminder)}</small>
                        {reminder.note && <p>{reminder.note}</p>}
                        <span className={`account-status ${reminder.status === "active" ? "is-active" : ""}`}>{reminder.status}</span>
                        <div className="hero-actions">
                          <button className="button secondary" onClick={() => editReminder(reminder)} type="button">Edit</button>
                          {reminder.status === "active" ? (
                            <>
                              <button
                                className="button secondary"
                                disabled={busy === `set-status:${reminder.id}`}
                                onClick={() => void updateReminder("set-status", reminder.id, "completed")}
                                type="button"
                              >Mark completed</button>
                              <button
                                className="button secondary"
                                disabled={busy === `set-status:${reminder.id}`}
                                onClick={() => void updateReminder("set-status", reminder.id, "dismissed")}
                                type="button"
                              >Dismiss</button>
                            </>
                          ) : (
                            <button
                              className="button secondary"
                              disabled={busy === `set-status:${reminder.id}`}
                              onClick={() => void updateReminder("set-status", reminder.id, "active")}
                              type="button"
                            >Reactivate</button>
                          )}
                        </div>
                        {pendingDeleteId === reminder.id ? (
                          <div className="action-confirm" role="group" aria-label="Confirm reminder deletion">
                            <strong>Delete this reminder record?</strong>
                            <div className="hero-actions">
                              <button
                                className="button secondary"
                                disabled={busy === `delete-reminder:${reminder.id}`}
                                onClick={() => void updateReminder("delete-reminder", reminder.id)}
                                type="button"
                              >{busy === `delete-reminder:${reminder.id}` ? "Deleting…" : "Yes, delete"}</button>
                              <button className="button secondary" onClick={() => setPendingDeleteId("")} type="button">Go back</button>
                            </div>
                          </div>
                        ) : (
                          <button className="button secondary" onClick={() => setPendingDeleteId(reminder.id)} type="button">Delete record</button>
                        )}
                      </span>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="account-card">
              <div className="account-card-heading">
                <div><span className="account-role">Tuveloz job history</span><h2>Start from completed work</h2></div>
                <span className="account-count">{data.completedJobs.length}</span>
              </div>
              <p>Completed jobs are suggestions only. You choose the next due date or mileage.</p>
              {data.completedJobs.length === 0 ? (
                <p className="admin-note">Completed Tuveloz jobs will appear here.</p>
              ) : (
                <div className="account-request-list">
                  {data.completedJobs.map((job) => (
                    <article className="account-request" key={job.id}>
                      <span>
                        <strong>{parseJobServices(job.service).join(" + ")}</strong>
                        <small>{job.vehicle}</small>
                      </span>
                      <button className="button secondary" onClick={() => startFromJob(job)} type="button">Create reminder</button>
                    </article>
                  ))}
                </div>
              )}
              <p className="records-disclaimer">
                These reminders are visible in your signed-in account. Optional email preferences remain under your control in the Privacy Center.
              </p>
            </section>
          </div>
        )}
      </section>
    </main>
  );
}
