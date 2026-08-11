"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type JobMessage = {
  id: string;
  senderRole: "customer" | "provider";
  mine: boolean;
  body: string;
  image?: { status: string; viewable: boolean } | null;
  createdAt: string;
};

type Conversation = {
  requestId: string;
  vehicle: string;
  service: string;
  status: string;
  otherParty: string;
  messages: JobMessage[];
};

function messageTime(value: string) {
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
    ? `${value.replace(" ", "T")}Z`
    : value;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime())
    ? "Time unavailable"
    : date.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
}

export function JobMessages({ audience }: { audience: "customer" | "provider" }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const loadMessages = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/messages", { cache: "no-store" });
      const result = await response.json() as { conversations?: Conversation[]; error?: string };
      if (!response.ok) throw new Error(result.error || "Unable to load messages.");
      const next = result.conversations ?? [];
      setConversations(next);
      setSelectedId((current) => next.some((item) => item.requestId === current)
        ? current
        : next[0]?.requestId ?? "");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load messages.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadMessages();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadMessages]);

  const selected = useMemo(
    () => conversations.find((item) => item.requestId === selectedId) ?? null,
    [conversations, selectedId],
  );

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    const body = String(formData.get("message") ?? "").trim();
    const image = formData.get("image");
    const hasImage = image instanceof File && image.size > 0;
    if (!body && !hasImage) return;
    setSending(true);
    setError("");
    try {
      // Multipart so an optional photo can ride along. The browser sets the
      // content-type boundary — do not set it by hand.
      const payload = new FormData();
      payload.set("requestId", selected.requestId);
      payload.set("body", body);
      if (hasImage) payload.set("image", image);
      const response = await fetch("/api/messages", { method: "POST", body: payload });
      const result = await response.json() as { message?: JobMessage; error?: string };
      if (!response.ok || !result.message) {
        throw new Error(result.error || "Unable to send your message.");
      }
      setConversations((items) => items.map((conversation) => (
        conversation.requestId === selected.requestId
          ? { ...conversation, messages: [...conversation.messages, result.message as JobMessage] }
          : conversation
      )));
      form.reset();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to send your message.");
    } finally {
      setSending(false);
    }
  }

  if (loading) return <p className="admin-note">Loading job messages…</p>;

  return (
    <div className="job-messages-panel">
      <div className="job-messages-heading">
        <div>
          <strong>Job messages</strong>
          <span>Available in this workspace to the customer and accepted provider for each job.</span>
        </div>
        <button className="button secondary" onClick={() => void loadMessages()} type="button">
          Refresh
        </button>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {conversations.length === 0 ? (
        <div className="account-empty">
          <strong>No job conversations yet</strong>
          <span>Messages become available after a customer accepts a provider quote.</span>
        </div>
      ) : (
        <div className="job-messages-layout">
          <div className="job-message-threads" aria-label="Job conversations">
            {conversations.map((conversation) => (
              <button
                aria-pressed={selectedId === conversation.requestId}
                className={selectedId === conversation.requestId ? "is-active" : ""}
                key={conversation.requestId}
                onClick={() => setSelectedId(conversation.requestId)}
                type="button"
              >
                <strong>{conversation.otherParty}</strong>
                <span>{conversation.service} · {conversation.vehicle}</span>
                <small>{conversation.status}</small>
              </button>
            ))}
          </div>
          {selected && (
            <section className="job-message-thread" aria-live="polite">
              <header>
                <div>
                  <strong>{selected.otherParty}</strong>
                  <span>{selected.service} · {selected.vehicle}</span>
                </div>
                <small>{selected.status}</small>
              </header>
              <div className="job-message-list">
                {selected.messages.length === 0 ? (
                  <p className="admin-note">No messages in this job yet.</p>
                ) : selected.messages.map((message) => (
                  <article className={message.mine ? "is-mine" : ""} key={message.id}>
                    <span>{message.mine ? "You" : selected.otherParty}</span>
                    {message.body ? <p>{message.body}</p> : null}
                    {message.image ? (
                      message.image.viewable ? (
                        // eslint-disable-next-line @next/next/no-img-element -- This authenticated no-store image must not pass through an optimizer cache.
                        <img
                          className="job-message-image"
                          src={`/api/message-image?requestId=${encodeURIComponent(selected.requestId)}&messageId=${encodeURIComponent(message.id)}`}
                          alt="Shared photo"
                          referrerPolicy="no-referrer"
                        />
                      ) : message.image.status === "blocked" ? (
                        <span className="job-message-image-note blocked">Photo couldn&apos;t be shared — it didn&apos;t pass a safety check.</span>
                      ) : (
                        <span className="job-message-image-note">🔍 Photo is being checked — it&apos;ll appear once it clears.</span>
                      )
                    ) : null}
                    <small>{messageTime(message.createdAt)}</small>
                  </article>
                ))}
              </div>
              <form className="job-message-form" onSubmit={sendMessage}>
                <label>
                  Message {audience === "customer" ? "your provider" : "the customer"}
                  <textarea
                    maxLength={1000}
                    name="message"
                    placeholder="Keep messages focused on this job, timing, and service details."
                    rows={3}
                  />
                </label>
                <label className="job-message-attach">
                  <span>Add a photo (optional)</span>
                  <input type="file" name="image" accept="image/jpeg,image/png,image/webp" />
                  <small>JPG, PNG, or WebP · up to 8 MB. Photos are safety-checked before they appear.</small>
                </label>
                <button className="button primary" disabled={sending} type="submit">
                  {sending ? "Sending…" : "Send message"}
                </button>
                <small>Do not share passwords, payment-card details, or unrelated sensitive information. Tuveloz stores messages and may review them for support, safety, privacy, payment, or legal issues under the <a href="/privacy">Privacy Policy</a>.</small>
              </form>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
