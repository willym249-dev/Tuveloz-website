import Link from "next/link";
import {
  CUSTOMER_REQUEST_ACCEPTANCE_TEXT,
  CUSTOMER_REQUEST_AGREEMENT_KEY,
  CUSTOMER_REQUEST_AGREEMENT_VERSION,
  CUSTOMER_REQUEST_PRIVACY_ACKNOWLEDGMENT_TEXT,
  CUSTOMER_REQUEST_PRIVACY_AGREEMENT_KEY,
  CUSTOMER_REQUEST_PRIVACY_AGREEMENT_VERSION,
  customerRequestAgreementHash,
  customerRequestPrivacyAgreementHash,
} from "../../lib/customer-job-scope";
import {
  CUSTOMER_JOB_POSTING_PAUSED,
  CUSTOMER_JOB_POSTING_PAUSED_DETAIL,
  CUSTOMER_JOB_POSTING_PAUSED_MESSAGE,
} from "../../lib/launch-status";
import {
  JOB_HIGH_VOLTAGE_STATUS_VALUES,
  JOB_LOCATION_TYPE_OPTIONS,
  JOB_SAFETY_ATTESTATION_OPTIONS,
  JOB_SCOPE_COUNTY,
  JOB_SCOPE_STATE,
  JOB_VEHICLE_DRIVEABILITY_VALUES,
  JOB_VEHICLE_STATE_VALUES,
  jobScopeRequirementsForService,
} from "../../lib/job-scope-facts";
import {
  POLICY_JURISDICTION,
  SERVICES,
} from "../../lib/provider-policy";
import {
  CURRENT_LAUNCH_AREA,
  CUSTOMER_SERVICE_LOCATION_OPTIONS,
  PARTS_PREFERENCE_OPTIONS,
  PARTS_SOURCE_OPTIONS,
} from "../../lib/service-matching";
import { SiteLanguageButton } from "../components/site-language";
import { BrandMark } from "../components/tuveloz-icons";

const exactServices = SERVICES.filter((service) => service.code !== "general_auto_repair");
const exactServiceFactRequirements = exactServices.map((service) => ({
  ...service,
  ...jobScopeRequirementsForService(service.code),
}));

export default async function PostJobPage() {
  if (CUSTOMER_JOB_POSTING_PAUSED) {
    return (
      <main className="account-shell">
        <header className="account-header">
          <Link className="brand" href="/" aria-label="Tuveloz home">
            <BrandMark />
            <span>Tuveloz</span>
          </Link>
          <div className="account-header-actions">
            <SiteLanguageButton />
            <Link className="account-home-link" href="/account">
              Sign up / Sign in
            </Link>
          </div>
        </header>

        <section className="account-main">
          <div className="account-welcome">
            <span className="account-kicker">Customer launch status</span>
            <h1>Customer accounts are open. Job requests are not.</h1>
            <p>{CUSTOMER_JOB_POSTING_PAUSED_MESSAGE}</p>
            <small>{CUSTOMER_JOB_POSTING_PAUSED_DETAIL}</small>
          </div>

          <section className="account-card" style={{ marginTop: 32, minHeight: 0 }}>
            <div className="account-card-heading">
              <div>
                <span className="account-role">Available now</span>
                <h2>Prepare for launch without entering job details.</h2>
              </div>
            </div>
            <p>
              Create a customer account, apply as an independent provider, or use
              Tuveloz AI for bilingual guidance. Nothing on this page submits a
              request, contacts a provider, books service, or processes a payment.
            </p>
            <div className="hero-actions" style={{ marginTop: 24 }}>
              <Link className="button primary" href="/account?role=customer&mode=create">
                Create customer account <span>→</span>
              </Link>
              <Link className="button secondary" href="/join">
                Apply as an independent provider
              </Link>
              <a className="button ai" href="https://ai.tuveloz.com/">
                Open Tuveloz AI
              </a>
            </div>
          </section>
        </section>
      </main>
    );
  }

  const [acceptanceHash, privacyHash] = await Promise.all([
    customerRequestAgreementHash(),
    customerRequestPrivacyAgreementHash(),
  ]);

  return (
    <main className="account-shell">
      <header className="account-header">
        <Link className="brand" href="/" aria-label="Tuveloz home">
          <BrandMark />
          <span>Tuveloz</span>
        </Link>
        <div className="account-header-actions">
          <SiteLanguageButton />
          <Link className="account-home-link" href="/account">
            Sign up / Sign in
          </Link>
        </div>
      </header>

      <section className="account-main">
        <div className="account-welcome">
          <span className="account-kicker">Customer intake review</span>
          <h1>New job requests are temporarily paused.</h1>
          <p>
            The full planned intake is shown below so the workflow can be reviewed
            together. {CUSTOMER_JOB_POSTING_PAUSED_MESSAGE}
          </p>
          <small>Review the complete exact-service request below.</small>
        </div>

        <section className="account-card" style={{ marginTop: 32, minHeight: 0 }}>
          <div className="account-card-heading">
            <div>
              <span className="account-role">No real submission</span>
              <h2>Provider onboarding remains separate from jobs.</h2>
            </div>
          </div>
          <p>{CUSTOMER_JOB_POSTING_PAUSED_DETAIL}</p>
          <p>
            TUVELOZ does not employ, hire, train, assign, or place anyone on
            payroll. When jobs eventually open, customers will select an
            independent provider business for an exact approved service.
          </p>
        </section>

        <form
          action="/api/requests"
          className="lead-form"
          encType="multipart/form-data"
          method="post"
          style={{ marginTop: 24 }}
        >
          <div className="form-heading">
            <span>01</span>
            <div>
              <h2>Customer and exact job scope</h2>
              <p>Review-only while every real customer-job action is server-blocked.</p>
            </div>
          </div>

          <div className="field-row">
            <label>
              Customer name
              <input maxLength={100} name="name" placeholder="Full legal name" required />
            </label>
            <label>
              Email address
              <input maxLength={180} name="email" placeholder="you@example.com" required type="email" />
            </label>
          </div>

          <label>
            Vehicle
            <input
              maxLength={320}
              name="vehicle"
              placeholder="Year, make, model, trim, engine, and relevant vehicle details"
              required
            />
          </label>

          <input name="jurisdiction" type="hidden" value={POLICY_JURISDICTION} />
          <input name="launch-area" type="hidden" value={CURRENT_LAUNCH_AREA} />
          <div className="field-row">
            <div className="fixed-launch-area">
              <span>Current service area</span>
              <strong>{CURRENT_LAUNCH_AREA}</strong>
            </div>
            <label>
              City, town, or municipality
              <input
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
                maxLength={10}
                name="zip"
                pattern="[0-9]{5}(-[0-9]{4})?"
                placeholder="20901"
                required
              />
            </label>
            <label>
              Requested service date and time
              <input name="scheduled-for" required type="datetime-local" />
              <small>Entered and recorded in America/New_York time.</small>
            </label>
          </div>
          <input name="scheduled-time-zone" type="hidden" value="America/New_York" />

          <label>
            One exact service code
            <select name="service-code" required defaultValue="">
              <option disabled value="">No exact service is activated yet</option>
              {exactServices.map((service) => {
                const available = service.launchState === "enabled" && service.customerVisible;
                return (
                  <option disabled={!available} key={service.code} value={service.code}>
                    {service.label} — {service.code}{available ? "" : " — not currently offered"}
                  </option>
                );
              })}
            </select>
            <small>
              Broad categories such as “general auto repair” are prohibited. Each
              added service must use its own approved code and customer authorization.
            </small>
          </label>

          <label>
            Exact requested operation or subtype code
            <select name="requested-operation" required defaultValue="">
              <option disabled value="">Choose an operation listed for the exact service</option>
              {exactServiceFactRequirements.map((service) => (
                <optgroup key={service.code} label={`${service.label} (${service.code})`}>
                  {service.allowedOperations.length ? service.allowedOperations.map((operation) => (
                    <option key={`${service.code}:${operation}`} value={operation}>
                      {operation}
                    </option>
                  )) : (
                    <option disabled value="">No mandatory-compliance-approved operation scope</option>
                  )}
                </optgroup>
              ))}
            </select>
            <small>
              The server verifies that this operation belongs to the selected
              service. A service label cannot conceal a different task.
            </small>
          </label>

          <details className="pilot-vision">
            <summary><strong>Required excluded-operation confirmations</strong></summary>
            <p>
              Check only the exclusions for the selected exact service. Do not
              check an item if that condition or work is present; use a separately
              approved workflow instead.
            </p>
            {exactServiceFactRequirements.map((service) => (
              <section key={service.code} style={{ marginTop: 16 }}>
                <strong>{service.label}</strong>
                <small style={{ display: "block" }}>
                  Location rule: {service.locationRule || "not configured — denied"}
                </small>
                {service.prohibitedOperations.length ? (
                  <div className="area-options">
                    {service.prohibitedOperations.map((operation) => (
                      <label key={`${service.code}:${operation}`}>
                        <input name="prohibited-operation-absent" type="checkbox" value={operation} />
                        I confirm {operation} is absent from this request and vehicle condition.
                      </label>
                    ))}
                  </div>
                ) : <small>No additional prohibited-scope tokens are listed.</small>}
              </section>
            ))}
          </details>

          <details className="pilot-vision">
            <summary><strong>Review every planned exact service</strong></summary>
            <ul>
              {exactServices.map((service) => (
                <li key={service.code}>
                  <code>{service.code}</code> — {service.label}: {service.description}.{" "}
                  Allowed operations: {jobScopeRequirementsForService(service.code).allowedOperations.join(", ") || "none — denied"}.
                </li>
              ))}
            </ul>
          </details>

          <fieldset className="area-fieldset">
            <legend>Who supplies any needed parts?</legend>
            <div className="area-options parts-source-options">
              {PARTS_SOURCE_OPTIONS.map((option) => (
                <label key={option}>
                  <input name="parts-source" required type="radio" value={option} />
                  {option}
                </label>
              ))}
            </div>
          </fieldset>

          <label>
            Parts preference
            <select defaultValue="No preference" name="parts-preference" required>
              {PARTS_PREFERENCE_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>

          <fieldset className="area-fieldset">
            <legend>One exact service-location arrangement</legend>
            <div className="area-options">
              {CUSTOMER_SERVICE_LOCATION_OPTIONS.map((option) => (
                <label key={option}>
                  <input name="service-location" required type="radio" value={option} />
                  {option}
                </label>
              ))}
            </div>
          </fieldset>

          <label>
            Exact job-location type
            <select defaultValue="" name="job-location-type" required>
              <option disabled value="">Choose the physical location type</option>
              {JOB_LOCATION_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <small>
              Customer intake currently accepts only customer-controlled private
              property or a fully checked lawful roadside position. Facility-only
              workflows remain blocked.
            </small>
          </label>

          <label>
            Service address
            <input
              maxLength={240}
              name="service-address"
              placeholder="Exact street address or complete roadside position"
              required
            />
            <small>
              Enter the municipality shown above, Maryland or MD, and the same ZIP
              code in this address. The server binds all five structured fields to
              the immutable scope. This review-mode check is not geocoding.
            </small>
          </label>
          <div className="fixed-launch-area">
            <span>Structured address boundary</span>
            <strong>{JOB_SCOPE_COUNTY}, {JOB_SCOPE_STATE}</strong>
            <small>Municipality, ZIP, and policy jurisdiction must exactly agree with the submitted address.</small>
          </div>

          <fieldset className="area-fieldset">
            <legend>Property authority</legend>
            <div className="area-options">
              <label>
                <input name="property-permission" required type="radio" value="customer_confirmed_authority" />
                I control or am authorized to use this private property for the vehicle and requested provider visit.
              </label>
              <label>
                <input name="property-permission" required type="radio" value="not_applicable_public_roadside" />
                This is a public-roadside request; private-property permission does not apply, and the roadside controls must pass.
              </label>
            </div>
          </fieldset>

          <div className="field-row">
            <label>
              Vehicle driveability
              <select defaultValue="" name="vehicle-driveability" required>
                <option disabled value="">Choose current driveability</option>
                {JOB_VEHICLE_DRIVEABILITY_VALUES.map((value) => (
                  <option key={value} value={value}>{value.replaceAll("_", " ")}</option>
                ))}
              </select>
            </label>
            <label>
              Current vehicle state
              <select defaultValue="" name="vehicle-state" required>
                <option disabled value="">Choose the closest exact state</option>
                {JOB_VEHICLE_STATE_VALUES.map((value) => (
                  <option key={value} value={value}>{value.replaceAll("_", " ")}</option>
                ))}
              </select>
            </label>
          </div>

          <label>
            High-voltage involvement
            <select defaultValue="" name="high-voltage-status" required>
              <option disabled value="">Choose the known high-voltage status</option>
              {JOB_HIGH_VOLTAGE_STATUS_VALUES.map((value) => (
                <option key={value} value={value}>{value.replaceAll("_", " ")}</option>
              ))}
            </select>
            <small>Unknown or suspected high-voltage damage defaults to no authorization.</small>
          </label>

          <fieldset className="area-fieldset">
            <legend>Exact location and safety attestations</legend>
            <p>
              The selected service and location rule determine which boxes are
              required. Missing facts deny routing, quoting, booking, and later stages.
            </p>
            <div className="area-options">
              {JOB_SAFETY_ATTESTATION_OPTIONS.map((option) => (
                <label key={option.value}>
                  <input name="safety-attestation" type="checkbox" value={option.value} />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>

          <label>
            Exact requested scope
            <textarea
              maxLength={1500}
              name="job-details"
              placeholder="State the exact task requested, symptoms or condition, known hazards, access limits, and work that is not authorized. Do not include payment data or sensitive documents."
              required
              rows={6}
            />
            <small>
              A provider may quote only this scope. Any added work, substitute part,
              changed price, schedule, or performing person needs a new approval.
            </small>
          </label>

          <label className="photo-field">
            Issue photo <span>(optional)</span>
            <input accept="image/jpeg,image/png,image/webp" name="issue-photo" type="file" />
            <small>JPG, PNG, or WebP; maximum 8 MB. Do not upload identity, payment, or medical records.</small>
          </label>

          <input name="customer-acceptance-key" type="hidden" value={CUSTOMER_REQUEST_AGREEMENT_KEY} />
          <input name="customer-acceptance-version" type="hidden" value={CUSTOMER_REQUEST_AGREEMENT_VERSION} />
          <input name="customer-acceptance-hash" type="hidden" value={acceptanceHash} />
          <label className="policy-consent">
            <input name="terms-accepted" required type="checkbox" value="yes" />
            <span>
              {CUSTOMER_REQUEST_ACCEPTANCE_TEXT}{" "}
              <Link href="/terms">Terms of Use</Link>{" · "}
              <Link href="/customer-agreement">Customer Agreement</Link>
            </span>
          </label>

          <input name="customer-privacy-key" type="hidden" value={CUSTOMER_REQUEST_PRIVACY_AGREEMENT_KEY} />
          <input name="customer-privacy-version" type="hidden" value={CUSTOMER_REQUEST_PRIVACY_AGREEMENT_VERSION} />
          <input name="customer-privacy-hash" type="hidden" value={privacyHash} />
          <label className="policy-consent">
            <input name="privacy-acknowledged" required type="checkbox" value="yes" />
            <span>
              {CUSTOMER_REQUEST_PRIVACY_ACKNOWLEDGMENT_TEXT}{" "}
              <Link href="/privacy">Privacy Policy</Link>
            </span>
          </label>

          <label className="policy-consent optional-consent">
            <input name="remember-email-consent" type="checkbox" value="yes" />
            <span>Create a reusable guest profile after I verify this email. Optional.</span>
          </label>
          <label className="policy-consent optional-consent">
            <input name="marketing-consent" type="checkbox" value="yes" />
            <span>Email me occasional TUVELOZ promotions. Optional.</span>
          </label>

          <button className="button primary form-button" disabled type="submit">
            Request posting is not open
          </button>
          <p className="admin-note">
            The server rejects real submissions before reading customer data. This
            review form does not create a job, offer employment, promise work, or charge anyone.
          </p>
        </form>

        <div className="hero-actions" style={{ marginTop: 24 }}>
          <Link className="button primary" href="/account?role=customer&mode=create">
            Create a customer account <span>→</span>
          </Link>
          <Link className="button secondary" href="/join">
            Apply as an independent provider
          </Link>
        </div>
      </section>
    </main>
  );
}
