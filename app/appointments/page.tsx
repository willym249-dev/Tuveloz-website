"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BrandMark } from "../components/tuveloz-icons";

type Appointment = {
  id: string;
  requestId: string;
  providerId: string;
  providerName: string;
  customerName: string;
  service: string;
  requestedByRole: "customer" | "provider";
  startsAt: string;
  confirmedStartAt: string;
  note: string;
  status: string;
};

type RequestOption = {
  id: string;
  vehicle: string;
  service: string;
  status: string;
  customerName: string;
};

type ProviderOption = {
  id: string;
  name: string;
  services: string[];
};

type AppointmentResponse = {
  role: "customer" | "provider";
  email: string;
  provider?: { id: string; name: string };
  appointments: Appointment[];
  requestOptions: RequestOption[];
  providers: ProviderOption[];
  error?: string;
};

function dateLabel(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

export default function AppointmentsPage() {
  const searchParams = useSearchParams();
  const initialProviderId = searchParams.get("provider") ?? "";
  const initialService = searchParams.get("service") ?? "";
  const initialRequestId = searchParams.get("request") ?? "";
  const [data, setData] = useState<AppointmentResponse | null>(null);
  const [selectedProviderId, setSelectedProviderId] = useState(initialProviderId);
  const [selectedService, setSelectedService] = useState(initialService);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/appointments", { cache: "no-store" });
    const result = await response.json().catch(() => ({})) as AppointmentResponse;
    if (response.status === 401) {
      window.location.replace("/account");
      return;
    }
    if (!response.ok) throw new Error(result.error || "Unable to load appointments.");
    setData(result);
    if (result.role === "customer" && !selectedProviderId && result.providers[0]) {
      setSelectedProviderId(result.providers[0].id);
      setSelectedService(result.providers[0].services[0] ?? "");
    }
  }, [selectedProviderId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load().catch((reason) => setError(
        reason instanceof Error ? reason.message : "Unable to load appointments.",
      ));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const selectedProvider = useMemo(
    () => data?.providers.find((provider) => provider.id === selectedProviderId) ?? null,
    [data?.providers, selectedProviderId],
  );

  async function submit(payload: Record<string, unknown>, success: string) {
    const actionKey = `${payload.action ?? "action"}-${payload.id ?? "new"}`;
    setBusy(actionKey);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/appointments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({})) as AppointmentResponse;
      if (!response.ok) throw new Error(result.error || "Unable to update this appointment.");
      setData(result);
      setNotice(success);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to update this appointment.");
    } finally {
      setBusy("");
    }
  }

  async function createAppointment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data) return;
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    await submit({
      action: "create",
      providerId: data.role === "customer" ? selectedProviderId : undefined,
      service: data.role === "customer" ? selectedService : undefined,
      requestId: data.role === "provider" ? values.requestId : values.requestId || "",
      startsAt: values.startsAt,
      note: values.note,
    }, "Appointment request sent.");
    form.reset();
  }

  const workspaceHref = data?.role === "provider" ? "/provider-jobs" : "/customer";

  return (
    <main className="account-shell">
      <header className="account-header">
        <Link className="brand" href="/"><BrandMark /><span>Tuveloz</span></Link>
        <Link className="account-home-link" href={workspaceHref}>Back to workspace</Link>
      </header>
      <section className="account-main">
        <div className="account-welcome">
          <span className="account-kicker">Appointments</span>
          <h1>Request and confirm a time.</h1>
          <p>Either the customer or selected provider may send an appointment request. The other person must confirm it.</p>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        {notice && <p className="portal-success" role="status">{notice}</p>}
        {!data && !error && <p className="admin-note">Loading appointments…</p>}
        {data && (
          <div className="account-grid">
            <section className="account-card">
              <div className="account-card-heading">
                <div>
                  <span className="account-role">{data.role === "provider" ? "Provider request" : "Customer request"}</span>
                  <h2>Request an appointment</h2>
                </div>
              </div>
              <form onSubmit={createAppointment}>
                {data.role === "customer" ? (
                  <>
                    <label>
                      Provider
                      <select
                        required
                        value={selectedProviderId}
                        onChange={(event) => {
                          const provider = data.providers.find((item) => item.id === event.target.value);
                          setSelectedProviderId(event.target.value);
                          setSelectedService(provider?.services[0] ?? "");
                        }}
                      >
                        <option disabled value="">Choose a provider</option>
                        {data.providers.map((provider) => (
                          <option key={provider.id} value={provider.id}>{provider.name}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Service
                      <select
                        required
                        value={selectedService}
                        onChange={(event) => setSelectedService(event.target.value)}
                      >
                        <option disabled value="">Choose a service</option>
                        {(selectedProvider?.services ?? []).map((service) => (
                          <option key={service}>{service}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Link to one of your requests (optional)
                      <select name="requestId" defaultValue="">
                        <option value="">No linked request</option>
                        {data.requestOptions.map((request) => (
                          <option key={request.id} value={request.id}>
                            {request.service} · {request.vehicle}
                          </option>
                        ))}
                      </select>
                    </label>
                  </>
                ) : (
                  <label>
                    Accepted customer job
                    <select required name="requestId" defaultValue={initialRequestId}>
                      <option disabled value="">Choose an accepted job</option>
                      {data.requestOptions.map((request) => (
                        <option key={request.id} value={request.id}>
                          {request.customerName} · {request.service} · {request.vehicle}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label>
                  Requested date and time
                  <input required name="startsAt" type="datetime-local" />
                </label>
                <label>
                  Note (optional)
                  <textarea name="note" rows={4} maxLength={800} placeholder="Timing details, arrival window, or what should be ready before the appointment" />
                </label>
                <button className="button primary" disabled={busy === "create-new"} type="submit">
                  {busy === "create-new" ? "Sending…" : "Send appointment request"}
                </button>
              </form>
            </section>

            <section className="account-card">
              <div className="account-card-heading">
                <div><span className="account-role">Schedule</span><h2>Your appointments</h2></div>
                <span className="account-count">{data.appointments.length}</span>
              </div>
              {data.appointments.length ? (
                <div className="account-request-list">
                  {data.appointments.map((appointment) => {
                    const receivedRequest = appointment.requestedByRole !== data.role;
                    const time = appointment.confirmedStartAt || appointment.startsAt;
                    return (
                      <article className="account-request" key={appointment.id}>
                        <span>
                          <strong>{appointment.service}</strong>
                          <small>{dateLabel(time)} · {appointment.status}</small>
                          <small>
                            {data.role === "provider"
                              ? `Customer: ${appointment.customerName}`
                              : `Provider: ${appointment.providerName}`}
                          </small>
                          {appointment.note && <small>{appointment.note}</small>}
                        </span>
                        {appointment.status === "requested" && receivedRequest ? (
                          <span>
                            <button
                              className="button primary"
                              disabled={Boolean(busy)}
                              onClick={() => void submit(
                                { action: "respond", id: appointment.id, status: "confirmed" },
                                "Appointment confirmed.",
                              )}
                              type="button"
                            >Confirm</button>
                            <button
                              className="button secondary"
                              disabled={Boolean(busy)}
                              onClick={() => void submit(
                                { action: "respond", id: appointment.id, status: "declined" },
                                "Appointment declined.",
                              )}
                              type="button"
                            >Decline</button>
                          </span>
                        ) : appointment.status === "requested" ? (
                          <button
                            className="button secondary"
                            disabled={Boolean(busy)}
                            onClick={() => void submit(
                              { action: "respond", id: appointment.id, status: "cancelled" },
                              "Appointment request cancelled.",
                            )}
                            type="button"
                          >Cancel request</button>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              ) : <p className="admin-note">No appointments yet.</p>}
            </section>
          </div>
        )}
      </section>
    </main>
  );
}