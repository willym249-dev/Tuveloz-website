"use client";

import { useEffect, useState } from "react";

type Appointment = { appointmentAt: string; note: string } | null;

type AppointmentResponse = {
  role?: "provider" | "customer";
  canEdit?: boolean;
  appointment?: Appointment;
  error?: string;
};

// ISO instant -> value a <input type="datetime-local"> accepts, in local time.
function isoToLocalInput(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatAppointment(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function JobAppointmentPanel(
  { requestId, token }: { requestId: string; token?: string },
) {
  const readOnly = Boolean(token);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [appointment, setAppointment] = useState<Appointment>(null);
  const [inputValue, setInputValue] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    let cancelled = false;
    const query = token
      ? `token=${encodeURIComponent(token)}`
      : `requestId=${encodeURIComponent(requestId)}`;
    (async () => {
      try {
        const response = await fetch(`/api/job-appointment?${query}`, { cache: "no-store" });
        const result = (await response.json().catch(() => ({}))) as AppointmentResponse;
        if (cancelled) return;
        if (!response.ok) throw new Error(result.error || "Unable to load the appointment.");
        const appt = result.appointment ?? null;
        setAppointment(appt);
        setInputValue(appt ? isoToLocalInput(appt.appointmentAt) : "");
        setNote(appt?.note ?? "");
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Unable to load the appointment.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [requestId, token]);

  async function submit(clear: boolean) {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const appointmentAt = clear || !inputValue ? "" : new Date(inputValue).toISOString();
      const response = await fetch("/api/job-appointment", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requestId, appointmentAt, note: clear ? "" : note.trim() }),
      });
      const result = (await response.json().catch(() => ({}))) as AppointmentResponse;
      if (!response.ok) throw new Error(result.error || "Unable to save the appointment.");
      const appt = result.appointment ?? null;
      setAppointment(appt);
      setInputValue(appt ? isoToLocalInput(appt.appointmentAt) : "");
      setNote(appt?.note ?? "");
      setNotice(appt ? "Time saved. Your customer can see it." : "Appointment cleared.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save the appointment.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="job-appointment-loading">Loading appointment…</p>;
  }

  if (readOnly) {
    if (!appointment) {
      return <p className="job-appointment-empty">No time is scheduled yet.</p>;
    }
    return (
      <div className="job-appointment job-appointment-readonly">
        <strong className="job-appointment-when">{formatAppointment(appointment.appointmentAt)}</strong>
        {appointment.note ? <p className="job-appointment-note">{appointment.note}</p> : null}
        <p className="job-appointment-hint">We&apos;ll email you a reminder before it.</p>
      </div>
    );
  }

  return (
    <div className="job-appointment job-appointment-editor">
      {error ? <p className="job-appointment-error">{error}</p> : null}
      {notice ? <p className="job-appointment-notice">{notice}</p> : null}
      <label className="job-appointment-field">
        Appointment date &amp; time
        <input
          type="datetime-local"
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
        />
      </label>
      <label className="job-appointment-field">
        Note for the customer (optional)
        <input
          type="text"
          maxLength={200}
          placeholder="e.g. I'll text when I'm 15 minutes out"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>
      <div className="job-appointment-actions">
        <button type="button" className="button lime small" disabled={saving || !inputValue} onClick={() => submit(false)}>
          {saving ? "Saving…" : appointment ? "Update time" : "Set time"}
        </button>
        {appointment ? (
          <button type="button" className="link-button danger" disabled={saving} onClick={() => submit(true)}>
            Clear appointment
          </button>
        ) : null}
      </div>
      <p className="job-appointment-hint">
        The customer sees this on their request and gets an automatic email reminder before it.
      </p>
    </div>
  );
}
