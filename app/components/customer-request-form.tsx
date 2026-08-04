"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { track } from "../../lib/analytics";
import {
  JOB_SAFETY_ATTESTATION_OPTIONS,
  jobScopeLocationRequirementsForService,
  jobScopeRequiredAttestations,
  jobScopeRequirementsForService,
  type JobLocationType,
} from "../../lib/job-scope-facts";
import { POLICY_JURISDICTION } from "../../lib/provider-policy";
import {
  CURRENT_LAUNCH_AREA,
  CUSTOMER_SERVICE_LOCATION_OPTIONS,
  PARTS_COMMUNICATION_NOTICE,
  PARTS_PREFERENCE_OPTIONS,
  PARTS_SOURCE_OPTIONS,
} from "../../lib/service-matching";
import { servicesForCustomerSelection } from "../../lib/service-tiers";
import { AddressAutocompleteInput } from "./address-autocomplete-input";
import { ConfirmAction } from "./confirm-action";
import {
  LocationDatalists,
  MUNICIPALITY_DATALIST_ID,
  ZIP_DATALIST_ID,
} from "./location-datalists";

/**
 * The customer request form, rebuilt around progressive disclosure. The
 * /api/requests contract makes the exact service optional: with no service
 * named the request is saved for manual review, and only when a service IS
 * named does the server require the full structured job-facts envelope. So
 * the form starts as a short "describe it" form, and the extra questions
 * appear only for the one selected service — never the whole catalog.
 */

const NOT_SURE_VALUE = "";

/** Internal policy prefix stripped for display, same as the provider form. */
function serviceDisplayLabel(label: string) {
  const plain = label.replace(/^Provisional /, "");
  return plain.charAt(0).toUpperCase() + plain.slice(1);
}

function humanizeCode(code: string) {
  const plain = code.replaceAll("_", " ");
  return plain.charAt(0).toUpperCase() + plain.slice(1);
}

const ATTESTATION_LABELS = new Map<string, string>(
  JOB_SAFETY_ATTESTATION_OPTIONS.map((option) => [option.value, option.label]),
);

const DRIVEABILITY_CHOICES = [
  { value: "driveable", label: "Yes, it drives" },
  { value: "not_driveable", label: "No, it can't be driven" },
  { value: "unknown", label: "Not sure" },
] as const;

const VEHICLE_STATE_CHOICES = [
  { value: "normal_stationary", label: "Parked and in normal condition" },
  { value: "disabled_no_collision", label: "Won't start or drive — no crash damage" },
  { value: "collision_damaged", label: "Crash or collision damage" },
  { value: "fire_or_flood_damaged", label: "Fire or flood damage" },
  { value: "battery_damaged", label: "Visibly damaged battery" },
] as const;

const HIGH_VOLTAGE_CHOICES = [
  {
    value: "not_applicable_or_not_involved",
    label: "No — gas vehicle, or the high-voltage system isn't involved",
  },
  {
    value: "present_not_involved",
    label: "It's a hybrid or EV, but this work doesn't touch the high-voltage system",
  },
  {
    value: "damage_or_work_suspected",
    label: "The high-voltage battery may be damaged or involved",
  },
  { value: "unknown", label: "Not sure" },
] as const;

const MANUAL_REVIEW_HINT =
  "If any of these don't fit your situation, choose “Not sure / other” for the "
  + "service above and just describe the problem — our team will review it by hand.";

type CustomerRequestFormProps = {
  acceptanceKey: string;
  acceptanceVersion: string;
  acceptanceHash: string;
  acceptanceText: string;
  privacyKey: string;
  privacyVersion: string;
  privacyHash: string;
  privacyText: string;
};

export function CustomerRequestForm(props: CustomerRequestFormProps) {
  const selectableServices = useMemo(() => servicesForCustomerSelection(), []);

  const [serviceCode, setServiceCode] = useState<string>(NOT_SURE_VALUE);
  const [locationChoice, setLocationChoice] = useState<"" | "home" | "roadside">("");
  const [operationCode, setOperationCode] = useState("");
  const [exclusionsConfirmed, setExclusionsConfirmed] = useState(false);
  const [checkedAttestations, setCheckedAttestations] = useState<readonly string[]>([]);
  const [partsSource, setPartsSource] = useState<string>(PARTS_SOURCE_OPTIONS[2]);
  const [vehicleState, setVehicleState] = useState("");
  const [highVoltageStatus, setHighVoltageStatus] = useState("");
  const [requestError, setRequestError] = useState("");
  const [requestBusy, setRequestBusy] = useState(false);
  const [confirmingSubmit, setConfirmingSubmit] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [requestToken, setRequestToken] = useState("");
  const [matchedProviderCount, setMatchedProviderCount] = useState<number | null>(null);

  const exactService = serviceCode === NOT_SURE_VALUE
    ? null
    : selectableServices.find((service) => service.code === serviceCode) ?? null;
  const scopeRequirements = exactService
    ? jobScopeRequirementsForService(exactService.code)
    : null;
  const locationRequirements = exactService
    ? jobScopeLocationRequirementsForService(exactService.code)
    : null;
  const homeAllowed = Boolean(
    locationRequirements?.allowedTypes.includes("customer_private_property"),
  );
  const roadsideAllowed = Boolean(
    locationRequirements?.allowedTypes.includes("public_roadside"),
  );
  // Customer intake accepts only these two location types; a service whose
  // location rule allows neither can't be requested online yet.
  const serviceRequestableOnline = Boolean(
    exactService
    && scopeRequirements
    && scopeRequirements.allowedOperations.length > 0
    && (homeAllowed || roadsideAllowed),
  );
  const locationType: JobLocationType | null = locationChoice === "home"
    ? "customer_private_property"
    : locationChoice === "roadside"
      ? "public_roadside"
      : null;
  const requiredAttestations = exactService && locationType
    ? jobScopeRequiredAttestations(exactService.code, locationType)
    : [];
  const effectiveOperation = scopeRequirements?.allowedOperations.length === 1
    ? scopeRequirements.allowedOperations[0]
    : operationCode;
  const batteryDamageProhibited = Boolean(
    scopeRequirements?.prohibitedOperations.includes("damaged_battery"),
  );

  function chooseService(code: string) {
    setServiceCode(code);
    setOperationCode("");
    setExclusionsConfirmed(false);
    setCheckedAttestations([]);
    setLocationChoice("");
    setConfirmingSubmit(false);
    setRequestError("");
  }

  function toggleAttestation(code: string, checked: boolean) {
    setCheckedAttestations((current) => (
      checked ? [...current, code] : current.filter((item) => item !== code)
    ));
  }

  function serviceFactsError(formData: FormData): string {
    if (!exactService || !scopeRequirements) return "";
    if (!serviceRequestableOnline) {
      return "This service can't be requested online yet. Choose “Not sure / other” and describe what you need instead.";
    }
    if (!effectiveOperation) {
      return "Choose which task you need under the selected service.";
    }
    if (scopeRequirements.prohibitedOperations.length > 0 && !exclusionsConfirmed) {
      return "Confirm that none of the listed excluded situations apply, or choose “Not sure / other” instead.";
    }
    if (!locationType) {
      return "Choose where the work will happen.";
    }
    const state = String(formData.get("vehicle-state") ?? "");
    if (state === "fire_or_flood_damaged") {
      return `Fire- or flood-damaged vehicles need a specially reviewed workflow. ${MANUAL_REVIEW_HINT}`;
    }
    if (state === "battery_damaged" && batteryDamageProhibited) {
      return `A visibly damaged battery is outside this service's approved scope. ${MANUAL_REVIEW_HINT}`;
    }
    const highVoltage = String(formData.get("high-voltage-status") ?? "");
    if (highVoltage === "damage_or_work_suspected" || highVoltage === "unknown") {
      return `Possible high-voltage damage needs a specially reviewed workflow. ${MANUAL_REVIEW_HINT}`;
    }
    const missingAttestation = requiredAttestations.find(
      (code) => !checkedAttestations.includes(code),
    );
    if (missingAttestation) {
      return "Check every safety confirmation — each one is required before providers can be matched.";
    }
    if (!String(formData.get("labor-only-parts-acknowledged") ?? "")) {
      return "Confirm that quotes and payments through Tuveloz cover labor only.";
    }
    // The server binds the address to the municipality, MD, and ZIP — check
    // here so the customer gets a friendly message instead of a rejection.
    const address = String(formData.get("service-address") ?? "").toLowerCase();
    const municipality = String(formData.get("municipality") ?? "").trim().toLowerCase();
    const zip = String(formData.get("zip") ?? "").trim().slice(0, 5);
    if (
      (municipality && !address.includes(municipality))
      || (zip && !address.includes(zip))
      || !/(^|[^a-z])(?:maryland|md)([^a-z]|$)/i.test(address)
    ) {
      return "Write the full service address including your city, “MD”, and ZIP — for example: 123 Main St, Rockville, MD 20850.";
    }
    return "";
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    // The server rejects past service times with a clear message; no client
    // clock check here (react-hooks/purity forbids Date.now in this component).
    const factsError = serviceFactsError(formData);
    if (factsError) {
      setRequestError(factsError);
      setConfirmingSubmit(false);
      return;
    }

    if (!confirmingSubmit) {
      setRequestError("");
      setConfirmingSubmit(true);
      return;
    }

    setRequestBusy(true);
    setRequestError("");
    try {
      const response = await fetch("/api/requests", { method: "POST", body: formData });
      const result = (await response.json()) as {
        error?: string;
        accessToken?: string;
        automaticallyApproved?: boolean;
        matchingProviderCount?: number;
      };
      if (!response.ok) throw new Error(result.error || "Please try again.");
      form.reset();
      setConfirmingSubmit(false);
      setRequestToken(result.accessToken ?? "");
      setMatchedProviderCount(
        result.automaticallyApproved ? result.matchingProviderCount ?? 0 : null,
      );
      chooseService(NOT_SURE_VALUE);
      setPartsSource(PARTS_SOURCE_OPTIONS[2]);
      setVehicleState("");
      setHighVoltageStatus("");
      setRequestSent(true);
      track("customer_request_posted");
    } catch (error) {
      setConfirmingSubmit(false);
      setRequestError(error instanceof Error ? error.message : "Please try again.");
    } finally {
      setRequestBusy(false);
    }
  }

  if (requestSent) {
    return (
      <div className="success-message" role="status">
        <span>✓</span>
        <h3>Request received.</h3>
        <p>
          {matchedProviderCount !== null && matchedProviderCount > 0
            ? `${matchedProviderCount} eligible ${matchedProviderCount === 1 ? "provider was" : "providers were"} notified. Quotes arrive by email — you choose whether to accept one.`
            : "Our team will review your request and follow up by email."}
        </p>
        {requestToken && (
          <a className="button primary" href={`/my-request?token=${requestToken}`}>
            Track my request
          </a>
        )}
        <button type="button" onClick={() => setRequestSent(false)}>
          Post another request
        </button>
      </div>
    );
  }

  return (
    <form className="lead-form" onSubmit={handleSubmit} style={{ marginTop: 24 }}>
      <LocationDatalists />
      <input name="jurisdiction" type="hidden" value={POLICY_JURISDICTION} />
      <input name="launch-area" type="hidden" value={CURRENT_LAUNCH_AREA} />
      <input name="scheduled-time-zone" type="hidden" value="America/New_York" />

      <div className="form-heading">
        <span>01</span>
        <div>
          <h2>What does your vehicle need?</h2>
          <p>A quick description is enough — “Not sure” is a perfectly good answer.</p>
        </div>
      </div>

      <label>
        Service
        <select
          name="service-code"
          value={serviceCode}
          onChange={(event) => chooseService(event.target.value)}
        >
          <option value={NOT_SURE_VALUE}>Not sure / other — just describe it below</option>
          {selectableServices.map((service) => (
            <option key={service.code} value={service.code}>
              {serviceDisplayLabel(service.label)}
            </option>
          ))}
        </select>
        <small>
          Naming a service lets us match eligible providers right away. Broad
          categories such as “general auto repair” are not accepted — if nothing
          fits, keep “Not sure / other” and our team reviews it by hand.
        </small>
      </label>

      <label>
        What&apos;s going on?
        <textarea
          maxLength={1500}
          name="job-details"
          placeholder="Describe the problem or the work you want, anything you've noticed, and anything a provider should know before quoting."
          required
          rows={5}
        />
      </label>

      <label className="photo-field">
        Photo <span>(optional)</span>
        <input accept="image/jpeg,image/png,image/webp" name="issue-photo" type="file" />
        <small>JPG, PNG, or WebP; maximum 8 MB. No identity, payment, or medical documents.</small>
      </label>

      {exactService && !serviceRequestableOnline && (
        <p className="form-error" role="alert">
          {serviceDisplayLabel(exactService.label)} can&apos;t be requested online yet.
          Choose “Not sure / other” above and describe what you need — our team
          will review it by hand.
        </p>
      )}

      {exactService && scopeRequirements && serviceRequestableOnline && (
        <>
          <div className="form-heading">
            <span>02</span>
            <div>
              <h2>A few details for {serviceDisplayLabel(exactService.label)}</h2>
              <p>These answers let eligible providers quote without back-and-forth.</p>
            </div>
          </div>

          {scopeRequirements.allowedOperations.length === 1 ? (
            <input
              name="requested-operation"
              type="hidden"
              value={scopeRequirements.allowedOperations[0]}
            />
          ) : (
            <fieldset className="area-fieldset">
              <legend>Which task do you need?</legend>
              <div className="area-options">
                {scopeRequirements.allowedOperations.map((operation) => (
                  <label key={operation}>
                    <input
                      checked={operationCode === operation}
                      name="requested-operation"
                      onChange={() => setOperationCode(operation)}
                      type="radio"
                      value={operation}
                    />
                    {humanizeCode(operation)}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {scopeRequirements.prohibitedOperations.length > 0 && (
            <fieldset className="area-fieldset">
              <legend>Not included in this service</legend>
              <p>
                This service can&apos;t cover the following. If any of them apply,
                choose “Not sure / other” above instead.
              </p>
              <ul>
                {scopeRequirements.prohibitedOperations.map((operation) => (
                  <li key={operation}>{humanizeCode(operation)}</li>
                ))}
              </ul>
              <label className="policy-consent">
                <input
                  checked={exclusionsConfirmed}
                  onChange={(event) => setExclusionsConfirmed(event.target.checked)}
                  type="checkbox"
                />
                <span>None of these apply to my vehicle or this request.</span>
              </label>
              {exclusionsConfirmed && scopeRequirements.prohibitedOperations.map((operation) => (
                <input
                  key={operation}
                  name="prohibited-operation-absent"
                  type="hidden"
                  value={operation}
                />
              ))}
            </fieldset>
          )}

          <fieldset className="area-fieldset">
            <legend>Where will the work happen?</legend>
            <div className="area-options">
              {homeAllowed && (
                <label>
                  <input
                    checked={locationChoice === "home"}
                    name="location-choice"
                    onChange={() => {
                      setLocationChoice("home");
                      setCheckedAttestations([]);
                    }}
                    type="radio"
                    value="home"
                  />
                  My driveway, garage, or private parking — I control it or have permission
                </label>
              )}
              {roadsideAllowed && (
                <label>
                  <input
                    checked={locationChoice === "roadside"}
                    name="location-choice"
                    onChange={() => {
                      setLocationChoice("roadside");
                      setCheckedAttestations([]);
                    }}
                    type="radio"
                    value="roadside"
                  />
                  Roadside — the vehicle is safely out of traffic
                </label>
              )}
            </div>
            {locationType && (
              <>
                <input name="job-location-type" type="hidden" value={locationType} />
                <input
                  name="property-permission"
                  type="hidden"
                  value={locationChoice === "home"
                    ? "customer_confirmed_authority"
                    : "not_applicable_public_roadside"}
                />
                <input
                  name="service-location"
                  type="hidden"
                  value={CUSTOMER_SERVICE_LOCATION_OPTIONS[0]}
                />
              </>
            )}
          </fieldset>

          <div className="field-row">
            <label>
              Can the vehicle be driven?
              <select defaultValue="" name="vehicle-driveability" required>
                <option disabled value="">Choose one</option>
                {DRIVEABILITY_CHOICES.map((choice) => (
                  <option key={choice.value} value={choice.value}>{choice.label}</option>
                ))}
              </select>
            </label>
            <label>
              Vehicle condition
              <select
                name="vehicle-state"
                onChange={(event) => setVehicleState(event.target.value)}
                required
                value={vehicleState}
              >
                <option disabled value="">Choose one</option>
                {VEHICLE_STATE_CHOICES.map((choice) => (
                  <option key={choice.value} value={choice.value}>{choice.label}</option>
                ))}
              </select>
            </label>
          </div>
          {vehicleState === "fire_or_flood_damaged" && (
            <p className="form-error" role="alert">
              Fire- or flood-damaged vehicles need a specially reviewed workflow.{" "}
              {MANUAL_REVIEW_HINT}
            </p>
          )}
          {vehicleState === "battery_damaged" && batteryDamageProhibited && (
            <p className="form-error" role="alert">
              A visibly damaged battery is outside this service&apos;s approved scope.{" "}
              {MANUAL_REVIEW_HINT}
            </p>
          )}

          <label>
            Is a high-voltage (hybrid/EV) system involved?
            <select
              name="high-voltage-status"
              onChange={(event) => setHighVoltageStatus(event.target.value)}
              required
              value={highVoltageStatus}
            >
              <option disabled value="">Choose one</option>
              {HIGH_VOLTAGE_CHOICES.map((choice) => (
                <option key={choice.value} value={choice.value}>{choice.label}</option>
              ))}
            </select>
          </label>
          {(highVoltageStatus === "damage_or_work_suspected" || highVoltageStatus === "unknown") && (
            <p className="form-error" role="alert">
              Possible high-voltage damage needs a specially reviewed workflow.{" "}
              {MANUAL_REVIEW_HINT}
            </p>
          )}

          {locationType && requiredAttestations.length > 0 && (
            <fieldset className="area-fieldset">
              <legend>Safety confirmations</legend>
              <p>
                Each of these must be true before providers can be matched. The
                provider rechecks everything on arrival and stops if anything changed.
              </p>
              <div className="area-options">
                {requiredAttestations.map((code) => (
                  <label key={code}>
                    <input
                      checked={checkedAttestations.includes(code)}
                      name="safety-attestation"
                      onChange={(event) => toggleAttestation(code, event.target.checked)}
                      type="checkbox"
                      value={code}
                    />
                    {ATTESTATION_LABELS.get(code) ?? humanizeCode(code)}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <fieldset className="area-fieldset">
            <legend>Parts</legend>
            <div className="area-options parts-source-options">
              {PARTS_SOURCE_OPTIONS.map((option) => (
                <label key={option}>
                  <input
                    checked={partsSource === option}
                    name="parts-source"
                    onChange={() => setPartsSource(option)}
                    type="radio"
                    value={option}
                  />
                  {option}
                </label>
              ))}
            </div>
            <label>
              Customer-supplied parts preference
              <select defaultValue="No preference" name="parts-preference">
                {PARTS_PREFERENCE_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
            <small className="parts-equipment-note">{PARTS_COMMUNICATION_NOTICE}</small>
            <label className="policy-consent">
              <input name="labor-only-parts-acknowledged" type="checkbox" value="yes" />
              <span>
                I understand that quotes and payments through Tuveloz cover labor
                only — I&apos;ll buy any required parts separately.
              </span>
            </label>
          </fieldset>
        </>
      )}

      <div className="form-heading">
        <span>{exactService && serviceRequestableOnline ? "03" : "02"}</span>
        <div>
          <h2>Where and when</h2>
          <p>Providers quote based on your location and preferred time.</p>
        </div>
      </div>

      <div className="field-row">
        <label>
          Your name <span className="optional-label">(optional)</span>
          <input maxLength={100} name="name" placeholder="First and last name" />
        </label>
        <label>
          Email
          <input maxLength={180} name="email" placeholder="you@example.com" required type="email" />
        </label>
      </div>

      <label>
        Vehicle <span className="optional-label">(optional)</span>
        <input
          maxLength={320}
          name="vehicle"
          placeholder="Year, make, and model — for example: 2018 Honda Civic"
        />
      </label>

      <div className="field-row">
        <div className="fixed-launch-area">
          <span>Current service area</span>
          <strong>{CURRENT_LAUNCH_AREA}</strong>
        </div>
        <label>
          City or town
          <input
            list={MUNICIPALITY_DATALIST_ID}
            maxLength={100}
            name="municipality"
            placeholder="Example: Rockville or Silver Spring"
            required
          />
        </label>
      </div>

      <div className="field-row">
        <label>
          ZIP code
          <input
            inputMode="numeric"
            list={ZIP_DATALIST_ID}
            maxLength={10}
            name="zip"
            pattern="[0-9]{5}(-[0-9]{4})?"
            placeholder="20901"
            required
          />
        </label>
        <label>
          Preferred date and time
          <input name="scheduled-for" required type="datetime-local" />
          <small>Eastern time. Providers confirm the final time with you.</small>
        </label>
      </div>

      <label>
        Service address
        <AddressAutocompleteInput
          maxLength={240}
          name="service-address"
          placeholder="123 Main St, Rockville, MD 20850"
          required
        />
        <small>
          Include your city, MD, and ZIP so providers see exactly where to go.
        </small>
      </label>

      <input name="customer-acceptance-key" type="hidden" value={props.acceptanceKey} />
      <input name="customer-acceptance-version" type="hidden" value={props.acceptanceVersion} />
      <input name="customer-acceptance-hash" type="hidden" value={props.acceptanceHash} />
      <label className="policy-consent">
        <input name="terms-accepted" required type="checkbox" value="yes" />
        <span>
          {props.acceptanceText}{" "}
          <Link href="/terms">Terms of Use</Link>{" · "}
          <Link href="/customer-agreement">Customer Agreement</Link>
        </span>
      </label>

      <input name="customer-privacy-key" type="hidden" value={props.privacyKey} />
      <input name="customer-privacy-version" type="hidden" value={props.privacyVersion} />
      <input name="customer-privacy-hash" type="hidden" value={props.privacyHash} />
      <label className="policy-consent">
        <input name="privacy-acknowledged" required type="checkbox" value="yes" />
        <span>
          {props.privacyText}{" "}
          <Link href="/privacy">Privacy Policy</Link>
        </span>
      </label>

      <label className="policy-consent optional-consent">
        <input name="remember-email-consent" type="checkbox" value="yes" />
        <span>Create a reusable guest profile after I verify this email. Optional.</span>
      </label>
      <label className="policy-consent optional-consent">
        <input name="marketing-consent" type="checkbox" value="yes" />
        <span>Email me occasional Tuveloz promotions. Optional.</span>
      </label>

      {confirmingSubmit ? (
        <ConfirmAction
          busy={requestBusy}
          busyLabel="Posting…"
          confirmLabel="Confirm and post"
          confirmStyle="primary"
          confirmType="submit"
          message="Posting your request shares it with eligible providers so they can quote. No job, provider contact, booking, or payment is created until you accept a quote."
          onBack={() => setConfirmingSubmit(false)}
          title="Post this request?"
        />
      ) : (
        <button className="button primary form-button" disabled={requestBusy} type="submit">
          Post my request <span>→</span>
        </button>
      )}
      {requestError && <p className="form-error" role="alert">{requestError}</p>}
      <p className="admin-note">
        Posting is free. You compare quotes and decide — or accept nothing at all.
      </p>
    </form>
  );
}
