"use client";

import { FormEvent, useEffect, useState } from "react";
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

/**
 * The provisional starter tier is a single approval level, but eleven jobs is a
 * lot to scan at once, so it's shown as three everyday sub-groups. The split is
 * purely visual: every code below shares the provisional_independent level, so
 * the "one tier per application" lock still treats them as interchangeable.
 */
const ROADSIDE_HELP_CODES: readonly ServiceCode[] = [
  "provisional_12v_jump_start",
  "provisional_12v_battery_replacement",
  "provisional_temporary_spare_install",
];
const QUICK_FIX_CODES: readonly ServiceCode[] = [
  "provisional_wiper_blade_replacement",
  "provisional_engine_or_cabin_air_filter",
  "provisional_conventional_bulb_replacement",
  "provisional_fluid_topoff_limited",
];
const CHECK_AND_CLEAN_CODES: readonly ServiceCode[] = [
  "photo_documentation_only",
  "provisional_visual_observation_report",
  "provisional_obd_read_only",
  "provisional_basic_detailing",
];

const PROVIDER_REVIEW_SERVICE_GROUPS = [
  {
    id: "roadside",
    label: "Roadside help (stuck on the road)",
    labelEs: "Ayuda en la carretera (varado en el camino)",
    description: "When someone's stuck — a jump, a battery, or the spare.",
    descriptionEs: "Cuando alguien está varado — corriente, batería o la llanta de repuesto.",
    services: PROVIDER_REVIEW_SERVICES.filter((service) => (
      ROADSIDE_HELP_CODES.includes(service.code)
    )),
  },
  {
    id: "quick_fixes",
    label: "Quick fixes",
    labelEs: "Arreglos rápidos",
    description: "Simple swaps like wipers, a filter, a bulb, or topping off fluids.",
    descriptionEs: "Cambios sencillos como plumillas, un filtro, un foco o rellenar líquidos.",
    services: PROVIDER_REVIEW_SERVICES.filter((service) => (
      QUICK_FIX_CODES.includes(service.code)
    )),
  },
  {
    id: "check_clean",
    label: "Check & clean (no repairs)",
    labelEs: "Revisar y limpiar (sin reparaciones)",
    description: "Photos, a look-over, reading a warning light, or interior cleaning.",
    descriptionEs: "Fotos, una revisión, leer una luz de advertencia o limpieza interior.",
    services: PROVIDER_REVIEW_SERVICES.filter((service) => (
      CHECK_AND_CLEAN_CODES.includes(service.code)
    )),
  },
  {
    id: "standard",
    label: "Everyday repair jobs",
    labelEs: "Trabajos de reparación comunes",
    description: "Bigger jobs like new tires, a battery, or a car wash.",
    descriptionEs: "Trabajos más grandes como llantas nuevas, batería o lavado de carro.",
    services: PROVIDER_REVIEW_SERVICES.filter((service) => (
      service.allowedProviderLevels.includes("standard_provider")
    )),
  },
  {
    id: "specialty",
    label: "Special jobs",
    labelEs: "Trabajos especiales",
    description: "Jobs that need extra licenses or permits — like towing, window tint, or A/C.",
    descriptionEs: "Trabajos que necesitan licencias o permisos adicionales — como remolque, polarizado o aire acondicionado.",
    services: PROVIDER_REVIEW_SERVICES.filter((service) => (
      service.allowedProviderLevels.includes("specialty_provider")
    )),
  },
] as const;

/**
 * Everyday, plain-language names for the signup service picker. The policy
 * catalog keeps the exact legal label of record (shown in the "What's included"
 * detail and used everywhere the requirement engine runs); applicants choosing
 * services just see the ordinary name for the job. Any service without an entry
 * here falls back to its catalog label.
 */
const PROVIDER_SERVICE_PLAIN_LABELS: Partial<
  Record<ServiceCode, { en: string; es: string }>
> = {
  photo_documentation_only: { en: "Take photos of a car", es: "Tomar fotos de un carro" },
  provisional_visual_observation_report: {
    en: "Look over a car and note what you see",
    es: "Revisar un carro y anotar lo que se ve",
  },
  provisional_obd_read_only: {
    en: "Read the check-engine light",
    es: "Leer la luz de check engine",
  },
  provisional_wiper_blade_replacement: {
    en: "Change wiper blades",
    es: "Cambiar las plumillas del limpiaparabrisas",
  },
  provisional_engine_or_cabin_air_filter: {
    en: "Change an air filter",
    es: "Cambiar un filtro de aire",
  },
  provisional_conventional_bulb_replacement: {
    en: "Change a light bulb",
    es: "Cambiar un foco",
  },
  provisional_fluid_topoff_limited: { en: "Top off fluids", es: "Rellenar líquidos" },
  provisional_12v_jump_start: {
    en: "Jump-start a dead battery",
    es: "Dar corriente a una batería descargada",
  },
  provisional_12v_battery_replacement: {
    en: "Change a car battery (simple starter job)",
    es: "Cambiar la batería del carro (trabajo sencillo para empezar)",
  },
  provisional_temporary_spare_install: {
    en: "Put on the spare tire",
    es: "Poner la llanta de repuesto",
  },
  provisional_basic_detailing: {
    en: "Clean the inside of a car",
    es: "Limpiar el interior de un carro",
  },
  battery_replacement: {
    en: "Change a car battery (full repair service)",
    es: "Cambiar la batería del carro (servicio completo de reparación)",
  },
  tire_repair_or_installation: {
    en: "Fix or put on tires",
    es: "Reparar o poner llantas",
  },
  basic_vehicle_diagnostics: {
    en: "Find out what's wrong with a car",
    es: "Averiguar qué le pasa a un carro",
  },
  mobile_car_wash: { en: "Wash a car", es: "Lavar un carro" },
  motor_vehicle_ac_service: {
    en: "Fix the car's air conditioning",
    es: "Arreglar el aire acondicionado del carro",
  },
  body_paint_refinishing: {
    en: "Fix dents and repaint",
    es: "Arreglar golpes y pintar",
  },
  window_tint_installation: {
    en: "Put tint on the windows",
    es: "Poner polarizado en las ventanas",
  },
  towing_or_storage: { en: "Tow or store a car", es: "Remolcar o guardar un carro" },
  vehicle_lockout: {
    en: "Unlock a car (keys locked inside)",
    es: "Abrir un carro con las llaves adentro",
  },
  official_vehicle_inspection: {
    en: "Official state inspection",
    es: "Inspección oficial del estado",
  },
  fuel_delivery: {
    en: "Bring gas to a stranded car",
    es: "Llevar gasolina a un carro varado",
  },
  ev_high_voltage_service: {
    en: "Work on an electric car's battery",
    es: "Trabajar en la batería de un carro eléctrico",
  },
};

/**
 * Strip the internal "Provisional " policy prefix for display. The policy
 * catalog keeps the full label as the legal name of record; applicants see
 * the plain service name, and the tier is shown separately when it matters.
 */
function serviceDisplayLabel(label: string) {
  const plain = label.replace(/^Provisional /, "");
  return plain.charAt(0).toUpperCase() + plain.slice(1);
}

/**
 * Everyday name for a service, in the applicant's language, falling back to the
 * cleaned-up catalog label when no plain-language entry exists.
 */
function providerServicePlainLabel(
  code: ServiceCode,
  fallbackLabel: string,
  isSpanish: boolean,
) {
  const plain = PROVIDER_SERVICE_PLAIN_LABELS[code];
  if (plain) return isSpanish ? plain.es : plain.en;
  return serviceDisplayLabel(fallbackLabel);
}

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

const SIGNUP_DRAFT_KEY = "tuveloz-provider-signup-draft-v1";

/**
 * Only plain identification/business text fields are autosaved. Legal
 * acknowledgment checkboxes and the emailed verification code are never
 * restored from a draft — acceptance must be affirmative in the session that
 * submits.
 */
const DRAFT_TEXT_FIELDS = [
  "performing-person-first-name",
  "performing-person-last-name",
  "provider-email",
  "provider-phone",
  "provider-name",
  "legal-business-name",
  "business-entity-type",
  "business-formation-state",
  "business-municipality",
  "business-service-address",
  "signer-name",
  "signer-title",
] as const;

type ProviderSignupDraft = {
  step?: SignupStep;
  selectedProviderServices?: ServiceCode[];
  soloBusiness?: boolean;
  selectedProviderWorkLocations?: string[];
  providerAssessment?: ProviderSelfAssessment;
  fields?: Record<string, string>;
};

function readSignupDraft(): ProviderSignupDraft | null {
  try {
    const raw = window.localStorage.getItem(SIGNUP_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as ProviderSignupDraft
      : null;
  } catch {
    return null;
  }
}

function clearSignupDraft() {
  try {
    window.localStorage.removeItem(SIGNUP_DRAFT_KEY);
  } catch {
    // Private-mode storage failures never block signup.
  }
}

export function ProviderSignupForm() {
  const { language } = useSiteLanguage();
  const providerFormIsSpanish = language === "es";

  const [step, setStep] = useState<SignupStep>(1);
  const [selectedProviderServices, setSelectedProviderServices] = useState<ServiceCode[]>([]);
  const [soloBusiness, setSoloBusiness] = useState(true);
  const [challengeResetNotice, setChallengeResetNotice] = useState("");
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
  const [businessDetailsOpen, setBusinessDetailsOpen] = useState(false);
  const [draftFields, setDraftFields] = useState<Record<string, string>>({});
  const [draftRestored, setDraftRestored] = useState(false);

  // Restore an unfinished application from this device. Runs once after mount
  // so server-rendered markup stays identical to the first client render; the
  // microtask defers state updates so the effect never sets state synchronously.
  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      const draft = readSignupDraft();
      if (!draft) return;
      if (Array.isArray(draft.selectedProviderServices)) {
        setSelectedProviderServices(draft.selectedProviderServices.filter((code) => (
          PROVIDER_REVIEW_SERVICES.some((service) => service.code === code)
        )));
      }
      if (typeof draft.soloBusiness === "boolean") setSoloBusiness(draft.soloBusiness);
      if (Array.isArray(draft.selectedProviderWorkLocations)) {
        setSelectedProviderWorkLocations(draft.selectedProviderWorkLocations.filter((option) => (
          (PROVIDER_WORK_LOCATION_OPTIONS as readonly string[]).includes(option)
        )));
      }
      if (draft.providerAssessment && typeof draft.providerAssessment === "object") {
        setProviderAssessment({ ...emptyProviderSelfAssessment, ...draft.providerAssessment });
      }
      if (draft.fields && typeof draft.fields === "object") {
        const fields: Record<string, string> = {};
        for (const key of DRAFT_TEXT_FIELDS) {
          const value = draft.fields[key];
          if (typeof value === "string" && value) fields[key] = value;
        }
        setDraftFields(fields);
      }
      if (draft.step === 1 || draft.step === 2 || draft.step === 3) setStep(draft.step);
      setDraftRestored(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Autosave everything except acknowledgments and the emailed code, so a
  // provider who starts on their phone can come back without retyping.
  useEffect(() => {
    if (applicationSent) return;
    const hasProgress = selectedProviderServices.length > 0
      || selectedProviderWorkLocations.length > 0
      || Object.keys(draftFields).length > 0;
    if (!hasProgress) return;
    try {
      window.localStorage.setItem(SIGNUP_DRAFT_KEY, JSON.stringify({
        step,
        selectedProviderServices,
        soloBusiness,
        selectedProviderWorkLocations,
        providerAssessment,
        fields: draftFields,
      } satisfies ProviderSignupDraft));
    } catch {
      // Storage being unavailable only disables autosave.
    }
  }, [
    applicationSent,
    step,
    selectedProviderServices,
    soloBusiness,
    selectedProviderWorkLocations,
    providerAssessment,
    draftFields,
  ]);

  const providerLevel = deriveProviderLevel(selectedProviderServices);
  // A service can be added only if it shares an allowed provider level with
  // every current selection — one application covers one tier at a time.
  // Incompatible options render disabled (with an explanation) instead of
  // silently replacing the applicant's earlier picks.
  const serviceIsSelectable = (service: (typeof PROVIDER_REVIEW_SERVICES)[number]) => (
    selectedProviderServices.length === 0
    || selectedProviderServices.every((code) => {
      const selected = PROVIDER_REVIEW_SERVICES.find((candidate) => candidate.code === code);
      return selected?.allowedProviderLevels.some((level) => (
        service.allowedProviderLevels.includes(level)
      ));
    })
  );
  const hasLockedServices = selectedProviderServices.length > 0
    && PROVIDER_REVIEW_SERVICES.some((service) => (
      !selectedProviderServices.includes(service.code) && !serviceIsSelectable(service)
    ));
  const providerAcceptsCustomersAtBusiness = selectedProviderWorkLocations.includes(
    PROVIDER_WORK_LOCATION_OPTIONS[1],
  );
  // Selected ServiceCodes are matched against the legal-category sets via the
  // code-to-category map in lib/provider-compliance.ts, so requirement
  // questions appear exactly for the services the law covers.
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
    // One-person businesses enter their name once; the signer and legal
    // business name derive from it instead of being asked again.
    const soloFullName = [values["performing-person-first-name"], values["performing-person-last-name"]]
      .map((value) => String(value ?? "").trim())
      .filter(Boolean)
      .join(" ");
    const adultAcknowledged = formData.get("adult-acknowledged") === "yes";
    const employmentResponsibilityAcknowledged = (
      formData.get("employment-work-authorization-acknowledged") === "yes"
    );
    const termsBundleAccepted = formData.get("terms-bundle-accepted") === "yes";
    const privacyAcknowledged = formData.get("privacy-acknowledged") === "yes";
    // A one-person business may leave the business name blank; their own
    // legal name is the business name of record.
    const businessName = String(values["provider-name"] ?? "").trim()
      || (soloBusiness ? soloFullName : "");
    const payload = {
      name: businessName,
      email: values["provider-email"],
      phone: values["provider-phone"],
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
      legalBusinessName: soloBusiness ? businessName : values["legal-business-name"],
      businessEntityType: values["business-entity-type"],
      businessFormationState: values["business-formation-state"],
      workLocations: selectedProviderWorkLocations,
      businessServiceAddress: values["business-service-address"],
      experience: "",
      insuranceStatus: "",
      rulesReviewed: legalRequirementsAccepted,
      providerAttestation: legalRequirementsAccepted && adultAcknowledged,
      legalResponsibility: legalRequirementsAccepted && employmentResponsibilityAcknowledged,
      signerName: soloBusiness ? soloFullName : values["signer-name"],
      signerTitle: soloBusiness ? "Owner" : values["signer-title"],
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
        clearSignupDraft();
        setDraftFields({});
        setDraftRestored(false);
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
      setChallengeResetNotice("");
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
        <h3>{providerFormIsSpanish ? "Solicitud recibida." : "Application received."}</h3>
        <p>{providerFormIsSpanish
          ? "Esto es lo que sigue: (1) inicie sesión con el mismo correo, (2) suba la evidencia requerida para sus servicios, (3) nuestro equipo revisa y usted puede seguir el estado en su panel. Le avisaremos por correo en cada paso."
          : "Here's what happens next: (1) sign in with the same email, (2) upload the evidence required for your services, (3) our team reviews and you can track the status from your dashboard. We'll email you at each step."}</p>
        <p><small>{providerFormIsSpanish
          ? "Si ya existía una solicitud para este correo, se conservó esa solicitud; los cambios se hacen después de iniciar sesión."
          : "If an application already existed for this email, that one was kept — changes happen after you sign in."}</small></p>
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
        // Capture only the draft fields rendered right now, so navigating
        // between steps never erases values saved from another step.
        const formData = new FormData(event.currentTarget);
        const formElements = event.currentTarget.elements;
        const presentFields = new Map<string, string>();
        for (const key of DRAFT_TEXT_FIELDS) {
          if (!formElements.namedItem(key)) continue;
          const value = formData.get(key);
          presentFields.set(key, typeof value === "string" ? value : "");
        }
        setDraftFields((current) => {
          const next = { ...current };
          for (const [key, value] of presentFields) {
            if (value.trim()) next[key] = value;
            else delete next[key];
          }
          return JSON.stringify(next) === JSON.stringify(current) ? current : next;
        });
        // Reset an in-flight submission/verification state if the applicant
        // edits anything after requesting a code — the payload above is
        // recomputed from current field values, so a stale challenge would
        // otherwise verify code against an outdated application.
        if ((event.target as HTMLElement).closest("[data-signup-step='3']")) {
          if (applicationChallengeId) {
            setChallengeResetNotice(providerFormIsSpanish
              ? "Cambió su solicitud, así que el código anterior ya no es válido. Envíe de nuevo para recibir un código nuevo."
              : "You changed your application, so the earlier code is no longer valid. Submit again to get a fresh code.");
          }
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
            2. {providerFormIsSpanish ? "Requisitos" : "Requirements"}
          </span>
        )}
        <span className={step === 3 ? "on" : ""}>
          {showStep2 ? "3" : "2"}. {providerFormIsSpanish ? "Su negocio" : "Your business"}
        </span>
      </div>
      <p className="hint step-progress" aria-live="polite">
        {providerFormIsSpanish
          ? `Paso ${step === 3 && !showStep2 ? 2 : step} de ${showStep2 ? 3 : 2}`
          : `Step ${step === 3 && !showStep2 ? 2 : step} of ${showStep2 ? 3 : 2}`}
      </p>

      {draftRestored && !applicationChallengeId && (
        <p className="hint" role="status">
          {providerFormIsSpanish
            ? "Bienvenido de nuevo — guardamos su avance en este dispositivo. Puede continuar donde quedó."
            : "Welcome back — we saved your progress on this device. Pick up where you left off."}
        </p>
      )}

      {stepError && <p className="form-error" role="alert">{stepError}</p>}

      {step === 1 && (
        <div data-signup-step="1">
          <h3>{providerFormIsSpanish ? "Solicite unirse como proveedor" : "Apply to join as a provider"}</h3>
          <p>{providerFormIsSpanish ? "Cuéntenos qué servicios ofrece." : "Tell us which services you offer."}</p>
          <div className="legal-requirement-note" role="status">
            <strong>
              {providerFormIsSpanish
                ? "Una cosa importante: esta solicitud es para revisión. Los trabajos reales se abren cuando sus servicios pasen la revisión de lanzamiento."
                : "One thing to know: this application is for review. Real customer jobs open once your services pass launch review."}
            </strong>
            <small>
              {providerFormIsSpanish
                ? "¿Todavía no tiene registro del condado? Puede solicitar de todos modos — elija sus servicios y le mostraremos exactamente lo que cada uno necesita."
                : "Not registered with the county yet? You can still apply — pick your services and we'll show you exactly what each one needs."}
            </small>
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
                    open={selectedCount > 0 ? true : undefined}
                    key={group.id}
                  >
                    <summary>
                      <span>
                        <strong>{providerFormIsSpanish ? group.labelEs : group.label}</strong>
                        <small>{providerFormIsSpanish ? group.descriptionEs : group.description}</small>
                      </span>
                      <b>
                        {selectedCount
                          ? providerFormIsSpanish
                            ? `${selectedCount} elegidos`
                            : `${selectedCount} selected`
                          : providerFormIsSpanish ? "Ver" : "View"}
                      </b>
                    </summary>
                    <div className="service-options">
                      {groupServices.map((service) => {
                        const isSelected = selectedProviderServices.includes(service.code);
                        const isLocked = !isSelected && !serviceIsSelectable(service);
                        return (
                          <div className="service-option" key={service.code}>
                            <label>
                              <input
                                checked={isSelected}
                                disabled={isLocked}
                                name="provider-service"
                                type="checkbox"
                                value={service.code}
                                onChange={(event) => {
                                  setSelectedProviderServices((current) => (
                                    event.target.checked
                                      ? [...current, service.code]
                                      : current.filter((item) => item !== service.code)
                                  ));
                                }}
                              />
                              <span>
                                <strong>
                                  {providerServicePlainLabel(
                                    service.code,
                                    service.label,
                                    providerFormIsSpanish,
                                  )}
                                </strong>
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
                        );
                      })}
                    </div>
                  </details>
                );
              })}
            </div>
            {hasLockedServices && (
              <p className="tier-swap-notice" role="status">
                {providerFormIsSpanish
                  ? "Algunos servicios están bloqueados porque una solicitud cubre un solo nivel a la vez. Para cambiar de nivel, desmarque sus selecciones actuales."
                  : "Some services are locked because one application covers one service tier at a time. To switch tiers, uncheck your current picks first."}
              </p>
            )}
            <small className="customer-service-note">
              {providerFormIsSpanish
                ? "No hay una opción de “reparación general” a propósito — solo elija los trabajos exactos que hace."
                : "There's no all-in-one “general repair” choice on purpose — just pick the exact jobs you do."}
            </small>
          </fieldset>
          {providerLevel !== "provisional_independent" && (
            <div className="provider-mode-preview" aria-live="polite">
              <span>{providerFormIsSpanish ? "Nivel de la solicitud" : "Application tier"}</span>
              <strong className="provider-mode-badge">{PROVIDER_LEVEL_LABELS[providerLevel]}</strong>
            </div>
          )}
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
                  ? "Solo pedimos el documento que cada ley realmente exige — nada de más."
                  : "We only ask for the one document each law actually requires — nothing extra."}
              </p>
              {requiredDocumentsBySelection.map((entry) => (
                <div key={entry.code} className="legal-requirement-note">
                  <strong>
                    {providerServicePlainLabel(entry.code, entry.label, providerFormIsSpanish)}
                  </strong>
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
          <p className="hint">
            {providerFormIsSpanish
              ? "Todos los proveedores también completan la configuración de impuestos y pagos antes del primer pago — allí firma el formulario de impuestos requerido (Formulario W-9 del IRS), y Tuveloz emite un 1099 por las ganancias anuales aplicables, como lo exige el Acuerdo de Proveedor."
              : "Every provider also completes tax and payout setup before their first payout — that's where you sign the required tax form (IRS Form W-9), and Tuveloz issues a 1099 for applicable annual earnings, as the Provider Agreement requires."}
          </p>
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
          <h3>{providerFormIsSpanish ? "Su negocio" : "Your business"}</h3>
          <p>
            {providerFormIsSpanish
              ? "Unos datos sobre usted y su negocio. La configuración de pago viene después de la aprobación."
              : "A few details about you and your business. Payout setup comes after approval."}
          </p>
          <fieldset className="area-fieldset">
            <legend>{providerFormIsSpanish ? "¿Quién solicita?" : "Who's applying?"}</legend>
            <div className="area-options">
              <label>
                <input
                  checked={soloBusiness}
                  name="business-size"
                  type="radio"
                  onChange={() => setSoloBusiness(true)}
                />
                {providerFormIsSpanish
                  ? "Solo yo — hago el trabajo yo mismo"
                  : "Just me — I do the work myself"}
              </label>
              <label>
                <input
                  checked={!soloBusiness}
                  name="business-size"
                  type="radio"
                  onChange={() => setSoloBusiness(false)}
                />
                {providerFormIsSpanish
                  ? "Un negocio con empleados o ayudantes"
                  : "A business with employees or helpers"}
              </label>
            </div>
          </fieldset>
          <label>
            {soloBusiness
              ? (providerFormIsSpanish ? "Su nombre legal" : "Your legal first name")
              : (providerFormIsSpanish
                ? "Nombre legal de la persona que hará el trabajo"
                : "Legal first name of the person doing the work")}
            <input
              autoComplete="given-name"
              defaultValue={draftFields["performing-person-first-name"] ?? ""}
              required
              name="performing-person-first-name"
              placeholder={providerFormIsSpanish
                ? "Nombre tal como aparece en su identificación"
                : "First name exactly as shown on ID"}
            />
          </label>
          <label>
            {soloBusiness
              ? (providerFormIsSpanish ? "Su apellido legal" : "Your legal last name")
              : (providerFormIsSpanish
                ? "Apellido legal de la persona que hará el trabajo"
                : "Legal last name of the person doing the work")}
            <input
              autoComplete="family-name"
              defaultValue={draftFields["performing-person-last-name"] ?? ""}
              required
              name="performing-person-last-name"
              placeholder={providerFormIsSpanish
                ? "Apellido tal como aparece en su identificación"
                : "Last name exactly as shown on ID"}
            />
            <small>
              {providerFormIsSpanish
                ? "Debe coincidir con la identificación usada en la verificación de identidad de Stripe."
                : "Must match the ID used in the separate Stripe Identity check."}
            </small>
          </label>
          <label>
            {providerFormIsSpanish ? "Correo electrónico" : "Email"}
            <input
              autoComplete="email"
              defaultValue={draftFields["provider-email"] ?? ""}
              inputMode="email"
              required
              name="provider-email"
              type="email"
              placeholder="hello@yourbusiness.com"
            />
            <small>
              {providerFormIsSpanish
                ? "Solo lo usamos para verificar su solicitud y enviarle actualizaciones."
                : "We only use this to verify your application and send you updates."}
            </small>
          </label>
          <label>
            {providerFormIsSpanish ? "Teléfono (opcional)" : "Phone (optional)"}
            <input
              autoComplete="tel"
              defaultValue={draftFields["provider-phone"] ?? ""}
              inputMode="tel"
              name="provider-phone"
              type="tel"
              placeholder="(301) 555-0100"
            />
            <small>
              {providerFormIsSpanish
                ? "Solo si prefiere que le contactemos por teléfono. El correo es lo único que se requiere."
                : "Only if you'd rather we reach you by phone. Email is all that's required."}
            </small>
          </label>
          <label>
            {soloBusiness
              ? (providerFormIsSpanish ? "Nombre del negocio (opcional)" : "Business name (optional)")
              : (providerFormIsSpanish ? "Nombre del negocio" : "Business name")}
            <input
              defaultValue={draftFields["provider-name"] ?? ""}
              required={!soloBusiness}
              name="provider-name"
              placeholder={providerFormIsSpanish ? "Su negocio o su propio nombre" : "Your business or your own name"}
            />
            {soloBusiness && (
              <small>
                {providerFormIsSpanish
                  ? "Déjelo en blanco y usaremos su nombre legal — muchos negocios de una sola persona trabajan con su propio nombre."
                  : "Leave this blank and we'll use your legal name — many one-person businesses operate under their own name."}
              </small>
            )}
          </label>
          <details
            className="business-details-disclosure"
            open={businessDetailsOpen || !soloBusiness}
            onToggle={(event) => setBusinessDetailsOpen(event.currentTarget.open)}
          >
            <summary>
              <strong>{providerFormIsSpanish ? "Detalles del negocio" : "Business details"}</strong>
              {soloBusiness && (
                <small>
                  {providerFormIsSpanish
                    ? " — lo configuramos como negocio de una sola persona en Maryland. Ábralo solo si registró una LLC o corporación."
                    : " — we've set this up as a one-person Maryland business. Only open this if you registered an LLC or corporation."}
                </small>
              )}
            </summary>
            <fieldset className="area-fieldset" key={soloBusiness ? "solo-business" : "team-business"}>
              {!soloBusiness && (
                <label>
                  {providerFormIsSpanish ? "Nombre legal del negocio" : "Legal business name"}
                  <input
                    defaultValue={draftFields["legal-business-name"] ?? ""}
                    required
                    name="legal-business-name"
                    placeholder={providerFormIsSpanish ? "Nombre registrado del negocio" : "Registered business name"}
                  />
                </label>
              )}
              <label>
                {providerFormIsSpanish ? "¿Cómo está formado su negocio?" : "How is your business set up?"}
                <select
                  required
                  name="business-entity-type"
                  defaultValue={draftFields["business-entity-type"]
                    || (soloBusiness ? "sole_proprietorship" : "")}
                >
                  <option value="" disabled>{providerFormIsSpanish ? "Elija una" : "Choose one"}</option>
                  <option value="sole_proprietorship">{providerFormIsSpanish ? "Solo yo (propietario único)" : "Just me (sole proprietor)"}</option>
                  <option value="limited_liability_company">{providerFormIsSpanish ? "LLC (compañía de responsabilidad limitada)" : "LLC (limited liability company)"}</option>
                  <option value="corporation">{providerFormIsSpanish ? "Corporación" : "Corporation"}</option>
                  <option value="partnership">{providerFormIsSpanish ? "Sociedad (dos o más dueños)" : "Partnership (two or more owners)"}</option>
                  <option value="other">{providerFormIsSpanish ? "Otro" : "Other"}</option>
                </select>
                {soloBusiness && (
                  <small>
                    {providerFormIsSpanish
                      ? "Si no registró nada, casi siempre es “Solo yo”. Cámbielo solo si creó una LLC o corporación."
                      : "If you haven't registered anything, it's almost always “Just me.” Change it only if you set up an LLC or corporation."}
                  </small>
                )}
              </label>
              <label>
                {providerFormIsSpanish
                  ? "¿En qué estado está registrado su negocio?"
                  : "What state is your business registered in?"}
                <input
                  required
                  defaultValue={draftFields["business-formation-state"]
                    ?? (soloBusiness ? "Maryland" : undefined)}
                  name="business-formation-state"
                  placeholder="Maryland"
                />
              </label>
            </fieldset>
          </details>
          <label>
            {providerFormIsSpanish ? "Ubicación del negocio" : "Business location"}
            <input
              defaultValue={draftFields["business-municipality"] ?? ""}
              required
              list={MUNICIPALITY_DATALIST_ID}
              name="business-municipality"
              placeholder={providerFormIsSpanish ? "Ciudad o pueblo" : "City or town"}
            />
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
              {providerFormIsSpanish ? "Dirección donde atenderá a clientes" : "Address where customers meet you"}
              <AddressAutocompleteInput
                defaultValue={draftFields["business-service-address"] ?? ""}
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
            <legend>
              {providerFormIsSpanish
                ? "Firma y confirmaciones"
                : "Signature and acknowledgments"}
            </legend>
            <label className="policy-consent">
              <input
                required
                name="performing-person-identity-acknowledged"
                type="checkbox"
                value="yes"
              />
              <span>
                {providerFormIsSpanish
                  ? "Certifico que el nombre legal anterior corresponde a la persona real de esta solicitud que puede realizar los servicios."
                  : "I certify that the legal name above is the actual person tied to this application who may perform services."}
              </span>
            </label>
            {soloBusiness ? (
              <p className="hint">
                {providerFormIsSpanish
                  ? "Como negocio de una sola persona, usted firma esta solicitud como propietario con el nombre legal anterior."
                  : "As a one-person business, you sign this application as the owner, using your legal name above."}
              </p>
            ) : (
              <>
                <label>
                  {providerFormIsSpanish ? "Firma (escriba su nombre completo)" : "Signature (type your full name)"}
                  <input defaultValue={draftFields["signer-name"] ?? ""} required name="signer-name" placeholder={providerFormIsSpanish ? "Nombre legal completo" : "Full legal name"} />
                </label>
                <label>
                  {providerFormIsSpanish ? "Su cargo en el negocio" : "Your role in the business"}
                  <input defaultValue={draftFields["signer-title"] ?? ""} required name="signer-title" placeholder={providerFormIsSpanish ? "Solicitante, propietario o representante autorizado" : "Applicant, owner, or authorized representative"} />
                </label>
              </>
            )}
            <label className="policy-consent">
              <input required name="adult-acknowledged" type="checkbox" value="yes" />
              <span>
                {providerFormIsSpanish
                  ? "Confirmo que tengo al menos 18 años y autorización para enviar esta solicitud."
                  : "I confirm that I am at least 18 years old and authorized to submit this application."}
              </span>
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
                {providerFormIsSpanish
                  ? "Último paso: escriba el código que le enviamos por correo"
                  : "Last step: enter the code we emailed you"}
              </strong>
              <small>
                {providerFormIsSpanish
                  ? "Escriba el código de 6 dígitos enviado al correo anterior. El código vence en 10 minutos. Solo confirma el control del correo; no verifica identidad, edad, autoridad, registro del negocio, licencias, seguros, calificaciones ni elegibilidad para trabajos."
                  : "Enter the 6-digit code sent to the email above. The code expires in 10 minutes. This proves email control only; it does not verify identity, age, authority, business registration, licensing, insurance, qualifications, or job eligibility."}
              </small>
              <small className="hint">
                {providerFormIsSpanish
                  ? "Sus respuestas se guardan en este dispositivo — si cambia a su correo para buscar el código, seguirán aquí cuando regrese."
                  : "Your answers are saved on this device — if you switch to your email to grab the code, they'll still be here when you come back."}
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
                  : (providerFormIsSpanish ? "Enviar solicitud" : "Submit application")} <span>→</span>
              </button>
            </div>
          )}
          {challengeResetNotice && !applicationChallengeId && (
            <p className="hint" role="status">{challengeResetNotice}</p>
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
