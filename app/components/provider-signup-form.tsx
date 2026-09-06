"use client";

import { InterfaceCopy } from "./interface-copy";
import { FormEvent, useEffect, useRef, useState } from "react";
import { SiteLink as Link } from "./site-link";
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
  providerLevelsForServices,
  SERVICES,
  type EvidenceRequirementCode,
  type ServiceCode,
} from "../../lib/provider-policy";
import {
  getRequiredDocumentsForSelection,
  needsProofStep,
} from "../../lib/service-tiers";
import { groupProviderSignupDocuments, hasProviderSignupQuestions } from "../../lib/provider-signup-checklist";
import {
  MAX_OPTIONAL_CERTIFICATES,
  OPTIONAL_CERTIFICATE_CATEGORIES,
  type DeclaredOptionalCertificate,
  type OptionalCertificateCategory,
} from "../../lib/optional-certificates";
import {
  PROVIDER_PRIVACY_ACKNOWLEDGMENT_TEXT,
  PROVIDER_TERMS_ACCEPTANCE_TEXT,
} from "../../lib/provider-policy-acceptance";
import { campaignAttribution, track } from "../../lib/analytics";
import { activeVariants } from "../../lib/experiments";
import { AddressAutocompleteInput } from "./address-autocomplete-input";
import { MUNICIPALITY_DATALIST_ID } from "./location-datalists";
import { useSiteLanguage } from "./site-language";
import { spanishText } from "../../lib/spanish-dictionary";
import { ConfirmAction } from "./confirm-action";
import { LegalHelp } from "./legal-help";
import { FollowAlong } from "./social-links";
import { normalizeReferralCode } from "../../lib/referral-code";
import { rememberEmailForSignIn } from "../../lib/remembered-email";
import {
  PHONE_TRANSACTIONAL_PURPOSE_TEXT_EN,
  PHONE_TRANSACTIONAL_PURPOSE_TEXT_ES,
  SMS_MARKETING_CONSENT_TEXT_EN,
  SMS_MARKETING_CONSENT_TEXT_ES,
} from "../../lib/phone-consent-text";

/**
 * A share code arriving as ?ref= on the join link. Read at submit time rather
 * than stored, so a malformed or absent value simply attributes nothing.
 */
function referralCode() {
  if (typeof window === "undefined") return "";
  return normalizeReferralCode(new URL(window.location.href).searchParams.get("ref"));
}

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
    description: "Specialized work like towing, window tint, or A/C.",
    descriptionEs: "Trabajos especializados como remolque, polarizado o aire acondicionado.",
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

/**
 * Everyday, plain-language names for the required documents. The policy matrix
 * keeps each document's exact legal name of record (which we still show, small,
 * so applicants recognize the real paperwork); this map only makes the first
 * line readable. Requirements come from the selected service and pathway
 * policy — nothing is added or removed, only reworded. A document without
 * a plain entry falls back to its official label.
 */
const PROVIDER_EVIDENCE_PLAIN_LABELS: Partial<
  Record<EvidenceRequirementCode, { en: string; es: string }>
> = {
  provisional_service_competency: {
    en: "A short note showing you've done this kind of job before",
    es: "Una nota breve que muestre que ya ha hecho este tipo de trabajo",
  },
  ocp_vehicle_service_registration: {
    en: "Your Montgomery County repair business certificate",
    es: "Su certificado de negocio de reparación del Condado de Montgomery",
  },
  no_employee_attestation: {
    en: "A short form saying it's just you — no employees",
    es: "Un formulario corto que dice que trabaja solo — sin empleados",
  },
  wash_water_plan: {
    en: "Your plan for collecting and disposing of cleaning water",
    es: "Su plan para recoger y desechar el agua de limpieza",
  },
  spent_battery_handling_plan: {
    en: "Your plan for safely handling and recycling used batteries",
    es: "Su plan para manejar y reciclar las baterías usadas de forma segura",
  },
  general_liability_coi: {
    en: "Proof of general liability insurance",
    es: "Comprobante de seguro de responsabilidad general",
  },
  business_auto_coverage: {
    en: "Proof of business-use auto insurance",
    es: "Comprobante de seguro de auto de uso comercial",
  },
  workers_comp_coverage: {
    en: "Proof of workers' compensation insurance",
    es: "Comprobante de seguro de compensación de trabajadores",
  },
  md_locksmith_business_license: {
    en: "Your Maryland locksmith business license",
    es: "Su licencia de negocio de cerrajería de Maryland",
  },
  mva_inspection_station_license: {
    en: "Your Maryland inspection station license",
    es: "Su licencia de estación de inspección de Maryland",
  },
  mva_inspection_mechanic_license: {
    en: "Your Maryland inspection mechanic license",
    es: "Su licencia de mecánico de inspección de Maryland",
  },
  epa_section_609_certificate: {
    en: "Your EPA Section 609 A/C certificate",
    es: "Su certificado EPA Sección 609 para aire acondicionado",
  },
  ocp_towing_registration: {
    en: "Your Montgomery County towing registration",
    es: "Su registro de remolque del Condado de Montgomery",
  },
};

function providerDocumentPlainLabel(
  code: EvidenceRequirementCode,
  isSpanish: boolean,
) {
  const plain = PROVIDER_EVIDENCE_PLAIN_LABELS[code];
  return plain ? (isSpanish ? plain.es : plain.en) : null;
}

function joinServiceNames(services: readonly string[], isSpanish: boolean) {
  if (services.length <= 1) return services.join("");
  const conjunction = isSpanish ? "y" : "and";
  const head = services.slice(0, -1).join(", ");
  return `${head} ${conjunction} ${services[services.length - 1]}`;
}

/**
 * Step 2 only exists when the chosen services actually carry requirements, so
 * a step's internal id is not the number the applicant sees. Display position
 * is derived from the visible steps instead of hand-patched at each call site.
 */
type SignupStep = 1 | 2 | 3 | 4;

const SIGNUP_STEP_LABELS: Record<SignupStep, { en: string; es: string }> = {
  1: { en: "Your services", es: "Sus servicios" },
  2: { en: "Your checklist", es: "Su lista" },
  3: { en: "Your details", es: "Sus datos" },
  4: { en: "Sign and submit", es: "Firmar y enviar" },
};

const SELECTED_PROVIDER_AREAS = [CURRENT_LAUNCH_AREA];

export const SIGNUP_DRAFT_KEY = "tuveloz-provider-signup-draft-v1";

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
  const stepContentRef = useRef<HTMLDivElement>(null);
  const previousStep = useRef<SignupStep>(step);
  const [selectedProviderServices, setSelectedProviderServices] = useState<ServiceCode[]>([]);
  const [soloBusiness, setSoloBusiness] = useState(true);
  const [challengeResetNotice, setChallengeResetNotice] = useState("");
  const [selectedProviderWorkLocations, setSelectedProviderWorkLocations] = useState<string[]>([]);
  const [legalConfirmed, setLegalConfirmed] = useState(false);
  const [providerAssessment, setProviderAssessment] = useState<ProviderSelfAssessment>(
    emptyProviderSelfAssessment,
  );
  const [stepError, setStepError] = useState("");
  const stepErrorRef = useRef<HTMLParagraphElement>(null);
  const [applicationSent, setApplicationSent] = useState(false);
  const [applicationBusy, setApplicationBusy] = useState(false);
  const [applicationError, setApplicationError] = useState("");
  const [applicationChallengeId, setApplicationChallengeId] = useState("");
  const [applicationVerificationCode, setApplicationVerificationCode] = useState("");
  const [pendingApplicationPayload, setPendingApplicationPayload] = useState<Record<string, unknown> | null>(null);
  const [confirmingSubmit, setConfirmingSubmit] = useState(false);
  const [showOptionalCertificates, setShowOptionalCertificates] = useState(false);
  const [optionalCertificates, setOptionalCertificates] = useState<DeclaredOptionalCertificate[]>([]);
  const [businessDetailsOpen, setBusinessDetailsOpen] = useState(false);
  const [draftFields, setDraftFields] = useState<Record<string, string>>({});
  const [draftRestored, setDraftRestored] = useState(false);

  // Long service lists can leave a phone scrolled below the next step when
  // its content is shorter. Bring the new step into view and move keyboard /
  // screen-reader focus with it. The CSS scroll margin clears the sticky nav.
  useEffect(() => {
    if (previousStep.current === step) return;
    previousStep.current = step;
    const frame = requestAnimationFrame(() => {
      stepContentRef.current?.focus({ preventScroll: true });
      stepContentRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
    });
    return () => cancelAnimationFrame(frame);
  }, [step]);

  // Restore an unfinished application from this device. Runs once after mount
  // so server-rendered markup stays identical to the first client render; the
  // microtask defers state updates so the effect never sets state synchronously.
  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      const draft = readSignupDraft();
      if (!draft) return;
      const restoredServices = Array.isArray(draft.selectedProviderServices)
        ? draft.selectedProviderServices.filter((code) => (
          PROVIDER_REVIEW_SERVICES.some((service) => service.code === code)
        ))
        : [];
      setSelectedProviderServices(restoredServices);
      if (typeof draft.soloBusiness === "boolean") setSoloBusiness(draft.soloBusiness);
      if (Array.isArray(draft.selectedProviderWorkLocations)) {
        setSelectedProviderWorkLocations(draft.selectedProviderWorkLocations.filter((option) => (
          (PROVIDER_WORK_LOCATION_OPTIONS as readonly string[]).includes(option)
        )));
      }
      if (draft.providerAssessment && typeof draft.providerAssessment === "object") {
        setProviderAssessment({ ...emptyProviderSelfAssessment, ...draft.providerAssessment });
      }
      const fields: Record<string, string> = {};
      if (draft.fields && typeof draft.fields === "object") {
        for (const key of DRAFT_TEXT_FIELDS) {
          const value = draft.fields[key];
          if (typeof value === "string" && value) fields[key] = value;
        }
        setDraftFields(fields);
      }
      // A saved step is only a hint: services may have changed, and the
      // checklist acknowledgment must be given again in this session. Put
      // that checkbox on screen instead of hiding it behind the final step.
      // Incomplete / obsolete drafts return to services without losing text.
      const firstStepComplete = restoredServices.length > 0
        && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((fields["provider-email"] ?? "").trim());
      if (firstStepComplete && (draft.step === 2 || draft.step === 3)) {
        const hasQuestions = hasProviderSignupQuestions(getProviderLegalRequirementFlags(
          restoredServices, SELECTED_PROVIDER_AREAS,
        ));
        const resumeChecklist = hasQuestions
          || (draft.step === 2 && needsProofStep(restoredServices, PROVIDER_PATHWAY));
        setStep(resumeChecklist ? 2 : 3);
      }
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

  // A provider level belongs to the exact service, not to the applicant, so one
  // application may span levels — standard battery work alongside specialty A/C
  // service, for example. Every service still stands on its own credentials, so
  // nothing here locks another service out.
  const providerLevels = providerLevelsForServices(
    selectedProviderServices,
    PROVIDER_PATHWAY,
  );
  const hasSpecialtySelection = providerLevels.includes("specialty_provider");
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
  const hasVisibleLegalRequirements = hasProviderSignupQuestions(providerLegalRequirements);
  const showProofStep = needsProofStep(selectedProviderServices, PROVIDER_PATHWAY);
  const requiredDocumentsBySelection = getRequiredDocumentsForSelection(
    selectedProviderServices,
    PROVIDER_PATHWAY,
  );
  const requiredDocumentGroups = groupProviderSignupDocuments(requiredDocumentsBySelection);
  // The preview and checklist both count a shared document once. Individual
  // services still have their own evidence review and approval requirements.
  const requiredDocumentCount = new Set(
    requiredDocumentsBySelection.flatMap((entry) => entry.documents.map((doc) => doc.code)),
  ).size;
  const showStep2 = showProofStep || hasVisibleLegalRequirements;
  // Step 4 ("Sign and submit") is defined but not yet reachable: splitting it
  // off unmounts step 3, which would drop every required field there from
  // FormData and skip its native validation. Each one needs a hidden carrier
  // and an explicit check first, the same way provider-email does.
  const visibleSteps: SignupStep[] = showStep2 ? [1, 2, 3] : [1, 3];
  const stepPosition = Math.max(visibleSteps.indexOf(step), 0) + 1;

  function resetChallenge() {
    setApplicationChallengeId("");
    setApplicationVerificationCode("");
    setPendingApplicationPayload(null);
    setConfirmingSubmit(false);
  }

  function toggleOptionalCertificates() {
    const next = !showOptionalCertificates;
    setShowOptionalCertificates(next);
    if (next && optionalCertificates.length === 0) {
      setOptionalCertificates([
        { category: "ase", title: "", credentialIdentifier: "", issuingAuthority: "" },
      ]);
    }
  }

  function addOptionalCertificate() {
    setOptionalCertificates((current) => (
      current.length >= MAX_OPTIONAL_CERTIFICATES
        ? current
        : [...current, { category: "ase", title: "", credentialIdentifier: "", issuingAuthority: "" }]
    ));
  }

  function updateOptionalCertificate(
    index: number,
    patch: Partial<DeclaredOptionalCertificate>,
  ) {
    setOptionalCertificates((current) => (
      current.map((certificate, position) => (
        position === index ? { ...certificate, ...patch } : certificate
      ))
    ));
  }

  function removeOptionalCertificate(index: number) {
    setOptionalCertificates((current) => current.filter((_, position) => position !== index));
  }

  const declaredOptionalCertificates = showOptionalCertificates
    ? optionalCertificates.filter((certificate) => certificate.title.trim())
    : [];

  function goToStep1() {
    resetChallenge();
    setStepError("");
    setStep(1);
  }

  // The step buttons sit at the bottom of a long step while the error renders
  // at the top; on a phone the message lands off-screen and the tap looks like
  // it did nothing. Bring the error to the reader every time it is raised.
  function showStepError(message: string) {
    setStepError(message);
    requestAnimationFrame(() => {
      stepErrorRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  }

  function goToStep2() {
    if (selectedProviderServices.length === 0) {
      showStepError(
        providerFormIsSpanish
          ? "Elija al menos un servicio."
          : "Pick at least one service.",
      );
      return;
    }
    // Step 1 renders its own Continue as type="button", so native `required`
    // validation never runs here — check the email explicitly.
    const stepOneEmail = (draftFields["provider-email"] ?? "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(stepOneEmail)) {
      showStepError(
        providerFormIsSpanish
          ? "Escriba un correo electrónico válido."
          : "Enter a valid email address.",
      );
      return;
    }
    setStepError("");
    resetChallenge();
    track("provider_step1_completed", { variants: activeVariants() });
    setStep(showStep2 ? 2 : 3);
  }

  function goToStep3() {
    if (hasVisibleLegalRequirements && !legalConfirmed) {
      showStepError(
        providerFormIsSpanish
          ? "Confirme que entiende los requisitos legales mostrados."
          : "Confirm you understand the legal requirements shown above.",
      );
      return;
    }
    setStepError("");
    resetChallenge();
    track("provider_step2_completed", { variants: activeVariants() });
    setStep(3);
  }

  async function handleFinalSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (hasVisibleLegalRequirements && !legalConfirmed) {
      resetChallenge();
      setApplicationError("");
      setStep(2);
      showStepError(providerFormIsSpanish
        ? "Revise la lista de sus servicios antes de continuar."
        : "Please review your service checklist before continuing.");
      return;
    }
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
      optionalCertificates: declaredOptionalCertificates,
    };

    if (applicationChallengeId) {
      if (!pendingApplicationPayload || !/^\d{6}$/.test(applicationVerificationCode)) {
        setApplicationError(providerFormIsSpanish
          ? "Escriba el código de 6 dígitos enviado al correo de la solicitud."
          : "Enter the 6-digit code sent to the application email.");
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
            // Attribution only. Never part of the verified application payload
            // or its hash — the server records it after the application is
            // stored, and it changes nothing about review or eligibility.
            referralCode: referralCode(),
            analyticsAttribution: { ...campaignAttribution(), variants: activeVariants() },
            // Promotional texts only. Reaching an applicant about their own
            // application is transactional and never depends on this.
            smsMarketingConsent: values["provider-sms-marketing-consent"] === "yes",
          }),
        });
        const result = (await response.json()) as { error?: string };
        if (!response.ok) throw new Error(result.error || "Please try again.");
        // The applicant proved control of this email seconds ago; prefill the
        // /account sign-in so "Continue provider verification" doesn't ask
        // them to retype it.
        rememberEmailForSignIn(String(pendingApplicationPayload.email ?? ""));
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
      track("provider_verification_requested", { variants: activeVariants() });
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
      <InterfaceCopy><div className="success-message provider-success" role="status">
        <span>✓</span>
        <h3>{providerFormIsSpanish ? "¡Gracias! Recibimos su solicitud." : "Thanks — we've received your application."}</h3>
        <p>{providerFormIsSpanish
          ? "Inicie sesión con el mismo correo para completar la lista de sus servicios y seguir la revisión en su panel. Le escribiremos cuando haya una actualización. Enviar la solicitud no activa servicios ni reservas."
          : "Sign in with the same email to complete your service checklist and follow the review in your dashboard. We'll email you when there's an update. Submitting an application does not activate services or bookings."}</p>
        <p><small>{providerFormIsSpanish
          ? "Si ya existía una solicitud para este correo, se conservó esa solicitud; los cambios se hacen después de iniciar sesión."
          : "If an application already existed for this email, that one was kept — changes happen after you sign in."}</small></p>
        <Link className="button primary" href="/account?role=provider">
          {providerFormIsSpanish ? "Continuar con la verificación" : "Continue provider verification"}
        </Link>
        <button type="button" onClick={() => setApplicationSent(false)}>
          {providerFormIsSpanish ? "Iniciar otra verificación" : "Start another verification"}
        </button>
        <FollowAlong source="provider_application_received" spanish={providerFormIsSpanish} tone="panel" />
      </div></InterfaceCopy>
    );
  }

  return (
    <InterfaceCopy><form
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
      <div className="step-indicator" aria-label={providerFormIsSpanish ? "Pasos de la solicitud" : "Application steps"}>
        {visibleSteps.map((id, index) => (
          <span aria-current={step === id ? "step" : undefined} className={step === id ? "on" : ""} key={id}>
            {index + 1}. {providerFormIsSpanish
              ? SIGNUP_STEP_LABELS[id].es
              : SIGNUP_STEP_LABELS[id].en}
          </span>
        ))}
      </div>
      <p className="hint step-progress" aria-live="polite">
        {providerFormIsSpanish
          ? `Paso ${stepPosition} de ${visibleSteps.length}`
          : `Step ${stepPosition} of ${visibleSteps.length}`}
      </p>

      {draftRestored && !applicationChallengeId && (
        <p className="hint" role="status">
          {step === 2 && hasVisibleLegalRequirements && !legalConfirmed
            ? (providerFormIsSpanish
              ? "Bienvenido de nuevo. Sus datos están guardados. Revise la lista de sus servicios antes de continuar."
              : "Welcome back. Your details are saved. Please review your service checklist before continuing.")
            : (providerFormIsSpanish
              ? "Bienvenido de nuevo — guardamos su avance en este dispositivo. Puede continuar donde quedó."
              : "Welcome back — we saved your progress on this device. Pick up where you left off.")}
        </p>
      )}

      {stepError && <p className="form-error" ref={stepErrorRef} role="alert">{stepError}</p>}

      {step === 1 && (
        <div data-signup-step="1" ref={stepContentRef} tabIndex={-1}>
          <h3>{providerFormIsSpanish ? "¿Qué servicios le gustaría ofrecer?" : "What would you like to offer?"}</h3>
          <p>{providerFormIsSpanish
            ? "Elija los servicios que ya sabe hacer. Le mostraremos una lista de lo que necesita para esas opciones."
            : "Choose services you already know how to do. We'll show you a checklist for those choices."}</p>
          <div className="legal-requirement-note" role="status">
            <strong>
              {providerFormIsSpanish
                ? "Solicite ahora. Agregue sus documentos después."
                : "Apply now. Add your documents later."}
            </strong>
            <small>
              {providerFormIsSpanish
                ? "Las solicitudes están abiertas en el Condado de Montgomery. Las reservas de clientes aún no están abiertas."
                : "Applications are open in Montgomery County. Customer bookings are not open yet."}
            </small>
          </div>
          <fieldset className="area-fieldset service-fieldset">
            <legend>{providerFormIsSpanish ? "Servicios que ofrece" : "Services you offer"}</legend>
            <p className="provider-service-picker-intro">
              {providerFormIsSpanish
                ? "Elija los tipos de trabajo que realmente hace. Abra una categoría para seleccionar trabajos específicos."
                : "Choose the kinds of work you actually do. Open a category to pick the exact jobs."}
            </p>
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
                          : providerFormIsSpanish
                            ? `${groupServices.length} trabajos`
                            : `${groupServices.length} jobs`}
                      </b>
                    </summary>
                    <div className="service-options">
                      {groupServices.map((service) => {
                        const isSelected = selectedProviderServices.includes(service.code);
                        return (
                          <div className="service-option" key={service.code}>
                            <label>
                              <input
                                checked={isSelected}
                                name="provider-service"
                                type="checkbox"
                                value={service.code}
                                onChange={(event) => {
                                  setLegalConfirmed(false);
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
                              <small>{providerFormIsSpanish ? spanishText[service.description] ?? service.description : service.description}</small>
                            </details>
                          </div>
                        );
                      })}
                    </div>
                  </details>
                );
              })}
            </div>
            {hasSpecialtySelection && (
              <p className="tier-swap-notice" role="status">
                {providerFormIsSpanish
                  ? "Elija todos los trabajos que realmente hace. Algunos servicios especializados requieren una licencia, permiso o certificado propio. Revisaremos cada servicio por separado."
                  : "Pick every job you actually do. Some specialty services need their own license, permit, or certificate. We'll review each service separately."}
              </p>
            )}
            <small className="customer-service-note">
              {providerFormIsSpanish
                ? "Elija solo los servicios que quiere que revisemos."
                : "Choose only the services you want reviewed."}
            </small>
          </fieldset>
          {requiredDocumentCount > 0 && (
            <div className="legal-requirement-note" role="status" aria-live="polite">
              <strong>
                {providerFormIsSpanish
                  ? `Para los trabajos que eligió, necesitará ${requiredDocumentCount} ${
                      requiredDocumentCount === 1 ? "documento" : "documentos únicos"
                    }.`
                  : `For the jobs you picked, you'll need ${requiredDocumentCount} ${
                      requiredDocumentCount === 1 ? "document" : "unique documents"
                    }.`}
              </strong>
              <small>
                {providerFormIsSpanish
                  ? "No los necesita ahora mismo. El siguiente paso le muestra exactamente cuáles son."
                  : "You don't need them right now. The next step shows you exactly which ones."}
              </small>
            </div>
          )}
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
                ? "Solo lo usamos para verificar su solicitud y enviarle actualizaciones. Sus respuestas se guardan en este dispositivo, así que puede continuar donde quedó."
                : "We only use this to verify your application and send you updates. Your answers are saved on this device, so you can pick up where you left off."}
            </small>
          </label>
          <button type="button" className="button lime form-button" onClick={goToStep2}>
            {providerFormIsSpanish ? "Continuar" : "Continue"} <span>→</span>
          </button>
        </div>
      )}

      {step === 2 && showStep2 && (
        <div data-signup-step="2" ref={stepContentRef} tabIndex={-1}>
          {requiredDocumentGroups.length > 0 && (
            <>
              <h3>{providerFormIsSpanish ? "La lista para sus servicios" : "Your service checklist"}</h3>
              <p className="hint">
                {providerFormIsSpanish
                  ? "Puede enviar su solicitud ahora y agregar estos documentos después. Solo mostramos los documentos y las revisiones de seguridad y experiencia de Tuveloz para los servicios que eligió. Los documentos compartidos aparecen una sola vez."
                  : "You can apply now and add these documents later. We only show the paperwork and Tuveloz safety and experience checks for your chosen services. Shared documents are listed once."}
              </p>
              {requiredDocumentGroups.map((group, groupIndex) => (
                <div key={groupIndex} className="legal-requirement-note">
                  <strong>
                    {group.serviceCodes.length === requiredDocumentsBySelection.length
                      ? (providerFormIsSpanish ? "Para sus servicios seleccionados" : "For your selected services")
                      : `${providerFormIsSpanish ? "Para " : "For "}${joinServiceNames(
                        group.serviceCodes.map((code) => providerServicePlainLabel(
                          code,
                          SERVICES.find((service) => service.code === code)?.label ?? code,
                          providerFormIsSpanish,
                        )),
                        providerFormIsSpanish,
                      )}`}
                  </strong>
                  <ul className="requirement-checklist">
                    {group.documents.map((doc) => {
                      const plain = providerDocumentPlainLabel(doc.code, providerFormIsSpanish);
                      return (
                        <li key={doc.code}>
                          <span className="requirement-check" aria-hidden="true">•</span>
                          <span className="requirement-text">
                            <span>
                              {plain ?? doc.label}
                              {doc.requiresExpiration === true
                                ? (providerFormIsSpanish
                                    ? " — con su fecha de vencimiento"
                                    : " — showing its expiration date")
                                : ""}
                            </span>
                            {plain && (
                              <small className="requirement-official-name">
                                {providerFormIsSpanish ? "Nombre oficial: " : "Official name: "}
                                {doc.label}
                              </small>
                            )}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
              <p className="hint">
                {providerFormIsSpanish
                  ? "Subirá estos documentos después de verificar su correo e iniciar sesión. Le mostraremos cómo, paso a paso."
                  : "You'll upload these after you verify your email and sign in. We'll walk you through it, step by step."}
              </p>
            </>
          )}
          <details className="provider-payout-details">
            <summary>
              {providerFormIsSpanish
                ? "Los datos fiscales y de cobro se piden después"
                : "Tax and payout details come later"}
            </summary>
            <p className="hint">
              {providerFormIsSpanish
                ? "Antes de su primer pago, completará sus datos fiscales y de cobro, incluido el Formulario W-9 del IRS requerido. Tuveloz emite un 1099 por las ganancias anuales aplicables."
                : "You'll set up tax and payout details before your first payout, including the required IRS Form W-9. Tuveloz issues a 1099 for applicable annual earnings."}
            </p>
          </details>
          {hasVisibleLegalRequirements && (
            <section className="provider-eligibility-guide">
              <div className="eligibility-guide-heading">
                <span>{providerFormIsSpanish ? "SOBRE SUS SERVICIOS" : "ABOUT YOUR SERVICES"}</span>
              </div>
              <p className="hint">
                {providerFormIsSpanish
                  ? "Si algo todavía no está listo, elija “Todavía no” o “No estoy seguro”. Puede continuar con la solicitud y le ayudaremos a confirmar lo que falta."
                  : "If something isn't ready, choose “Not yet” or “Not sure.” You can continue your application, and we'll help you confirm what's needed."}
              </p>
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
                    <details className="legal-note-details">
                      <summary>
                        {providerFormIsSpanish ? "Guía de registro y fuentes" : "Registration guidance and sources"}
                      </summary>
                      <small>
                        <strong>
                          {providerFormIsSpanish
                            ? "El Condado de Montgomery no tiene una vía de reparaciones simples sin registro."
                            : "Montgomery County has no unregistered simple-repair lane."}
                        </strong>{" "}
                        {providerFormIsSpanish
                          ? "Un negocio móvil de reparación o mantenimiento debe contar con el registro OCP del Condado. Un propietario-operador independiente necesita un negocio real, registro OCP vigente y cobertura confirmada por su corredor para cada servicio específico."
                          : "A mobile repair or maintenance business must hold the County OCP registration. An independent owner-operator needs a real business, current OCP registration, and broker-confirmed coverage for each exact service."}
                      </small>
                      <small>
                        <a
                          href="https://www.montgomerycountymd.gov/office-consumer-protection/business-education-registration-unit-bear/motor-vehicle-repair-maintenance-towing"
                          rel="noreferrer"
                          target="_blank"
                        >
                          {providerFormIsSpanish ? "Guía de registro OCP del Condado de Montgomery" : "Montgomery County OCP registration guidance"}
                        </a>
                        {" · "}
                        <a
                          href="https://codelibrary.amlegal.com/codes/montgomerycounty/latest/montgomeryco_md/0-0-0-138743"
                          rel="noreferrer"
                          target="_blank"
                        >
                          {providerFormIsSpanish ? "Capítulo 31A del Código del Condado" : "County Code Chapter 31A"}
                        </a>
                      </small>
                    </details>
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
                  ? (providerFormIsSpanish ? "Gracias. Verificaremos sus respuestas durante la revisión." : "Thanks. We'll verify your answers during review.")
                  : providerLegalStatus === "needs-review"
                    ? (providerFormIsSpanish ? "Puede continuar. Le ayudaremos a confirmar los puntos que faltan." : "You can continue. We'll help you confirm the outstanding items.")
                    : (providerFormIsSpanish ? "Puede solicitar ahora. Estos puntos deben completarse antes de aprobar los servicios." : "You can apply now. These items need to be completed before services are approved.")}
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
        <div data-signup-step="3" ref={stepContentRef} tabIndex={-1}>
          <h3>
            {providerFormIsSpanish ? "Usted y su negocio" : "You and your business"}
          </h3>
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
          {/*
            Email is collected on step 1 so an applicant who abandons partway
            still has their progress saved under an address they can return to.
            Steps render conditionally, so `new FormData(form)` at submit only
            sees the current step — this hidden field carries the step-1 value
            into the payload. The read-back row below keeps it visible and
            correctable without leaving step 3.
          */}
          <input
            name="provider-email"
            type="hidden"
            value={draftFields["provider-email"] ?? ""}
          />
          <div className="provider-email-readback">
            <span>{providerFormIsSpanish ? "Correo electrónico" : "Email"}</span>
            <strong>{draftFields["provider-email"] ?? ""}</strong>
            <button type="button" className="account-text-button" onClick={goToStep1}>
              {providerFormIsSpanish ? "Cambiar" : "Change"}
            </button>
          </div>
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
            <small>
              {providerFormIsSpanish
                ? PHONE_TRANSACTIONAL_PURPOSE_TEXT_ES
                : PHONE_TRANSACTIONAL_PURPOSE_TEXT_EN}
            </small>
          </label>
          <label className="provider-sms-consent">
            <input name="provider-sms-marketing-consent" type="checkbox" value="yes" />
            <span>
              {providerFormIsSpanish
                ? SMS_MARKETING_CONSENT_TEXT_ES
                : SMS_MARKETING_CONSENT_TEXT_EN}
            </span>
          </label>
          {/*
            Everything above is about the person; everything below is about the
            business. Marking the seam is what makes this step read as two
            short sections instead of one long one — no fields move, so nothing
            can drop out of FormData.
          */}
          <h4 className="signup-subheading">
            {providerFormIsSpanish ? "Su negocio" : "Your business"}
          </h4>
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
          <section className="optional-cert-section">
            <div className="optional-cert-optin">
              <div className="optional-cert-optin-copy">
                <strong>
                  {providerFormIsSpanish
                    ? "¿Tiene certificados (como ASE) que quiera mostrar a los clientes?"
                    : "Have any certificates (like ASE) you'd like to show customers?"}
                </strong>
                <small>
                  {providerFormIsSpanish
                    ? "No es obligatorio. Puede agregarlos y Tuveloz los verifica antes de que un cliente los vea."
                    : "Not required — but you can add them, and we'll verify each one before any customer sees it."}
                </small>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={showOptionalCertificates}
                className={`brand-switch${showOptionalCertificates ? " on" : ""}`}
                onClick={toggleOptionalCertificates}
              >
                <span className="brand-switch-track">
                  <span className="brand-switch-thumb" />
                </span>
                <span className="brand-switch-state">
                  {showOptionalCertificates
                    ? (providerFormIsSpanish ? "Sí" : "On")
                    : (providerFormIsSpanish ? "No" : "Off")}
                </span>
              </button>
            </div>
            {showOptionalCertificates && (
              <div className="optional-cert-editor">
                {optionalCertificates.map((certificate, index) => (
                  <div className="optional-cert-row" key={index}>
                    <label>
                      {providerFormIsSpanish ? "Tipo de certificado" : "Certificate type"}
                      <select
                        value={certificate.category}
                        onChange={(event) => updateOptionalCertificate(index, {
                          category: event.target.value as OptionalCertificateCategory,
                        })}
                      >
                        {OPTIONAL_CERTIFICATE_CATEGORIES.map((option) => (
                          <option key={option.key} value={option.key}>
                            {providerFormIsSpanish ? option.es : option.en}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      {providerFormIsSpanish ? "Nombre del certificado" : "Certificate name"}
                      <input
                        maxLength={120}
                        value={certificate.title}
                        placeholder={providerFormIsSpanish
                          ? "Ej.: ASE A6 sistema eléctrico"
                          : "e.g. ASE A6 Electrical Systems"}
                        onChange={(event) => updateOptionalCertificate(index, {
                          title: event.target.value,
                        })}
                      />
                    </label>
                    <label>
                      {providerFormIsSpanish ? "Número (opcional)" : "Certificate number (optional)"}
                      <input
                        maxLength={80}
                        value={certificate.credentialIdentifier}
                        placeholder={providerFormIsSpanish ? "Si lo tiene" : "If you have one"}
                        onChange={(event) => updateOptionalCertificate(index, {
                          credentialIdentifier: event.target.value,
                        })}
                      />
                    </label>
                    <button
                      type="button"
                      className="optional-cert-remove"
                      onClick={() => removeOptionalCertificate(index)}
                    >
                      {providerFormIsSpanish ? "Quitar" : "Remove"}
                    </button>
                  </div>
                ))}
                {optionalCertificates.length < MAX_OPTIONAL_CERTIFICATES && (
                  <button
                    type="button"
                    className="optional-cert-add"
                    onClick={addOptionalCertificate}
                  >
                    + {providerFormIsSpanish ? "Agregar otro certificado" : "Add another certificate"}
                  </button>
                )}
                <small className="hint">
                  {providerFormIsSpanish
                    ? "Tuveloz revisa cada certificado y le escribe si necesita algo más. Nada se muestra a los clientes hasta que quede verificado."
                    : "Tuveloz checks each certificate and emails you if we need anything else. Nothing shows to customers until it's verified."}
                </small>
              </div>
            )}
          </section>
          <fieldset className="area-fieldset">
            <legend>
              {providerFormIsSpanish
                ? "Revise y confirme"
                : "Review and confirm"}
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
            {/*
              Stays English until its Spanish legal copy is reviewed. Unlike
              the two acceptances below, this one is not hash-recorded, so
              translating it would not corrupt any evidence record — that is
              exactly why it looks safe to translate, and it is not. It is
              still a legal acknowledgment, and what it means in Spanish is a
              reviewed-copy decision rather than a string swap.
            */}
            {providerFormIsSpanish && (
              <p className="hint">
                Los acuerdos de abajo están en inglés. Abra los enlaces y léalos
                antes de aceptar. Si necesita ayuda, escríbanos a{" "}
                <a href="mailto:hello@tuveloz.com">hello@tuveloz.com</a>.
                Puede guardar su solicitud y volver después.
              </p>
            )}
            <div data-no-interface-translation lang="en">
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
          {/*
            DO NOT translate the two acceptance texts below, and do not add
            them to the spanishText dictionary. The enclosing form wrapper is marked
            data-manual-language, and this local wrapper is a second barrier
            in case a future refactor moves the legal text outside that panel.

            On submit, app/api/providers/route.ts records
            providerAgreementEvidenceText() for every acceptance document, and
            that evidence embeds `presentedText` — these exact English
            constants — alongside a canonical body hash and release id.
            Rendering Spanish here while recording the English would make the
            immutable record assert the applicant saw text they never saw.

            Translating them needs a reviewed Spanish policy release and a
            presentedText that follows the displayed language, not a string
            swap. Spanish drafts already exist in site-language.tsx if that
            work gets picked up.
          */}
              <label className="policy-consent">
                <input required name="terms-bundle-accepted" type="checkbox" value="yes" />
                <span>
                  {PROVIDER_TERMS_ACCEPTANCE_TEXT}{" "}
                  Review the <a href="/terms">Terms</a>,{" "}
                  <a href="/provider-agreement">Provider Agreement</a>,{" "}
                  <a href="/payments">Payment Policy</a>,{" "}
                  <a href="/marketplace-conduct">Conduct Policy</a>,{" "}
                  <a href="/provisional-provider-policy">Provider Pathway Policy</a>, and{" "}
                  <a href="/provider-safety-policy">Safety and Safe-Work Policy</a>.
                </span>
              </label>
              <label className="policy-consent">
                <input required name="privacy-acknowledged" type="checkbox" value="yes" />
                <span>
                  {PROVIDER_PRIVACY_ACKNOWLEDGMENT_TEXT}{" "}
                  Review the <a href="/privacy">Privacy Policy</a>.
                </span>
              </label>
            </div>
          </fieldset>
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
                  ? "Escriba el código de 6 dígitos enviado al correo anterior. Vence en 10 minutos y solo confirma su correo. Sus servicios todavía necesitan revisión antes de aprobarse."
                  : "Enter the 6-digit code sent to the email above. It expires in 10 minutes and confirms your email only. Your services still need review before approval."}
              </small>
              <small className="hint">
                {providerFormIsSpanish
                  ? "Sus respuestas se guardan en este dispositivo — si cambia a su correo para buscar el código, seguirán aquí cuando regrese."
                  : "Your answers are saved on this device — if you switch to your email to grab the code, they'll still be here when you come back."}
              </small>
              <label>
                {providerFormIsSpanish
                  ? "Código de verificación de 6 dígitos"
                  : "6-digit verification code"}
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
                {applicationBusy
                  ? (providerFormIsSpanish ? "Verificando..." : "Verifying...")
                  : (providerFormIsSpanish
                    ? "Verificar correo y continuar"
                    : "Verify email and continue")}
              </button>
              {/* One button to press. The two ways out stay available as plain
                  links so they cannot be mistaken for the thing to do next. */}
              <div className="form-alt-actions">
                <button disabled={applicationBusy} onClick={resendProviderApplicationCode} type="button">
                  {providerFormIsSpanish ? "Enviar el código de nuevo" : "Send the code again"}
                </button>
                <button disabled={applicationBusy} onClick={resetChallenge} type="button">
                  {/* TODO(es): "Regresar y editar" is a literal rendering of main's
                      newer label; confirm against reviewed Spanish copy. */}
                  {providerFormIsSpanish ? "Regresar y editar" : "Go back and edit"}
                </button>
              </div>
            </section>
          ) : confirmingSubmit ? (
            <ConfirmAction
              backLabel={providerFormIsSpanish ? "Regresar" : "Go back"}
              busy={applicationBusy}
              busyLabel={providerFormIsSpanish ? "Enviando…" : "Sending…"}
              confirmLabel={providerFormIsSpanish ? "Sí, envíenme el código" : "Yes, send my code"}
              confirmStyle="lime"
              confirmType="submit"
              message={providerFormIsSpanish
                ? "Écheles un vistazo a los datos de arriba — ¿todo bien? Le enviaremos un código de un solo uso para confirmar que es usted. Esto inicia una solicitud nueva solo si aún no tiene una para este correo; si ya la tiene, puede actualizarla después de iniciar sesión."
                : "Take a quick look above — all set? We'll email you a one-time code to confirm it's you. This starts a new application only if you don't already have one for this email; if you do, you can update it after signing in."}
              onBack={() => setConfirmingSubmit(false)}
              title={providerFormIsSpanish ? "¿Listo para enviarla?" : "Ready to send it in?"}
            />
          ) : (
            <div className="form-nav">
              <button type="button" className="button secondary" onClick={showStep2 ? () => setStep(2) : goToStep1}>
                ← {providerFormIsSpanish ? "Regresar" : "Back"}
              </button>
              <button className="button lime form-button" type="submit" disabled={applicationBusy}>
                {applicationBusy
                  ? (providerFormIsSpanish ? "Preparando…" : "Preparing…")
                  : (providerFormIsSpanish ? "Enviar mi solicitud" : "Send my application")} <span>→</span>
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
    </form></InterfaceCopy>
  );
}
