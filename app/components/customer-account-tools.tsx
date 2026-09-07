"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  CUSTOMER_SERVICE_LOCATION_OPTIONS,
  parseProviderServices,
} from "../../lib/service-matching";
import { AddressAutocompleteInput } from "./address-autocomplete-input";
import { LocationDatalists, MUNICIPALITY_DATALIST_ID, ZIP_DATALIST_ID } from "./location-datalists";
import {
  CustomerToolsError,
  hasCustomerProviderReceipt,
  readCustomerTools,
  readSavedCustomerProfile,
  requestCustomerTools,
  type CustomerTools,
} from "../../lib/customer-tools-response";

export function CustomerAccountTools({ view }: { view: "saved" | "settings" }) {
  const [data, setData] = useState<CustomerTools | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [saved, setSaved] = useState(false);
  const [serviceLocations, setServiceLocations] = useState<string[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [signIn, setSignIn] = useState(false);
  const [savedRevision, setSavedRevision] = useState(0);
  const requestRef = useRef<AbortController | null>(null);

  function showError(reason: unknown, fallback: string) {
    setError(reason instanceof CustomerToolsError ? reason.message : fallback);
    setSignIn(reason instanceof CustomerToolsError && reason.signIn);
  }

  const load = useCallback(async () => {
    if (requestRef.current) return;
    const controller = new AbortController();
    requestRef.current = controller;
    setBusyId("loading");
    setError("");
    setSignIn(false);
    setLoadError(false);
    const fallback = view === "saved" ? "We couldn't load your saved providers. Please try again."
      : "We couldn't load your customer settings. Please try again.";
    try {
      const result = readCustomerTools(await requestCustomerTools(controller.signal, fallback));
      if (controller.signal.aborted) return;
      if (!result) throw new CustomerToolsError(fallback);
      setData(result);
      setServiceLocations(result.profile.serviceLocations);
    } catch (reason) {
      if (!controller.signal.aborted) { showError(reason, fallback); setLoadError(true); }
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
      if (!controller.signal.aborted) setBusyId("");
    }
  }, [view]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => {
      window.clearTimeout(timer);
      requestRef.current?.abort();
      requestRef.current = null;
    };
  }, [load]);

  const savedIds = useMemo(
    () => new Set(data?.savedProviders.map((provider) => provider.id) ?? []),
    [data],
  );
  const available = data?.providerChoices.filter((provider) => !savedIds.has(provider.id)) ?? [];
  const providerMayVisit = serviceLocations.includes(CUSTOMER_SERVICE_LOCATION_OPTIONS[0]);

  async function updateProvider(providerId: string, action: "save-provider" | "remove-provider") {
    if (requestRef.current || loadError) return;
    const controller = new AbortController();
    requestRef.current = controller;
    setBusyId(providerId);
    setError("");
    setSignIn(false);
    let confirmed = false;
    const fallback = "We couldn't confirm the change to your saved providers. Please try again.";
    const refreshFailure = "Your change was saved, but we couldn't refresh the list. Try again to see the latest list.";
    try {
      const result = await requestCustomerTools(controller.signal, fallback, { action, providerId });
      if (controller.signal.aborted) return;
      if (!hasCustomerProviderReceipt(result)) throw new CustomerToolsError(fallback);
      confirmed = true;
      const refreshed = readCustomerTools(await requestCustomerTools(controller.signal, refreshFailure));
      if (controller.signal.aborted) return;
      if (!refreshed) throw new CustomerToolsError(refreshFailure);
      setData(refreshed);
    } catch (reason) {
      if (!controller.signal.aborted) {
        showError(reason, confirmed ? refreshFailure : fallback);
        setLoadError(confirmed);
      }
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
      if (!controller.signal.aborted) setBusyId("");
    }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (requestRef.current || !data) return;
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    const expected = {
      email: data.profile.email,
      displayName: String(values.displayName ?? "").trim(),
      municipality: String(values.municipality ?? "").trim(),
      zip: String(values.zip ?? "").trim(),
      serviceLocations: [...serviceLocations],
      serviceAddress: providerMayVisit ? String(values.serviceAddress ?? "").trim() : "",
    };
    const controller = new AbortController();
    requestRef.current = controller;
    setBusyId("profile");
    setSaved(false);
    setError("");
    setSignIn(false);
    const fallback = "We couldn't confirm your changes were saved. Your entries are still here. Please try again.";
    try {
      const result = await requestCustomerTools(controller.signal, fallback, {
          action: "save-profile",
          displayName: values.displayName,
          municipality: values.municipality,
          zip: values.zip,
          serviceLocations,
          serviceAddress: providerMayVisit ? values.serviceAddress : "",
      });
      if (controller.signal.aborted) return;
      const profile = readSavedCustomerProfile(result, expected);
      if (!profile) throw new CustomerToolsError(fallback);
      setData((current) => current ? { ...current, profile } : current);
      setServiceLocations(profile.serviceLocations);
      setSavedRevision(revision => revision + 1);
      setSaved(true);
    } catch (reason) {
      if (!controller.signal.aborted) showError(reason, fallback);
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
      if (!controller.signal.aborted) setBusyId("");
    }
  }

  const errorNotice = error && (
    <div>
      <p className="form-error" role="alert">{error}</p>
      {signIn ? <Link className="button secondary" href="/account?role=customer&mode=signin">Sign in again</Link>
        : loadError && <button className="button secondary" disabled={!!busyId} onClick={() => void load()} type="button">Try again</button>}
    </div>
  );
  if (!data) return errorNotice
    ? <div className="customer-settings-panel">{errorNotice}</div>
    : <p className="admin-note" role="status">Loading customer settings…</p>;

  if (view === "settings") {
    return (
      <div className="customer-settings-panel">
        {errorNotice}
        {data && (
          <form className="customer-profile-form" key={savedRevision} onChange={() => setSaved(false)} onSubmit={saveProfile}>
            <fieldset className="customer-profile-fields" disabled={!!busyId}>
            <LocationDatalists />
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
                <input defaultValue={data.profile.municipality} list={MUNICIPALITY_DATALIST_ID} maxLength={100} name="municipality" required placeholder="Example: Rockville" />
              </label>
              <label>
                ZIP code
                <input defaultValue={data.profile.zip} inputMode="numeric" list={ZIP_DATALIST_ID} maxLength={10} name="zip" required placeholder="20850" />
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
                <AddressAutocompleteInput defaultValue={data.profile.serviceAddress} maxLength={240} name="serviceAddress" required placeholder="Street address" />
                <small>This stays private until you select a provider for a job.</small>
              </label>
            )}
            <button className="button primary" disabled={busyId === "profile"} type="submit">
              {busyId === "profile" ? "Saving…" : "Save profile and service area"}
            </button>
            </fieldset>
            {saved && <p className="portal-success" role="status">✓ Profile and service area saved</p>}
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
      {errorNotice}
      <p className="customer-tool-explainer">
        Save providers who previously sent a quote on one of your Tuveloz requests.
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
                <span className="verified-badge">Prior quote provider</span>
                <h3>{provider.name}</h3>
                <p>{parseProviderServices(provider.service).join(" · ")}</p>
                <small>{provider.serviceArea}</small>
                <div>
                  {provider.publicSlug && (
                    <Link className="button secondary" href={`/providers/${provider.publicSlug}`}>View profile</Link>
                  )}
                  <button
                    className="button secondary"
                    disabled={!!busyId || loadError}
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
                <span className="verified-badge">Prior quote provider</span>
                <h3>{provider.name}</h3>
                <p>{parseProviderServices(provider.service).join(" · ")}</p>
                <small>{provider.serviceArea}</small>
                <button
                  className="button primary"
                  disabled={!!busyId || loadError}
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
