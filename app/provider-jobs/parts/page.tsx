"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SiteLanguageButton } from "../../components/site-language";
import { BrandMark } from "../../components/tuveloz-icons";

type PartItem = {
  id: string;
  description: string;
  spec: string;
  quantity: string;
  notes: string;
};

type AccountSummary = {
  role?: "customer" | "provider";
  email?: string;
};

const STORAGE_KEY = "tuveloz-provider-parts-checklist-v1";

// Example rows the provider edits. Kept generic on purpose — this tool
// describes the customer-supplied part so the customer can buy the right one
// themselves. Tuveloz never sells, sources, prices, links to, verifies, or
// reimburses parts, so there are deliberately no store links or prices here.
const DEFAULT_PARTS: PartItem[] = [
  {
    id: "example-1",
    description: "Front brake pads",
    spec: "Exact year, make, model, and trim — plus the part number if you have it",
    quantity: "1 set",
    notes: "Confirm the fitment matches the VIN before you buy.",
  },
  {
    id: "example-2",
    description: "Engine oil filter",
    spec: "Filter that matches the engine on the VIN",
    quantity: "1",
    notes: "Bring the oil separately if the job includes an oil change.",
  },
];

function parseStoredParts(value: string | null): PartItem[] | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0 || parsed.length > 20) return null;
    const items = parsed.map((item) => {
      if (!item || typeof item !== "object") return null;
      const candidate = item as Partial<PartItem>;
      if (
        typeof candidate.id !== "string"
        || typeof candidate.description !== "string"
        || typeof candidate.spec !== "string"
        || typeof candidate.quantity !== "string"
        || typeof candidate.notes !== "string"
      ) {
        return null;
      }
      return {
        id: candidate.id.slice(0, 80),
        description: candidate.description.slice(0, 120),
        spec: candidate.spec.slice(0, 180),
        quantity: candidate.quantity.slice(0, 40),
        notes: candidate.notes.slice(0, 300),
      };
    });
    return items.every(Boolean) ? (items as PartItem[]) : null;
  } catch {
    return null;
  }
}

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const field = document.createElement("textarea");
  field.value = value;
  field.setAttribute("readonly", "true");
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.appendChild(field);
  field.select();
  const copied = document.execCommand("copy");
  field.remove();
  if (!copied) throw new Error("Copy was blocked by this browser.");
}

function makeId() {
  // Time/random are fine here — this is a client-only local draft key, never
  // persisted server-side, so uniqueness within one browser is all that matters.
  return `part-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

function checklistText(parts: PartItem[]) {
  const lines = parts
    .filter((part) => part.description.trim())
    .map((part, index) => {
      const bits = [`${index + 1}. ${part.description.trim()}`];
      if (part.spec.trim()) bits.push(`   Spec: ${part.spec.trim()}`);
      if (part.quantity.trim()) bits.push(`   Quantity: ${part.quantity.trim()}`);
      if (part.notes.trim()) bits.push(`   Notes: ${part.notes.trim()}`);
      return bits.join("\n");
    });
  return [
    "Parts to have ready for our appointment:",
    "",
    ...lines,
    "",
    "Please buy these yourself and have them with you at the appointment. I don't",
    "supply, sell, or charge for parts — the quote covers labor only. If anything is",
    "unclear, message me before you buy so we get the exact fit.",
  ].join("\n");
}

export default function ProviderPartsChecklistPage() {
  const [parts, setParts] = useState<PartItem[]>(DEFAULT_PARTS);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [copying, setCopying] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch("/api/account", { cache: "no-store" });
        const account = await response.json().catch(() => ({})) as AccountSummary & { error?: string };
        if (response.status === 401) {
          window.location.replace("/account?role=provider");
          return;
        }
        if (!response.ok) throw new Error(account.error || "Unable to verify your provider account.");
        if (account.role !== "provider") {
          window.location.replace("/customer");
          return;
        }
        setEmail(account.email ?? "");
        const stored = parseStoredParts(window.localStorage.getItem(STORAGE_KEY));
        if (stored) setParts(stored);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Unable to load the parts checklist.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  function updatePart(id: string, field: keyof Omit<PartItem, "id">, value: string) {
    setNotice("");
    setParts((current) => current.map((part) => (
      part.id === id ? { ...part, [field]: value } : part
    )));
  }

  function addPart() {
    setNotice("");
    setError("");
    setParts((current) => {
      if (current.length >= 20) {
        setError("You can keep up to 20 parts in a checklist.");
        return current;
      }
      return [...current, { id: makeId(), description: "", spec: "", quantity: "", notes: "" }];
    });
  }

  function removePart(id: string) {
    setNotice("");
    setParts((current) => current.filter((part) => part.id !== id));
  }

  function saveParts() {
    setError("");
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(parts));
      setNotice("Checklist saved on this browser and device.");
    } catch {
      setError("This browser could not save the checklist. You can still copy and send it during this visit.");
    }
  }

  function resetParts() {
    setParts(DEFAULT_PARTS.map((part) => ({ ...part })));
    setNotice("Example checklist restored. Select “Save on this device” to keep your edits.");
  }

  async function copyChecklist() {
    setCopying(true);
    setError("");
    setNotice("");
    try {
      if (!parts.some((part) => part.description.trim())) {
        throw new Error("Add at least one part description before copying.");
      }
      await copyText(checklistText(parts));
      setNotice("Checklist copied. Paste it into a message to your customer.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to copy the checklist.");
    } finally {
      setCopying(false);
    }
  }

  return (
    <main className="account-shell">
      <header className="account-header">
        <Link className="brand" href="/" aria-label="Tuveloz home">
          <BrandMark />
          <span>Tuveloz</span>
        </Link>
        <div className="account-header-actions">
          <SiteLanguageButton />
          <Link className="account-home-link" href="/provider-jobs">Provider workspace</Link>
        </div>
      </header>

      <section className="account-main">
        <div className="account-welcome">
          <span className="account-kicker">Provider-controlled business tools</span>
          <h1>Parts checklist.</h1>
          <p>
            Spell out the exact customer-supplied part before the appointment, so your
            customer shows up with the right one and a wrong part never wastes your trip.
          </p>
          <p className="admin-note">
            Tuveloz quotes and payments are labor only. Tuveloz doesn&apos;t sell, source,
            price, link to, verify, or reimburse parts — the customer buys the part
            separately and brings it. Use this only to describe the part they need.
          </p>
          <p className="admin-note">
            Tuveloz is currently open for provider onboarding only. This private checklist
            is a preparation tool; it does not activate a service or let anyone view, quote,
            accept, start, complete, or receive payment for a real job.
          </p>
          {email && <small>Signed in as {email}</small>}
        </div>

        {error && <p className="form-error account-login-message" role="alert">{error}</p>}
        {notice && <p className="portal-success account-login-message" role="status">{notice}</p>}
        {loading ? (
          <p className="admin-note account-loading">Loading your parts checklist…</p>
        ) : (
          <div className="account-grid">
            <section className="account-card">
              <div className="account-card-heading">
                <div>
                  <span className="account-role">How this works</span>
                  <h2>Describe it, save it, send it.</h2>
                </div>
              </div>
              <p>
                List each part by what it is, the fitment detail that gets the right one
                (year, make, model, trim, or a part number), how many, and any note. Copy
                the plain-text checklist and send it to your customer so the part is in
                hand before you arrive.
              </p>
              <p className="admin-note">
                Saved checklists stay only in this browser on this device. Don&apos;t put
                customer names, addresses, payment details, or other private information
                in a reusable checklist.
              </p>
              <div className="hero-actions">
                <button className="button primary" onClick={saveParts} type="button">
                  Save on this device
                </button>
                <button className="button secondary" onClick={resetParts} type="button">
                  Restore example
                </button>
                <button
                  className="button lime"
                  disabled={copying}
                  onClick={() => void copyChecklist()}
                  type="button"
                >
                  {copying ? "Copying…" : "Copy checklist to send"}
                </button>
              </div>
            </section>

            {parts.map((part, index) => (
              <section className="account-card" key={part.id}>
                <div className="account-card-heading">
                  <div>
                    <span className="account-role">Part {index + 1}</span>
                    <h2>{part.description.trim() || "New part"}</h2>
                  </div>
                  <button
                    className="button secondary"
                    onClick={() => removePart(part.id)}
                    type="button"
                  >
                    Remove
                  </button>
                </div>
                <label>
                  What is the part?
                  <input
                    maxLength={120}
                    onChange={(event) => updatePart(part.id, "description", event.target.value)}
                    placeholder="Example: Front brake pads"
                    value={part.description}
                  />
                </label>
                <label>
                  Fitment detail to get the right one
                  <input
                    maxLength={180}
                    onChange={(event) => updatePart(part.id, "spec", event.target.value)}
                    placeholder="Year, make, model, trim — or a part number"
                    value={part.spec}
                  />
                </label>
                <label>
                  Quantity
                  <input
                    maxLength={40}
                    onChange={(event) => updatePart(part.id, "quantity", event.target.value)}
                    placeholder="Example: 1 set"
                    value={part.quantity}
                  />
                </label>
                <label>
                  Notes for the customer
                  <textarea
                    maxLength={300}
                    onChange={(event) => updatePart(part.id, "notes", event.target.value)}
                    placeholder="Example: Confirm the fitment matches the VIN before buying."
                    rows={3}
                    value={part.notes}
                  />
                </label>
              </section>
            ))}

            <section className="account-card">
              <div className="account-card-heading">
                <div>
                  <span className="account-role">Add another</span>
                  <h2>Need more parts on the list?</h2>
                </div>
              </div>
              <p>Add a row for each part the customer needs to have ready.</p>
              <div className="hero-actions">
                <button className="button primary" onClick={addPart} type="button">
                  Add a part
                </button>
              </div>
            </section>

            <section className="account-card">
              <div className="account-card-heading">
                <div>
                  <span className="account-role">Connected provider tools</span>
                  <h2>Finish the quote and set the appointment.</h2>
                </div>
              </div>
              <p>
                The checklist describes the customer-supplied part only. Set labor, scope,
                and timing in your quote and appointment — additional work or charges always
                need a separate accepted authorization.
              </p>
              <div className="hero-actions">
                <Link className="button primary" href="/provider-jobs">Return to provider workspace</Link>
                <Link className="button secondary" href="/provider-jobs/toolkit">Quote templates</Link>
                <Link className="button secondary" href="/appointments">Appointments</Link>
              </div>
            </section>
          </div>
        )}
      </section>
    </main>
  );
}
