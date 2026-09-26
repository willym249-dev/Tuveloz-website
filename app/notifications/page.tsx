"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BrandMark } from "../components/tuveloz-icons";

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  href: string;
  readAt: string;
  createdAt: string;
};

type NotificationResponse = {
  role: "customer" | "provider";
  email: string;
  notifications: NotificationItem[];
  unreadCount: number;
  error?: string;
};

async function notificationRequest(init?: RequestInit) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch("/api/notifications", {
      ...init, cache: "no-store", signal: controller.signal,
    });
    if (response.status === 401) {
      window.location.replace("/account");
      throw new Error("Please sign in again to view your notifications.");
    }
    const result: unknown = await response.json().catch(() => null);
    if (!response.ok || !result || typeof result !== "object") {
      throw new Error(init?.method === "POST"
        ? "We couldn’t confirm the update. Refresh your notifications to check their status."
        : "We couldn’t load your notifications. Please try again.");
    }
    return result;
  } catch (reason) {
    if (controller.signal.aborted) throw new Error("This is taking longer than expected. Please try again.");
    if (reason instanceof TypeError) throw new Error("We couldn’t connect. Check your connection and try again.");
    throw reason;
  } finally { window.clearTimeout(timeout); }
}

function isNotificationResponse(value: unknown): value is NotificationResponse {
  if (!value || typeof value !== "object") return false;
  const result = value as NotificationResponse;
  return (result.role === "customer" || result.role === "provider")
    && typeof result.email === "string" && Number.isInteger(result.unreadCount) && result.unreadCount >= 0
    && Array.isArray(result.notifications) && result.notifications.every(item => item && (
      [item.id, item.title, item.body, item.href, item.readAt, item.createdAt].every(field => typeof field === "string")
    ));
}

function dateLabel(value: string) {
  const date = new Date(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);
  return Number.isNaN(date.getTime()) ? "Recently" : date.toLocaleString();
}

export default function NotificationsPage() {
  const [data, setData] = useState<NotificationResponse | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState<"refresh" | "mark" | null>("refresh");

  const load = useCallback(async () => {
    const result = await notificationRequest();
    if (!isNotificationResponse(result)) throw new Error("We couldn’t load your notifications. Please try again.");
    setData(result);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load().catch((reason) => setError(
        reason instanceof Error ? reason.message : "Unable to load notifications.",
      )).finally(() => setBusy(null));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function refresh() {
    if (busy) return;
    setBusy("refresh");
    setError("");
    try { await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "We couldn’t refresh your notifications. Please try again."); }
    finally { setBusy(null); }
  }

  async function markAllRead() {
    if (busy) return;
    setBusy("mark");
    setError("");
    setStatus("");
    try {
      const result = await notificationRequest({
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "mark-all-read" }),
      });
      if (!("ok" in result) || result.ok !== true || ("error" in result && result.error)) {
        throw new Error("We couldn’t confirm the update. Refresh your notifications to check their status.");
      }
      // The write has succeeded even if the subsequent list request fails.
      const readAt = new Date().toISOString();
      setData(current => current ? { ...current, unreadCount: 0,
        notifications: current.notifications.map(item => ({ ...item, readAt: item.readAt || readAt })),
      } : current);
      setStatus("Notifications marked as read.");
      try { await load(); }
      catch { setError("Your notifications are marked as read, but we couldn’t refresh the list. Please refresh to check for new updates."); }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to update notifications.");
    } finally {
      setBusy(null);
    }
  }

  function markRead(id: string) {
    // Opening the destination must not wait for a bookkeeping request. Keep it
    // alive during navigation; on failure the notice remains unread on return.
    void fetch("/api/notifications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "mark-read", id }),
      keepalive: true,
    }).catch(() => {});
  }

  return (
    <main className="account-shell">
      <header className="account-header">
        <Link className="brand" href="/"><BrandMark /><span>Tuveloz</span></Link>
        <Link className="account-home-link" href={data?.role === "provider" ? "/provider-jobs" : "/customer"}>
          Back to workspace
        </Link>
      </header>
      <section className="account-main">
        <div className="account-welcome">
          <span className="account-kicker">Account notifications</span>
          <h1>Your account updates.</h1>
          <p>Find account notices and updates about your activity here.</p>
        </div>
        {status && <p className="form-success" role="status">{status}</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
        {!data && busy && <p className="admin-note">Loading notifications…</p>}
        <button className="button secondary" disabled={!!busy} onClick={refresh} type="button">
          {busy === "refresh" ? "Refreshing…" : "Refresh notifications"}
        </button>
        {data && (
          <section className="account-card">
            <div className="account-card-heading">
              <div><span className="account-role">{data.email}</span><h2>Notifications</h2></div>
              <span className="account-count">{data.unreadCount}</span>
            </div>
            {data.notifications.length ? (
              <div className="account-request-list">
                {data.notifications.map((item) => (
                  <article className="account-request" key={item.id}>
                    <span>
                      <strong>{item.readAt ? item.title : `New · ${item.title}`}</strong>
                      <small>{item.body}</small>
                      <small>{dateLabel(item.createdAt)}</small>
                    </span>
                    {item.href ? (
                      <Link href={item.href} aria-label={`Open: ${item.title}`} onClick={() => markRead(item.id)}>Open</Link>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : <p className="admin-note">No notifications yet.</p>}
            {data.unreadCount > 0 && (
              <button className="button secondary" disabled={!!busy} onClick={markAllRead} type="button">
                {busy === "mark" ? "Updating…" : "Mark all as read"}
              </button>
            )}
          </section>
        )}
      </section>
    </main>
  );
}
