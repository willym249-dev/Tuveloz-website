"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BrandMark } from "../components/tuveloz-icons";

type TrackingJob = {
  requestId: string;
  vehicle: string;
  service: string;
  requestStatus: string;
  providerName: string;
  customerName: string;
  sharing: boolean;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  sharedAt: string;
  expiresAt: string;
  updatedAt: string;
};

type TrackingResponse = {
  role: "customer" | "provider";
  email: string;
  jobs: TrackingJob[];
  privacy: string;
  error?: string;
};

function mapUrl(latitude: number, longitude: number) {
  const distance = 0.012;
  const bbox = [
    longitude - distance,
    latitude - distance,
    longitude + distance,
    latitude + distance,
  ].join(",");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${encodeURIComponent(`${latitude},${longitude}`)}`;
}

function dateLabel(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "Recently" : parsed.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function TrackingPage() {
  const [data, setData] = useState<TrackingResponse | null>(null);
  const [activeRequestId, setActiveRequestId] = useState("");
  const [trackingConsent, setTrackingConsent] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const watchIdRef = useRef<number | null>(null);
  const activeRequestRef = useRef("");
  const lastSentAtRef = useRef(0);

  const load = useCallback(async () => {
    const response = await fetch("/api/tracking", { cache: "no-store" });
    const result = await response.json().catch(() => ({})) as TrackingResponse;
    if (response.status === 401) {
      window.location.replace("/account");
      return;
    }
    if (!response.ok) throw new Error(result.error || "Unable to load tracking.");
    setData(result);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load().catch((reason) => setError(
        reason instanceof Error ? reason.message : "Unable to load tracking.",
      ));
    }, 0);
    const interval = window.setInterval(() => {
      void load().catch(() => undefined);
    }, 15_000);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
    };
  }, [load]);

  useEffect(() => () => {
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    if (activeRequestRef.current) {
      void fetch("/api/tracking", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "stop", requestId: activeRequestRef.current }),
        keepalive: true,
      });
    }
  }, []);

  async function postTracking(payload: Record<string, unknown>) {
    const response = await fetch("/api/tracking", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({})) as TrackingResponse;
    if (!response.ok) throw new Error(result.error || "Unable to update trip tracking.");
    setData(result);
  }

  async function sendPosition(requestId: string, position: GeolocationPosition) {
    const now = Date.now();
    if (now - lastSentAtRef.current < 10_000) return;
    lastSentAtRef.current = now;
    await postTracking({
      action: "share",
      requestId,
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      permissionAccepted: true,
    });
  }

  function startSharing(requestId: string) {
    setError("");
    setNotice("");
    if (!trackingConsent) {
      setError("Confirm the location-sharing choice before starting.");
      return;
    }
    if (!("geolocation" in navigator)) {
      setError("This browser does not provide GPS location sharing.");
      return;
    }
    if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    setBusy(requestId);
    activeRequestRef.current = requestId;
    setActiveRequestId(requestId);
    lastSentAtRef.current = 0;
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        void sendPosition(requestId, position).then(() => {
          setNotice("Your latest trip location is being shared with this customer.");
          setBusy("");
        }).catch((reason) => {
          setError(reason instanceof Error ? reason.message : "Unable to share this location.");
          setBusy("");
        });
      },
      (reason) => {
        setError(reason.message || "Location permission was not granted.");
        setBusy("");
        setActiveRequestId("");
        activeRequestRef.current = "";
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5_000,
        timeout: 15_000,
      },
    );
  }

  async function stopSharing(requestId: string) {
    setBusy(`stop-${requestId}`);
    setError("");
    try {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      await postTracking({ action: "stop", requestId });
      setActiveRequestId("");
      activeRequestRef.current = "";
      setTrackingConsent(false);
      setNotice("Location sharing stopped and the precise location was cleared.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to stop location sharing.");
    } finally {
      setBusy("");
    }
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
          <span className="account-kicker">Trip tracking & job status</span>
          <h1>{data?.role === "provider" ? "Share only when you choose." : "Follow the latest job update."}</h1>
          <p>
            {data?.role === "provider"
              ? "Your browser shares a current GPS point only while this page remains open and only for a job marked on my way."
              : "See whether the provider is on the way, has arrived, or marked your vehicle service complete."}
          </p>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        {notice && <p className="portal-success" role="status">{notice}</p>}
        {!data && !error && <p className="admin-note">Loading trip and job updates…</p>}
        {data && (
          <section className="account-card">
            <p>{data.privacy}</p>
            {data.role === "provider" && (
              <label>
                <input
                  checked={trackingConsent}
                  onChange={(event) => setTrackingConsent(event.target.checked)}
                  type="checkbox"
                />
                I choose to share my current location with the selected customer for this trip. I can stop at any time.
              </label>
            )}
            {data.jobs.length ? (
              <div className="account-request-list">
                {data.jobs.map((job) => (
                  <article className="account-request" key={job.requestId}>
                    <span>
                      <strong>{job.service} · {job.vehicle}</strong>
                      <small>Status: {job.requestStatus}</small>
                      <small>
                        {data.role === "provider"
                          ? `Customer: ${job.customerName}`
                          : `Provider: ${job.providerName}`}
                      </small>
                      {job.sharing && job.sharedAt && <small>Location updated {dateLabel(job.sharedAt)}</small>}
                    </span>
                    {data.role === "provider" ? (
                      job.requestStatus === "on my way" ? (
                        activeRequestId === job.requestId || job.sharing ? (
                          <button
                            className="button secondary"
                            disabled={busy === `stop-${job.requestId}`}
                            onClick={() => void stopSharing(job.requestId)}
                            type="button"
                          >
                            {busy === `stop-${job.requestId}` ? "Stopping…" : "Stop sharing"}
                          </button>
                        ) : (
                          <button
                            className="button primary"
                            disabled={!trackingConsent || busy === job.requestId}
                            onClick={() => startSharing(job.requestId)}
                            type="button"
                          >
                            {busy === job.requestId ? "Getting GPS…" : "Start sharing trip location"}
                          </button>
                        )
                      ) : (
                        <small>Mark the job “on my way” in the provider workspace to enable sharing.</small>
                      )
                    ) : job.requestStatus === "completed" ? (
                      <Link className="button primary" href={`/my-request?request=${encodeURIComponent(job.requestId)}`}>
                        Vehicle ready · view completion
                      </Link>
                    ) : job.sharing && job.latitude !== null && job.longitude !== null ? (
                      <div style={{ width: "100%" }}>
                        <iframe
                          allowFullScreen
                          aria-label={`Latest shared location for ${job.providerName}`}
                          height="260"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          src={mapUrl(job.latitude, job.longitude)}
                          style={{ border: 0, borderRadius: "1rem", width: "100%" }}
                          title="Latest provider location"
                        />
                        <small>
                          Latest point only{job.accuracy ? ` · device accuracy about ${Math.round(job.accuracy)} meters` : ""}.
                          This is not a guaranteed route or arrival time.
                        </small>
                      </div>
                    ) : (
                      <small>
                        {job.requestStatus === "on my way"
                          ? "The provider has not shared a current GPS point, or the latest point expired."
                          : "Location is available only while the provider is on the way and chooses to share."}
                      </small>
                    )}
                  </article>
                ))}
              </div>
            ) : <p className="admin-note">No accepted jobs are available for tracking yet.</p>}
          </section>
        )}
      </section>
    </main>
  );
}