"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import {
  emptyProviderSelfAssessment,
  evaluateProviderServices,
  getProviderLegalRequirementFlags,
  type ProviderSelfAssessment,
} from "../../lib/provider-compliance";
import {
  CURRENT_LAUNCH_AREA,
  PROVIDER_WORK_LOCATION_OPTIONS,
  providerModeForWorkLocations,
} from "../../lib/service-matching";
import {
  POLICY_JURISDICTION,
  POLICY_STATUS,
  POLICY_VERSION,
  PROVIDER_LEVEL_LABELS,
  SERVICES,
  type ProviderLevel,
  type ServiceCode,
} from "../../lib/provider-policy";
import {
  getRequiredDocumentsForSelection,
  needsProofStep,
} from "../../lib/service-tiers";
import {
  PROVIDER_PRIVACY_ACKNOWLEDGMENT_TEXT,
  PROVIDER_TERMS_ACCEPTANCE_TEXT,
} from "../../lib/provider-policy-acceptance";
import { track } from "../../lib/analytics";
import { AddressAutocompleteInput } from "./address-autocomplete-input";
import { MUNICIPALITY_DATALIST_ID } from "./location-datalists";
import { useSiteLanguage } from "./site-language";
import { ConfirmAction } from "./confirm-action";
import { LegalHelp } from "./legal-help";

/**
 * New provider signups only ever create independent-contractor accounts.
 * Sponsored-trainee/provider-business-employee pathways stay in the schema
 * and admin tooling for existing records but are no longer offered here.
 */
const PROVIDER_PATHWAY = "independent_startup" as const;

const PROVIDER_REVIEW_SERVICES = SERVICES.filter(
  (service) => service.code !== "general_auto_repair",
);

const PROVIDER_REVIEW_SERVICE_GROUPS = [
  {
    id: "limited",
    label: "Getting started — basic services",
    description: "Entry-level services. Selecting one doesn't enroll you in training or authorize customer work.",
    services: PROVIDER_REVIEW_SERVICES.filter((service) => (
      service.allowedProviderLevels.includes("sponsored_trainee")
      || service.allowedProviderLevels.includes("provisional_independent")
    )),
  },
  {
    id: "standard",
    label: "Standard services",
    description: "Requires a registered provider business with matching coverage.",
    services: PROVIDER_REVIEW_SERVICES.filter((service) => (
      service.allowedProviderLevels.includes("standard_provider")
    )),
  },
  {
    id: "specialty",
    label: "Specialty services",
    description: "Requires the listed licenses, permits, and approvals.",
    services: PROVIDER_REVIEW_SERVICES.filter((service) => (
      service.allowedProviderLevels.includes("specialty_provider")
    )),
  },
] as const;

function deriveProviderLevel(selectedServices: readonly ServiceCode[]): ProviderLevel {
  const selectedPolicies = selectedServices.map((code) => (
    PROVIDER_REVIEW_SERVICES.find((service) => service.code === code)
  ));
  if (selectedPolicies.some((service) => service?.allowedProviderLevels.includes("specialty_provider"))) {
    return "specialty_provider";
  }
  if (selectedPolicies.some((service) => service?.allowedProviderLevels.includes("standard_provider"))) {
    return "standard_provider";
  }
  return "provisional_independent";
}

type SignupStep = 1 | 2 | 3;

const SELECTED_PROVIDER_AREAS = [CURRENT_LAUNCH_AREA];

export function ProviderSignupForm() {
  const { language } = useSiteLanguage();
  const providerFormIsSpanish = language === "es";

  const [step, setStep] = useState<SignupStep>(1);
  const [selectedProviderServices, setSelectedProviderServices] = useState<ServiceCode[]>([]);
  const [tierSwapNotice, setTierSwapNotice] = useState("");
  const [selectedProviderWorkLocations, setSelectedProviderWorkLocations] = useState<string[]>([]);
  const [legalConfirmed, setLegalConfirmed] = useState(false);
  const [providerAssessment, setProviderAssessment] = useState<ProviderSelfAssessment>(
    emptyProviderSelfAssessment,
  );
  const [stepError, setStepError] = useState("");
  const [applicationSent, setApplicationSent] = useState(false);
  const [applicationBusy, setApplicationBusy] = useState(false);
  const [applicationError, setApplicationError] = useState("");
  const [applicationChallengeId, setApplicationChallengeId] = useState("");
  const [applicationVerificationCode, setApplicationVerificationCode] = useState("");
  const [pendingApplicationPayload, setPendingApplicationPayload] = useState<Record<string, unknown> | null>(null);
  const [confirmingSubmit, setConfirmingSubmit] = useState(false);

  const providerLevel = deriveProviderLevel(selectedProviderServices);
  const providerAcceptsCustomersAtBusiness = selectedProviderWorkLocations.includes(
    PROVIDER_WORK_LOCATION_OPTIONS[1],
  );
  // Same display-name-keyed lookup the page used before extraction; selected
  // services are policy ServiceCodes, so this may already under-match against
  // the legacy string sets in lib/provider-compliance.ts. Preserved as-is —
  // reconciling that mismatch is a separate piece of work.
  const providerLegalRequirements = getProviderLegalRequirementFlags(
    selectedProviderServices,
    SELECTED_PROVIDER_AREAS,
  );
  const providerEligibility = evaluateProviderServices(
    selectedProviderServices,
    SELECTED_PROVIDER_AREAS,
    providerAssessment,
  );
  const providerEligibilityResults = Object.values(providerEligibility);
  const providerLegalStatus = providerEligibilityResults.some((result) => result.status === "blocked")
    ? "blocked"
    : providerEligibilityResults.some((result) => result.status === "needs-review")
      ? "needs-review"
      : "ready";
  const hasVisibleLegalRequirements = Object.values(providerLegalRequirements).some(Boolean);
  const showProofStep = needsProofStep(selectedProviderServices, PROVIDER_PATHWAY);
  const requiredDocumentsBySelection = getRequiredDocumentsForSelection(
    selectedProviderServices,
    PROVIDER_PATHWAY,
  );
  const showStep2 = showProofStep || hasVisibleLegalRequirements;

  function resetChallenge() {
    setApplicationChallengeId("");
    setApplicationVerificationCode("");
    setPendingApplicationPayload(null);
    setConfirmingSubmit(false);
  }

  function goToStep1() {
    resetChallenge();
    setStepError("");
    setStep(1);
  }

  function goToStep2() {
    if (selectedProviderServices.length === 0) {
      setStepError(
        providerFormIsSpanish
          ? "Elija al menos un servicio."
          : "Pick at least one service.",
      );
      return;
    }
    setStepError("");
    resetChallenge();
    track("provider_step1_completed");
    setStep(showStep2 ? 2 : 3);
  }

  function goToStep3() {
    if (hasVisibleLegalRequirements && !legalConfirmed) {
      setStepError(
        providerFormIsSpanish
          ? "Confirme que entiende los requisitos legales mostrados."
          : "Confirm you understand the legal requirements shown above.",
      );
      return;
    }
    setStepError("");
    resetChallenge();
    track("provider_step2_completed");
    setStep(3);
  }

  async function handleFinalSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const values = Object.fromEntries(formData.entries());

    if (selectedProviderWorkLocations.length === 0) {
      setApplicationError(
        providerFormIsSpanish
          ? "Elija al menos una forma de atender a los clientes."
          : "Choose at least one way customers can receive service.",
      );
      return;
    }

    const legalRequirementsAccepted = !hasVisibleLegalRequirements || legalConfirmed;
    const adultAcknowledged = formData.get("adult-acknowledged") === "yes";
    const employmentResponsibilityAcknowledged = (
      formData.get("employment-work-authorization-acknowledged") === "yes"
    );
    const termsBundleAccepted = formData.get("terms-bundle-accepted") === "yes";
    const privacyAcknowledged = formData.get("privacy-acknowledged") === "yes";
    const payload = {
      name: values["provider-name"],
      email: values["provider-email"],
      preferredLanguage: providerFormIsSpanish ? "Spanish" : "English",
      services: selectedProviderServices,
      serviceCodes: selectedProviderServices,
      applicationPathway: PROVIDER_PATHWAY,
      providerPathway: PROVIDER_PATHWAY,
      providerLevel,
      learningAccountOnly: false,
      policyVersion: POLICY_VERSION,
      policyStatus: POLICY_STATUS,
      policyJurisdiction: POLICY_JURISDICTION,
      serviceArea: SELECTED_PROVIDER_AREAS.join(" | "),
      businessMunicipality: values["business-municipality"],
      legalBusinessName: values["legal-business-name"],
      businessEntityType: values["business-entity-type"],
      businessFormationState: values["business-formation-state"],
      workLocations: selectedProviderWorkLocations,
      businessServiceAddress: values["business-service-address"],
      experience: "",
      insuranceStatus: "",
      rulesReviewed: legalRequirementsAccepted,
      providerAttestation: legalRequirementsAccepted && adultAcknowledged,
      legalResponsibility: legalRequirementsAccepted && employmentResponsibilityAcknowledged,
      signerName: values["signer-name"],
      signerTitle: values["signer-title"],
      performingPersonFirstName: values["performing-person-first-name"],
      performingPersonLastName: values["performing-person-last-name"],
      performingPersonIdentityAcknowledged:
        formData.get("performing-person-identity-acknowledged") === "yes",
      adultAcknowledged,
      employmentWorkAuthorizationResponsibilityAcknowledged: employmentResponsibilityAcknowledged,
      termsBundleAccepted,
      privacyAcknowledged,
      providerSelfAssessment: providerAssessment,
    };

    if (applicationChallengeId) {
      if (!pendingApplicationPayload || !/^\d{6}$/.test(applicationVerificationCode)) {
        setApplicationError("Enter the 6-digit code sent to the application email.");
        return;
      }
      setApplicationBusy(true);
      setApplicationError("");
      try {
        const response = await fetch("/api/providers", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ...pendingApplicationPayload,
            challengeId: applicationChallengeId,
            verificationCode: applicationVerificationCode,
          }),
        });
        const result = (await response.json()) as { error?: string };
        if (!response.ok) throw new Error(result.error || "Please try again.");
        form.reset();
        setApplicationChallengeId("");
        setApplicationVerificationCode("");
        setPendingApplicationPayload(null);
        setConfirmingSubmit(false);
        setSelectedProviderServices([]);
        setSelectedProviderWorkLocations([]);
        setProviderAssessment(emptyProviderSelfAssessment);
        setLegalConfirmed(false);
        setStep(1);
        setApplicationSent(true);
        track("provider_signup_completed");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Please try again.";
        setApplicationError(message);
      } finally {
        setApplicationBusy(false);
      }
      return;
    }

    if (!confirmingSubmit) {
      setApplicationError("");
      setConfirmingSubmit(true);
      return;
    }

    setApplicationBusy(true);
    setApplicationError("");
    try {
      const response = await fetch("/api/providers/challenge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { error?: string; challengeId?: string };
      if (!response.ok) throw new Error(result.error || "Please try again.");
      if (!result.challengeId) {
        throw new Error("A verification code could not be prepared. Please try again.");
      }
      setConfirmingSubmit(false);
      setPendingApplicationPayload(payload);
      setApplicationChallengeId(result.challengeId);
      setApplicationVerificationCode("");
    } catch (error) {
      setConfirmingSubmit(false);
      const message = error instanceof Error ? error.message : "Please try again.";
      setApplicationError(message);
    } finally {
      setApplicationBusy(false);
    }
  }

  async function resendProviderApplicationCode() {
    if (!pendingApplicationPayload) return;
    setApplicationBusy(true);
    setApplicationError("");
    try {
      const response = await fetch("/api/providers/challenge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(pendingApplicationPayload),
      });
      const result = (await response.json()) as { error?: string; challengeId?: string };
      if (!response.ok || !result.challengeId) {
        throw new Error(result.error || "A new code could not be requested.");
      }
      setApplicationChallengeId(result.challengeId);
      setApplicationVerificationCode("");
    } catch (error) {
      setApplicationError(error instanceof Error ? error.message : "Please try again.");
    } finally {
      setApplicationBusy(false);
    }
  }

  if (applicationSent) {
    return (
      <div className="success-message provider-success" role="status">
        <span>✓</span>
        <h3>{providerFormIsSpanish ? "Verificación completa." : "Verification complete."}</h3>
        <p>{providerFormIsSpanish
          ? "Si no existía una solicitud para este correo, se creó una nueva. Inicie sesión para verla o continuarla; los cambios a una solicitud existente no se guardaron en este formulario público."
          : "If no application existed for this email, a new one was created. Sign in with the same email to view or continue it. Changes to an existing application were not saved by this public form."}</p>
        <Link className="button primary" href="/account?role=provider">
          {providerFormIsSpanish ? "Continuar con la verificación" : "Continue provider verification"}
        </Link>
        <button type="button" onClick={() => setApplicationSent(false)}>
          {providerFormIsSpanish ? "Iniciar otra verificación" : "Start another verification"}
        </button>
      </div>
    );
  }

  return (
    <form
      className="provider-form"
      onChange={(event) => {
        // Reset an in-flight submission/verification state if the applicant
        // edits anything after requesting a code — the payload above is
        // recomputed from current field values, so a stale challenge would
        // otherwise verify code against an outdated application.
        if ((event.target as HTMLElement).closest("[data-signup-step='3']")) {
          resetChallenge();
        }
      }}
      onSubmit={handleFinalSubmit}
    >
      <div className="step-indicator" aria-label="Application steps">
        <span className={step === 1 ? "on" : ""}>
          1. {providerFormIsSpanish ? "Sus servicios" : "Your services"}
        </span>
        {showStep2 && (
          <span className={step === 2 ? "on" : ""}>
            2. {providerFormIsSpanish ? "Requisitos" : "Prove it"}
          </span>
        )}
        <span className={step === 3 ? "on" : ""}>
          {showStep2 ? "3" : "2"}. {providerFormIsSpanish ? "Cobre" : "Get paid"}
        </span>
      </div>

      {stepError && <p className="form-error" role="alert">{stepError}</p>}

      {step === 1 && (
        <div data-signup-step="1">
          <h3>{providerFormIsSpanish ? "Conviértase en proveedor fundador" : "Become a founding provider"}</h3>
          <p>{providerFormIsSpanish ? "Cuéntenos qué servicios ofrece." : "Tell us which services you offer."}</p>
          <div className="legal-requirement-note" role="status">
            <strong>
              {providerFormIsSpanish
                ? "Las solicitudes son solo para revisión — ningún servicio está activo todavía."
                : "Applications are for review only — no service is available for a real customer job today."}
            </strong>
            <details className="legal-note-details">
              <summary>
                {providerFormIsSpanish
                  ? "Por qué, y qué exige el Condado de Montgomery"
                  : "Why, and what Montgomery County requires"}
              </summary>
              <small>
                Applications and service selections are accepted for review only. Activation requires
                documented compliance with applicable law, insurer approval, and every required government,
                agency, environmental, tax, payment, privacy, security, and service-specific control.
              </small>
              <small>
                <strong>Montgomery County has no unregistered simple-repair lane.</strong>{" "}
                A mobile repair or maintenance business must hold the County OCP registration.
                An independent owner-operator needs a real business, current OCP registration, and
                broker-confirmed coverage for each exact service.
              </small>
              <small>
                Official sources: {" "}
                <a
                  href="https://www.montgomerycountymd.gov/office-consumer-protection/business-education-registration-unit-bear/motor-vehicle-repair-maintenance-towing"
                  rel="noreferrer"
                  target="_blank"
                >
                  Montgomery County OCP registration guidance
                </a>
                {" · "}
                <a
                  href="https://codelibrary.amlegal.com/codes/montgomerycounty/latest/montgomeryco_md/0-0-0-138743"
                  rel="noreferrer"
                  target="_blank"
                >
                  County Code Chapter 31A
                </a>
              </small>
            </details>
          </div>
          <fieldset className="area-fieldset service-fieldset">
            <legend>{providerFormIsSpanish ? "Servicios que ofrece" : "Services you offer"}</legend>
            <div className="service-groups provider-service-groups">
              {PROVIDER_REVIEW_SERVICE_GROUPS.map((group) => {
                const groupServices = group.services.filter((service) => (
                  service.allowedPathways.includes(PROVIDER_PATHWAY)
                ));
                if (groupServices.length === 0) return null;
                const selectedCount = groupServices.filter((service) => (
                  selectedProviderServices.includes(service.code)
                )).length;
                return (
                  <details
                    className="service-group"
                    open={group.id === "limited" ? true : undefined}
                    key={group.id}
                  >
                    <summary>
                      <span>
                        <strong>{group.label}</strong>
                        <small>{group.description}</small>
                      </span>
                      <b>{selectedCount ? `${selectedCount} selected` : "View"}</b>
                    </summary>
                    <div className="service-options">
                      {groupServices.map((service) => (
                        <div className="service-option" key={service.code}>
                          <label>
                            <input
                              checked={selectedProviderServices.includes(service.code)}
                              name="provider-service"
                              type="checkbox"
                              value={service.code}
                              onChange={(event) => {
                                if (!event.target.checked) {
                                  setSelectedProviderServices((current) => (
                                    current.filter((item) => item !== service.code)
                                  ));
                                  setTierSwapNotice("");
                                  return;
                                }
                                const kept = selectedProviderServices.filter((item) => {
                                  const selected = PROVIDER_REVIEW_SERVICES.find(
                                    (candidate) => candidate.code === item,
                                  );
                                  return selected?.allowedProviderLevels.some((level) => (
                                    service.allowedProviderLevels.some((nextLevel) => nextLevel === level)
                                  ));
                                });
                                const removedLabels = selectedProviderServices
                                  .filter((item) => !kept.includes(item))
                                  .map((code) => PROVIDER_REVIEW_SERVICES.find(
                                    (candidate) => candidate.code === code,
                                  )?.label)
                                  .filter(Boolean)
                                  .join(", ");
                                setSelectedProviderServices([...kept, service.code]);
                                setTierSwapNotice(removedLabels
                                  ? (providerFormIsSpanish
                                    ? `Se quitó: ${removedLabels}. Una solicitud cubre un solo nivel de servicios a la vez.`
                                    : `Removed: ${removedLabels}. An application covers one service tier at a time.`)
                                  : "");
                              }}
                            />
                            <span>
                              <strong>{service.label}</strong>
                            </span>
                          </label>
                          <details className="service-scope">
                            <summary>
                              {providerFormIsSpanish
                                ? "Qué incluye y qué no"
                                : "What's included and not included"}
                            </summary>
                            <small>{service.description}</small>
                          </details>
                        </div>
                      ))}
                    </div>
                  </details>
                );
              })}
            </div>
            {tierSwapNotice && (
              <p className="tier-swap-notice" role="status">{tierSwapNotice}</p>
            )}
            <small className="customer-service-note">
              &ldquo;General auto repair&rdquo; is too broad to select — pick the exact services you
              offer instead. Selections are for review, not real-job access.
            </small>
          </fieldset>
          <div className="provider-mode-preview" aria-live="polite">
            <span>{providerFormIsSpanish ? "Su nivel de proveedor" : "Your provider tier"}</span>
            <strong className="provider-mode-badge">{PROVIDER_LEVEL_LABELS[providerLevel]}</strong>
          </div>
          <button type="button" className="button lime form-button" onClick={goToStep2}>
            {providerFormIsSpanish ? "Continuar" : "Continue"} <span>→</span>
          </button>
        </div>
      )}

      {step === 2 && showStep2 && (
        <div data-signup-step="2">
          {requiredDocumentsBySelection.length > 0 && (
            <>
              <h3>{providerFormIsSpanish ? "Lo que se necesita" : "What's required"}</h3>
              <p className="hint">
                {providerFormIsSpanish
                  ? "Solo se pide un documento por requisito legal aplicable — nada genérico."
                  : "One document per legal requirement that actually applies — nothing generic."}
              </p>
              {requiredDocumentsBySelection.map((entry) => (
                <div key={entry.code} className="legal-requirement-note">
                  <strong>{entry.label}</strong>
                  {entry.documents.map((doc) => (
                    <small key={doc.code}>
                      {doc.label}
                      {doc.requiresExpiration === true ? " (must include an expiration date)" : ""}
                    </small>
                  ))}
                </div>
              ))}
              <p className="hint">
                {providerFormIsSpanish
                  ? "Subirá estos documentos después de verificar su correo e iniciar sesión."
                  : "You'll upload these after you verify your email and sign in."}
              </p>
            </>
          )}
          {hasVisibleLegalRequirements && (
            <section className="provider-eligibility-guide">
              <div className="eligibility-guide-heading">
                <span>{providerFormIsSpanish ? "REQUISITOS LEGALES" : "LEGAL REQUIREMENTS"}</span>
              </div>
              <div className="eligibility-questions">
                {providerLegalRequirements.montgomeryRegistration && (
                  <div className="legal-question">
                    <div className="legal-question-heading">
                      <strong id="montgomery-registration-question">
                        {providerFormIsSpanish
                          ? "¿Tiene el registro de reparación requerido por el Condado de Montgomery?"
                          : "Do you have the required Montgomery County repair registration?"}
                      </strong>
                      <LegalHelp
                        label={providerFormIsSpanish
                          ? "Explicar el registro de reparación"
                          : "Explain the repair registration"}
                        text={providerFormIsSpanish
                          ? "Es el certificado del Condado de Montgomery para negocios de reparación de vehículos. Si todavía no lo tiene, elija “Todavía no”."
                          : "This is Montgomery County’s certificate for vehicle-repair businesses. If you do not have it yet, choose “Not yet.”"}
                      />
                    </div>
                    <small id="montgomery-registration-help">
                      {providerFormIsSpanish
                        ? "Se exige para estos servicios en el condado. Tuveloz debe verificar el certificado vigente antes de aprobar al proveedor."
                        : "It is required for these services in the county. Tuveloz must verify the current certificate before approving the provider."}
                    </small>
                    <select
                      aria-describedby="montgomery-registration-help"
                      aria-labelledby="montgomery-registration-question"
                      value={providerAssessment.businessRegistered}
                      onChange={(event) => setProviderAssessment((current) => ({
                        ...current,
                        businessRegistered: event.target.value as ProviderSelfAssessment["businessRegistered"],
                      }))}
                    >
                      <option value="unsure">{providerFormIsSpanish ? "No estoy seguro" : "Not sure"}</option>
                      <option value="yes">{providerFormIsSpanish ? "Sí" : "Yes"}</option>
                      <option value="no">{providerFormIsSpanish ? "Todavía no" : "Not yet"}</option>
                    </select>
                  </div>
                )}
                {providerLegalRequirements.marylandCustomerPaperwork && (
                  <div className="legal-question">
                    <div className="legal-question-heading">
                      <strong id="customer-forms-question">
                        {providerFormIsSpanish
                          ? "¿Puede usar los formularios de cliente que exige la ley?"
                          : "Can you use the customer forms required by law?"}
                      </strong>
                      <LegalHelp
                        label={providerFormIsSpanish
                          ? "Explicar los formularios del cliente"
                          : "Explain the customer forms"}
                        text={providerFormIsSpanish
                          ? "Son registros sencillos del trabajo: el cliente aprueba el servicio, recibe una cotización cuando la ley la exige y recibe una factura al final."
                          : "These are simple job records: the customer approves the service, receives an estimate when the law requires one, and gets an invoice afterward."}
                      />
                    </div>
                    <small id="customer-forms-help">
                      {providerFormIsSpanish
                        ? "En el Condado de Montgomery se exigen la autorización y la factura. También debe dar una cotización cuando se solicite para trabajos de más de $25 y devolver las piezas reemplazadas."
                        : "Montgomery County requires an authorization and invoice. It also requires an estimate when requested for work over $25 and return of replaced parts."}
                    </small>
                    <select
                      aria-describedby="customer-forms-help"
                      aria-labelledby="customer-forms-question"
                      value={providerAssessment.consumerDocumentsReady}
                      onChange={(event) => setProviderAssessment((current) => ({
                        ...current,
                        consumerDocumentsReady: event.target.value as ProviderSelfAssessment["consumerDocumentsReady"],
                      }))}
                    >
                      <option value="unsure">{providerFormIsSpanish ? "No estoy seguro" : "Not sure"}</option>
                      <option value="yes">{providerFormIsSpanish ? "Sí" : "Yes"}</option>
                      <option value="no">{providerFormIsSpanish ? "Todavía no" : "Not yet"}</option>
                    </select>
                  </div>
                )}
                {providerLegalRequirements.tintCompliance && (
                  <div className="legal-question">
                    <div className="legal-question-heading">
                      <strong id="tint-limits-question">
                        {providerFormIsSpanish
                          ? "¿Cumplirá cada trabajo de polarizado los límites legales del vehículo y del estado?"
                          : "Will every tint job follow the legal limits for the vehicle and state?"}
                      </strong>
                      <LegalHelp
                        label={providerFormIsSpanish
                          ? "Explicar los límites de polarizado"
                          : "Explain the tint limits"}
                        text={providerFormIsSpanish
                          ? "Debe revisar el límite legal para el vehículo antes de instalar el polarizado. Si no sabe cómo verificarlo, elija “No estoy seguro”."
                          : "Check the legal limit for the vehicle before installing tint. If you do not know how to check it, choose “Not sure.”"}
                      />
                    </div>
                    <small id="tint-limits-help">
                      {providerFormIsSpanish
                        ? "La ley prohíbe instalar polarizado que exceda los límites aplicables."
                        : "The law prohibits installing tint that exceeds the applicable limits."}
                    </small>
                    <select
                      aria-describedby="tint-limits-help"
                      aria-labelledby="tint-limits-question"
                      value={providerAssessment.tintRequirementsReady}
                      onChange={(event) => setProviderAssessment((current) => ({
                        ...current,
                        tintRequirementsReady: event.target.value as ProviderSelfAssessment["tintRequirementsReady"],
                      }))}
                    >
                      <option value="unsure">{providerFormIsSpanish ? "No estoy seguro" : "Not sure"}</option>
                      <option value="yes">{providerFormIsSpanish ? "Sí" : "Yes"}</option>
                      <option value="no">{providerFormIsSpanish ? "No" : "No"}</option>
                    </select>
                  </div>
                )}
                {providerLegalRequirements.washWaterCompliance && (
                  <div className="legal-question">
                    <div className="legal-question-heading">
                      <strong id="wash-water-question">
                        {providerFormIsSpanish
                          ? "¿Puede mantener el agua comercial de lavado fuera de los desagües pluviales y las vías fluviales?"
                          : "Can you keep commercial wash water out of storm drains and waterways?"}
                      </strong>
                      <LegalHelp
                        label={providerFormIsSpanish
                          ? "Explicar la regla del agua de lavado"
                          : "Explain the wash-water rule"}
                        text={providerFormIsSpanish
                          ? "El agua con jabón de un lavado pagado no puede correr hacia un desagüe pluvial o arroyo. Use una conexión permitida o recoja el agua."
                          : "Soapy water from a paid car wash cannot run into a storm drain or stream. Use an allowed connection or collect the water."}
                      />
                    </div>
                    <small id="wash-water-help">
                      {providerFormIsSpanish
                        ? "El Condado de Montgomery exige enviarla al alcantarillado sanitario o recogerla para desecharla fuera del lugar."
                        : "Montgomery County requires it to go to the sanitary sewer or be captured for off-site disposal."}
                    </small>
                    <select
                      aria-describedby="wash-water-help"
                      aria-labelledby="wash-water-question"
                      value={providerAssessment.washWaterReady}
                      onChange={(event) => setProviderAssessment((current) => ({
                        ...current,
                        washWaterReady: event.target.value as ProviderSelfAssessment["washWaterReady"],
                      }))}
                    >
                      <option value="unsure">{providerFormIsSpanish ? "No estoy seguro" : "Not sure"}</option>
                      <option value="yes">{providerFormIsSpanish ? "Sí" : "Yes"}</option>
                      <option value="no">{providerFormIsSpanish ? "Todavía no" : "Not yet"}</option>
                    </select>
                  </div>
                )}
                {providerLegalRequirements.officialInspectionRestriction && (
                  <div className="legal-requirement-note">
                    <strong>{providerFormIsSpanish ? "Evaluaciones independientes solamente" : "Independent checks only"}</strong>
                    <small>
                      {providerFormIsSpanish
                        ? "No anuncie un diagnóstico o una inspección antes de comprar como una inspección estatal oficial. Solo una estación autorizada puede ofrecer inspecciones oficiales."
                        : "Do not advertise diagnostics or a pre-purchase inspection as an official state inspection. Only an authorized station may offer official inspections."}
                    </small>
                  </div>
                )}
                {providerLegalRequirements.removedTireRule && (
                  <div className="legal-requirement-note">
                    <strong>{providerFormIsSpanish ? "La llanta permanece con el cliente" : "The tire stays with the customer"}</strong>
                    <small>
                      {providerFormIsSpanish
                        ? "Deje la llanta retirada con el cliente, salvo una devolución legal de garantía o intercambio."
                        : "Leave the removed tire with the customer unless a lawful warranty or trade-in return applies."}
                    </small>
                  </div>
                )}
              </div>
              <p className={`legal-check-status ${providerLegalStatus}`}>
                {providerLegalStatus === "ready"
                  ? (providerFormIsSpanish ? "Requisitos legales confirmados." : "Legal requirements confirmed.")
                  : providerLegalStatus === "needs-review"
                    ? (providerFormIsSpanish ? "Confirme los puntos marcados antes de la aprobación." : "Confirm the marked items before approval.")
                    : (providerFormIsSpanish ? "Hay un requisito legal que todavía no se ha cumplido." : "A legal requirement is not complete yet.")}
              </p>
              <label className="legal-confirmation">
                <input
                  type="checkbox"
                  checked={legalConfirmed}
                  onChange={(event) => setLegalConfirmed(event.target.checked)}
                />
                {providerFormIsSpanish
                  ? "Entiendo los requisitos legales mostrados para mis selecciones."
                  : "I understand the legal requirements shown for my selections."}
              </label>
            </section>
          )}
          <div className="form-nav">
            <button type="button" className="button secondary" onClick={goToStep1}>
              ← {providerFormIsSpanish ? "Regresar" : "Back"}
            </button>
            <button type="button" className="button lime form-button" onClick={goToStep3}>
              {providerFormIsSpanish ? "Continuar" : "Continue"} <span>→</span>
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div data-signup-step="3">
          <h3>{providerFormIsSpanish ? "Cobre" : "Get paid"}</h3>
          <p>
            {providerFormIsSpanish
              ? "Cuéntenos sobre su negocio. La configuración de pago viene después."
              : "Tell us about your business. Payout setup comes next."}
          </p>
          <label>
            {providerFormIsSpanish ? "Nombre personal o del negocio" : "Name or business name"}
            <input required name="provider-name" placeholder={providerFormIsSpanish ? "Su nombre o compañía" : "Your name or company"} />
          </label>
          <label>
            {providerFormIsSpanish ? "Correo electrónico" : "Email"}
            <input required name="provider-email" type="email" placeholder="hello@yourbusiness.com" />
          </label>
          <fieldset className="area-fieldset">
            <legend>Independent owner-operator business</legend>
            <label>
              Legal business name
              <input required name="legal-business-name" placeholder="Registered business name" />
            </label>
            <label>
              Business entity type
              <select required name="business-entity-type" defaultValue="">
                <option value="" disabled>Choose one</option>
                <option value="sole_proprietorship">Sole proprietorship</option>
                <option value="limited_liability_company">Limited liability company</option>
                <option value="corporation">Corporation</option>
                <option value="partnership">Partnership</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label>
              State where the business is formed or registered
              <input required name="business-formation-state" placeholder="Maryland" />
            </label>
          </fieldset>
          <label>
            {providerFormIsSpanish ? "Ubicación del negocio" : "Business location"}
            <input required list={MUNICIPALITY_DATALIST_ID} name="business-municipality" placeholder={providerFormIsSpanish ? "Ciudad o pueblo" : "City or town"} />
            <small>
              {providerFormIsSpanish
                ? "Se usa para determinar las reglas locales que correspondan."
                : "Used to determine which local laws apply."}
            </small>
          </label>
          <fieldset className="area-fieldset location-fieldset">
            <legend>
              {providerFormIsSpanish
                ? "¿Cómo pueden recibir el servicio los clientes?"
                : "How can customers receive service?"}
            </legend>
            <p>
              {providerFormIsSpanish ? "Elija una o ambas opciones." : "Choose one or both."}
            </p>
            <div className="area-options">
              {PROVIDER_WORK_LOCATION_OPTIONS.map((option) => (
                <label key={option}>
                  <input
                    checked={selectedProviderWorkLocations.includes(option)}
                    name="provider-work-location"
                    type="checkbox"
                    value={option}
                    onChange={(event) => setSelectedProviderWorkLocations((current) => (
                      event.target.checked
                        ? [...current, option]
                        : current.filter((item) => item !== option)
                    ))}
                  />
                  {providerFormIsSpanish
                    ? option === PROVIDER_WORK_LOCATION_OPTIONS[0]
                      ? "Voy a la ubicación del cliente"
                      : "Los clientes vienen a mi negocio"
                    : option}
                </label>
              ))}
            </div>
            {selectedProviderWorkLocations.length > 0 && (
              <div className="provider-mode-preview" aria-live="polite">
                <span>
                  {providerFormIsSpanish ? "La insignia del perfil será" : "Profile badge"}
                </span>
                <strong className="provider-mode-badge">
                  {providerModeForWorkLocations(selectedProviderWorkLocations)}
                </strong>
              </div>
            )}
          </fieldset>
          {providerAcceptsCustomersAtBusiness && (
            <label>
              {providerFormIsSpanish ? "Dirección donde atenderá a clientes" : "Business meeting address"}
              <AddressAutocompleteInput
                required
                name="business-service-address"
                placeholder={providerFormIsSpanish ? "Dirección" : "Street address"}
              />
              <small>
                {providerFormIsSpanish
                  ? "Solo se comparte con el cliente que seleccione su cotización."
                  : "Shared only with a customer who selects your quote."}
              </small>
            </label>
          )}
          <div className="fixed-launch-area provider-fixed-area">
            <span>{providerFormIsSpanish ? "Área de trabajo actual" : "Current job area"}</span>
            <strong>
              {providerFormIsSpanish ? "Condado de Montgomery, Maryland" : CURRENT_LAUNCH_AREA}
            </strong>
            <Link href="/about#expansion">
              {providerFormIsSpanish
                ? "¿Está fuera del condado? Solicite su área"
                : "Outside the county? Request your area"}
            </Link>
          </div>
          <fieldset className="area-fieldset">
            <legend>Performing person, authorized signature, and acknowledgments</legend>
            <label>
              Legal first name of the person doing the work
              <input
                autoComplete="given-name"
                required
                name="performing-person-first-name"
                placeholder="First name exactly as shown on ID"
              />
            </label>
            <label>
              Legal last name of the person doing the work
              <input
                autoComplete="family-name"
                required
                name="performing-person-last-name"
                placeholder="Last name exactly as shown on ID"
              />
              <small>
                This names the individual tied to this provider-person record. It may be
                different from the business name or authorized signer and must match the ID
                used in the separate Stripe Identity check.
              </small>
            </label>
            <label className="policy-consent">
              <input
                required
                name="performing-person-identity-acknowledged"
                type="checkbox"
                value="yes"
              />
              <span>
                I certify that this is the legal name of the actual person tied to this
                application who may perform services. This does not grant job access.
              </span>
            </label>
            <label>
              Typed signer name
              <input required name="signer-name" placeholder="Full legal name" />
            </label>
            <label>
              Signer title or capacity
              <input required name="signer-title" placeholder="Applicant, owner, or authorized representative" />
            </label>
            <label className="policy-consent">
              <input required name="adult-acknowledged" type="checkbox" value="yes" />
              <span>I confirm that I am at least 18 years old and authorized to submit this application.</span>
            </label>
            <label className="policy-consent">
              <input
                required
                name="employment-work-authorization-acknowledged"
                type="checkbox"
                value="yes"
              />
              <span>
                I understand that the provider business—not Tuveloz—is responsible for lawful
                employment classification, work authorization, wages, payroll taxes, workers&apos;
                compensation, supervision, and personnel records. An independent owner-operator
                remains responsible for their own business and work authorization obligations.
              </span>
            </label>
          </fieldset>
          <label className="policy-consent">
            <input required name="terms-bundle-accepted" type="checkbox" value="yes" />
            <span>
              {PROVIDER_TERMS_ACCEPTANCE_TEXT}{" "}
              Review the <a href="/terms">Terms</a>,{" "}
              <a href="/provider-agreement">Provider Agreement</a>,{" "}
              <a href="/payments">Payment Policy</a>,{" "}
              <a href="/marketplace-conduct">Conduct Policy</a>, and{" "}
              <a href="/provisional-provider-policy">Provider Pathway Policy</a>.
            </span>
          </label>
          <label className="policy-consent">
            <input required name="privacy-acknowledged" type="checkbox" value="yes" />
            <span>
              {PROVIDER_PRIVACY_ACKNOWLEDGMENT_TEXT}{" "}
              Review the <a href="/privacy">Privacy Policy</a>.
            </span>
          </label>
          {applicationChallengeId ? (
            <section
              className="legal-requirement-note"
              aria-labelledby="provider-email-code-title"
              onChange={(event) => event.stopPropagation()}
            >
              <strong id="provider-email-code-title">
                Step 2 of 2: confirm the application email
              </strong>
              <small>
                Enter the 6-digit code sent to the email above. The code expires in 10 minutes.
                This proves email control only; it does not verify identity, age, authority,
                business registration, licensing, insurance, qualifications, or job eligibility.
              </small>
              <label>
                6-digit verification code
                <input
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  maxLength={6}
                  name="provider-verification-code"
                  onChange={(event) => setApplicationVerificationCode(
                    event.target.value.replace(/\D/g, "").slice(0, 6),
                  )}
                  pattern="[0-9]{6}"
                  placeholder="000000"
                  required
                  value={applicationVerificationCode}
                />
              </label>
              <button
                className="button lime form-button"
                disabled={applicationBusy || applicationVerificationCode.length !== 6}
                type="submit"
              >
                {applicationBusy ? "Verifying..." : "Verify email and continue"}
              </button>
              <button
                className="button secondary form-button"
                disabled={applicationBusy}
                onClick={resendProviderApplicationCode}
                type="button"
              >
                Send the code again
              </button>
              <button
                className="button secondary form-button"
                disabled={applicationBusy}
                onClick={resetChallenge}
                type="button"
              >
                Edit application
              </button>
            </section>
          ) : confirmingSubmit ? (
            <ConfirmAction
              backLabel={providerFormIsSpanish ? "Regresar" : "Go back"}
              busy={applicationBusy}
              busyLabel={providerFormIsSpanish ? "Enviando…" : "Sending…"}
              confirmLabel={providerFormIsSpanish ? "Confirmar y enviar codigo" : "Confirm and send code"}
              confirmStyle="lime"
              confirmType="submit"
              message={providerFormIsSpanish
                ? "Revise la información anterior. TUVELOZ enviará un código. Solo se crea una solicitud nueva si no existe otra para este correo; los cambios a una solicitud existente se hacen después de iniciar sesión."
                : "Review the information above. TUVELOZ will email a one-time code. Verification creates a new application only if none exists for this email; changes to an existing application happen after sign-in."}
              onBack={() => setConfirmingSubmit(false)}
              title={providerFormIsSpanish ? "¿Continuar con la verificación?" : "Continue with email verification?"}
            />
          ) : (
            <div className="form-nav">
              <button type="button" className="button secondary" onClick={showStep2 ? () => setStep(2) : goToStep1}>
                ← {providerFormIsSpanish ? "Regresar" : "Back"}
              </button>
              <button className="button lime form-button" type="submit" disabled={applicationBusy}>
                {applicationBusy
                  ? (providerFormIsSpanish ? "Preparando…" : "Preparing…")
                  : (providerFormIsSpanish ? "Solicitar ingreso" : "Start application")} <span>→</span>
              </button>
            </div>
          )}
          {applicationError && <p className="form-error" role="alert">{applicationError}</p>}
          <small>
            {providerFormIsSpanish
              ? "Si la ley exige una licencia o un registro para el servicio y la ubicación seleccionados, Tuveloz debe recibir y verificar la prueba antes de aprobarlos. Si no corresponde una licencia gubernamental, Tuveloz no la solicitará por ese motivo; aún pueden exigirse seguros, competencia, documentos comerciales u otras pruebas del servicio."
              : "If the selected service and location legally require a license or registration, Tuveloz must receive and verify proof before approval. If no government license applies, Tuveloz will not request one for that reason; insurance, competency, business, or other service evidence may still be required."}
          </small>
        </div>
      )}
    </form>
  );
}
