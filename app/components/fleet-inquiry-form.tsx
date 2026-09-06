"use client";

import { useState } from "react";
import { FLEET_SIZE_OPTIONS } from "../../lib/fleet-options";
import {
  PHONE_TRANSACTIONAL_PURPOSE_TEXT_EN,
  SMS_MARKETING_CONSENT_TEXT_EN,
} from "../../lib/phone-consent-text";

/**
 * Fleet interest capture. Submitting records interest only — it creates no
 * account, books nothing, and promises no service. The copy says so on the
 * form itself, not just in the confirmation.
 */
export function FleetInquiryForm() {
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [smsMarketingConsent, setSmsMarketingConsent] = useState(false);
  const [fleetSize, setFleetSize] = useState("");
  const [vehicleTypes, setVehicleTypes] = useState("");
  const [municipality, setMunicipality] = useState("");
  const [servicesNeeded, setServicesNeeded] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  if (done) {
    return (
      <div className="fleet-form-done" role="status">
        <strong>Thanks for telling us about your fleet.</strong>
        <p>
          We&apos;ve received your details and may follow up about your needs or
          fleet service plans. This does not create an account, book a service,
          or charge you.
        </p>
      </div>
    );
  }

  return (
    <form
      className="fleet-inquiry-form"
      onSubmit={async (event) => {
        event.preventDefault();
        setError("");
        setBusy(true);
        try {
          const response = await fetch("/api/fleet-inquiry", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              companyName,
              contactName,
              email,
              contactPhone,
              smsMarketingConsent,
              fleetSize,
              vehicleTypes,
              municipality,
              servicesNeeded,
            }),
          });
          if (!response.ok) {
            const payload = await response.json().catch(() => ({})) as { error?: string };
            throw new Error(payload.error || "We could not save your fleet request.");
          }
          setDone(true);
        } catch (submitError) {
          setError(submitError instanceof Error
            ? submitError.message
            : "We could not save your fleet request.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        <span>Business name</span>
        <input
          value={companyName}
          onChange={(event) => setCompanyName(event.target.value)}
          maxLength={120}
          required
        />
      </label>
      <label>
        <span>Your name</span>
        <input
          value={contactName}
          onChange={(event) => setContactName(event.target.value)}
          maxLength={120}
          required
        />
      </label>
      <label>
        <span>Email address</span>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          maxLength={180}
          required
        />
      </label>
      <label>
        <span>Phone <small>(optional)</small></span>
        <input
          type="tel"
          value={contactPhone}
          onChange={(event) => setContactPhone(event.target.value)}
          maxLength={40}
          autoComplete="tel"
        />
        <small className="fleet-field-note">{PHONE_TRANSACTIONAL_PURPOSE_TEXT_EN}</small>
      </label>
      <label>
        <span>How many vehicles?</span>
        <select
          value={fleetSize}
          onChange={(event) => setFleetSize(event.target.value)}
          required
        >
          <option value="">Choose one</option>
          {FLEET_SIZE_OPTIONS.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </label>
      <label>
        <span>Vehicle types <small>(optional)</small></span>
        <input
          value={vehicleTypes}
          onChange={(event) => setVehicleTypes(event.target.value)}
          maxLength={200}
          placeholder="Cargo vans, box trucks, sedans…"
        />
      </label>
      <label>
        <span>Where are the vehicles kept? <small>(optional)</small></span>
        <input
          value={municipality}
          onChange={(event) => setMunicipality(event.target.value)}
          maxLength={120}
          placeholder="Rockville, Silver Spring…"
        />
      </label>
      <label className="fleet-inquiry-wide">
        <span>What do you need most? <small>(optional)</small></span>
        <textarea
          value={servicesNeeded}
          onChange={(event) => setServicesNeeded(event.target.value)}
          maxLength={300}
          rows={3}
          placeholder="Scheduled maintenance, tires, batteries, diagnostics…"
        />
      </label>

      {contactPhone.trim() && (
        <label className="fleet-sms-consent">
          <input
            type="checkbox"
            checked={smsMarketingConsent}
            onChange={(event) => setSmsMarketingConsent(event.target.checked)}
          />
          <span>{SMS_MARKETING_CONSENT_TEXT_EN}</span>
        </label>
      )}

      <p className="fleet-inquiry-note">
        Sending this records your interest only. It does not create an account,
        book a service, or charge you. We haven&apos;t set a fleet launch date,
        and availability will depend on providers in your area.
      </p>

      {error && <p className="form-error" role="alert">{error}</p>}

      <button className="button primary" type="submit" disabled={busy}>
        {busy ? "Sending…" : "Send fleet details"}
      </button>
    </form>
  );
}
