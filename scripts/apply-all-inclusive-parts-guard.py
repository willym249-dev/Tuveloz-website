from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(relative_path: str, old: str, new: str) -> None:
    path = ROOT / relative_path
    text = path.read_text(encoding="utf-8")
    if new in text:
        print(f"already patched: {relative_path}")
        return
    count = text.count(old)
    if count != 1:
        raise RuntimeError(
            f"Expected one match in {relative_path}, found {count}.\n--- old ---\n{old[:500]}"
        )
    path.write_text(text.replace(old, new, 1), encoding="utf-8")
    print(f"patched: {relative_path}")


# Provider quote form and provider workspace displays.
replace_once(
    "app/provider-jobs/page.tsx",
    '''  PARTS_SOURCE_OPTIONS,
  providerModeForWorkLocations,
  QUOTE_PART_TYPE_OPTIONS,
} from "../../lib/service-matching";
''',
    '''  PARTS_SOURCE_OPTIONS,
  providerModeForWorkLocations,
} from "../../lib/service-matching";
import {
  ALL_INCLUSIVE_PART_QUALITY_OPTIONS,
  PARTS_BILLING_TERMS_VERSION,
  PROVIDER_ALL_INCLUSIVE_NO_SEPARATE_CHARGE_TEXT,
  PROVIDER_ALL_INCLUSIVE_TAX_CERTIFICATION_TEXT,
  PROVIDER_CUSTOMER_SUPPLIED_PARTS_TEXT,
  PROVIDER_NO_PARTS_NEEDED_TEXT,
  isAllInclusivePartQuality,
  isPartsBillingModel,
  partQualityFromStoredPartType,
  partsBillingLabel,
  partsBillingModelFromStoredPartType,
  type AllInclusivePartQuality,
  type PartsBillingModel,
} from "../../lib/parts-billing";
''',
)

replace_once(
    "app/provider-jobs/page.tsx",
    '''type PendingQuote = {
  requestId: string;
  laborPrice: string;
  partsPrice: string;
  partType: string;
  availability: string;
  message: string;
};
''',
    '''type PendingQuote = {
  requestId: string;
  servicePrice: string;
  partsBillingModel: PartsBillingModel;
  partQuality: AllInclusivePartQuality | "";
  partsDescription: string;
  providerPartsTermsAccepted: boolean;
  providerPartsTaxConfirmed: boolean;
  availability: string;
  message: string;
};
''',
)

replace_once(
    "app/provider-jobs/page.tsx",
    '''function PartTypeHelp() {
  return (
    <details className="legal-help">
      <summary aria-label="What do the part types mean?">?</summary>
      <span>
        OEM means a part made for the vehicle brand. Aftermarket means a compatible
        part made by another company. Choose “No parts needed” only when the quote
        includes labor without a new part.
      </span>
    </details>
  );
}

function defaultPartType(preference: string) {
  return preference === "OEM" || preference === "Aftermarket"
    ? preference
    : "Aftermarket";
}
''',
    '''function PartsBillingHelp() {
  return (
    <details className="legal-help">
      <summary aria-label="How do provider-supplied parts work?">?</summary>
      <span>
        Customer-supplied parts remain outside the Tuveloz payment. When you supply
        parts, quote one all-inclusive repair-service price and describe the included
        items without assigning them a separate price. Separately priced parts,
        reimbursements, core charges, tire fees, and over-the-counter sales are disabled.
      </span>
    </details>
  );
}

function defaultPartQuality(preference: string): AllInclusivePartQuality {
  return preference === "OEM" || preference === "Aftermarket"
    ? preference
    : "Aftermarket";
}

type QuotePartsRecord = {
  partType: string;
  partsPriceCents: string;
};

function quotePartsLabel(record: QuotePartsRecord) {
  const model = partsBillingModelFromStoredPartType(
    record.partType,
    record.partsPriceCents,
  );
  return partsBillingLabel(model, partQualityFromStoredPartType(record.partType));
}
''',
)

replace_once(
    "app/provider-jobs/page.tsx",
    '''  function reviewQuote(event: FormEvent<HTMLFormElement>, requestId: string) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    setError("");
    setPendingQuote({
      requestId,
      laborPrice: String(values.laborPrice ?? ""),
      partsPrice: String(values.partsPrice ?? "0"),
      partType: String(values.partType ?? "Customer supplied"),
      availability: String(values.availability ?? ""),
      message: String(values.message ?? ""),
    });
  }
''',
    '''  function reviewQuote(event: FormEvent<HTMLFormElement>, requestId: string) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    const rawModel = String(values.partsBillingModel ?? "customer_supplied");
    const rawQuality = String(values.partQuality ?? "");
    const partsDescription = String(values.partsDescription ?? "").trim();
    const providerPartsTermsAccepted = values.providerPartsTermsAccepted === "on";
    const providerPartsTaxConfirmed = values.providerPartsTaxConfirmed === "on";
    setError("");
    if (!isPartsBillingModel(rawModel)) {
      setError("Choose a valid parts arrangement.");
      return;
    }
    const partQuality = isAllInclusivePartQuality(rawQuality) ? rawQuality : "";
    if (!providerPartsTermsAccepted) {
      setError("Confirm the selected parts arrangement before reviewing the quote.");
      return;
    }
    if (
      rawModel === "provider_all_inclusive"
      && (!partQuality || !partsDescription || !providerPartsTaxConfirmed)
    ) {
      setError(
        "For provider-supplied parts, choose OEM or aftermarket, list the included items, and confirm the tax responsibility.",
      );
      return;
    }
    setPendingQuote({
      requestId,
      servicePrice: String(values.servicePrice ?? ""),
      partsBillingModel: rawModel,
      partQuality,
      partsDescription,
      providerPartsTermsAccepted,
      providerPartsTaxConfirmed,
      availability: String(values.availability ?? ""),
      message: String(values.message ?? ""),
    });
  }
''',
)

replace_once(
    "app/provider-jobs/page.tsx",
    '''  const completedLaborCents = completedJobs.reduce(
    (total, job) => total + Number(job.laborPriceCents),
    0,
  );
  const completedPartsCents = completedJobs.reduce(
    (total, job) => total + Number(job.partsPriceCents),
    0,
  );
''',
    "",
)

replace_once(
    "app/provider-jobs/page.tsx",
    '''              {activeJobs.map((job) => {
                const next = nextStatus[job.status];
                return (
''',
    '''              {activeJobs.map((job) => {
                const next = nextStatus[job.status];
                const partsLabel = quotePartsLabel(job);
                return (
''',
)

replace_once(
    "app/provider-jobs/page.tsx",
    '''                    <dl className="quote-breakdown compact">
                      <div><dt>Labor</dt><dd>${(Number(job.laborPriceCents) / 100).toFixed(2)}</dd></div>
                      {job.partsSource !== PARTS_SOURCE_OPTIONS[0] && (
                        <div>
                          <dt>
                            Parts
                            {job.partType === "Not specified" ? "" : ` (${job.partType})`}
                          </dt>
                          <dd>${(Number(job.partsPriceCents) / 100).toFixed(2)}</dd>
                        </div>
                      )}
                      <div className="total"><dt>Total</dt><dd>${(Number(job.priceCents) / 100).toFixed(2)}</dd></div>
                    </dl>
''',
    '''                    <dl className="quote-breakdown compact">
                      <div><dt>Parts arrangement</dt><dd>{partsLabel}</dd></div>
                      <div className="total">
                        <dt>Accepted provider service price</dt>
                        <dd>${(Number(job.priceCents) / 100).toFixed(2)}</dd>
                      </div>
                    </dl>
''',
)

replace_once(
    "app/provider-jobs/page.tsx",
    '''                  <dl className="quote-breakdown compact">
                    <div><dt>Labor</dt><dd>${(Number(quote.laborPriceCents) / 100).toFixed(2)}</dd></div>
                    <div><dt>Parts ({quote.partType})</dt><dd>${(Number(quote.partsPriceCents) / 100).toFixed(2)}</dd></div>
                    <div className="total"><dt>Your subtotal</dt><dd>${(Number(quote.priceCents) / 100).toFixed(2)}</dd></div>
                    <div><dt>Customer sees</dt><dd>${(Number(quote.customerTotalCents) / 100).toFixed(2)}</dd></div>
                  </dl>
''',
    '''                  <dl className="quote-breakdown compact">
                    <div><dt>Parts arrangement</dt><dd>{quotePartsLabel(quote)}</dd></div>
                    <div className="total"><dt>Your service price</dt><dd>${(Number(quote.priceCents) / 100).toFixed(2)}</dd></div>
                    <div><dt>Customer sees</dt><dd>${(Number(quote.customerTotalCents) / 100).toFixed(2)}</dd></div>
                  </dl>
''',
)

replace_once(
    "app/provider-jobs/page.tsx",
    '''                  <dl className="quote-breakdown compact">
                    <div><dt>Labor</dt><dd>${(Number(job.laborPriceCents) / 100).toFixed(2)}</dd></div>
                    <div><dt>Parts</dt><dd>${(Number(job.partsPriceCents) / 100).toFixed(2)}</dd></div>
                    <div className="total"><dt>Accepted quote subtotal</dt><dd>${(Number(job.priceCents) / 100).toFixed(2)}</dd></div>
                  </dl>
''',
    '''                  <dl className="quote-breakdown compact">
                    <div><dt>Parts arrangement</dt><dd>{quotePartsLabel(job)}</dd></div>
                    <div className="total"><dt>Accepted provider service price</dt><dd>${(Number(job.priceCents) / 100).toFixed(2)}</dd></div>
                  </dl>
''',
)

replace_once(
    "app/provider-jobs/page.tsx",
    '''          <div className="earnings-grid">
            <div><span>Completed job value</span><strong>${(completedJobValueCents / 100).toFixed(2)}</strong></div>
            <div><span>Labor</span><strong>${(completedLaborCents / 100).toFixed(2)}</strong></div>
            <div><span>Parts</span><strong>${(completedPartsCents / 100).toFixed(2)}</strong></div>
            <div><span>Actual time</span><strong>{durationLabel(trackedSecondsTotal)}</strong></div>
            <div><span>Billable time</span><strong>{durationLabel(billableMinutesTotal * 60)}</strong></div>
          </div>
''',
    '''          <div className="earnings-grid">
            <div><span>Completed service value</span><strong>${(completedJobValueCents / 100).toFixed(2)}</strong></div>
            <div><span>Completed jobs</span><strong>{completedJobs.length}</strong></div>
            <div><span>Actual time</span><strong>{durationLabel(trackedSecondsTotal)}</strong></div>
            <div><span>Billable time</span><strong>{durationLabel(billableMinutesTotal * 60)}</strong></div>
          </div>
''',
)

replace_once(
    "app/provider-jobs/page.tsx",
    '''                <form onSubmit={(event) => reviewQuote(event, job.id)}>
                  <div className="quote-breakdown-fields">
                    <label>
                      Labor ($)
                      <input
                        disabled={pendingQuote?.requestId === job.id}
                        required
                        name="laborPrice"
                        type="number"
                        min="0.01"
                        step="0.01"
                        placeholder="0.00"
                      />
                    </label>
                    {job.partsSource === PARTS_SOURCE_OPTIONS[0] ? (
                      <>
                        <input name="partsPrice" type="hidden" value="0" />
                        <input name="partType" type="hidden" value="Customer supplied" />
                      </>
                    ) : (
                      <>
                        <label>
                          <span className="field-label-with-help">
                            Part type
                            <PartTypeHelp />
                          </span>
                          <select
                            defaultValue={defaultPartType(job.partsPreference)}
                            disabled={pendingQuote?.requestId === job.id}
                            name="partType"
                            required
                          >
                            {QUOTE_PART_TYPE_OPTIONS.map((option) => (
                              <option key={option}>{option}</option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Parts price ($)
                          <input
                            defaultValue="0"
                            disabled={pendingQuote?.requestId === job.id}
                            required
                            name="partsPrice"
                            type="number"
                            min="0"
                            step="0.01"
                          />
                        </label>
                      </>
                    )}
                  </div>
                  <input disabled={pendingQuote?.requestId === job.id} required name="availability" placeholder="Availability, e.g. Saturday 10–2" />
                  <textarea disabled={pendingQuote?.requestId === job.id} required name="message" rows={3} placeholder="Explain what the labor and parts amounts include." />
                  {pendingQuote?.requestId !== job.id && <button className="button primary" type="submit">Review quote →</button>}
                </form>
''',
    '''                <form onSubmit={(event) => reviewQuote(event, job.id)}>
                  <div className="quote-breakdown-fields">
                    <label>
                      One provider service price ($)
                      <input
                        disabled={pendingQuote?.requestId === job.id}
                        required
                        name="servicePrice"
                        type="number"
                        min="0.01"
                        step="0.01"
                        placeholder="0.00"
                      />
                      <small>Do not enter a separate parts, materials, reimbursement, core, or tire amount.</small>
                    </label>
                    {job.partsSource === PARTS_SOURCE_OPTIONS[0] ? (
                      <>
                        <input name="partsBillingModel" type="hidden" value="customer_supplied" />
                        <p className="admin-note">{PROVIDER_CUSTOMER_SUPPLIED_PARTS_TEXT}</p>
                      </>
                    ) : (
                      <>
                        <label>
                          <span className="field-label-with-help">
                            Parts arrangement
                            <PartsBillingHelp />
                          </span>
                          <select
                            defaultValue="provider_all_inclusive"
                            disabled={pendingQuote?.requestId === job.id}
                            name="partsBillingModel"
                            required
                          >
                            <option value="provider_all_inclusive">Provider supplies parts in one all-inclusive repair price</option>
                            <option value="customer_supplied">Customer supplies all required parts</option>
                            <option value="no_parts_needed">No new parts are needed</option>
                          </select>
                        </label>
                        <label>
                          Included part quality
                          <select
                            defaultValue={defaultPartQuality(job.partsPreference)}
                            disabled={pendingQuote?.requestId === job.id}
                            name="partQuality"
                          >
                            {ALL_INCLUSIVE_PART_QUALITY_OPTIONS.map((option) => (
                              <option key={option}>{option}</option>
                            ))}
                          </select>
                          <small>Used only when you supply the parts.</small>
                        </label>
                        <label>
                          Parts/materials included in the one service price
                          <textarea
                            disabled={pendingQuote?.requestId === job.id}
                            name="partsDescription"
                            rows={2}
                            placeholder="Example: front brake pads, hardware kit, and brake cleaner. Do not enter prices."
                          />
                        </label>
                      </>
                    )}
                  </div>
                  <input name="partsPrice" type="hidden" value="0" />
                  <input disabled={pendingQuote?.requestId === job.id} required name="availability" placeholder="Availability, e.g. Saturday 10–2" />
                  <textarea disabled={pendingQuote?.requestId === job.id} required name="message" rows={3} placeholder="Explain the repair service, warranty, timing, and anything the customer should know. Do not list a separate parts price." />
                  <label className="policy-consent">
                    <input
                      disabled={pendingQuote?.requestId === job.id}
                      name="providerPartsTermsAccepted"
                      required
                      type="checkbox"
                    />
                    <span>
                      I confirm the selected parts arrangement is accurate and no separate goods charge is included through Tuveloz. I agree to the <Link href="/provider-agreement">Provider Agreement</Link> and <Link href="/payments">Payment Policy</Link>.
                    </span>
                  </label>
                  {job.partsSource !== PARTS_SOURCE_OPTIONS[0] && (
                    <label className="policy-consent">
                      <input
                        disabled={pendingQuote?.requestId === job.id}
                        name="providerPartsTaxConfirmed"
                        type="checkbox"
                      />
                      <span>{PROVIDER_ALL_INCLUSIVE_TAX_CERTIFICATION_TEXT} Required only when you choose provider-supplied parts.</span>
                    </label>
                  )}
                  {pendingQuote?.requestId !== job.id && <button className="button primary" type="submit">Review quote →</button>}
                </form>
''',
)

replace_once(
    "app/provider-jobs/page.tsx",
    '''                    <p>
                      Labor ${(Number(pendingQuote.laborPrice) || 0).toFixed(2)} + {pendingQuote.partType.toLowerCase()} ${(Number(pendingQuote.partsPrice) || 0).toFixed(2)}
                      {" "}makes a ${(Number(pendingQuote.laborPrice || 0) + Number(pendingQuote.partsPrice || 0)).toFixed(2)} total.
                      Availability: “{pendingQuote.availability}.” Please confirm the details are correct.
                    </p>
''',
    '''                    <p>
                      One provider service price: ${(Number(pendingQuote.servicePrice) || 0).toFixed(2)}.
                      Parts arrangement: {partsBillingLabel(pendingQuote.partsBillingModel, pendingQuote.partQuality)}.
                      Availability: “{pendingQuote.availability}.” Please confirm the details are correct.
                    </p>
                    <p className="approval-note">
                      {pendingQuote.partsBillingModel === "provider_all_inclusive"
                        ? `${PROVIDER_ALL_INCLUSIVE_NO_SEPARATE_CHARGE_TEXT} ${PROVIDER_ALL_INCLUSIVE_TAX_CERTIFICATION_TEXT} Included items: ${pendingQuote.partsDescription}.`
                        : pendingQuote.partsBillingModel === "customer_supplied"
                          ? PROVIDER_CUSTOMER_SUPPLIED_PARTS_TEXT
                          : PROVIDER_NO_PARTS_NEEDED_TEXT}
                      {" "}Certification version: {PARTS_BILLING_TERMS_VERSION}.
                    </p>
''',
)

# Provider quote API: one service price, zero separate parts amount, and immutable certifications.
replace_once(
    "app/api/jobs/route.ts",
    '''  providerMatchesServiceLocation,
  parseProviderServices,
  QUOTE_PART_TYPE_OPTIONS,
} from "../../../lib/service-matching";
''',
    '''  providerMatchesServiceLocation,
  parseProviderServices,
} from "../../../lib/service-matching";
import {
  PARTS_BILLING_TERMS_VERSION,
  allInclusivePartsAllowedForServiceCodes,
  composeQuoteMessage,
  isAllInclusivePartQuality,
  isPartsBillingModel,
  storedPartTypeFor,
} from "../../../lib/parts-billing";
''',
)

replace_once(
    "app/api/jobs/route.ts",
    '''import { CUSTOMER_REQUEST_SCOPE_VERSION } from "../../../lib/customer-job-scope";
''',
    '''import { CUSTOMER_REQUEST_SCOPE_VERSION } from "../../../lib/customer-job-scope";
import { policyAccepted } from "../../../lib/policies";
''',
)

replace_once(
    "app/api/jobs/route.ts",
    '''  const availability = clean(body.availability, 200);
  const message = clean(body.message, 800);
  let partType = clean(body.partType, 40);
  const laborPrice = Number(body.laborPrice ?? body.price);
  const partsPrice = Number(body.partsPrice ?? 0);
  const price = laborPrice + partsPrice;
  if (
    !availability
    || !message
    || !Number.isFinite(laborPrice)
    || !Number.isFinite(partsPrice)
    || laborPrice < 0
    || partsPrice < 0
    || price <= 0
  ) {
    return Response.json({
      error: "Enter valid labor and parts amounts, with a total greater than $0.",
    }, { status: 400 });
  }
''',
    '''  const availability = clean(body.availability, 200);
  const providerMessage = clean(body.message, 800);
  const partsBillingModel = clean(body.partsBillingModel, 80);
  const requestedPartQuality = clean(body.partQuality, 40);
  const partsDescription = clean(body.partsDescription, 600);
  const servicePrice = Number(body.servicePrice ?? body.laborPrice ?? body.price);
  const submittedPartsPrice = Number(body.partsPrice ?? 0);
  const providerPartsTermsAccepted = policyAccepted(body.providerPartsTermsAccepted);
  const providerPartsTaxConfirmed = policyAccepted(body.providerPartsTaxConfirmed);
  if (
    !availability
    || !providerMessage
    || !Number.isFinite(servicePrice)
    || servicePrice <= 0
    || servicePrice > 1_000_000
    || !Number.isFinite(submittedPartsPrice)
    || submittedPartsPrice !== 0
  ) {
    return Response.json({
      error: "Enter one valid provider service price. Separate parts or materials amounts are disabled.",
    }, { status: 400 });
  }
  if (!isPartsBillingModel(partsBillingModel)) {
    return Response.json({ error: "Choose a valid parts arrangement." }, { status: 400 });
  }
  if (!providerPartsTermsAccepted) {
    return Response.json({
      error: "Confirm the selected parts arrangement and no-separate-goods-charge rule.",
    }, { status: 400 });
  }
''',
)

replace_once(
    "app/api/jobs/route.ts",
    '''  if (job.partsSource === "I have the parts — labor only") {
    if (partsPrice > 0) {
      return Response.json({
        error: "This customer is supplying the parts, so the parts amount must be $0.",
      }, { status: 400 });
    }
    partType = "Customer supplied";
  } else {
    if (!QUOTE_PART_TYPE_OPTIONS.includes(
      partType as (typeof QUOTE_PART_TYPE_OPTIONS)[number],
    )) {
      return Response.json({ error: "Choose the part type included in this quote." }, { status: 400 });
    }
    if (
      (job.partsPreference === "OEM" || job.partsPreference === "Aftermarket")
      && partType !== job.partsPreference
      && partType !== "No parts needed"
    ) {
      return Response.json({
        error: `This customer requested ${job.partsPreference} parts.`,
      }, { status: 400 });
    }
    if (partType === "No parts needed" && partsPrice !== 0) {
      return Response.json({
        error: "Choose a $0 parts price when no parts are needed.",
      }, { status: 400 });
    }
    if (partType !== "No parts needed" && partsPrice <= 0) {
      return Response.json({
        error: "Enter the price for the selected part type.",
      }, { status: 400 });
    }
  }
''',
    '''  let selectedPartQuality: "OEM" | "Aftermarket" | "" = "";
  if (partsBillingModel === "provider_all_inclusive") {
    if (job.partsSource === "I have the parts — labor only") {
      return Response.json({
        error: "This customer is supplying the parts. Provider-supplied parts cannot be added to this quote.",
      }, { status: 400 });
    }
    if (!allInclusivePartsAllowedForServiceCodes(serviceCodes)) {
      return Response.json({
        error: "The all-inclusive parts method is unavailable for this service because separate tire, fuel, towing, lockout, inspection, or other special rules may apply.",
        code: "SPECIAL_PARTS_FLOW_REQUIRED",
      }, { status: 409 });
    }
    if (!isAllInclusivePartQuality(requestedPartQuality)) {
      return Response.json({ error: "Choose OEM or aftermarket for provider-supplied parts." }, { status: 400 });
    }
    if (
      (job.partsPreference === "OEM" || job.partsPreference === "Aftermarket")
      && requestedPartQuality !== job.partsPreference
    ) {
      return Response.json({
        error: `This customer requested ${job.partsPreference} parts.`,
      }, { status: 400 });
    }
    if (!partsDescription) {
      return Response.json({
        error: "List the parts and materials included in the one service price without listing separate prices.",
      }, { status: 400 });
    }
    if (!providerPartsTaxConfirmed) {
      return Response.json({
        error: "Confirm your responsibility for applicable sales or use tax on parts and supplies used in this lump-sum repair.",
      }, { status: 400 });
    }
    selectedPartQuality = requestedPartQuality;
  } else if (partsBillingModel === "customer_supplied") {
    if (job.partsSource === "Provider supplies parts") {
      return Response.json({
        error: "The customer requested provider-supplied parts. Ask the customer to update the request before quoting customer-supplied parts.",
      }, { status: 400 });
    }
  }
  const partType = storedPartTypeFor(partsBillingModel, selectedPartQuality);
  const message = composeQuoteMessage({
    model: partsBillingModel,
    quality: selectedPartQuality,
    partsDescription,
    providerMessage,
  }).slice(0, 2200);
''',
)

replace_once(
    "app/api/jobs/route.ts",
    '''  const customerPrice = customerPriceFor(Math.round(price * 100));
''',
    '''  const servicePriceCents = Math.round(servicePrice * 100);
  const customerPrice = customerPriceFor(servicePriceCents);
''',
)

replace_once(
    "app/api/jobs/route.ts",
    '''      priceCents: String(customerPrice.providerQuoteCents),
      laborPriceCents: String(Math.round(laborPrice * 100)),
      partsPriceCents: String(Math.round(partsPrice * 100)),
''',
    '''      priceCents: String(customerPrice.providerQuoteCents),
      laborPriceCents: String(customerPrice.providerQuoteCents),
      partsPriceCents: "0",
''',
)

replace_once(
    "app/api/jobs/route.ts",
    '''    details: { serviceCodes, scheduledFor: job.scheduledFor, performingPersonId },
''',
    '''    details: {
      serviceCodes,
      scheduledFor: job.scheduledFor,
      performingPersonId,
      partsBillingModel,
      partType,
      partsDescription,
      partsBillingTermsVersion: PARTS_BILLING_TERMS_VERSION,
      noSeparateGoodsChargeConfirmed: providerPartsTermsAccepted,
      providerTaxResponsibilityConfirmed: providerPartsTaxConfirmed,
    },
''',
)

# Immutable customer selection evidence.
replace_once(
    "lib/customer-job-scope.ts",
    '''import { sha256Text } from "./provider-policy-acceptance";
''',
    '''import { sha256Text } from "./provider-policy-acceptance";
import type { PartsBillingModel } from "./parts-billing";
''',
)

replace_once(
    "lib/customer-job-scope.ts",
    '''  "provider-quote-selection:2",
''',
    '''  "provider-quote-selection:3",
''',
)

replace_once(
    "lib/customer-job-scope.ts",
    '''    partType: string;
    availability: string;
    message: string;
''',
    '''    partType: string;
    partsBillingModel: PartsBillingModel;
    partsBillingLabel: string;
    partsTermsVersion: string;
    availability: string;
    message: string;
''',
)

replace_once(
    "lib/customer-job-scope.ts",
    '''      partType: scope.quote.partType,
      availability: scope.quote.availability,
      message: scope.quote.message,
''',
    '''      partType: scope.quote.partType,
      partsBillingModel: scope.quote.partsBillingModel,
      partsBillingLabel: scope.quote.partsBillingLabel,
      partsTermsVersion: scope.quote.partsTermsVersion,
      availability: scope.quote.availability,
      message: scope.quote.message,
''',
)

replace_once(
    "lib/customer-job-scope.ts",
    '''export function customerProviderSelectionAcceptanceText(
  scope: CustomerQuoteSelectionScope,
) {
  const serviceLabel = scope.quote.serviceCodes.join(", ");
  const amount = (Number(scope.quote.customerTotalCents) / 100).toFixed(2);
  const operationCodes = scope.request.jobFacts.requestedOperations
    .map((operation) => operation.operationCode)
    .join(", ");
  return [
    `I select ${scope.quote.providerName} and its disclosed performing person (${scope.quote.performingPersonDisplay}) for only the exact service code ${serviceLabel} and operation ${operationCodes}.`,
    `The authorized location is ${scope.request.jobFacts.location.address} (${scope.request.jobFacts.location.type}), with the stored property, vehicle-condition, excluded-operation, and safety attestations unchanged.`,
    `I accept quote ${scope.quote.quoteId} for a displayed customer total of $${amount}, scheduled for ${scope.quote.scheduledFor}.`,
    "I agree to the linked Terms of Use, Customer Agreement, and Payment, Cancellation and Refund Policy.",
    "Accepting this quote creates a direct service agreement with the selected provider business. TUVELOZ operates the marketplace and does not perform the vehicle service.",
    "No added work, substitute part, price increase, different performing person, or changed schedule is authorized by this acceptance; each material change requires a new recorded approval.",
  ].join(" ");
}
''',
    '''export function customerProviderSelectionAcceptanceText(
  scope: CustomerQuoteSelectionScope,
) {
  const serviceLabel = scope.quote.serviceCodes.join(", ");
  const amount = (Number(scope.quote.customerTotalCents) / 100).toFixed(2);
  const operationCodes = scope.request.jobFacts.requestedOperations
    .map((operation) => operation.operationCode)
    .join(", ");
  const partsAcceptance = scope.quote.partsBillingModel === "provider_all_inclusive"
    ? "Provider-supplied parts and materials described in the quote are included in one all-inclusive repair-service price. No separate parts, materials, reimbursement, parts-markup, core-charge, tire-fee, or other goods amount is authorized through Tuveloz."
    : scope.quote.partsBillingModel === "customer_supplied"
      ? "The customer supplies all required parts. No provider-supplied part, fluid, material, reimbursement, or other good is included in the Tuveloz service price."
      : "No new part, fluid, material, reimbursement, or other good is included in the Tuveloz service price.";
  return [
    `I select ${scope.quote.providerName} and its disclosed performing person (${scope.quote.performingPersonDisplay}) for only the exact service code ${serviceLabel} and operation ${operationCodes}.`,
    `The authorized location is ${scope.request.jobFacts.location.address} (${scope.request.jobFacts.location.type}), with the stored property, vehicle-condition, excluded-operation, and safety attestations unchanged.`,
    `I accept quote ${scope.quote.quoteId} for a displayed customer total of $${amount}, scheduled for ${scope.quote.scheduledFor}.`,
    `Parts arrangement: ${scope.quote.partsBillingLabel}. ${partsAcceptance} Parts billing terms version ${scope.quote.partsTermsVersion}.`,
    "I agree to the linked Terms of Use, Customer Agreement, and Payment, Cancellation and Refund Policy.",
    "Accepting this quote creates a direct service agreement with the selected provider business. TUVELOZ operates the marketplace and does not perform the vehicle service.",
    "No added work, substitute part, separate parts charge, price increase, different performing person, or changed schedule is authorized by this acceptance; each material change requires a new recorded approval.",
  ].join(" ");
}
''',
)

# Customer quote API blocks legacy itemized parts and stores the exact model.
replace_once(
    "app/api/customer-quotes/route.ts",
    '''import {
  providerMatchesArea,
  providerMatchesServiceLocation,
} from "../../../lib/service-matching";
''',
    '''import {
  providerMatchesArea,
  providerMatchesServiceLocation,
} from "../../../lib/service-matching";
import {
  PARTS_BILLING_TERMS_VERSION,
  customerPartsDisclosure,
  partQualityFromStoredPartType,
  partsBillingLabel,
  partsBillingModelFromStoredPartType,
} from "../../../lib/parts-billing";
''',
)

replace_once(
    "app/api/customer-quotes/route.ts",
    '''  const storedFeeCents = Number(quote.customerFeeCents);
  const storedTotalCents = Number(quote.customerTotalCents);
  if (
    ![laborPriceCents, partsPriceCents, providerSubtotalCents, storedFeeCents, storedTotalCents]
      .every((value) => Number.isSafeInteger(value) && value >= 0)
    || providerSubtotalCents <= 0
    || !Number.isSafeInteger(quote.customerFeeRateBps)
    || quote.customerFeeRateBps < 0
    || quote.customerFeeRateBps > 10_000
    || laborPriceCents + partsPriceCents !== providerSubtotalCents
    || providerSubtotalCents + storedFeeCents !== storedTotalCents
    || storedFeeCents !== price.customerFeeCents
    || storedTotalCents !== price.customerTotalCents
  ) {
    return {
      scope: null,
      reason: "This quote does not contain one consistent immutable labor, parts, fee, and total breakdown.",
    };
  }
''',
    '''  const storedFeeCents = Number(quote.customerFeeCents);
  const storedTotalCents = Number(quote.customerTotalCents);
  const storedPartsModel = partsBillingModelFromStoredPartType(
    quote.partType,
    quote.partsPriceCents,
  );
  if (storedPartsModel === "legacy_itemized" || storedPartsModel === "legacy_unclassified") {
    return {
      scope: null,
      reason: "This quote uses a retired or unclassified parts flow. The provider must submit a new quote using one current service price.",
    };
  }
  const partQuality = partQualityFromStoredPartType(quote.partType);
  if (
    ![laborPriceCents, partsPriceCents, providerSubtotalCents, storedFeeCents, storedTotalCents]
      .every((value) => Number.isSafeInteger(value) && value >= 0)
    || providerSubtotalCents <= 0
    || !Number.isSafeInteger(quote.customerFeeRateBps)
    || quote.customerFeeRateBps < 0
    || quote.customerFeeRateBps > 10_000
    || partsPriceCents !== 0
    || laborPriceCents !== providerSubtotalCents
    || providerSubtotalCents + storedFeeCents !== storedTotalCents
    || storedFeeCents !== price.customerFeeCents
    || storedTotalCents !== price.customerTotalCents
  ) {
    return {
      scope: null,
      reason: "This quote does not contain one consistent immutable service price, zero separate parts amount, fee, and total.",
    };
  }
''',
)

replace_once(
    "app/api/customer-quotes/route.ts",
    '''        partType: quote.partType,
        availability: quote.availability,
        message: quote.message,
''',
    '''        partType: quote.partType,
        partsBillingModel: storedPartsModel,
        partsBillingLabel: partsBillingLabel(storedPartsModel, partQuality),
        partsTermsVersion: PARTS_BILLING_TERMS_VERSION,
        availability: quote.availability,
        message: quote.message,
''',
)

replace_once(
    "app/api/customer-quotes/route.ts",
    '''    const customerPrice = storedCustomerPrice(quote);
    const provider = providerDetails.get(quote.providerEmail);
''',
    '''    const customerPrice = storedCustomerPrice(quote);
    const presentedPartsModel = partsBillingModelFromStoredPartType(
      quote.partType,
      quote.partsPriceCents,
    );
    const presentedPartQuality = partQualityFromStoredPartType(quote.partType);
    const provider = providerDetails.get(quote.providerEmail);
''',
)

replace_once(
    "app/api/customer-quotes/route.ts",
    '''      customerTotalCents: String(customerPrice.customerTotalCents),
      ratingAverage: ratings.has(quote.providerEmail)
''',
    '''      customerTotalCents: String(customerPrice.customerTotalCents),
      partsBillingModel: presentedPartsModel,
      partsBillingLabel: partsBillingLabel(presentedPartsModel, presentedPartQuality),
      partsTermsVersion: presentedPartsModel === "legacy_itemized"
        || presentedPartsModel === "legacy_unclassified"
        ? ""
        : PARTS_BILLING_TERMS_VERSION,
      ratingAverage: ratings.has(quote.providerEmail)
''',
)

replace_once(
    "app/api/customer-quotes/route.ts",
    '''    partType: selection.scope.quote.partType,
    jobFacts: selection.scope.request.jobFacts,
''',
    '''    partType: selection.scope.quote.partType,
    partsBillingModel: selection.scope.quote.partsBillingModel,
    partsBillingLabel: selection.scope.quote.partsBillingLabel,
    partsTermsVersion: selection.scope.quote.partsTermsVersion,
    partsDisclosure: customerPartsDisclosure(
      selection.scope.quote.partsBillingModel,
      partQualityFromStoredPartType(selection.scope.quote.partType),
    ),
    jobFacts: selection.scope.request.jobFacts,
''',
)

replace_once(
    "app/api/customer-quotes/route.ts",
    '''          partsResponsibility: selection.scope.request.partsSource,
''',
    '''          partsResponsibility: selection.scope.quote.partsBillingLabel,
''',
)

# Customer quote screen shows one service price and the exact parts arrangement.
replace_once(
    "app/my-request/page.tsx",
    '''  partType: string;
  availability: string;
''',
    '''  partType: string;
  partsBillingModel: string;
  partsBillingLabel: string;
  partsTermsVersion: string;
  availability: string;
''',
)

replace_once(
    "app/my-request/page.tsx",
    '''            <dl className="quote-breakdown">
              <div><dt>Labor</dt><dd>${(Number(quote.laborPriceCents) / 100).toFixed(2)}</dd></div>
              {job?.partsSource !== PARTS_SOURCE_OPTIONS[0] && (
                <div>
                  <dt>
                    Parts
                    {quote.partType === "Not specified" ? "" : ` (${quote.partType})`}
                  </dt>
                  <dd>${(Number(quote.partsPriceCents) / 100).toFixed(2)}</dd>
                </div>
              )}
              <div><dt>Provider quote subtotal</dt><dd>${(Number(quote.priceCents) / 100).toFixed(2)}</dd></div>
              <div>
                <dt>Tuveloz service fee shown at acceptance</dt>
                <dd>${(Number(quote.customerFeeCents) / 100).toFixed(2)}</dd>
              </div>
              <div className="total">
                <dt>Customer total</dt>
                <dd>${(Number(quote.customerTotalCents) / 100).toFixed(2)}</dd>
              </div>
            </dl>
''',
    '''            <dl className="quote-breakdown">
              <div><dt>Parts arrangement</dt><dd>{quote.partsBillingLabel}</dd></div>
              <div><dt>Provider service price</dt><dd>${(Number(quote.priceCents) / 100).toFixed(2)}</dd></div>
              <div>
                <dt>Tuveloz service fee shown at acceptance</dt>
                <dd>${(Number(quote.customerFeeCents) / 100).toFixed(2)}</dd>
              </div>
              <div className="total">
                <dt>Customer total</dt>
                <dd>${(Number(quote.customerTotalCents) / 100).toFixed(2)}</dd>
              </div>
            </dl>
            <p className="approval-note">
              {quote.partsBillingModel === "provider_all_inclusive"
                ? "The provider-supplied parts and materials described below are included in the one provider service price. No separate parts charge is authorized through Tuveloz."
                : quote.partsBillingModel === "customer_supplied"
                  ? "You supply all required parts. No provider-supplied parts are included in the Tuveloz payment."
                  : quote.partsBillingModel === "no_parts_needed"
                    ? "No new parts or materials are included in this quote."
                    : "This legacy quote cannot be selected until the provider replaces it with the current one-price format."}
            </p>
''',
)

# Checkout card repeats the exact parts model before payment.
replace_once(
    "app/components/quote-payment-card.tsx",
    '''    partsPriceCents: string;
    customerFeeRateBps: number;
''',
    '''    partsPriceCents: string;
    partsBillingModel: string;
    partsBillingLabel: string;
    customerFeeRateBps: number;
''',
)

replace_once(
    "app/components/quote-payment-card.tsx",
    '''  const taxAndOtherCents = Math.max(
    0,
    Number(quote.priceCents)
      - Number(quote.laborPriceCents)
      - Number(quote.partsPriceCents),
  );
''',
    '''  const usesCurrentPartsModel = [
    "customer_supplied",
    "provider_all_inclusive",
    "no_parts_needed",
  ].includes(quote.partsBillingModel);
''',
)

replace_once(
    "app/components/quote-payment-card.tsx",
    '''      <dl className="quote-breakdown">
        <div><dt>Provider labor</dt><dd>{dollars(quote.laborPriceCents)}</dd></div>
        <div><dt>Provider parts</dt><dd>{dollars(quote.partsPriceCents)}</dd></div>
        <div><dt>Authorized tax and other charges</dt><dd>{dollars(taxAndOtherCents)}</dd></div>
        <div><dt>Complete authorized provider amount</dt><dd>{dollars(quote.priceCents)}</dd></div>
        <div>
          <dt>Tuveloz service fee ({quote.customerFeeRateBps / 100}%)</dt>
          <dd>{dollars(quote.customerFeeCents)}</dd>
        </div>
        <div className="total"><dt>Total</dt><dd>{dollars(quote.customerTotalCents)}</dd></div>
      </dl>
''',
    '''      <dl className="quote-breakdown">
        <div><dt>Parts arrangement</dt><dd>{quote.partsBillingLabel}</dd></div>
        {usesCurrentPartsModel ? (
          <div><dt>Provider service price</dt><dd>{dollars(quote.priceCents)}</dd></div>
        ) : (
          <>
            <div><dt>Legacy provider labor</dt><dd>{dollars(quote.laborPriceCents)}</dd></div>
            <div><dt>Legacy separately itemized parts</dt><dd>{dollars(quote.partsPriceCents)}</dd></div>
          </>
        )}
        <div>
          <dt>Tuveloz service fee ({quote.customerFeeRateBps / 100}%)</dt>
          <dd>{dollars(quote.customerFeeCents)}</dd>
        </div>
        <div className="total"><dt>Total</dt><dd>{dollars(quote.customerTotalCents)}</dd></div>
      </dl>
''',
)

replace_once(
    "app/components/quote-payment-card.tsx",
    '''              I am 18 or older and agree to the <Link href="/terms">Terms</Link>,{" "}
              <Link href="/customer-agreement">Customer Agreement</Link>, and{" "}
              <Link href="/payments">Payment Policy</Link>.
''',
    '''              I am 18 or older, accept the displayed “{quote.partsBillingLabel}” arrangement and exact total, and agree to the <Link href="/terms">Terms</Link>,{" "}
              <Link href="/customer-agreement">Customer Agreement</Link>, and{" "}
              <Link href="/payments">Payment Policy</Link>.
''',
)

# Stripe checkout refuses retired itemized-parts quotes even if an old record was accepted.
replace_once(
    "app/api/stripe/checkout/route.ts",
    '''import { jobScopeFactsFromScopeDetails } from "../../../../lib/job-scope-facts";
''',
    '''import { jobScopeFactsFromScopeDetails } from "../../../../lib/job-scope-facts";
import {
  PARTS_BILLING_TERMS_VERSION,
  partQualityFromStoredPartType,
  partsBillingLabel,
  partsBillingModelFromStoredPartType,
} from "../../../../lib/parts-billing";
''',
)

replace_once(
    "app/api/stripe/checkout/route.ts",
    '''    providerAmount: providerQuotes.priceCents,
    customerFeeRateBps: providerQuotes.customerFeeRateBps,
''',
    '''    providerAmount: providerQuotes.priceCents,
    laborPriceCents: providerQuotes.laborPriceCents,
    partsPriceCents: providerQuotes.partsPriceCents,
    partType: providerQuotes.partType,
    customerFeeRateBps: providerQuotes.customerFeeRateBps,
''',
)

replace_once(
    "app/api/stripe/checkout/route.ts",
    '''  if (selection.isTestJob === "yes") {
    return Response.json({
      checkoutAllowed: false,
      reason: "Test jobs never create real or sandbox payments.",
      payment: null,
    });
  }
''',
    '''  if (selection.isTestJob === "yes") {
    return Response.json({
      checkoutAllowed: false,
      reason: "Test jobs never create real or sandbox payments.",
      payment: null,
    });
  }
  const partsModel = partsBillingModelFromStoredPartType(
    selection.partType,
    selection.partsPriceCents,
  );
  if (
    partsModel === "legacy_itemized"
    || partsModel === "legacy_unclassified"
    || Number(selection.partsPriceCents) !== 0
    || Number(selection.laborPriceCents) !== Number(selection.providerAmount)
  ) {
    return Response.json({
      checkoutAllowed: false,
      reason: "This quote uses the retired itemized-parts flow. Ask the provider for a new one-price quote before paying.",
      payment: publicPaymentSummary(await latestQuotePayment(quoteId)),
    });
  }
''',
)

replace_once(
    "app/api/stripe/checkout/route.ts",
    '''    let settlementStrategy: "destination_charge" | "separate_transfer";
    let lineItems: Stripe.Checkout.SessionCreateParams.LineItem[];
''',
    '''    let settlementStrategy: "destination_charge" | "separate_transfer";
    let partsBillingModel = "";
    let partsBillingDescription = "";
    let lineItems: Stripe.Checkout.SessionCreateParams.LineItem[];
''',
)

replace_once(
    "app/api/stripe/checkout/route.ts",
    '''      if (selection.isTestJob === "yes") {
        return Response.json(
          { error: "Test jobs cannot create Stripe Checkout sessions." },
          { status: 409 },
        );
      }
''',
    '''      if (selection.isTestJob === "yes") {
        return Response.json(
          { error: "Test jobs cannot create Stripe Checkout sessions." },
          { status: 409 },
        );
      }
      const selectedPartsModel = partsBillingModelFromStoredPartType(
        selection.partType,
        selection.partsPriceCents,
      );
      if (
        selectedPartsModel === "legacy_itemized"
        || selectedPartsModel === "legacy_unclassified"
        || Number(selection.partsPriceCents) !== 0
        || Number(selection.laborPriceCents) !== Number(selection.providerAmount)
      ) {
        return Response.json({
          error: "This quote uses the retired itemized-parts flow. A new one-price quote is required before checkout.",
          code: "CURRENT_PARTS_BILLING_REQUIRED",
        }, { status: 409, headers: { "cache-control": "no-store" } });
      }
      partsBillingModel = selectedPartsModel;
      partsBillingDescription = partsBillingLabel(
        selectedPartsModel,
        partQualityFromStoredPartType(selection.partType),
      );
''',
)

replace_once(
    "app/api/stripe/checkout/route.ts",
    '''              description: `Provider quote from ${selection.providerName}`,
''',
    '''              description: `Provider quote from ${selection.providerName}. ${partsBillingDescription}`,
''',
)

replace_once(
    "app/api/stripe/checkout/route.ts",
    '''      ...(scopeAuthorizationDecisionId
        ? { tuveloz_scope_authorization_id: scopeAuthorizationDecisionId }
        : {}),
      ...(finalProductId ? { tuveloz_product_id: finalProductId } : {}),
''',
    '''      ...(scopeAuthorizationDecisionId
        ? { tuveloz_scope_authorization_id: scopeAuthorizationDecisionId }
        : {}),
      ...(partsBillingModel
        ? {
            tuveloz_parts_billing_model: partsBillingModel,
            tuveloz_parts_terms_version: PARTS_BILLING_TERMS_VERSION,
          }
        : {}),
      ...(finalProductId ? { tuveloz_product_id: finalProductId } : {}),
''',
)

print("All-inclusive parts source patch completed.")
