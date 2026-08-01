"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import {
  emptyProviderSelfAssessment,
  evaluateProviderServices,
  getProviderLegalRequirementFlags,
  type ProviderSelfAssessment,
} from "../lib/provider-compliance";
import {
  CURRENT_LAUNCH_AREA,
  CUSTOMER_SERVICE_GROUPS,
  CUSTOMER_SERVICE_LOCATION_OPTIONS,
  parseCustomerServiceLocations,
  PARTS_PREFERENCE_OPTIONS,
  PARTS_SOURCE_OPTIONS,
  PROVIDER_WORK_LOCATION_OPTIONS,
  providerModeForWorkLocations,
} from "../lib/service-matching";
import {
  POLICY_JURISDICTION,
  POLICY_STATUS,
  POLICY_VERSION,
  PROVIDER_LEVEL_LABELS,
  SERVICES,
  type ProviderLevel,
  type ProviderPathway,
  type ServiceCode,
} from "../lib/provider-policy";
import {
  PROVIDER_PRIVACY_ACKNOWLEDGMENT_TEXT,
  PROVIDER_TERMS_ACCEPTANCE_TEXT,
} from "../lib/provider-policy-acceptance";
import { MarketPriceLinks } from "./components/market-price-links";
import VehicleSelector from "./components/vehicle-selector";
import {
  SiteLanguageButton,
  useSiteLanguage,
} from "./components/site-language";
import {
  BrandMark,
  TuvelozIcon,
  type TuvelozIconName,
} from "./components/tuveloz-icons";
import { ConfirmAction } from "./components/confirm-action";

// The old homepage form accepted multiple broad service labels and older
// clickwrap. It is permanently excluded from rendering; /post-job is the only
// customer-intake review surface and uses the exact-service authorization flow.
function legacyHomepageRequestFormEnabled() {
  return false;
}

const services: Array<{
  icon: TuvelozIconName;
  title: string;
  text: string;
}> = [
  {
    icon: "battery",
    title: "Battery & Jump Start",
    text: "Get back on the road when your battery lets you down.",
  },
  {
    icon: "tire",
    title: "Tire Help",
    text: "Flat tire support, spare installation, and mobile tire service.",
  },
  {
    icon: "diagnostics",
    title: "Basic Vehicle Diagnostics",
    text: "Connect with a local independent provider for a basic on-site vehicle assessment.",
  },
  {
    icon: "tint",
    title: "Window Tint Quotes",
    text: "Request quotes from local tint providers for installations that follow applicable state and local laws.",
  },
  {
    icon: "rain-guard",
    title: "Rain Guards & Vent Visors",
    text: "Request installation of vehicle-fit rain guards, vent visors, or window deflectors.",
  },
  {
    icon: "sunshade",
    title: "Vehicle Sunshades",
    text: "Request installation of a removable or retractable sunshade made to fit your vehicle.",
  },
  {
    icon: "detailing",
    title: "Car Washing & Detailing",
    text: "Choose an exterior wash with basic rim cleaning, interior detailing, or both.",
  },
];

const steps = [
  ["01", "Post your job", "Tell us about your vehicle, what you need, and your preferred timing."],
  ["02", "Receive quotes", "Interested local providers review the details and send a price."],
  ["03", "Choose what works", "Compare your options and accept a quote only when it feels right."],
];

const feedbackJobOptions = [
  "Oil changes",
  "Brake service",
  "Battery replacement",
  "Tire installation",
  "Minor repairs and maintenance",
  "Towing or roadside service",
];

const feedbackProviderOptions = [
  "Scheduling and availability",
  "Simple quote templates",
  "Customer messaging",
  "Invoices and receipts",
  "Parts and labor estimates",
  "Business performance dashboard",
];

const feedbackCustomerOptions = [
  "Clear price ranges",
  "Easier provider comparison",
  "Appointment scheduling",
  "Job status updates",
  "Service history and reminders",
  "More providers and service choices",
];

type ProviderApplicationPathway = "learning_account" | ProviderPathway;

const PROVIDER_APPLICATION_PATHWAYS: ReadonlyArray<{
  code: ProviderApplicationPathway;
  label: string;
  description: string;
}> = [
  {
    code: "learning_account",
    label: "Applicant-only account",
    description: "Application-interest record only. TUVELOZ does not provide training, employment, job assignment, customer jobs, or payouts through this account.",
  },
  {
    code: "independent_startup",
    label: "Independent startup owner-operator",
    description: "You own the provider business and personally perform any future approved work.",
  },
  {
    code: "sponsored_trainee_employee",
    label: "Sponsored trainee employee",
    description: "You are a genuine paid trainee employee of a separate approved provider business - not TUVELOZ.",
  },
  {
    code: "provider_business_employee",
    label: "Regular provider-business employee",
    description: "You are a current non-trainee employee of a separate provider business responsible for the work - not a TUVELOZ employee.",
  },
];

const PROVIDER_REVIEW_SERVICES = SERVICES.filter(
  (service) => service.code !== "general_auto_repair",
);

const PROVIDER_REVIEW_SERVICE_GROUPS = [
  {
    id: "limited",
    label: "Limited and provisional services",
    description: "Candidate limited services for later qualification review. Selecting one does not enroll you in training or authorize customer work.",
    services: PROVIDER_REVIEW_SERVICES.filter((service) => (
      service.allowedProviderLevels.includes("sponsored_trainee")
      || service.allowedProviderLevels.includes("provisional_independent")
    )),
  },
  {
    id: "standard",
    label: "Standard provider services",
    description: "Services requiring an approved registered provider business and matching coverage.",
    services: PROVIDER_REVIEW_SERVICES.filter((service) => (
      service.allowedProviderLevels.includes("standard_provider")
    )),
  },
  {
    id: "specialty",
    label: "Specialty provider services",
    description: "Higher-control services requiring the listed licenses, permits, evidence, and workflow approval.",
    services: PROVIDER_REVIEW_SERVICES.filter((service) => (
      service.allowedProviderLevels.includes("specialty_provider")
    )),
  },
] as const;

function deriveProviderLevel(
  pathway: ProviderApplicationPathway,
  selectedServices: readonly ServiceCode[],
): ProviderLevel {
  if (pathway === "learning_account") return "learning_account";
  if (pathway === "sponsored_trainee_employee") return "sponsored_trainee";

  const selectedPolicies = selectedServices.map((code) => (
    PROVIDER_REVIEW_SERVICES.find((service) => service.code === code)
  ));
  if (selectedPolicies.some((service) => service?.allowedProviderLevels.includes("specialty_provider"))) {
    return "specialty_provider";
  }
  if (selectedPolicies.some((service) => service?.allowedProviderLevels.includes("standard_provider"))) {
    return "standard_provider";
  }
  return pathway === "independent_startup"
    ? "provisional_independent"
    : "standard_provider";
}

type PublicReview = {
  id: string;
  providerName: string;
  customerDisplayName: string;
  service: string;
  rating: number;
  comment: string;
  createdAt: string;
  providerVerified: boolean;
};

type PriceGuidanceItem = {
  service: string;
  available: boolean;
  sampleCount: number;
  averageCents?: number;
  lowCents?: number;
  highCents?: number;
  message?: string;
};

type RepeatBooking = {
  token: string;
  providerName: string;
  customerName: string;
  customerEmail: string;
  vehicle: string;
  launchArea: string;
  municipality: string;
  zip: string;
  partsSource: string;
  partsPreference: string;
  serviceLocations: string;
  serviceAddress: string;
};

function dollars(cents: number | undefined) {
  return `$${((cents ?? 0) / 100).toFixed(2)}`;
}

function LegalHelp({ label, text }: { label: string; text: string }) {
  return (
    <details className="legal-help">
      <summary aria-label={label}>?</summary>
      <span>{text}</span>
    </details>
  );
}

export type PublicView = "home" | "about" | "request" | "provider";

export function TuvelozPublic({ view = "home" }: { view?: PublicView }) {
  const { language } = useSiteLanguage();
  const [menuOpen, setMenuOpen] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [requestToken, setRequestToken] = useState("");
  const [applicationSent, setApplicationSent] = useState(false);
  const [requestBusy, setRequestBusy] = useState(false);
  const [applicationBusy, setApplicationBusy] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [vehicleResetVersion, setVehicleResetVersion] = useState(0);
  const [applicationError, setApplicationError] = useState("");
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [feedbackError, setFeedbackError] = useState("");
  const [expansionSent, setExpansionSent] = useState(false);
  const [expansionBusy, setExpansionBusy] = useState(false);
  const [expansionError, setExpansionError] = useState("");
  const [expansionAudience, setExpansionAudience] = useState("");
  const [pendingSubmission, setPendingSubmission] = useState<
    "" | "request" | "application" | "feedback"
  >("");
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [reviewSummary, setReviewSummary] = useState({ average: 0, count: 0 });
  const [selectedCustomerServices, setSelectedCustomerServices] = useState<string[]>([]);
  const [selectedCustomerVehicle, setSelectedCustomerVehicle] = useState("");
  const [partsSource, setPartsSource] = useState("Either is okay");
  const [partsPreference, setPartsPreference] = useState("No preference");
  const [selectedCustomerLocations, setSelectedCustomerLocations] = useState<string[]>([]);
  const [priceGuidance, setPriceGuidance] = useState<PriceGuidanceItem[]>([]);
  const [priceGuidanceBusy, setPriceGuidanceBusy] = useState(false);
  const [repeatBooking, setRepeatBooking] = useState<RepeatBooking | null>(null);
  const [repeatBookingError, setRepeatBookingError] = useState("");
  const [useSameVehicle, setUseSameVehicle] = useState(true);
  const [selectedProviderServices, setSelectedProviderServices] = useState<ServiceCode[]>([]);
  const [providerPathwayChoice, setProviderPathwayChoice] = useState<ProviderApplicationPathway>(
    "learning_account",
  );
  const [selectedProviderAreas, setSelectedProviderAreas] = useState<string[]>([
    CURRENT_LAUNCH_AREA,
  ]);
  const [selectedProviderWorkLocations, setSelectedProviderWorkLocations] = useState<string[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [headerAccountState, setHeaderAccountState] = useState<
    "checking" | "signed-out" | "customer" | "provider"
  >("checking");
  const [headerAccountDestination, setHeaderAccountDestination] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/account", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (response.status === 401) {
          setHeaderAccountState("signed-out");
          return;
        }

        if (!response.ok) {
          throw new Error("Account status unavailable.");
        }

        const result = (await response.json()) as {
          role?: "customer" | "provider";
          destination?: string;
        };

        if (result.role === "customer" || result.role === "provider") {
          setHeaderAccountState(result.role);
          setHeaderAccountDestination(result.destination ?? "");
          return;
        }

        setHeaderAccountState("checking");
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setHeaderAccountState("checking");
      });

    return () => controller.abort();
  }, []);
  const [providerAssessment, setProviderAssessment] = useState<ProviderSelfAssessment>(
    emptyProviderSelfAssessment,
  );
  const customerAllowsProviderTravel = selectedCustomerLocations.includes(
    CUSTOMER_SERVICE_LOCATION_OPTIONS[0],
  );
  const providerAcceptsCustomersAtBusiness = selectedProviderWorkLocations.includes(
    PROVIDER_WORK_LOCATION_OPTIONS[1],
  );
  const providerFormIsSpanish = language === "es";
  const providerLanguage = providerFormIsSpanish ? "Spanish" : "English";
  const providerLevel = deriveProviderLevel(
    providerPathwayChoice,
    selectedProviderServices,
  );
  const providerRelationshipPath = providerPathwayChoice === "learning_account"
    ? null
    : providerPathwayChoice;
  const providerNeedsOwnBusiness = providerPathwayChoice === "independent_startup";
  const providerNeedsSponsor = providerPathwayChoice === "sponsored_trainee_employee"
    || providerPathwayChoice === "provider_business_employee";
  const providerLegalRequirements = getProviderLegalRequirementFlags(
    selectedProviderServices,
    selectedProviderAreas,
  );
  const providerEligibility = evaluateProviderServices(
    selectedProviderServices,
    selectedProviderAreas,
    providerAssessment,
  );
  const providerEligibilityResults = Object.values(providerEligibility);
  const providerLegalStatus = providerEligibilityResults.some((result) => result.status === "blocked")
    ? "blocked"
    : providerEligibilityResults.some((result) => result.status === "needs-review")
      ? "needs-review"
      : "ready";
  const hasVisibleLegalRequirements = Object.values(providerLegalRequirements).some(Boolean);

  useEffect(() => {
    fetch("/api/reviews").then(async (response) => {
      if (!response.ok) return;
      const result = (await response.json()) as {
        reviews?: PublicReview[];
        summary?: { average: number; count: number };
      };
      setReviews(result.reviews ?? []);
      setReviewSummary(result.summary ?? { average: 0, count: 0 });
    }).catch(() => {
      // Reviews are supporting content; the rest of the homepage remains available.
    });
  }, []);

  useEffect(() => {
    fetch("/api/owner-access")
      .then(async (response) => {
        if (!response.ok) return;
        const result = (await response.json()) as { isOwner?: boolean };
        setIsOwner(result.isOwner === true);
      })
      .catch(() => {
        // The owner shortcut stays hidden whenever identity cannot be verified.
      });
  }, []);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("bookAgain") ?? "";
    if (!token) return;
    const controller = new AbortController();
    fetch(`/api/customer-quotes?token=${encodeURIComponent(token)}`, {
      signal: controller.signal,
    }).then(async (response) => {
      const result = await response.json() as {
        error?: string;
        job?: {
          customerName: string;
          customerEmail: string;
          vehicle: string;
          launchArea: string;
          municipality: string;
          zip: string;
          partsSource: string;
          partsPreference: string;
          serviceLocations: string;
          serviceAddress: string;
          status: string;
          isTestJob: boolean;
        };
        quotes?: Array<{
          providerName: string;
          status: string;
          providerVerified: boolean;
          providerTest: boolean;
        }>;
      };
      if (!response.ok || !result.job) {
        throw new Error(result.error || "That repeat-booking link is not available.");
      }
      const provider = result.quotes?.find((quote) => (
        quote.status === "accepted"
        && quote.providerVerified
        && !quote.providerTest
      ));
      if (result.job.status !== "completed" || result.job.isTestJob || !provider) {
        throw new Error("Repeat booking is available after a completed real job with an eligible provider account.");
      }
      if (result.job.launchArea && result.job.launchArea !== CURRENT_LAUNCH_AREA) {
        throw new Error(
          "Tuveloz currently accepts service requests only in Montgomery County, Maryland.",
        );
      }
      setRepeatBooking({
        token,
        providerName: provider.providerName,
        customerName: result.job.customerName,
        customerEmail: result.job.customerEmail,
        vehicle: result.job.vehicle,
        launchArea: result.job.launchArea,
        municipality: result.job.municipality,
        zip: result.job.zip,
        partsSource: result.job.partsSource,
        partsPreference: result.job.partsPreference,
        serviceLocations: result.job.serviceLocations,
        serviceAddress: result.job.serviceAddress,
      });
      setSelectedCustomerVehicle(result.job.vehicle);
      setPartsSource(result.job.partsSource);
      setPartsPreference(result.job.partsPreference);
      setSelectedCustomerLocations(
        parseCustomerServiceLocations(result.job.serviceLocations),
      );
      setUseSameVehicle(true);
    }).catch((error) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setRepeatBookingError(
        error instanceof Error ? error.message : "That repeat-booking link is not available.",
      );
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (selectedCustomerServices.length === 0) {
      return;
    }
    const controller = new AbortController();
    const params = new URLSearchParams();
    selectedCustomerServices.forEach((service) => params.append("service", service));
    fetch(`/api/price-guidance?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Price guidance is unavailable.");
        const result = await response.json() as { guidance?: PriceGuidanceItem[] };
        setPriceGuidance(result.guidance ?? []);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setPriceGuidance([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setPriceGuidanceBusy(false);
      });
    return () => controller.abort();
  }, [selectedCustomerServices]);

  function cancelRepeatBooking() {
    setRepeatBooking(null);
    setRepeatBookingError("");
    setPartsSource(PARTS_SOURCE_OPTIONS[2]);
    setPartsPreference(PARTS_PREFERENCE_OPTIONS[3]);
    setSelectedCustomerLocations([]);
    setSelectedCustomerVehicle("");
    setUseSameVehicle(false);
    const url = new URL(window.location.href);
    url.searchParams.delete("bookAgain");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
    type: "request" | "application",
  ) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const values = Object.fromEntries(formData.entries());
    const isRequest = type === "request";
    const serviceAreas = formData.getAll("service-area").map(String);
    const providerServices = formData.getAll("provider-service").map(String);
    const providerWorkLocations = formData.getAll("provider-work-location").map(String);
    const customerServiceLocations = formData.getAll("service-location").map(String);
    const customerServices = formData.getAll("service").map(String);
    if (isRequest && !String(formData.get("vehicle") ?? "").trim()) {
      setRequestError("Choose your vehicle by year, make, and model—or use the VIN lookup.");
      return;
    }
    if (isRequest && customerServices.length === 0) {
      setRequestError("Choose at least one service.");
      return;
    }
    if (isRequest && customerServiceLocations.length === 0) {
      setRequestError("Choose at least one place where the service can happen.");
      return;
    }
    if (!isRequest && providerServices.length === 0) {
      setApplicationError(
        providerFormIsSpanish
          ? "Seleccione al menos un servicio para revisión."
          : "Choose at least one exact service for application review.",
      );
      return;
    }
    if (!isRequest && providerWorkLocations.length === 0) {
      setApplicationError(
        providerFormIsSpanish
          ? "Elija al menos una forma de atender a los clientes."
          : "Choose at least one way customers can receive service.",
      );
      return;
    }
    const legalRequirementsAccepted = !hasVisibleLegalRequirements
      || formData.get("legal-confirmation") === "yes";
    const adultAcknowledged = formData.get("adult-acknowledged") === "yes";
    const employmentResponsibilityAcknowledged = (
      formData.get("employment-work-authorization-acknowledged") === "yes"
    );
    const termsBundleAccepted = formData.get("terms-bundle-accepted") === "yes";
    const privacyAcknowledged = formData.get("privacy-acknowledged") === "yes";
    const payload = {
      name: values["provider-name"],
      email: values["provider-email"],
      preferredLanguage: providerLanguage,
      services: providerServices,
      serviceCodes: providerServices,
      applicationPathway: providerPathwayChoice,
      providerPathway: providerRelationshipPath,
      providerLevel,
      learningAccountOnly: providerPathwayChoice === "learning_account",
      policyVersion: POLICY_VERSION,
      policyStatus: POLICY_STATUS,
      policyJurisdiction: POLICY_JURISDICTION,
      serviceArea: serviceAreas.join(" | "),
      businessMunicipality: values["business-municipality"],
      legalBusinessName: values["legal-business-name"],
      businessEntityType: values["business-entity-type"],
      businessFormationState: values["business-formation-state"],
      sponsoringProviderLegalName: values["sponsoring-provider-legal-name"],
      sponsorContactName: values["sponsor-contact-name"],
      sponsorContactEmail: values["sponsor-contact-email"],
      sponsorContactTitle: values["sponsor-contact-title"],
      workLocations: providerWorkLocations,
      businessServiceAddress: values["business-service-address"],
      experience: "",
      insuranceStatus: "",
      rulesReviewed: legalRequirementsAccepted,
      providerAttestation: legalRequirementsAccepted && adultAcknowledged,
      legalResponsibility: legalRequirementsAccepted && employmentResponsibilityAcknowledged,
      signerName: values["signer-name"],
      signerTitle: values["signer-title"],
      adultAcknowledged,
      employmentWorkAuthorizationResponsibilityAcknowledged: employmentResponsibilityAcknowledged,
      termsBundleAccepted,
      privacyAcknowledged,
      termsAccepted: termsBundleAccepted,
      providerSelfAssessment: providerAssessment,
    };

    if (pendingSubmission !== type) {
      if (isRequest) setRequestError("");
      else setApplicationError("");
      setPendingSubmission(type);
      return;
    }

    if (isRequest) {
      setRequestBusy(true);
      setRequestError("");
    } else {
      setApplicationBusy(true);
      setApplicationError("");
    }

    try {
      const response = isRequest
        ? await fetch("/api/requests", { method: "POST", body: formData })
        : await fetch("/api/providers", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
          });
      const result = (await response.json()) as { error?: string; accessToken?: string };
      if (!response.ok) throw new Error(result.error || "Please try again.");
      form.reset();
      setPendingSubmission("");
      if (isRequest) {
        setSelectedCustomerServices([]);
        setSelectedCustomerVehicle("");
        setPartsSource("Either is okay");
        setPartsPreference("No preference");
        setSelectedCustomerLocations([]);
        setRepeatBooking(null);
        setRepeatBookingError("");
        setVehicleResetVersion((version) => version + 1);
        setRequestToken(result.accessToken ?? "");
        setRequestSent(true);
      }
      else {
        setSelectedProviderServices([]);
        setSelectedProviderAreas([CURRENT_LAUNCH_AREA]);
        setSelectedProviderWorkLocations([]);
        setProviderPathwayChoice("learning_account");
        setProviderAssessment(emptyProviderSelfAssessment);
        setApplicationSent(true);
      }
    } catch (error) {
      setPendingSubmission("");
      const message = error instanceof Error ? error.message : "Please try again.";
      if (isRequest) setRequestError(message);
      else setApplicationError(message);
    } finally {
      if (isRequest) setRequestBusy(false);
      else setApplicationBusy(false);
    }
  }

  async function handleFeedbackSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const jobsWanted = formData.getAll("jobs-wanted").map(String);
    const providerFeatures = formData.getAll("provider-features").map(String);
    const customerImprovements = formData.getAll("customer-improvements").map(String);
    const jobsOther = String(formData.get("jobs-wanted-other") ?? "").trim();
    const providerOther = String(formData.get("provider-features-other") ?? "").trim();
    const customerOther = String(formData.get("customer-improvements-other") ?? "").trim();
    const joinAnswers = (answers: string[], other: string) => (
      [...answers, ...(other ? [`Other: ${other}`] : [])].join(" | ")
    );

    if (
      (jobsWanted.length === 0 && !jobsOther)
      || (providerFeatures.length === 0 && !providerOther)
      || (customerImprovements.length === 0 && !customerOther)
    ) {
      setFeedbackError("Select at least one answer in each feedback section.");
      setPendingSubmission("");
      return;
    }

    if (pendingSubmission !== "feedback") {
      setFeedbackError("");
      setPendingSubmission("feedback");
      return;
    }
    setFeedbackBusy(true);
    setFeedbackError("");

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          audience: formData.get("audience"),
          featureWanted: joinAnswers(jobsWanted, jobsOther),
          problemToSolve: joinAnswers(providerFeatures, providerOther),
          trustBuilder: joinAnswers(customerImprovements, customerOther),
          email: formData.get("feedback-email"),
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Please try again.");
      form.reset();
      setPendingSubmission("");
      setFeedbackSent(true);
    } catch (error) {
      setPendingSubmission("");
      setFeedbackError(error instanceof Error ? error.message : "Please try again.");
    } finally {
      setFeedbackBusy(false);
    }
  }

  async function handleExpansionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setExpansionBusy(true);
    setExpansionError("");

    try {
      const response = await fetch("/api/expansion-interest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          audience: formData.get("expansion-audience"),
          providerType: formData.get("expansion-provider-type"),
          locality: formData.get("expansion-locality"),
          state: formData.get("expansion-state"),
          email: formData.get("expansion-email"),
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Please try again.");
      form.reset();
      setExpansionAudience("");
      setExpansionSent(true);
    } catch (error) {
      setExpansionError(error instanceof Error ? error.message : "Please try again.");
    } finally {
      setExpansionBusy(false);
    }
  }

  const accountHref = headerAccountDestination || (
    headerAccountState === "customer"
      ? "/customer"
      : headerAccountState === "provider"
        ? "/provider-onboarding"
        : "/account"
  );
  const accountLabel =
    headerAccountState === "customer"
      ? "Customer account"
      : headerAccountState === "provider"
        ? "Provider account"
        : headerAccountState === "signed-out"
          ? "Sign up / Sign in"
          : "Account";

  return (
    <main className={`public-site public-view-${view}`}>
      <header className="site-header">
        <Link className="brand" href="/" aria-label="Tuveloz home">
          <BrandMark />
          <span>Tuveloz</span>
        </Link>

        <button
          className="menu-button"
          aria-label="Toggle navigation"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((value) => !value)}
        >
          <span />
          <span />
        </button>

        <nav className={menuOpen ? "nav open" : "nav"} aria-label="Main navigation">
          <Link href="/about" onClick={() => setMenuOpen(false)}>Learn about Tuveloz</Link>
          <Link href="/post-job" onClick={() => setMenuOpen(false)}>Customer launch status</Link>
          <Link href="/join" onClick={() => setMenuOpen(false)}>Join as a provider</Link>
          <Link href="/how-it-works" onClick={() => setMenuOpen(false)}>How it works</Link>
          <Link href="/safety" onClick={() => setMenuOpen(false)}>Safety &amp; trust</Link>
          <Link href="/faq" onClick={() => setMenuOpen(false)}>FAQ</Link>
        </nav>

        <div className="header-actions">
          <SiteLanguageButton />
          <Link
            aria-label={accountLabel}
            className="header-sign-in"
            href={accountHref}
            onClick={() => setMenuOpen(false)}
          >
            {accountLabel}
          </Link>
          <Link className="header-cta" href="/post-job">
            Launch status
          </Link>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-glow" />
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="pulse" />
            Provider onboarding is open
          </div>
          <h1>
            Vehicle services.
            <br />
            <span className="hero-value-line">
              Choice for customers. Freedom for providers.
            </span>
          </h1>
          <p>
            TUVELOZ is building a local vehicle-service marketplace. Provider
            applications and evidence review are open; customer job requests,
            payments, and real provider work are not open yet.
          </p>
          <div className="hero-actions">
            <Link className="button primary" href="/post-job">
              See customer launch status <span>→</span>
            </Link>
            <Link className="button secondary" href="/join">
              Join as a provider
            </Link>
          </div>
          <div className="hero-launch-note">
            <strong>Provider onboarding now in Montgomery County, Maryland</strong>
            <Link href="/about#expansion">Outside the county? Request your area →</Link>
          </div>
        </div>

        <div className="hero-visual" aria-label="Concept preview of the planned Tuveloz service-request workflow">
          <div className="speed-lines" />
          <div className="phone">
            <div className="phone-top">
              <BrandMark compact />
              <span className="status-dot" />
            </div>
            <div className="phone-copy">
              <small>GOOD MORNING</small>
              <strong>What does your car need?</strong>
            </div>
            <div className="service-grid">
              <div className="selected"><TuvelozIcon name="battery" />Battery</div>
              <div><TuvelozIcon name="tire" />Tire</div>
              <div><TuvelozIcon name="diagnostics" />Diagnostics</div>
              <div><TuvelozIcon name="tint" />Window tint</div>
            </div>
            <div className="map-card">
              <div className="road road-one" />
              <div className="road road-two" />
              <div className="map-pin">T</div>
              <div className="provider-pin">M</div>
            </div>
            <div className="match-card">
              <div className="provider-photo">M</div>
              <div>
                <strong>Planned provider match</strong>
                <span>Concept preview—not a live job</span>
              </div>
              <b>→</b>
            </div>
          </div>
          <div className="floating-card arrival">
            <span className="check">✓</span>
            <div><strong>Example quote flow</strong><small>Available only after launch activation</small></div>
          </div>
          <div className="floating-card rating">
            <strong>Local independent providers</strong>
            <span>FOUNDING NETWORK</span>
          </div>
        </div>
      </section>

      <section className="proof-strip" aria-label="Tuveloz advantages">
        <span><b>Now onboarding</b> Montgomery County providers</span>
        <span><b>Customer jobs</b> not open yet</span>
        <span><b>Exact services</b> default blocked</span>
        <span><b>Apply</b> for provider review</span>
      </section>

      <section className="audience-section" aria-labelledby="audience-heading">
        <div className="audience-intro">
          <span className="kicker">Built for both sides</span>
          {view === "about" ? (
            <h1 id="audience-heading">
              One marketplace. Clear benefits for customers and providers.
            </h1>
          ) : (
            <h2 id="audience-heading">
              One marketplace. Clear benefits for customers and providers.
            </h2>
          )}
          <p>
            Tuveloz keeps customers in control of their vehicle-service
            decisions and independent providers in control of their business.
          </p>
        </div>

        <div className="audience-grid">
          <article className="audience-card audience-customer-card">
            <span className="audience-label">For customers</span>
            <h3>Compare your options. Choose what works.</h3>
            <p>
              After launch activation, customers will request exact services,
              compare eligible providers and quotes, and choose what fits. That
              transaction flow is currently closed.
            </p>
            <ul>
              <li><span>✓</span> Choose from available services</li>
              <li><span>✓</span> Compare providers and quotes</li>
              <li><span>✓</span> You make the final decision</li>
            </ul>
            <Link className="button primary" href="/post-job">
              Check customer launch status <span>→</span>
            </Link>
          </article>

          <article className="audience-card audience-provider-card">
            <span className="audience-label">For providers</span>
            <h3>Run your work on your terms.</h3>
            <p>
              Mobile mechanics, service-truck operators, and shop-based
              providers can apply now, choose exact services for review, and
              upload required evidence. Job access begins only after the exact
              service and provider pass every launch gate.
            </p>
            <ul>
              <li><span>✓</span> Work on your schedule</li>
              <li><span>✓</span> Use one simple job workspace</li>
              <li><span>✓</span> Request tools that help you grow</li>
            </ul>
            <Link className="button secondary" href="/join">
              See provider benefits <span>→</span>
            </Link>
          </article>
        </div>
      </section>

      <section className="section services" id="services">
        <div className="section-heading">
          <div>
            <span className="kicker">What we&apos;re building</span>
            <h2>Vehicle help, without the runaround.</h2>
          </div>
          <p>
            These are product concepts, not currently offered customer services.
            Only exact service codes that pass the written launch controls may open later.
          </p>
        </div>
        <div className="service-cards">
          {services.map((service) => (
            <article key={service.title}>
              <div className="service-icon">
                <TuvelozIcon name={service.icon} />
              </div>
              <h3>{service.title}</h3>
              <p>{service.text}</p>
              <Link href="/post-job">Not open yet · view launch status <span>→</span></Link>
            </article>
          ))}
        </div>
        <div className="quote-banner">
          <div className="quote-icon"><TuvelozIcon name="quote" /></div>
          <div>
            <span className="kicker">Planned quote workflow</span>
            <h3>Cosmetic-repair quotes are not open yet.</h3>
            <p>
              This concept remains disabled unless an exact service definition,
              provider evidence, and launch approvals are implemented.
            </p>
          </div>
          <Link className="button secondary" href="/post-job">
            View launch status <span>→</span>
          </Link>
        </div>
      </section>

      <section className="section how" id="how-it-works">
        <div className="how-intro">
          <span className="kicker light">Planned customer workflow</span>
          <h2>After activation: post exact work and compare eligible providers.</h2>
          <p>
            The request-and-quote flow shown here is a product preview. Real
            requests, quotes, bookings, completion, payments, and payouts remain blocked.
          </p>
          <Link className="text-link" href="/post-job">See customer launch status →</Link>
        </div>
        <div className="steps">
          {steps.map(([number, title, text]) => (
            <article key={number}>
              <span>{number}</span>
              <div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section reviews-section" id="reviews">
        <div className="reviews-heading">
          <div>
            <span className="kicker">Verified customer reviews</span>
            <h2>See how local providers performed.</h2>
          </div>
          {reviewSummary.count > 0 && (
            <div className="reviews-summary" aria-label={`${reviewSummary.average} out of 5 stars across ${reviewSummary.count} reviews`}>
              <strong>{reviewSummary.average.toFixed(1)}</strong>
              <span aria-hidden="true">★★★★★</span>
              <small>{reviewSummary.count} completed-job {reviewSummary.count === 1 ? "review" : "reviews"}</small>
            </div>
          )}
        </div>
        {reviews.length > 0 ? (
          <div className="public-review-grid">
            {reviews.map((review) => (
              <article key={review.id}>
                <div className="public-review-stars" aria-label={`${review.rating} out of 5 stars`}>
                  <span aria-hidden="true">{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</span>
                  <strong>{review.rating}.0</strong>
                </div>
                <blockquote>{review.comment}</blockquote>
                <div className="review-byline">
                  <div><strong>{review.customerDisplayName}</strong><span>Completed job record</span></div>
                  <div>
                    <strong>{review.providerName}</strong>
                    {review.providerVerified && <span className="verified-inline">Provider account was active for this job</span>}
                    <span>{review.service}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="reviews-empty">
            <strong>No public reviews yet.</strong>
            <p>Verified reviews will appear after customers complete jobs.</p>
          </div>
        )}
      </section>

      <section className="section request-section" id="request">
        <div className="request-copy">
          <span className="kicker">New and growing</span>
          {view === "request" ? (
            <h1>Post your job. We&apos;ll send it to providers who match.</h1>
          ) : (
            <h2>Post your job. We&apos;ll send it to providers who match.</h2>
          )}
          <p>
            Customer requests are currently closed. After launch approval, the
            server—not a manual owner decision—will share an exact-service request
            only with providers whose current eligibility records match it.
          </p>
          <div className="pilot-vision">
            <strong>Our vision</strong>
            <p>
              We want to change how the mechanic industry works: give customers
              clearer choices and help independent providers grow.
            </p>
          </div>
          <ul>
            <li><span>✕</span> Customer posting is not open yet</li>
            <li><span>✓</span> Future jobs must use enabled exact service codes</li>
            <li><span>✓</span> Customers will choose whether to accept a quote</li>
            <li><span>⏳</span> Final fees and tax treatment remain under mandatory legal and CPA or tax-adviser review</li>
          </ul>
        </div>

        {!legacyHomepageRequestFormEnabled() && (
          <div className="lead-form">
            <div className="form-heading">
              <span>01</span>
              <div>
                <h3>Review the one exact-service intake</h3>
                <p>
                  The old multi-service homepage form is disabled. The dedicated
                  review page uses one exact service code, a scheduled time,
                  jurisdiction, immutable terms/privacy records, and server-side gates.
                </p>
              </div>
            </div>
            <Link className="button primary form-button" href="/post-job">
              Open exact-service intake review <span>→</span>
            </Link>
            <small>
              It is review-only. No customer job can be submitted while onboarding mode is active.
            </small>
          </div>
        )}

        {legacyHomepageRequestFormEnabled() && (
        <form
          className="lead-form"
          key={`${vehicleResetVersion}:${repeatBooking?.token ?? "new"}`}
          onChange={() => pendingSubmission === "request" && setPendingSubmission("")}
          onSubmit={(event) => handleSubmit(event, "request")}
        >
          {requestSent ? (
            <div className="success-message" role="status">
              <span>✓</span>
              <h3>Your request is in review.</h3>
              <p>
                If it matches our pilot services and areas, we&apos;ll send it to
                eligible local providers. Tuveloz is new, so quotes may take longer
                while our network grows. Thank you for your patience.
              </p>
              {requestToken && (
                <>
                  <a className="button primary" href={`/my-request?token=${requestToken}`}>
                    View your private request
                  </a>
                  <small>
                    Save this private link. It opens your request details and quotes.
                  </small>
                </>
              )}
              <a className="button secondary" href="/account?role=customer&mode=create">
                Save these records in an account
              </a>
              <small>
                After you verify the same email, your requests and quotes appear in your
                customer workspace.
              </small>
              <button type="button" onClick={() => setRequestSent(false)}>Post another job</button>
            </div>
          ) : (
            <>
              <div className="form-heading">
                <span>01</span>
                <div><h3>Planned exact-service request</h3><p>After launch, qualifying requests route automatically to providers eligible for every selected service.</p></div>
              </div>
              {repeatBooking && (
                <div className="repeat-booking-banner">
                  <span>Book again</span>
                  <strong>Request {repeatBooking.providerName} again</strong>
                  <p>
                    After Tuveloz reviews the request, it will go only to this provider.
                    Availability and a new quote are not guaranteed.
                  </p>
                  <input name="rebook-token" type="hidden" value={repeatBooking.token} />
                  <button type="button" onClick={cancelRepeatBooking}>
                    Compare all matching providers instead
                  </button>
                </div>
              )}
              {repeatBookingError && (
                <p className="form-error" role="alert">{repeatBookingError}</p>
              )}
              <label>
                Your name
                <input
                  defaultValue={repeatBooking?.customerName ?? ""}
                  required
                  name="name"
                  placeholder="Full name"
                />
              </label>
              <label>
                Email address
                <input
                  defaultValue={repeatBooking?.customerEmail ?? ""}
                  required
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                />
              </label>
              {repeatBooking && (
                <fieldset className="area-fieldset repeat-vehicle-fieldset">
                  <legend>Which vehicle is this for?</legend>
                  <div className="area-options">
                    <label>
                      <input
                        checked={useSameVehicle}
                        name="repeat-vehicle-choice"
                        onChange={() => {
                          setUseSameVehicle(true);
                          setSelectedCustomerVehicle(repeatBooking.vehicle);
                        }}
                        type="radio"
                      />
                      Use the same vehicle
                    </label>
                    <label>
                      <input
                        checked={!useSameVehicle}
                        name="repeat-vehicle-choice"
                        onChange={() => {
                          setUseSameVehicle(false);
                          setSelectedCustomerVehicle("");
                        }}
                        type="radio"
                      />
                      Choose a different vehicle
                    </label>
                  </div>
                  {useSameVehicle && <strong>{repeatBooking.vehicle}</strong>}
                </fieldset>
              )}
              {repeatBooking && useSameVehicle ? (
                <input name="vehicle" type="hidden" value={repeatBooking.vehicle} />
              ) : (
                <VehicleSelector
                  key={vehicleResetVersion}
                  onVehicleChange={setSelectedCustomerVehicle}
                />
              )}
              <input name="launch-area" type="hidden" value={CURRENT_LAUNCH_AREA} />
              <div className="field-row">
                <div className="fixed-launch-area">
                  <span>Current service area</span>
                  <strong>Montgomery County, Maryland</strong>
                  <Link href="/about#expansion">Outside the county? Request your area</Link>
                </div>
                <label>
                  City, town, or municipality
                  <input
                    defaultValue={repeatBooking?.municipality ?? ""}
                    required
                    name="municipality"
                    placeholder="Example: Rockville or Silver Spring"
                  />
                </label>
              </div>
              <label>
                ZIP code
                <input
                  defaultValue={repeatBooking?.zip ?? ""}
                  required
                  name="zip"
                  inputMode="numeric"
                  placeholder="20901"
                />
              </label>
              <fieldset className="area-fieldset service-fieldset customer-service-fieldset">
                <legend>What does your vehicle need?</legend>
                <p>Choose one or more. One provider must be able to handle the complete request.</p>
                <div className="service-groups customer-service-groups">
                  {CUSTOMER_SERVICE_GROUPS.map((group) => {
                    const selectedCount = group.options.filter((option) => (
                      selectedCustomerServices.includes(option.value)
                    )).length;
                    return (
                      <details
                        className="service-group"
                        open={group.id === "mobile" ? true : undefined}
                        key={group.id}
                      >
                        <summary>
                          <span>
                            <strong>{group.label}</strong>
                            <small>{group.description}</small>
                          </span>
                          <b>{selectedCount ? `${selectedCount} selected` : "View"}</b>
                        </summary>
                        <div className="service-options customer-service-options">
                          {group.options.map((option) => (
                            <label
                              className={selectedCustomerServices.includes(option.value) ? "selected" : ""}
                              key={option.value}
                            >
                              <input
                                checked={selectedCustomerServices.includes(option.value)}
                                name="service"
                                type="checkbox"
                                value={option.value}
                                onChange={(event) => {
                                  setPriceGuidanceBusy(true);
                                  setSelectedCustomerServices((current) => (
                                    event.target.checked
                                      ? [...current, option.value]
                                      : current.filter((service) => service !== option.value)
                                  ));
                                }}
                              />
                              <span>{option.label}</span>
                            </label>
                          ))}
                        </div>
                      </details>
                    );
                  })}
                </div>
                <small className="customer-service-note">
                  Availability depends on a provider having current approval for that exact service.
                  Rain guards include vent visors and window deflectors; window tint is separate.
                </small>
              </fieldset>
              {selectedCustomerServices.length > 0 && (
                <section className="price-guidance-card" aria-live="polite">
                  <div className="price-guidance-heading">
                    <div>
                      <span>Real completed-job data</span>
                      <strong>Observed Tuveloz price guide</strong>
                    </div>
                    <small>Not a promised quote</small>
                  </div>
                  {priceGuidanceBusy ? (
                    <p>Checking completed Tuveloz jobs…</p>
                  ) : (
                    <div className="price-guidance-list">
                      {priceGuidance.map((item) => (
                        <article key={item.service}>
                          <strong>{item.service}</strong>
                          {item.available ? (
                            <>
                              <span>Average {dollars(item.averageCents)}</span>
                              <small>
                                Observed range {dollars(item.lowCents)}–{dollars(item.highCents)}
                                {" · "}{item.sampleCount} completed jobs
                              </small>
                            </>
                          ) : (
                            <span>
                              {item.message
                                ?? "Not enough real completed jobs yet to publish a trustworthy price."}
                            </span>
                          )}
                        </article>
                      ))}
                    </div>
                  )}
                  <p>
                    Numbers appear only after at least 3 real, non-test, completed
                    single-service jobs. Combined jobs may price differently.
                  </p>
                </section>
              )}
              {selectedCustomerVehicle && selectedCustomerServices.length > 0 && (
                <MarketPriceLinks
                  context="decision"
                  preference={partsPreference}
                  service={selectedCustomerServices.join(" | ")}
                  vehicle={selectedCustomerVehicle}
                />
              )}
              <fieldset className="area-fieldset">
                <legend>Who should supply any needed parts?</legend>
                <div className="area-options parts-source-options">
                  {PARTS_SOURCE_OPTIONS.map((option) => (
                    <label key={option}>
                      <input
                        checked={partsSource === option}
                        name="parts-source"
                        required
                        type="radio"
                        value={option}
                        onChange={(event) => setPartsSource(event.target.value)}
                      />
                      {option}
                    </label>
                  ))}
                </div>
                <small className="parts-equipment-note">
                  Providers bring the tools and equipment needed for the job. Any special
                  equipment or rental cost must be disclosed in the quote.
                </small>
              </fieldset>
              {partsSource !== PARTS_SOURCE_OPTIONS[0] && (
                <label>
                  <span className="field-label-with-help">
                    Parts preference
                    <LegalHelp
                      label="What do OEM, aftermarket, and best value mean?"
                      text="OEM means a part made for the vehicle brand. Aftermarket means a compatible part made by another company and may cost less. Best value lets the provider recommend a suitable balance of price and quality. No preference means you are open to either."
                    />
                  </span>
                  <select
                    name="parts-preference"
                    value={partsPreference}
                    onChange={(event) => setPartsPreference(event.target.value)}
                  >
                    {PARTS_PREFERENCE_OPTIONS.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                  <small>
                    If the provider supplies parts, the quote will show the included
                    items and one all-inclusive provider service price before you choose.
                  </small>
                </label>
              )}
              {partsSource === PARTS_SOURCE_OPTIONS[0] && (
                <input name="parts-preference" type="hidden" value="No preference" />
              )}
              <fieldset className="area-fieldset location-fieldset">
                <legend>Where can the service happen?</legend>
                <p>Choose one or both.</p>
                <div className="area-options">
                  {CUSTOMER_SERVICE_LOCATION_OPTIONS.map((option) => (
                    <label key={option}>
                      <input
                        checked={selectedCustomerLocations.includes(option)}
                        name="service-location"
                        type="checkbox"
                        value={option}
                        onChange={(event) => setSelectedCustomerLocations((current) => (
                          event.target.checked
                            ? [...current, option]
                            : current.filter((item) => item !== option)
                        ))}
                      />
                      {option}
                    </label>
                  ))}
                </div>
              </fieldset>
              {customerAllowsProviderTravel && (
                <label>
                  Service address
                  <input
                    defaultValue={repeatBooking?.serviceAddress ?? ""}
                    required
                    name="service-address"
                    placeholder="Street address"
                  />
                  <small>Only the provider you select will receive this address.</small>
                </label>
              )}
              <label>
                Describe the job
                <textarea
                  required
                  name="job-details"
                  placeholder="Describe the problem, condition, preferred timing, and anything else the provider should know."
                  rows={4}
                />
                <small>
                  Include a budget here only if you want providers to see one.
                </small>
              </label>
              <label className="photo-field">
                Photo of the issue <span>(optional)</span>
                <input name="issue-photo" type="file" accept="image/jpeg,image/png,image/webp" />
                <small>JPG, PNG, or WebP · maximum 8 MB. Don&apos;t upload payment details or sensitive documents.</small>
              </label>
              <label className="policy-consent">
                <input required name="terms-accepted" type="checkbox" value="yes" />
                <span>
                  I am 18 or older and agree to the <a href="/terms">Terms</a> and{" "}
                  <a href="/customer-agreement">Customer Agreement</a>, and
                  acknowledge the <a href="/privacy">Privacy Policy</a>.
                </span>
              </label>
              <label className="policy-consent optional-consent">
                <input name="remember-email-consent" type="checkbox" value="yes" />
                <span>
                  Create a reusable guest profile so Tuveloz can match this request to a
                  future account after I verify this email. <strong>Optional.</strong>
                </span>
              </label>
              <label className="policy-consent optional-consent">
                <input name="marketing-consent" type="checkbox" value="yes" />
                <span>
                  Email me occasional Tuveloz promotions and service updates. Optional;
                  I can unsubscribe anytime.
                </span>
              </label>
              <small>
                We&apos;ll use your email to manage this request and send related updates.
                Promotions are sent only if you opt in. Don&apos;t include payment details
                or sensitive documents.
              </small>
              {pendingSubmission === "request" ? (
                <ConfirmAction
                  busy={requestBusy}
                  busyLabel="Posting…"
                  confirmLabel="Confirm and post"
                  confirmType="submit"
                  message="Review the information above. Nothing is posted until you confirm."
                  onBack={() => setPendingSubmission("")}
                  title="Post this job?"
                />
              ) : (
                <button className="button primary form-button" type="submit" disabled={requestBusy}>
                  {requestBusy ? "Saving…" : "Submit request"} <span>→</span>
                </button>
              )}
              {requestError && <p className="form-error" role="alert">{requestError}</p>}
              <small>
                We use this information only to review your request and contact you about Tuveloz.
                Don&apos;t include payment details or sensitive documents.
              </small>
            </>
          )}
        </form>
        )}
      </section>

      <section className="section providers" id="providers">
        <div className="provider-panel" data-manual-language>
          <div className="provider-copy">
            <span className="kicker light">
              {providerFormIsSpanish ? "Para proveedores independientes" : "For independent providers"}
            </span>
            {view === "provider" ? (
              <h1>
                {providerFormIsSpanish
                  ? "Solicite la revisión de servicios específicos. Prepárese para trabajos futuros. Maneje su negocio a su manera."
                  : "Apply for exact services. Get ready for future jobs. Run your business your way."}
              </h1>
            ) : (
              <h2>
                {providerFormIsSpanish
                  ? "Solicite la revisión de servicios específicos. Prepárese para trabajos futuros. Maneje su negocio a su manera."
                  : "Apply for exact services. Get ready for future jobs. Run your business your way."}
              </h2>
            )}
            <p>
              {providerFormIsSpanish
                ? "La incorporación de proveedores está abierta ahora. Después del lanzamiento, los proveedores elegibles podrán definir su disponibilidad, revisar trabajos que coincidan con sus servicios, enviar su precio y gestionar el trabajo seleccionado desde un solo lugar."
                : "Provider onboarding is open now. After marketplace launch, eligible providers will be able to set availability, review jobs that match their exact services, send a price, and manage selected work in one place."}
            </p>
            <div className="legal-requirement-note">
              <strong>
                {providerFormIsSpanish
                  ? "TUVELOZ no emplea ni capacita a proveedores."
                  : "TUVELOZ does not employ or train providers."}
              </strong>
              <small>
                {providerFormIsSpanish
                  ? "TUVELOZ no contrata, patrocina, asigna ni supervisa a mecánicos, aprendices o empleados de negocios proveedores. Un negocio proveedor separado debe manejar su propia contratación, nómina, capacitación, supervisión y asignación de trabajo."
                  : "TUVELOZ does not hire, sponsor, assign, or supervise mechanics, trainees, or provider-business employees. A separate provider business must handle its own hiring, payroll, training, supervision, and work assignment."}
              </small>
            </div>
            <p className="provider-extra-work">
              <strong>
                {providerFormIsSpanish
                  ? "¿Ya tiene un trabajo de tiempo completo o su propio negocio?"
                  : "Already have a full-time job or your own business?"}
              </strong>{" "}
              {providerFormIsSpanish
                ? "Use Tuveloz para encontrar oportunidades locales adicionales cuando se ajusten a su horario, sin obligación de cotizar cada solicitud."
                : "Use Tuveloz for extra local opportunities when they fit your schedule, with no obligation to quote every request."}
            </p>
            <div className="provider-benefits">
              <div><span>01</span><strong>{providerFormIsSpanish ? "Revise trabajos que coincidan con sus servicios" : "Review jobs matched to your services"}</strong></div>
              <div><span>02</span><strong>{providerFormIsSpanish ? "Defina su precio, disponibilidad y área de servicio" : "Set your price, availability, and service area"}</strong></div>
              <div><span>03</span><strong>{providerFormIsSpanish ? "Solicite herramientas que simplifiquen y hagan crecer su negocio" : "Request tools that simplify and grow your business"}</strong></div>
            </div>
            <section className="provider-eligibility-guide" aria-labelledby="provider-guide-title">
              <div className="eligibility-guide-heading">
                <span id="provider-guide-title">7-STEP PROVIDER GUIDE</span>
              </div>
              <ol>
                <li>Choose the account pathway that matches your real working relationship.</li>
                <li>Select only the exact services you want Tuveloz to review.</li>
                <li>Provide your legal business or sponsoring-provider details when required.</li>
                <li>Tell us where the business operates and how future service could occur.</li>
                <li>Review the service-specific legal and evidence requirements.</li>
                <li>Type the authorized signer&apos;s name and complete each acknowledgment.</li>
                <li>Submit for review. No customer-job access begins until written activation.</li>
              </ol>
              <div className="legal-requirement-note" aria-label="Service status legend">
                <strong>Service status legend</strong>
                <small>✓ Selectable for application review</small>
                <small>✕ Not available for real customer jobs</small>
                <small>⏳ Under review for mandatory requirements and insurer activation</small>
              </div>
            </section>
          </div>

          <form
            className="provider-form"
            onChange={() => pendingSubmission === "application" && setPendingSubmission("")}
            onSubmit={(event) => handleSubmit(event, "application")}
          >
            {applicationSent ? (
              <div className="success-message provider-success" role="status">
                <span>✓</span>
                <h3>{providerFormIsSpanish ? "Solicitud guardada." : "Application saved."}</h3>
                <p>{providerFormIsSpanish
                  ? "Cree su cuenta de proveedor con el mismo correo para cargar documentos y seguir la revisión."
                  : "Create your provider account with the same email to upload documents and follow the exact-service review checklist."}</p>
                <Link className="button primary" href="/account?role=provider">
                  {providerFormIsSpanish ? "Continuar con la verificación" : "Continue provider verification"}
                </Link>
                <button type="button" onClick={() => setApplicationSent(false)}>
                  {providerFormIsSpanish ? "Enviar otra respuesta" : "Submit another response"}
                </button>
              </div>
            ) : (
              <>
                <h3>{providerFormIsSpanish ? "Conviértase en proveedor fundador" : "Become a founding provider"}</h3>
                <p>{providerFormIsSpanish ? "Cuéntenos sobre sus servicios y dónde trabaja." : "Tell us about your services and where you work."}</p>
                <label>
                  {providerFormIsSpanish ? "Nombre personal o del negocio" : "Name or business name"}
                  <input required name="provider-name" placeholder={providerFormIsSpanish ? "Su nombre o compañía" : "Your name or company"} />
                </label>
                <label>
                  {providerFormIsSpanish ? "Correo electrónico" : "Email"}
                  <input required name="provider-email" type="email" placeholder="hello@yourbusiness.com" />
                </label>
                <div className="legal-requirement-note" role="status">
                  <strong>✕ No v0.11 service is available for a real customer job today.</strong>
                  <small>
                    Applications and service selections are accepted for review only. Activation requires
                    documented compliance with applicable law, insurer approval, and every required government,
                    agency, environmental, tax, payment, privacy, security, and service-specific control.
                  </small>
                  <small>
                    Policy {POLICY_VERSION} · {POLICY_JURISDICTION} · {POLICY_STATUS}
                  </small>
                </div>
                <fieldset className="area-fieldset">
                  <legend>1. Choose your provider pathway</legend>
                  <p>Select the choice that describes the real relationship. It does not grant job access.</p>
                  <div className="area-options">
                    {PROVIDER_APPLICATION_PATHWAYS.map((pathway) => (
                      <label key={pathway.code}>
                        <input
                          checked={providerPathwayChoice === pathway.code}
                          name="provider-pathway-choice"
                          onChange={() => {
                            setProviderPathwayChoice(pathway.code);
                            setSelectedProviderServices([]);
                          }}
                          type="radio"
                          value={pathway.code}
                        />
                        <span>
                          <strong>{pathway.label}</strong>
                          <small>{pathway.description}</small>
                        </span>
                      </label>
                    ))}
                  </div>
                  <input
                    name="provider-pathway"
                    type="hidden"
                    value={providerRelationshipPath ?? "learning_account"}
                  />
                  <input name="provider-level" type="hidden" value={providerLevel} />
                  <div className="provider-mode-preview" aria-live="polite">
                    <span>Derived policy level</span>
                    <strong className="provider-mode-badge">
                      {PROVIDER_LEVEL_LABELS[providerLevel]}
                    </strong>
                  </div>
                </fieldset>
                {providerNeedsOwnBusiness && (
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
                )}
                {providerNeedsSponsor && (
                  <fieldset className="area-fieldset">
                    <legend>
                      {providerPathwayChoice === "sponsored_trainee_employee"
                        ? "Sponsoring provider business"
                        : "Employer provider business"}
                    </legend>
                    <label>
                      Legal business name
                      <input required name="sponsoring-provider-legal-name" placeholder="Provider business legal name" />
                    </label>
                    <label>
                      Authorized business contact
                      <input required name="sponsor-contact-name" placeholder="Contact's legal name" />
                    </label>
                    <label>
                      Contact title
                      <input required name="sponsor-contact-title" placeholder="Owner, manager, or authorized signer" />
                    </label>
                    <label>
                      Contact email
                      <input required name="sponsor-contact-email" type="email" placeholder="contact@provider.com" />
                    </label>
                  </fieldset>
                )}
                {providerPathwayChoice === "learning_account" && (
                  <div className="legal-requirement-note">
                    <strong>Applicant-only account: no training, employment, customer jobs, or payout</strong>
                    <small>You may select services only to identify what you hope to qualify for independently later. TUVELOZ does not provide training or promise work.</small>
                  </div>
                )}
                <fieldset className="area-fieldset service-fieldset">
                  <legend>{providerFormIsSpanish ? "Servicios que ofrece" : "Services you offer"}</legend>
                  <p>
                    {providerFormIsSpanish
                      ? "Seleccione servicios de un solo nivel por solicitud."
                      : "Choose exact services from one level per application. Changing levels replaces incompatible selections."}
                  </p>
                  <div className="service-groups provider-service-groups">
                    {PROVIDER_REVIEW_SERVICE_GROUPS.map((group) => {
                      const groupServices = providerPathwayChoice === "learning_account"
                        ? group.services
                        : group.services.filter((service) => (
                            service.allowedPathways.includes(providerPathwayChoice)
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
                            <b>
                              {selectedCount
                                ? `${selectedCount} selected`
                                : "View"}
                            </b>
                          </summary>
                          <div className="service-options">
                            {groupServices.map((service) => (
                              <label key={service.code}>
                                <input
                                  checked={selectedProviderServices.includes(service.code)}
                                  name="provider-service"
                                  type="checkbox"
                                  value={service.code}
                                  onChange={(event) => setSelectedProviderServices((current) => (
                                    event.target.checked
                                      ? providerPathwayChoice === "learning_account"
                                        ? [...new Set([...current, service.code])]
                                        : [
                                            ...current.filter((item) => {
                                              const selected = PROVIDER_REVIEW_SERVICES.find(
                                                (candidate) => candidate.code === item,
                                              );
                                              return selected?.allowedProviderLevels.some((level) => (
                                                service.allowedProviderLevels.some((nextLevel) => nextLevel === level)
                                              ));
                                            }),
                                            service.code,
                                          ]
                                      : current.filter((item) => item !== service.code)
                                  ))}
                                />
                                <span>
                                  <strong>✓ {service.label}</strong>
                                  <small>{service.description}</small>
                                  <small>
                                    ✕ Real jobs unavailable · Under review pending mandatory requirements + insurer activation
                                    {service.launchState.includes("environmental") ? " + environmental approval" : ""}
                                    {service.launchState.includes("agency") ? " + agency approval" : ""}
                                  </small>
                                  <small>Exact code: {service.code}</small>
                                </span>
                              </label>
                            ))}
                          </div>
                        </details>
                      );
                    })}
                  </div>
                  <small className="customer-service-note">
                    ✕ General auto repair is prohibited as a broad category and is not selectable.
                    Choose exact v0.11 services only. Selections are for review, not real-job access.
                  </small>
                </fieldset>
                <label>
                  {providerFormIsSpanish ? "Ubicación del negocio" : "Business location"}
                  <input required name="business-municipality" placeholder={providerFormIsSpanish ? "Ciudad o pueblo" : "City or town"} />
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
                    {providerFormIsSpanish
                      ? "Elija una o ambas opciones."
                      : "Choose one or both."}
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
                        {providerFormIsSpanish
                          ? "La insignia del perfil será"
                          : "Profile badge"}
                      </span>
                      <strong className="provider-mode-badge">
                        {providerModeForWorkLocations(selectedProviderWorkLocations)}
                      </strong>
                    </div>
                  )}
                </fieldset>
                {providerAcceptsCustomersAtBusiness && (
                  <label>
                    {providerFormIsSpanish
                      ? "Dirección donde atenderá a clientes"
                      : "Business meeting address"}
                    <input
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
                <input name="service-area" type="hidden" value={CURRENT_LAUNCH_AREA} />
                <div className="fixed-launch-area provider-fixed-area">
                  <span>
                    {providerFormIsSpanish ? "Área de trabajo actual" : "Current job area"}
                  </span>
                  <strong>
                    {providerFormIsSpanish
                      ? "Condado de Montgomery, Maryland"
                      : CURRENT_LAUNCH_AREA}
                  </strong>
                  <Link href="/about#expansion">
                    {providerFormIsSpanish
                      ? "¿Está fuera del condado? Solicite su área"
                      : "Outside the county? Request your area"}
                  </Link>
                </div>
                {selectedProviderServices.length > 0
                  && selectedProviderAreas.length > 0
                  && hasVisibleLegalRequirements ? (
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
                      <input required type="checkbox" name="legal-confirmation" value="yes" />
                      {providerFormIsSpanish
                        ? "Entiendo los requisitos legales mostrados para mis selecciones."
                        : "I understand the legal requirements shown for my selections."}
                    </label>
                  </section>
                ) : null}
                <fieldset className="area-fieldset">
                  <legend>Authorized signature and acknowledgments</legend>
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
                {pendingSubmission === "application" ? (
                  <ConfirmAction
                    backLabel={providerFormIsSpanish ? "Regresar" : "Go back"}
                    busy={applicationBusy}
                    busyLabel={providerFormIsSpanish ? "Enviando…" : "Submitting…"}
                    confirmLabel={providerFormIsSpanish ? "Confirmar y solicitar" : "Confirm and apply"}
                    confirmStyle="lime"
                    confirmType="submit"
                    message={providerFormIsSpanish
                      ? "Revise la información anterior. La solicitud no se enviará hasta que confirme."
                      : "Review the information above. The application is not sent until you confirm."}
                    onBack={() => setPendingSubmission("")}
                    title={providerFormIsSpanish ? "¿Enviar esta solicitud?" : "Submit this application?"}
                  />
                ) : (
                  <button className="button lime form-button" type="submit" disabled={applicationBusy}>
                    {applicationBusy
                      ? (providerFormIsSpanish ? "Guardando…" : "Saving…")
                      : (providerFormIsSpanish ? "Solicitar ingreso" : "Apply to join")} <span>→</span>
                  </button>
                )}
                {applicationError && <p className="form-error" role="alert">{applicationError}</p>}
                <small>
                  {providerFormIsSpanish
                    ? "Si la ley exige una licencia o un registro para el servicio y la ubicación seleccionados, Tuveloz debe recibir y verificar la prueba antes de aprobarlos. Si no corresponde una licencia gubernamental, Tuveloz no la solicitará por ese motivo; aún pueden exigirse seguros, competencia, documentos comerciales u otras pruebas del servicio."
                    : "If the selected service and location legally require a license or registration, Tuveloz must receive and verify proof before approval. If no government license applies, Tuveloz will not request one for that reason; insurance, competency, business, or other service evidence may still be required."}
                </small>
              </>
            )}
          </form>
        </div>
      </section>

      <section className="section expansion-section" id="expansion">
        <div className="expansion-copy">
          <span className="kicker">Future expansion</span>
          <h2>Bring Tuveloz to your area.</h2>
          <p>
            Tuveloz currently operates only in Montgomery County, Maryland.
            Customers and providers elsewhere in Maryland or Washington, DC can
            request their area. We&apos;ll use combined demand to choose where to
            launch next.
          </p>
          <div className="expansion-signals" aria-label="Expansion demand groups">
            <span>Customers</span>
            <span>Providers</span>
            <span>Mobile mechanics &amp; service trucks</span>
          </div>
        </div>

        <form className="expansion-form" onSubmit={handleExpansionSubmit}>
          {expansionSent ? (
            <div className="success-message expansion-success" role="status">
              <span>✓</span>
              <h3>Your area request is counted.</h3>
              <p>We&apos;ll compare customer and provider demand as Tuveloz plans its next launch area.</p>
              <button type="button" onClick={() => setExpansionSent(false)}>
                Request another area
              </button>
            </div>
          ) : (
            <>
              <h3>Request your area</h3>
              <p>Four quick answers help us measure real local demand.</p>
              <fieldset className="expansion-audience-fieldset">
                <legend>I am a…</legend>
                <div className="expansion-role-options">
                  {["Customer", "Provider", "Both"].map((option) => (
                    <label
                      className={expansionAudience === option ? "selected" : ""}
                      key={option}
                    >
                      <input
                        checked={expansionAudience === option}
                        name="expansion-audience"
                        onChange={() => setExpansionAudience(option)}
                        required
                        type="radio"
                        value={option}
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              {(expansionAudience === "Provider" || expansionAudience === "Both") && (
                <label>
                  Provider type
                  <select required name="expansion-provider-type" defaultValue="">
                    <option value="" disabled>Select one</option>
                    <option>Mobile mechanic or service truck</option>
                    <option>Shop-based mechanic</option>
                    <option>Mobile detailer</option>
                    <option>Window tint provider</option>
                    <option>Other vehicle-service provider</option>
                  </select>
                </label>
              )}
              <div className="field-row">
                <label>
                  State or district
                  <select required name="expansion-state" defaultValue="">
                    <option value="" disabled>Select one</option>
                    <option>Maryland</option>
                    <option>Washington, DC</option>
                  </select>
                </label>
                <label>
                  County or independent city
                  <input
                    name="expansion-locality"
                    placeholder="Example: Prince George's County"
                    required
                  />
                </label>
              </div>
              <label>
                Email address
                <input
                  name="expansion-email"
                  placeholder="you@example.com"
                  required
                  type="email"
                />
              </label>
              <button className="button primary form-button" disabled={expansionBusy} type="submit">
                {expansionBusy ? "Saving…" : "Request my area"} <span>→</span>
              </button>
              {expansionError && <p className="form-error" role="alert">{expansionError}</p>}
              <small>
                An area request shows interest; it does not promise a launch date.
                Don&apos;t include payment details or sensitive information.
              </small>
            </>
          )}
        </form>
      </section>

      <section className="section feedback-section" id="feedback">
        <div className="feedback-copy">
          <span className="kicker">Your feedback matters</span>
          <h2>Help shape what Tuveloz builds next</h2>
          <p>
            Choose the services, customer improvements, and provider tools you
            want us to add as Tuveloz grows.
          </p>
          <div className="feedback-points">
            <span><b>01</b> Suggest services</span>
            <span><b>02</b> Request provider tools</span>
            <span><b>03</b> Improve customer choices</span>
          </div>
        </div>

        <form
          className="feedback-form"
          onChange={() => pendingSubmission === "feedback" && setPendingSubmission("")}
          onSubmit={handleFeedbackSubmit}
        >
          {feedbackSent ? (
            <div className="success-message" role="status">
              <span>✓</span>
              <h3>Thanks for your feedback.</h3>
              <p>We saved your ideas for review as Tuveloz grows.</p>
              <button type="button" onClick={() => setFeedbackSent(false)}>Share another idea</button>
            </div>
          ) : (
            <>
              <h3>Share your feedback</h3>
              <p>Required questions are marked below. Email is optional.</p>
              <label>
                I&apos;m answering as
                <select required name="audience" defaultValue="">
                  <option value="" disabled>Select one</option>
                  <option>Customer</option>
                  <option>Provider</option>
                  <option>Both</option>
                </select>
              </label>
              <fieldset className="feedback-choice-group">
                <legend>Which jobs should Tuveloz add or feature next?</legend>
                <p>Select every service you would like to see.</p>
                <div className="feedback-options">
                  {feedbackJobOptions.map((option) => (
                    <label key={option}>
                      <input name="jobs-wanted" type="checkbox" value={option} />
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
                <label className="feedback-other">
                  Other job or service <span className="optional-label">(optional)</span>
                  <input name="jobs-wanted-other" placeholder="Tell us what should be added" />
                </label>
              </fieldset>
              <fieldset className="feedback-choice-group">
                <legend>Which tools would make a provider&apos;s work easier?</legend>
                <p>Pick the tools that would genuinely help.</p>
                <div className="feedback-options">
                  {feedbackProviderOptions.map((option) => (
                    <label key={option}>
                      <input name="provider-features" type="checkbox" value={option} />
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
                <label className="feedback-other">
                  Other provider tool <span className="optional-label">(optional)</span>
                  <input name="provider-features-other" placeholder="Suggest another provider feature" />
                </label>
              </fieldset>
              <fieldset className="feedback-choice-group">
                <legend>What would make Tuveloz better for customers?</legend>
                <p>Select the improvements that matter most.</p>
                <div className="feedback-options">
                  {feedbackCustomerOptions.map((option) => (
                    <label key={option}>
                      <input name="customer-improvements" type="checkbox" value={option} />
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
                <label className="feedback-other">
                  Other customer improvement <span className="optional-label">(optional)</span>
                  <input name="customer-improvements-other" placeholder="Suggest another improvement" />
                </label>
              </fieldset>
              <label>
                Email for follow-up <span className="optional-label">(optional)</span>
                <input name="feedback-email" type="email" placeholder="you@example.com" />
              </label>
              {pendingSubmission === "feedback" ? (
                <ConfirmAction
                  busy={feedbackBusy}
                  busyLabel="Sending…"
                  confirmLabel="Confirm and send"
                  confirmType="submit"
                  message="Review your feedback above. It is not sent until you confirm."
                  onBack={() => setPendingSubmission("")}
                  title="Send this feedback?"
                />
              ) : (
                <button className="button primary form-button" type="submit" disabled={feedbackBusy}>
                  {feedbackBusy ? "Saving…" : "Send feedback"} <span>→</span>
                </button>
              )}
              {feedbackError && <p className="form-error" role="alert">{feedbackError}</p>}
              <small>Don&apos;t include payment details, identification numbers, or sensitive documents.</small>
            </>
          )}
        </form>
      </section>

      <section className="final-cta">
        <span className="kicker light">Tuveloz</span>
        <h2>Provider onboarding is open. Customer jobs remain closed.</h2>
        <div>
          <Link className="button lime" href="/post-job">See customer launch status <span>→</span></Link>
          <Link className="button ghost" href="/join">Join the provider network</Link>
        </div>
      </section>

      <footer>
        <Link className="brand footer-brand" href="/">
          <BrandMark /><span>Tuveloz</span>
        </Link>
        <p>Vehicle services built around customer choice and provider freedom.</p>
        <div className="footer-links">
          <Link href="/about">Learn about Tuveloz</Link>
          <Link href="/post-job">Customer launch status</Link>
          <Link href="/join">Join as a provider</Link>
          <Link href="/how-it-works">How it works</Link>
          <Link href="/safety">Safety &amp; trust</Link>
          <Link href="/faq">FAQ</Link>
          <a href="/storefront">Storefront</a>
          <Link href={accountHref}>{accountLabel}</Link>
          <a href="/terms">Terms</a>
          <a href="/customer-agreement">Customer agreement</a>
          <a href="/provider-agreement">Provider agreement</a>
          <a href="/marketplace-conduct">Marketplace conduct</a>
          <a href="/provisional-provider-policy">Provider pathways</a>
          <a href="/privacy">Privacy</a>
          <a href="/payments">Payments</a>
          <Link href="/about#expansion">Request your area</Link>
          <Link href="/about#feedback">Give feedback</Link>
          {isOwner && <a href="/admin">Owner dashboard</a>}
          <a href="mailto:hello@tuveloz.com?subject=Tuveloz%20Early%20Supporter">Early supporters</a>
          <a href="mailto:hello@tuveloz.com">hello@tuveloz.com</a>
        </div>
        <div className="footer-bottom">
          <span>© 2026 Tuveloz. All rights reserved.</span>
          <span>Marketplace build · Provider onboarding open in Montgomery County, Maryland.</span>
        </div>
      </footer>
    </main>
  );
}

export default function Home() {
  return <TuvelozPublic view="home" />;
}
