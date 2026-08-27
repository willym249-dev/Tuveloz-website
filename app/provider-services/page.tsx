"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BrandMark } from "../components/tuveloz-icons";

type CatalogItem = {
  id: string;
  service: string;
  priceType: string;
  startingPriceCents: number;
  maximumPriceCents: number;
  description: string;
  durationMinutes: number;
  active: string;
};

type Credential = {
  id: string;
  credentialName: string;
  issuingAuthority: string;
  credentialIdentifier: string;
  jurisdiction: string;
  expiresAt: string;
  status: string;
  reviewNote: string;
  publicDisplay: string;
};

type ToolsResponse = {
  provider: { id: string; name: string; approvedServices: string[] };
  priceTypes: Array<{ value: string; label: string }>;
  catalogItems: CatalogItem[];
  credentials: Credential[];
  credentialNotice: string;
  error?: string;
};

function priceLabel(item: CatalogItem) {
  if (item.priceType === "quote") return "Custom quote";
  const formatter = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  });
  const amount = formatter.format(item.startingPriceCents / 100);
  if (item.priceType === "starting_at") return `Starting at ${amount}`;
  if (item.priceType === "range") {
    const maximum = Math.max(item.maximumPriceCents, item.startingPriceCents);
    return `Typically ${amount}–${formatter.format(maximum / 100)}`;
  }
  if (item.priceType === "hourly") return `${amount} per hour`;
  return amount;
}

export default function ProviderServicesPage() {
  const [data, setData] = useState<ToolsResponse | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/provider-marketplace-tools", { cache: "no-store" });
    const result = await response.json().catch(() => ({})) as ToolsResponse;
    if (response.status === 401) {
      window.location.replace("/account?role=provider");
      return;
    }
    if (!response.ok) throw new Error(result.error || "Unable to load provider tools.");
    setData(result);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load().catch((reason) => setError(
        reason instanceof Error ? reason.message : "Unable to load provider tools.",
      ));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function submit(action: string, payload: Record<string, unknown>, success: string) {
    setBusy(action);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/provider-marketplace-tools", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      const result = await response.json().catch(() => ({})) as ToolsResponse;
      if (!response.ok) throw new Error(result.error || "Unable to save this provider setting.");
      setData(result);
      setNotice(success);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save this provider setting.");
    } finally {
      setBusy("");
    }
  }

  async function saveCatalog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    await submit("save-catalog-item", {
      service: values.service,
      priceType: values.priceType,
      startingPrice: values.startingPrice,
      maximumPrice: values.maximumPrice,
      durationMinutes: values.durationMinutes,
      description: values.description,
      active: values.active === "on",
    }, "Service and provider-set price saved.");
    form.reset();
  }

  async function addCredential(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    await submit("add-credential", values, "Credential submitted for Tuveloz review.");
    form.reset();
  }

  return (
    <main className="account-shell">
      <header className="account-header">
        <Link className="brand" href="/"><BrandMark /><span>Tuveloz</span></Link>
        <Link className="account-home-link" href="/provider-jobs">Provider workspace</Link>
      </header>
      <section className="account-main">
        <div className="account-welcome">
          <span className="account-kicker">Provider business tools</span>
          <h1>Services, prices, and credentials.</h1>
          <p>Pick from the services you are approved for and set your own prices.</p>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        {notice && <p className="portal-success" role="status">{notice}</p>}
        {!data && !error && <p className="admin-note">Loading provider business tools…</p>}
        {data && (
          <div className="account-grid">
            <section className="account-card">
              <div className="account-card-heading">
                <div><span className="account-role">Provider prices</span><h2>Add or update a service</h2></div>
                <span className="account-count">{data.catalogItems.length}</span>
              </div>
              <form onSubmit={saveCatalog}>
                <label>
                  Approved service
                  <select required name="service" defaultValue="">
                    <option disabled value="">Choose a service</option>
                    {data.provider.approvedServices.map((service) => <option key={service}>{service}</option>)}
                  </select>
                </label>
                <label>
                  Price type
                  <select required name="priceType" defaultValue="starting_at">
                    {data.priceTypes.map((type) => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Your price ($)
                  <input name="startingPrice" type="number" min="0" max="100000" step="0.01" placeholder="0.00" />
                  <small>Leave at 0 when the service requires a custom quote. This is your provider price, not a promise that every job will cost the same.</small>
                </label>
                <label>
                  Typical range maximum ($)
                  <input name="maximumPrice" type="number" min="0" max="100000" step="0.01" placeholder="0.00" />
                  <small>Only used with the Typical range price type. You set both ends yourself; your written quote still decides every job.</small>
                </label>
                <label>
                  How long it usually takes (minutes)
                  <input name="durationMinutes" type="number" min="0" max="10080" step="5" placeholder="60" />
                </label>
                <label>
                  What the price includes
                  <textarea name="description" maxLength={500} rows={4} placeholder="Example: Labor for a standard oil change. Oil and filter priced separately unless stated." />
                </label>
                <label>
                  <input name="active" type="checkbox" defaultChecked /> Show this service on my public page
                </label>
                <button className="button primary" disabled={busy === "save-catalog-item"} type="submit">
                  {busy === "save-catalog-item" ? "Saving…" : "Save service and price"}
                </button>
              </form>
              {data.catalogItems.length ? (
                <div className="account-request-list">
                  {data.catalogItems.map((item) => (
                    <article className="account-request" key={item.id}>
                      <span>
                        <strong>{item.service}</strong>
                        <small>{priceLabel(item)}{item.durationMinutes ? ` · about ${item.durationMinutes} minutes` : ""}</small>
                        <small>{item.description || "No public description added."}</small>
                      </span>
                      <button
                        className="button secondary"
                        disabled={busy === `remove-${item.id}`}
                        onClick={() => void submit(
                          "remove-catalog-item",
                          { id: item.id },
                          "Service price removed.",
                        )}
                        type="button"
                      >Remove</button>
                    </article>
                  ))}
                </div>
              ) : <p className="admin-note">No provider prices have been added yet.</p>}
            </section>

            <section className="account-card">
              <div className="account-card-heading">
                <div><span className="account-role">Credentials</span><h2>Add a license or credential</h2></div>
              </div>
              <p>{data.credentialNotice}</p>
              <form onSubmit={addCredential}>
                <label>Credential or license name<input required name="credentialName" maxLength={140} /></label>
                <label>Who issued it<input name="issuingAuthority" maxLength={160} /></label>
                <label>License or credential number<input name="credentialIdentifier" maxLength={120} /></label>
                <label>Where it applies<input name="jurisdiction" maxLength={120} placeholder="Maryland or Montgomery County" /></label>
                <label>Expiration date<input name="expiresAt" type="date" /></label>
                <button className="button primary" disabled={busy === "add-credential"} type="submit">
                  {busy === "add-credential" ? "Submitting…" : "Submit credential for review"}
                </button>
              </form>
              {data.credentials.length ? (
                <div className="account-request-list">
                  {data.credentials.map((credential) => (
                    <article className="account-request" key={credential.id}>
                      <span>
                        <strong>{credential.credentialName}</strong>
                        <small>Status: {credential.status}{credential.publicDisplay === "yes" ? " · shown publicly" : " · private"}</small>
                        <small>{credential.issuingAuthority || "Issuing authority not listed"}{credential.expiresAt ? ` · expires ${credential.expiresAt}` : ""}</small>
                        {credential.reviewNote && <small>Tuveloz note: {credential.reviewNote}</small>}
                      </span>
                      {credential.status !== "verified" && (
                        <button
                          className="button secondary"
                          onClick={() => void submit(
                            "remove-credential",
                            { id: credential.id },
                            "Credential removed.",
                          )}
                          type="button"
                        >Remove</button>
                      )}
                    </article>
                  ))}
                </div>
              ) : <p className="admin-note">No optional credentials submitted yet.</p>}
            </section>
          </div>
        )}
      </section>
    </main>
  );
}