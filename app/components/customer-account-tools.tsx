"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { parseProviderServices } from "../../lib/service-matching";

type CustomerProfile = {
  email: string;
  displayName: string;
};

type CustomerProvider = {
  id: string;
  name: string;
  service: string;
  serviceArea: string;
  publicSlug: string;
};

type CustomerTools = {
  profile: CustomerProfile;
  providerChoices: CustomerProvider[];
  savedProviders: CustomerProvider[];
};

export function CustomerAccountTools({ view }: { view: "saved" | "settings" }) {
  const [data, setData] = useState<CustomerTools | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/customer-tools", { cache: "no-store" });
      const result = await response.json() as CustomerTools & { error?: string };
      if (!response.ok) throw new Error(result.error || "Unable to load customer settings.");
      setData(result);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load customer settings.");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const savedIds = useMemo(
    () => new Set(data?.savedProviders.map((provider) => provider.id) ?? []),
    [data],
  );
  const available = data?.providerChoices.filter((provider) => !savedIds.has(provider.id)) ?? [];

  async function updateProvider(providerId: string, action: "save-provider" | "remove-provider") {
    setBusyId(providerId);
    setError("");
    try {
      const response = await fetch("/api/customer-tools", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, providerId }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Unable to update saved providers.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to update saved providers.");
    } finally {
      setBusyId("");
    }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    setBusyId("profile");
    setSaved(false);
    setError("");
    try {
      const response = await fetch("/api/customer-tools", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "save-profile",
          displayName: values.displayName,
        }),
      });
      const result = await response.json() as { profile?: CustomerProfile; error?: string };
      if (!response.ok || !result.profile) {
        throw new Error(result.error || "Unable to save your profile.");
      }
      setData((current) => current ? { ...current, profile: result.profile as CustomerProfile } : current);
      setSaved(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save your profile.");
    } finally {
      setBusyId("");
    }
  }

  if (!data && !error) return <p className="admin-note">Loading customer settings…</p>;

  if (view === "settings") {
    return (
      <div className="customer-settings-panel">
        {error && <p className="form-error" role="alert">{error}</p>}
        {data && (
          <form className="customer-profile-form" key={`${data.profile.email}-${data.profile.displayName}`} onSubmit={saveProfile}>
            <label>
              Account email
              <input disabled readOnly value={data.profile.email} />
              <small>Your verified sign-in address cannot be changed here.</small>
            </label>
            <label>
              Display name
              <input defaultValue={data.profile.displayName} maxLength={80} name="displayName" required />
              <small>Used in your Tuveloz customer workspace and job communication.</small>
            </label>
            <button className="button primary" disabled={busyId === "profile"} type="submit">
              {busyId === "profile" ? "Saving…" : "Save profile"}
            </button>
            {saved && <p className="portal-success">✓ Profile saved</p>}
          </form>
        )}
        <div className="customer-security-note">
          <strong>Password and account security</strong>
          <p>Password changes require a fresh email verification code. Sign out, return to sign in, and choose “Forgot password?” when you need to change it.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="saved-provider-panel">
      {error && <p className="form-error" role="alert">{error}</p>}
      <p className="customer-tool-explainer">
        Save verified providers who have sent a quote on one of your Tuveloz requests.
      </p>
      <section>
        <h3>Saved providers</h3>
        {!data || data.savedProviders.length === 0 ? (
          <div className="account-empty">
            <strong>No saved providers yet</strong>
            <span>Eligible providers from your quote history will appear below.</span>
          </div>
        ) : (
          <div className="saved-provider-grid">
            {data.savedProviders.map((provider) => (
              <article key={provider.id}>
                <span className="verified-badge">✓ Tuveloz verified</span>
                <h3>{provider.name}</h3>
                <p>{parseProviderServices(provider.service).join(" · ")}</p>
                <small>{provider.serviceArea}</small>
                <div>
                  {provider.publicSlug && (
                    <Link className="button secondary" href={`/providers/${provider.publicSlug}`}>View profile</Link>
                  )}
                  <button
                    className="button secondary"
                    disabled={busyId === provider.id}
                    onClick={() => void updateProvider(provider.id, "remove-provider")}
                    type="button"
                  >
                    {busyId === provider.id ? "Updating…" : "Remove"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      {available.length > 0 && (
        <section>
          <h3>Providers from your quotes</h3>
          <div className="saved-provider-grid">
            {available.map((provider) => (
              <article key={provider.id}>
                <span className="verified-badge">✓ Tuveloz verified</span>
                <h3>{provider.name}</h3>
                <p>{parseProviderServices(provider.service).join(" · ")}</p>
                <small>{provider.serviceArea}</small>
                <button
                  className="button primary"
                  disabled={busyId === provider.id}
                  onClick={() => void updateProvider(provider.id, "save-provider")}
                  type="button"
                >
                  {busyId === provider.id ? "Saving…" : "Save provider"}
                </button>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
