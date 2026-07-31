"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BrandMark } from "../components/tuveloz-icons";
import {
  CURRENT_LAUNCH_AREA,
  PROVIDER_WORK_LOCATION_OPTIONS,
} from "../../lib/service-matching";
import { PROVIDER_TRAVEL_RADIUS_OPTIONS } from "../../lib/service-area-settings";

type ProviderAreaSettings = {
  email: string;
  serviceArea: string;
  baseZip: string;
  travelRadiusMiles: number;
  workLocations: string[];
  businessMunicipality: string;
  businessServiceAddress: string;
};

export default function ProviderServiceAreaPage() {
  const [settings, setSettings] = useState<ProviderAreaSettings | null>(null);
  const [workLocations, setWorkLocations] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError("");
    const response = await fetch("/api/provider-service-area", { cache: "no-store" });
    const result = await response.json() as { settings?: ProviderAreaSettings; error?: string };
    if (response.status === 401) {
      window.location.replace("/account?role=provider");
      return;
    }
    if (!response.ok || !result.settings) {
      throw new Error(result.error || "Unable to load service-area settings.");
    }
    setSettings(result.settings);
    setWorkLocations(result.settings.workLocations);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load().catch((reason) => {
        setError(reason instanceof Error ? reason.message : "Unable to load service-area settings.");
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/provider-service-area", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          serviceArea: CURRENT_LAUNCH_AREA,
          baseZip: values.baseZip,
          travelRadiusMiles: values.travelRadiusMiles,
          workLocations,
          businessMunicipality: values.businessMunicipality,
          businessServiceAddress: workLocations.includes(PROVIDER_WORK_LOCATION_OPTIONS[1])
            ? values.businessServiceAddress
            : "",
        }),
      });
      const result = await response.json() as {
        settings?: ProviderAreaSettings;
        note?: string;
        error?: string;
      };
      if (!response.ok || !result.settings) {
        throw new Error(result.error || "Unable to save service-area settings.");
      }
      setSettings(result.settings);
      setWorkLocations(result.settings.workLocations);
      setNotice(result.note || "Service-area settings saved.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save service-area settings.");
    } finally {
      setBusy(false);
    }
  }

  const customersMayVisit = workLocations.includes(PROVIDER_WORK_LOCATION_OPTIONS[1]);

  return (
    <main className="account-shell">
      <header className="account-header">
        <Link className="brand" href="/" aria-label="Tuveloz home">
          <BrandMark />
          <span>Tuveloz</span>
        </Link>
        <Link className="account-home-link" href="/provider-jobs">Provider workspace</Link>
      </header>
      <section className="account-main">
        <div className="account-welcome">
          <span className="account-kicker">Provider settings</span>
          <h1>Service area.</h1>
          <p>Control where customers can meet you and which launch area can send matching jobs.</p>
          {settings && <small>Signed in as {settings.email}</small>}
        </div>
        {error && <p className="form-error account-login-message" role="alert">{error}</p>}
        {!settings && !error && <p className="admin-note account-loading">Loading service-area settings…</p>}
        {settings && (
          <section className="account-card customer-settings-panel">
            <form className="customer-profile-form" key={`${settings.email}-${settings.baseZip}-${settings.travelRadiusMiles}`} onSubmit={save}>
              <label>
                Current Tuveloz launch area
                <input disabled readOnly value={CURRENT_LAUNCH_AREA} />
                <small>Only supported launch areas can send matching jobs.</small>
              </label>
              <div className="field-row">
                <label>
                  Starting ZIP code
                  <input defaultValue={settings.baseZip} inputMode="numeric" maxLength={10} name="baseZip" required placeholder="20850" />
                </label>
                <label>
                  Preferred travel distance
                  <select defaultValue={String(settings.travelRadiusMiles)} name="travelRadiusMiles">
                    {PROVIDER_TRAVEL_RADIUS_OPTIONS.map((miles) => (
                      <option key={miles} value={miles}>{miles} miles</option>
                    ))}
                  </select>
                </label>
              </div>
              <fieldset className="area-fieldset location-fieldset">
                <legend>How can customers receive service?</legend>
                <p>These choices immediately affect which jobs appear in your workspace.</p>
                <div className="area-options">
                  {PROVIDER_WORK_LOCATION_OPTIONS.map((option) => (
                    <label key={option}>
                      <input
                        checked={workLocations.includes(option)}
                        onChange={(event) => setWorkLocations((current) => (
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
              <label>
                Business city, town, or municipality
                <input defaultValue={settings.businessMunicipality} maxLength={100} name="businessMunicipality" required placeholder="Example: Rockville" />
              </label>
              {customersMayVisit && (
                <label>
                  Customer service address
                  <input defaultValue={settings.businessServiceAddress} maxLength={240} name="businessServiceAddress" required placeholder="Business street address" />
                  <small>This address is shared only where the customer needs it for an accepted job.</small>
                </label>
              )}
              <button className="button primary" disabled={busy} type="submit">
                {busy ? "Saving…" : "Save service area"}
              </button>
              {notice && <p className="portal-success" role="status">✓ {notice}</p>}
            </form>
          </section>
        )}
      </section>
    </main>
  );
}
