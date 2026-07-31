"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CUSTOMER_SERVICE_LOCATION_OPTIONS,
  parseProviderServices,
} from "../../lib/service-matching";

type CustomerProfile = {
  email: string;
  displayName: string;
  municipality: string;
  zip: string;
  serviceLocations: string[];
  serviceAddress: string;
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
  const [serviceLocations, setServiceLocations] = useState<string[]>([]);

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/customer-tools", { cache: "no-store" });
      const result = await response.json() as CustomerTools & { error?: string };
      if (!response.ok) throw new Error(result.error || "Unable to load customer settings.");
      setData(result);
      setServiceLocations(result.profile.serviceLocations);
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
  const providerMayVisit = serviceLocations.includes(CUSTOMER_SERVICE_LOCATION_OPTIONS[0]);

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
          municipality: values.municipality,
          zip: values.zip,
          serviceLocations,
          serviceAddress: providerMayVisit ? values.serviceAddress : "",
        }),
      });
      const result = await response.json() as { profile?: CustomerProfile; error?: string };
      if (!response.ok || !result.profile) {
        throw new Error(result.error || "Unable to save your profile.");
      }
      setData((current) => current ? { ...current, profile: result.profile as CustomerProfile } : current);
      setServiceLocations(result.profile.serviceLocations);
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
          <form className="customer-profile-form" key={`${data.profile.email}-${data.profile.displayName}-${data.profile.zip}`} onSubmit={saveProfile}>
            <label>
              Account email
              <input disabled readOnly value={data.profile.email} />
              <small>Your verified sign-in address cannot be changed here.</small>
            </label>
            <label>
              Display name
              <input defaultValue={data.profile.displayName} maxLength={80} name="displayName" required />
              <small>Existing job requests keep the name originally submitted.</small>
            </label>
            <div className="field-row">
              <label>
                City, town, or municipality
                <input defaultValue={data.profile.municipality} maxLength={100} name="municipality" required placeholder="Example: Rockville" />
              </label>
              <label>
                ZIP code
                <input defaultValue={data.profile.zip} inputMode="numeric" maxLength={10} name="zip" required placeholder="20850" />
              </label>
            </div>
            <fieldset className="area-fieldset location-fieldset">
              <legend>Default service location</legend>
              <p>Choose one or both. You can still change this on each job.</p>
              <div className="area-options">
                {CUSTOMER_SERVICE_LOCATION_OPTIONS.map((option) => (
                  <label key={option}>
                    <input
                      checked={serviceLocations.includes(option)}
                      onChange={(event) => setServiceLocations((current) => (
                        event.target.checked
                          ? [...current, option]
                          : current.filter((item) => item !== option)
                      ))}
                      type="checkbox"
                    />
                    {option}
                  </label>
                ))}
              </div>
            </fieldset>
            {providerMayVisit && (
              <label>
                Default service address
                <input defaultValue={data.profile.serviceAddress} maxLength={240} name="serviceAddress" required placeholder="Street address" />
                <small>This stays private until you select a provider for a job.</small>
              </label>
            )}
            <button className="button primary" disabled={busyId === "profile"} type="submit">
              {busyId === "profile" ? "Saving…" : "Save profile and service area"}
            </button>
            {saved && <p className="portal-success">✓ Profile and service area saved</p>}
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
