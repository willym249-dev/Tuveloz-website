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
        <strong>Thank you — we&apos;ve got your fleet.</strong>
        <p>
          Keeping vehicles on the road is the actual job, and knowing what you run
          helps us build for it rather than guess. Nothing has been booked or
          charged and this isn&apos;t an account — when multi-vehicle service opens in
          Montgomery County, we&apos;ll come to you.
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
        <span>Your business</span>
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
        <span>Email</span>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          maxLength={180}
          required
        />
      </label>
      <label>
        <span>Phone <small>(optional — fastest way to reach you)</small></span>
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
        <span>What gives you the most trouble? <small>(optional)</small></span>
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
        This tells us about your fleet and nothing more — no account, no booking,
        no charge, and no promise that a service will be available. We&apos;d rather
        be straight with you than have you waiting on a call we can&apos;t make yet.
      </p>

      {error && <p className="form-error" role="alert">{error}</p>}

      <button className="button primary" type="submit" disabled={busy}>
        {busy ? "Sending…" : "Tell Tuveloz about our fleet"}
      </button>
    </form>
  );
}
