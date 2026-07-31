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
  promotion: null | {
    status: string;
    requestId: string;
    redeemedAt: string;
  };
  error?: string;
};

function dateLabel(value: string) {
  const date = new Date(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);
  return Number.isNaN(date.getTime()) ? "Recently" : date.toLocaleString();
}

export default function NotificationsPage() {
  const [data, setData] = useState<NotificationResponse | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/notifications", { cache: "no-store" });
    const result = await response.json().catch(() => ({})) as NotificationResponse;
    if (response.status === 401) {
      window.location.replace("/account");
      return;
    }
    if (!response.ok) throw new Error(result.error || "Unable to load notifications.");
    setData(result);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load().catch((reason) => setError(
        reason instanceof Error ? reason.message : "Unable to load notifications.",
      ));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function markAllRead() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/notifications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "mark-all-read" }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Unable to update notifications.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to update notifications.");
    } finally {
      setBusy(false);
    }
  }

  async function markRead(id: string) {
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "mark-read", id }),
    });
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
          <h1>Updates that matter.</h1>
          <p>Appointments, trip sharing, job progress, completion, account notices, and offers appear here.</p>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        {!data && !error && <p className="admin-note">Loading notifications…</p>}
        {data && (
          <section className="account-card">
            <div className="account-card-heading">
              <div><span className="account-role">{data.email}</span><h2>Notifications</h2></div>
              <span className="account-count">{data.unreadCount}</span>
            </div>
            {data.role === "customer" && data.promotion && (
              <article className="account-request">
                <span>
                  <strong>First oil-change Tuveloz fee offer</strong>
                  <small>Status: {data.promotion.status}. Only the Tuveloz customer service fee is waived; provider and other charges still apply.</small>
                </span>
                <Link href="/first-oil-change">Offer details</Link>
              </article>
            )}
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
                      <Link href={item.href} onClick={() => void markRead(item.id)}>Open</Link>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : <p className="admin-note">No notifications yet.</p>}
            {data.unreadCount > 0 && (
              <button className="button secondary" disabled={busy} onClick={markAllRead} type="button">
                {busy ? "Updating…" : "Mark all as read"}
              </button>
            )}
          </section>
        )}
      </section>
    </main>
  );
}