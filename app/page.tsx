"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import {
  CURRENT_LAUNCH_AREA,
  CUSTOMER_SERVICE_GROUPS,
  CUSTOMER_SERVICE_LOCATION_OPTIONS,
  parseCustomerServiceLocations,
  PARTS_COMMUNICATION_NOTICE,
  PARTS_PREFERENCE_OPTIONS,
  PARTS_SOURCE_OPTIONS,
} from "../lib/service-matching";
import { CUSTOMER_JOB_POSTING_PAUSED } from "../lib/launch-status";
import { SERVICE_CODES } from "../lib/provider-policy";
import { track } from "../lib/analytics";
import { getVariant } from "../lib/experiments";
import { AddressAutocompleteInput } from "./components/address-autocomplete-input";
import { LocationDatalists, MUNICIPALITY_DATALIST_ID, ZIP_DATALIST_ID } from "./components/location-datalists";
import VehicleSelector from "./components/vehicle-selector";
import { SiteLanguageButton } from "./components/site-language";
import {
  BrandMark,
  TuvelozIcon,
  type TuvelozIconName,
} from "./components/tuveloz-icons";
import { ConfirmAction } from "./components/confirm-action";
import { LegalHelp } from "./components/legal-help";
import { ProviderSignupForm, SIGNUP_DRAFT_KEY } from "./components/provider-signup-form";
import { SocialLinks } from "./components/social-links";

// Homepage launches with only the easy-entry, no-license services — the
// simplest onboarding path. Specialized/proof-required services (tire
// repair, A/C service, towing, etc.) are added as separate categories once
// the marketplace is ready to expand, not shown here yet. Each group's
// serviceCodes must be real entries from lib/provider-policy.ts's catalog,
// checked below, so this list can't silently drift from what actually exists.
const services: Array<{
  icon: TuvelozIconName;
  title: string;
  text: string;
  serviceCodes: readonly string[];
}> = [
  {
    icon: "battery",
    title: "Battery & jump start",
    text: "Back on the road when your battery quits.",
    serviceCodes: ["provisional_12v_jump_start", "provisional_12v_battery_replacement"],
  },
  {
    icon: "services",
    title: "Wipers & bulbs",
    text: "New wiper blades and burnt-out bulbs, swapped fast.",
    serviceCodes: ["provisional_wiper_blade_replacement", "provisional_conventional_bulb_replacement"],
  },
  {
    icon: "services",
    title: "Top off fluids",
    text: "A quick top-up to keep your car running right.",
    serviceCodes: ["provisional_fluid_topoff_limited"],
  },
  {
    icon: "detailing",
    title: "Car cleaning",
    text: "An outside wash, inside cleaning, or both.",
    serviceCodes: ["provisional_basic_detailing"],
  },
  {
    icon: "diagnostics",
    title: "Find out what's wrong",
    text: "A local provider checks your car on-site to see what's going on.",
    serviceCodes: ["provisional_obd_read_only", "basic_vehicle_diagnostics"],
  },
];

const KNOWN_SERVICE_CODES: readonly string[] = SERVICE_CODES;
if (services.some((service) => service.serviceCodes.some((code) => !KNOWN_SERVICE_CODES.includes(code)))) {
  throw new Error("Homepage services list references an unknown service code.");
}

// What the platform is built to carry so a provider can, as much as possible,
// just show up and do the work. Each item maps to a real workspace tool
// (appointments, quote toolkit, job evidence, authorizations/invoices,
// performance) or to the marketplace itself bringing the customer. Copy stays
// inside Tuveloz's launch-honest voice: these run for real jobs only after a
// service passes launch review — stated in the note below the grid.
const providerHandled: Array<{
  icon: TuvelozIconName;
  title: string;
  text: string;
}> = [
  {
    icon: "open-jobs",
    title: "Customers come to you",
    text: "No website to build, no ads to run. Matching requests reach the providers approved for that exact service.",
  },
  {
    icon: "active-job",
    title: "Scheduling in one place",
    text: "Confirm appointments and keep every job's date, time, and details together instead of chasing texts.",
  },
  {
    icon: "quote",
    title: "Quotes in minutes",
    text: "Reusable quote wording and your own set prices. Send a clear scope and price fast — no phone tag.",
  },
  {
    icon: "gallery",
    title: "Photo-backed job records",
    text: "Log vehicle condition, progress, parts, and completion evidence with photos from any phone.",
  },
  {
    icon: "earnings",
    title: "Invoices and payment handled",
    text: "Accepted quotes become written authorizations, invoices, and receipts. At launch, payment runs through the platform.",
  },
  {
    icon: "overview",
    title: "Your numbers, private",
    text: "Track your own completed jobs and performance in a workspace only you can see.",
  },
];

// What a marketplace can design for that single-shop software can't. Framed as
// how Tuveloz is built — not live guarantees — to stay inside the site's
// launch-honest voice (the note below the grid restates the launch caveat).
// Each maps to something real in the model: bilingual EN/ES interface,
// platform-run payment released on completion evidence, the labor-only /
// customer-supplied-parts flow, and mobile/on-location job records.
const providerDifferences: Array<{
  icon: TuvelozIconName;
  title: string;
  text: string;
}> = [
  {
    icon: "quote",
    title: "Bilingual to the fine print",
    text: "Your quote, authorization, and invoice are built to read in English and Spanish — so you and your customer agree to the same words, not a rough translation.",
  },
  {
    icon: "earnings",
    title: "Paid through the platform",
    text: "At launch, accepted jobs are paid through Tuveloz and released on your completion evidence. Finish the work and the payout is set up to follow — no chasing checks.",
  },
  {
    icon: "services",
    title: "Labor-only, done right",
    text: "Customers bring the part. Tuveloz is designed to line up the exact part before your appointment, so a wrong part doesn't waste your trip.",
  },
  {
    icon: "active-job",
    title: "Made for mobile, not just the front desk",
    text: "Appointments, records, and photo evidence work from any phone at the customer's location — built for mobile mechanics and service trucks, not only walk-in shops.",
  },
];

// The emotional case for joining, focused on control and ownership rather than
// repeating the feature grid. Each line reflects a value the platform already
// states: independence (providers aren't employed/assigned), keep-100% pricing,
// no exclusivity, and reviews tied to completed jobs. Honest, no fabricated
// numbers or testimonials — the marketplace is pre-launch.
const providerReasons: Array<{
  icon: TuvelozIconName;
  title: string;
  text: string;
}> = [
  {
    icon: "overview",
    title: "You're the boss",
    text: "Tuveloz doesn't employ, train, or assign you. Set your own price, schedule, and how you do the work — every job, every time.",
  },
  {
    icon: "earnings",
    title: "Keep what you earn",
    text: "Keep 100% of your quoted price. No subscription, no lead fees, no commission carved out of your labor.",
  },
  {
    icon: "open-jobs",
    title: "No exclusivity, no cage",
    text: "Keep your own customers and work other platforms too. Tuveloz is one more way to fill your day — not a lock-in.",
  },
  {
    icon: "reviews",
    title: "Grow on real work",
    text: "Reviews are tied to completed jobs, not gameable star clicks. Your track record is yours to build and keep.",
  },
];

const liveSteps = [
  ["01", "Post what you need", "A quick description is enough."],
  ["02", "Get quotes", "Independent providers respond with their price."],
  ["03", "Choose what works", "Compare and pick, or don't accept anything at all."],
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

export type PublicView = "home" | "about" | "request" | "provider";

export function TuvelozPublic({ view = "home" }: { view?: PublicView }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [requestToken, setRequestToken] = useState("");
  const [requestBusy, setRequestBusy] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [vehicleResetVersion, setVehicleResetVersion] = useState(0);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [feedbackError, setFeedbackError] = useState("");
  const [expansionSent, setExpansionSent] = useState(false);
  const [expansionBusy, setExpansionBusy] = useState(false);
  const [expansionError, setExpansionError] = useState("");
  const [expansionAudience, setExpansionAudience] = useState("");
  const [pendingSubmission, setPendingSubmission] = useState<
    "" | "request" | "feedback"
  >("");
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [reviewSummary, setReviewSummary] = useState({ average: 0, count: 0 });
  const [selectedCustomerServices, setSelectedCustomerServices] = useState<string[]>([]);
  const [, setSelectedCustomerVehicle] = useState("");
  const [partsSource, setPartsSource] = useState(PARTS_SOURCE_OPTIONS[2]);
  const [partsPreference, setPartsPreference] = useState("No preference");
  const [selectedCustomerLocations, setSelectedCustomerLocations] = useState<string[]>([]);
  const [priceGuidance, setPriceGuidance] = useState<PriceGuidanceItem[]>([]);
  const [priceGuidanceBusy, setPriceGuidanceBusy] = useState(false);
  const [repeatBooking, setRepeatBooking] = useState<RepeatBooking | null>(null);
  const [repeatBookingError, setRepeatBookingError] = useState("");
  const [useSameVehicle, setUseSameVehicle] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [headerAccountState, setHeaderAccountState] = useState<
    "checking" | "signed-out" | "customer" | "provider"
  >("checking");
  const [headerAccountDestination, setHeaderAccountDestination] = useState("");
  // Control ("A") on first render so server and client match; the real assigned
  // variant is set after mount in the provider-view effect below.
  const [heroVariant, setHeroVariant] = useState("A");

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
  const customerAllowsProviderTravel = selectedCustomerLocations.includes(
    CUSTOMER_SERVICE_LOCATION_OPTIONS[0],
  );

  useEffect(() => {
    if (view === "provider") {
      const variant = getVariant("provider_hero");
      // Defer out of the effect's synchronous phase so it doesn't cascade
      // renders; the assigned variant is stable for the whole session.
      queueMicrotask(() => setHeroVariant(variant));
      track("provider_signup_started", { experiment: "provider_hero", variant });
    }
    if (view === "request") track("customer_request_started");
  }, [view]);

  useEffect(() => {
    // On /join, a returning applicant wants to pick their in-progress application
    // back up — so jump them straight to the form. A first-time visitor should
    // meet the hero pitch first; don't yank them past it. A saved signup draft is
    // our signal that this person has already started applying.
    if (view !== "provider") return;
    if (window.location.hash) return;
    let hasDraft = false;
    try {
      hasDraft = window.localStorage.getItem(SIGNUP_DRAFT_KEY) !== null;
    } catch {
      hasDraft = false;
    }
    if (!hasDraft) return;
    let cancelled = false;
    const scrollToForm = () => {
      if (cancelled) return;
      const target = document.getElementById("provider-apply")
        ?? document.getElementById("providers");
      target?.scrollIntoView({ block: "start" });
    };
    scrollToForm();
    const frame = requestAnimationFrame(scrollToForm);
    // Content above the form (reviews, hero image) loads async and pushes the
    // form down after first paint, so re-assert a few times until it settles.
    const timers = [200, 600, 1200].map((ms) => window.setTimeout(scrollToForm, ms));
    // Stop fighting the visitor the moment they take over scrolling.
    const stop = () => { cancelled = true; };
    window.addEventListener("wheel", stop, { passive: true, once: true });
    window.addEventListener("touchstart", stop, { passive: true, once: true });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      timers.forEach((id) => window.clearTimeout(id));
      window.removeEventListener("wheel", stop);
      window.removeEventListener("touchstart", stop);
    };
  }, [view]);

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const customerServiceLocations = formData.getAll("service-location").map(String);
    const customerServices = formData.getAll("service").map(String);
    if (!String(formData.get("vehicle") ?? "").trim()) {
      setRequestError("Choose your vehicle by year, make, and model—or use the VIN lookup.");
      return;
    }
    if (customerServices.length === 0) {
      setRequestError("Choose at least one service.");
      return;
    }
    if (customerServiceLocations.length === 0) {
      setRequestError("Choose at least one place where the service can happen.");
      return;
    }

    if (pendingSubmission !== "request") {
      setRequestError("");
      setPendingSubmission("request");
      return;
    }

    setRequestBusy(true);
    setRequestError("");

    try {
      const response = await fetch("/api/requests", { method: "POST", body: formData });
      const result = (await response.json()) as {
        error?: string;
        accessToken?: string;
      };
      if (!response.ok) throw new Error(result.error || "Please try again.");
      setPendingSubmission("");
      form.reset();
      setSelectedCustomerServices([]);
      setSelectedCustomerVehicle("");
      setPartsSource(PARTS_SOURCE_OPTIONS[2]);
      setPartsPreference("No preference");
      setSelectedCustomerLocations([]);
      setRepeatBooking(null);
      setRepeatBookingError("");
      setVehicleResetVersion((version) => version + 1);
      setRequestToken(result.accessToken ?? "");
      setRequestSent(true);
      track("customer_request_posted");
    } catch (error) {
      setPendingSubmission("");
      const message = error instanceof Error ? error.message : "Please try again.";
      setRequestError(message);
    } finally {
      setRequestBusy(false);
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
          ? "Sign up or sign in"
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
          aria-controls="main-navigation"
          aria-label={menuOpen ? "Close main menu" : "Open main menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((value) => !value)}
        >
          <span />
          <span />
        </button>

        <nav className={menuOpen ? "nav open" : "nav"} id="main-navigation" aria-label="Main navigation">
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
          {view === "provider" ? (
            <>
              <div className="eyebrow">
                <span className="pulse" />
                Now onboarding · Montgomery County
              </div>
              <h1>
                {heroVariant === "B" ? "Do great work. Get paid." : "Your wrench. Your rules."}
                <br />
                <span className="hero-value-line">
                  We handle the rest.
                </span>
              </h1>
              <p>
                Tuveloz is a local vehicle-services marketplace launching in Montgomery
                County, Maryland. You bring the skills — we bring the customers and knock
                out the paperwork. Join free, keep 100% of your quoted price, no
                exclusivity. Real jobs and payments open as we launch.
              </p>
            </>
          ) : CUSTOMER_JOB_POSTING_PAUSED ? (
            <>
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
                Tuveloz is a local vehicle-services marketplace launching in Montgomery
                County, Maryland. Independent providers can apply now — join free, keep
                100% of your quoted price, no exclusivity. Customer requests, payments,
                and real jobs open after launch review.
              </p>
            </>
          ) : (
            <>
              <h1>Any car issue. Multiple quotes. You choose.</h1>
              <p>
                Tell us what your vehicle needs. Local independent providers send you
                real quotes. You pick the one that works — on your schedule, your
                price, your call.
              </p>
            </>
          )}
          <div className="hero-actions">
            {view === "provider" ? (
              <>
                <a className="button primary" href="#provider-apply">
                  Join free — apply now <span>→</span>
                </a>
                <Link className="button secondary" href="/how-it-works">
                  See how it works <span>→</span>
                </Link>
              </>
            ) : CUSTOMER_JOB_POSTING_PAUSED ? (
              <>
                <Link className="button primary" href="/join">
                  Join as a provider — free <span>→</span>
                </Link>
                <Link className="button secondary" href="/post-job">
                  Customer launch status <span>→</span>
                </Link>
              </>
            ) : (
              <>
                <Link className="button primary" href="/post-job">
                  Get started — free <span>→</span>
                </Link>
                <Link className="button secondary" href="/join">
                  Join as a provider — free <span>→</span>
                </Link>
              </>
            )}
            <a className="button ai" href="https://ai.tuveloz.com/">
              Try Tuveloz AI <span>✦</span>
            </a>
          </div>
          <div className="hero-launch-note">
            <strong>
              {CUSTOMER_JOB_POSTING_PAUSED
                ? "Now onboarding providers in Montgomery County, Maryland"
                : "Now serving Montgomery County, Maryland. More areas coming soon."}
            </strong>
            <Link href="/about#expansion">Outside the county? Request your area →</Link>
          </div>
        </div>

        <div className="hero-visual" aria-label="Preview of the planned Tuveloz service-request experience" role="img">
          <div className="quote-board">
            <article className="quote-ticket qt-1">
              <div className="qt-head"><span>JOB #4471</span><b>Preview</b></div>
              <strong>Battery replacement</strong>
              <span className="qt-price">$118</span>
              <small>Ramirez Mobile Auto · concept preview</small>
            </article>
            <article className="quote-ticket qt-2">
              <div className="qt-head"><span>JOB #4471</span><b>Preview</b></div>
              <strong>Battery replacement</strong>
              <span className="qt-price">$96</span>
              <small>Silver Spring Auto Care · concept preview</small>
            </article>
            <article className="quote-ticket qt-3 qt-selected">
              <div className="qt-head"><span>JOB #4471</span><b>Planned pick</b></div>
              <strong>Battery replacement</strong>
              <span className="qt-price">$96</span>
              <small>Silver Spring Auto Care · concept preview</small>
              <span className="qt-stamp">YOU CHOOSE</span>
            </article>
          </div>
          <p className="hero-visual-caption">
            {CUSTOMER_JOB_POSTING_PAUSED
              ? "Concept preview — not a live job. Customer requests and quotes open after launch."
              : "Example preview of a real quote comparison."}
          </p>
        </div>
      </section>

      <section className="proof-strip" aria-label="Current Tuveloz launch status">
        <span><b>Launch area</b> Montgomery County, Maryland</span>
        <span><b>Customer requests</b> are not yet available</span>
        <span><b>Service activation</b> requires approval</span>
        <span><b>Provider applications</b> are open now</span>
      </section>

      <section className="trust-section" aria-labelledby="trust-heading">
        <div className="trust-intro">
          <span className="kicker light">Trust, stated plainly</span>
          <h2 id="trust-heading">We show what&apos;s documented. Nothing more.</h2>
        </div>
        <div className="trust-grid">
          <article className="trust-card">
            <span className="trust-card-label">Marketplace, not mechanic</span>
            <p>
              Tuveloz connects you with providers; at launch, payment will run
              through the platform. The work itself is a direct agreement
              between you and the provider you choose.
            </p>
          </article>
          <article className="trust-card">
            <span className="trust-card-label">Independent providers</span>
            <p>
              Providers are independent businesses, not Tuveloz employees —
              they set their own price, schedule, and methods.
            </p>
          </article>
          <article className="trust-card">
            <span className="trust-card-label">Law-based verification</span>
            <p>
              When a service legally requires a license or registration, it
              must be documented and confirmed before that provider can offer
              the service through Tuveloz — nothing added just in case.
            </p>
          </article>
        </div>
      </section>

      {view === "home" && (
        <section className="ai-home-card" aria-labelledby="tuveloz-ai-heading">
          <div className="ai-home-copy">
            <span className="kicker">Available now · Tuveloz AI</span>
            <h2 id="tuveloz-ai-heading">A clearer way to describe what your vehicle needs.</h2>
            <p>
              Get bilingual, safety-first guidance that helps you organize observations
              and prepare for future service requests. It does not diagnose, dispatch
              help, guarantee pricing, or choose a provider.
            </p>
          </div>
          <a className="button ai" href="https://ai.tuveloz.com/">
            Open Tuveloz AI <span>→</span>
          </a>
        </section>
      )}

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
            <h3>Your car. Your call.</h3>
            <p>
              Soon you&apos;ll say what your car needs, get real quotes from local
              providers side by side, and pick the one that feels right — no pressure,
              no obligation, no runaround. We&apos;re almost there; check the launch
              status anytime.
            </p>
            <ul>
              <li><span aria-hidden="true">✓</span> Choose from available services</li>
              <li><span aria-hidden="true">✓</span> Compare providers and quotes</li>
              <li><span aria-hidden="true">✓</span> You make the final decision</li>
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
              providers can apply now, select specific services for review, and
              upload the required evidence. Job access begins only after the provider
              and each selected service pass every required review.
            </p>
            <ul>
              <li><span aria-hidden="true">✓</span> Work on your schedule</li>
              <li><span aria-hidden="true">✓</span> Use one simple job workspace</li>
              <li><span aria-hidden="true">✓</span> Request tools that help you grow</li>
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
            These services are planned and are not yet available. Each one must
            complete Tuveloz&apos;s launch review before it can open to customers.
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
            </article>
          ))}
        </div>
        <div className="quote-banner">
          <div className="quote-icon"><TuvelozIcon name="quote" /></div>
          <div>
            <span className="kicker">Planned quote workflow</span>
            <h3>Cosmetic-repair quotes are not yet available.</h3>
            <p>
              This service will remain unavailable until its requirements,
              provider evidence, and launch approvals are complete.
            </p>
          </div>
          <Link className="button secondary" href="/post-job">
            View launch status <span>→</span>
          </Link>
        </div>
      </section>

      <section className="section how" id="how-it-works">
        <div className="how-intro">
          <span className="kicker light">
            {CUSTOMER_JOB_POSTING_PAUSED ? "Planned customer workflow" : "How it works"}
          </span>
          <h2>
            {CUSTOMER_JOB_POSTING_PAUSED
              ? "After launch, request a specific service and compare eligible providers."
              : "Post it once. Compare real quotes. Choose what works."}
          </h2>
          {CUSTOMER_JOB_POSTING_PAUSED && (
            <p>
              The request-and-quote flow shown here is a product preview. Requests,
              quotes, bookings, payments, and payouts are not yet available.
            </p>
          )}
          {CUSTOMER_JOB_POSTING_PAUSED && (
            <Link className="text-link" href="/post-job">See customer launch status →</Link>
          )}
        </div>
        <div className="steps">
          {(CUSTOMER_JOB_POSTING_PAUSED ? steps : liveSteps).map(([number, title, text]) => (
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
            <span className="kicker">Reviews linked to a completed Tuveloz job</span>
            <h2>Read customer feedback tied to Tuveloz job records.</h2>
            <p>
              A completed-job link confirms a platform record; it does not independently verify
              every statement, certify repair quality, or guarantee future performance.
            </p>
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
            <p>Job-linked reviews will appear after customers complete Tuveloz jobs.</p>
          </div>
        )}
      </section>

      <section className="section request-section" id="request">
        <div className="request-copy">
          <span className="kicker">
            {CUSTOMER_JOB_POSTING_PAUSED ? "Customer accounts are open" : "For customers"}
          </span>
          {view === "request" ? (
            <h1>
              {CUSTOMER_JOB_POSTING_PAUSED
                ? "Set up now. Be first in line when we launch."
                : "Post it once. Compare real quotes. No pressure."}
            </h1>
          ) : (
            <h2>
              {CUSTOMER_JOB_POSTING_PAUSED
                ? "Set up now. Be first in line when we launch."
                : "Post it once. Compare real quotes. No pressure."}
            </h2>
          )}
          {CUSTOMER_JOB_POSTING_PAUSED ? (
            <>
              <p>
                We&apos;re putting the finishing touches on the marketplace, so requests
                and payments aren&apos;t open just yet — but you can set up your customer
                account today and be ready the moment we launch. When you post, your
                request goes only to providers actually approved for that exact service,
                so you&apos;re matched with the right pro, not spammed.
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
            </>
          ) : (
            <ul>
              <li><span>✓</span> Describe what&apos;s wrong — no rigid categories required</li>
              <li><span>✓</span> Independent local providers send you their price</li>
              <li><span>✓</span> You decide — no fee to post, no fee to compare, no obligation to accept</li>
            </ul>
          )}
        </div>

        {CUSTOMER_JOB_POSTING_PAUSED ? (
          <div className="lead-form">
            <div className="form-heading">
              <span>✓</span>
              <div>
                <h3>Prepare for launch without submitting a job</h3>
                <p>
                  Create your customer account to keep your information together and
                  return when customer service requests open. No job, provider contact,
                  booking, or payment is created now.
                </p>
              </div>
            </div>
            <div className="hero-actions">
              <Link className="button primary" href="/account?role=customer&mode=create">
                Create customer account <span>→</span>
              </Link>
              <Link className="button secondary" href="/join">
                Apply as a provider
              </Link>
            </div>
            <small>
              Customer account signup and provider applications are open. Customer
              jobs and payments remain server-blocked.
            </small>
          </div>
        ) : (
        <form
          className="lead-form"
          key={`${vehicleResetVersion}:${repeatBooking?.token ?? "new"}`}
          onChange={() => pendingSubmission === "request" && setPendingSubmission("")}
          onSubmit={handleSubmit}
        >
          <LocationDatalists />
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
                    list={MUNICIPALITY_DATALIST_ID}
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
                  list={ZIP_DATALIST_ID}
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
                        open={selectedCount > 0 ? true : undefined}
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
              <fieldset className="area-fieldset">
                <legend>Parts arrangement for this labor-only request</legend>
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
                <small className="parts-equipment-note">{PARTS_COMMUNICATION_NOTICE}</small>
              </fieldset>
              <label>
                <span className="field-label-with-help">
                  Customer-supplied parts preference
                  <LegalHelp
                    label="What do OEM and aftermarket mean here?"
                    text="OEM and aftermarket are communication preferences for a part the customer purchases separately. Tuveloz does not sell, source, verify, reimburse, or process payment for the part."
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
              </label>
              <label className="policy-consent">
                <input
                  name="labor-only-parts-acknowledged"
                  required
                  type="checkbox"
                  value="yes"
                />
                <span>
                  I understand that Tuveloz quotes and payments are labor only. Any
                  required part must be purchased separately by me and cannot be
                  included as a provider-supplied part or parts charge.
                </span>
              </label>
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
                  <AddressAutocompleteInput
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

      <section className="section provider-pitch" id="why-join">
        <div className="section-heading">
          <div>
            <span className="kicker">Why mechanics join Tuveloz</span>
            <h2>You&apos;ve got the skills. Let&apos;s build the business around them.</h2>
          </div>
          <p>
            You shouldn&apos;t have to hand your customers — or your paycheck — to
            anyone. On Tuveloz you stay independent, set your own price, and let us
            handle the busywork. Show up, do great work, get paid. Simple as that.
          </p>
        </div>
        <div className="pitch-grid">
          {providerReasons.map((reason) => (
            <article key={reason.title}>
              <div className="pitch-icon">
                <TuvelozIcon name={reason.icon} />
              </div>
              <h3>{reason.title}</h3>
              <p>{reason.text}</p>
            </article>
          ))}
        </div>
        <div className="founding-banner">
          <div>
            <span className="kicker light">Founding providers · Montgomery County</span>
            <h3>Be first. Own your corner of the county.</h3>
            <p>
              The first mechanics into Montgomery County get first pick of jobs and
              a real voice in how Tuveloz works. Free to apply, no subscription, no
              exclusivity — there&apos;s no better time to bet on yourself.
            </p>
          </div>
          <a className="button lime" href="#provider-apply">
            Join free <span>→</span>
          </a>
        </div>
      </section>

      <section className="section providers" id="providers">
        <div className="provider-panel" data-manual-language>
          <div className="provider-copy">
            <span className="kicker light">For providers</span>
            {view === "provider" ? (
              <h1>Your business. Your price. Your schedule.</h1>
            ) : (
              <h2>Your business. Your price. Your schedule.</h2>
            )}
            <p>
              This is your business — run it your way. Tuveloz doesn&apos;t employ, train, or assign work to providers;
              you pick the jobs that fit and name your price. Sign up free — no listing fee, no subscription.
            </p>
            <div className="provider-benefits">
              <div><span>01</span><strong>Keep 100% of your quoted price</strong></div>
              <div><span>02</span><strong>Work other platforms too — no exclusivity</strong></div>
              <div><span>03</span><strong>Documents requested only when your exact services require them</strong></div>
            </div>
            <a className="button primary" href="#provider-apply">Join free <span>→</span></a>
            <section className="provider-eligibility-guide" aria-labelledby="provider-guide-title">
              <div className="eligibility-guide-heading">
                <span id="provider-guide-title">How applying works</span>
              </div>
              <ol>
                <li>Tell us which services you offer.</li>
                <li>See exactly what&apos;s required, only if anything is — skipped entirely otherwise.</li>
                <li>Give us your business details and verify your email to submit.</li>
              </ol>
              <div className="legal-requirement-note" aria-label="Service status note">
                <strong>Explore and pick your services freely — nothing&apos;s locked in.</strong>
                <small>Each service switches on for real jobs once its legal and insurance basics are in place, and we&apos;ll walk you through anything that&apos;s needed.</small>
              </div>
            </section>
            <section className="provider-handles" aria-labelledby="provider-handles-title">
              <div className="provider-handles-heading">
                <span className="kicker light">Show up. Do the work.</span>
                <h3 id="provider-handles-title">You fix the vehicle. We knock out the paperwork.</h3>
                <p>
                  Booking dates, quotes, records, invoices, getting paid — the admin
                  that eats everyone else&apos;s evenings lives in one workspace here.
                  Spend your time under the hood, not buried in office work.
                </p>
              </div>
              <div className="provider-handles-grid">
                {providerHandled.map((item) => (
                  <article key={item.title}>
                    <span className="provider-handles-icon">
                      <TuvelozIcon name={item.icon} />
                    </span>
                    <strong>{item.title}</strong>
                    <p>{item.text}</p>
                  </article>
                ))}
              </div>
              <small className="provider-handles-note">
                Get set up and comfortable now — these tools come online for real jobs
                as we launch, and we&apos;ll keep you posted. You&apos;re always your own
                business: Tuveloz never sets your prices, schedule, or how you work.
              </small>
            </section>
          </div>

          <div id="provider-apply">
            <ProviderSignupForm />
          </div>
        </div>
      </section>

      <section className="section difference-section" id="what-makes-us-different">
        <div className="section-heading">
          <div>
            <span className="kicker">Why Tuveloz is different</span>
            <h2>Built as a marketplace — so we can do what shop software can&apos;t.</h2>
          </div>
          <p>
            Most tools are built for one front desk. Tuveloz is built around
            independent providers and their customers, which lets us design for
            trust, language, and mobile work from the ground up.
          </p>
        </div>
        <div className="difference-grid">
          {providerDifferences.map((item) => (
            <article key={item.title}>
              <div className="difference-icon">
                <TuvelozIcon name={item.icon} />
              </div>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
        <p className="difference-note">
          This is how Tuveloz is built to work for you. Services and payments
          switch on as each one is ready — no surprises, and we&apos;ll keep you
          in the loop the whole way.
        </p>
      </section>

      <section className="section expansion-section" id="expansion">
        <div className="expansion-copy">
          <span className="kicker">Future expansion</span>
          <h2>Bring Tuveloz to your area.</h2>
          <p>
            Tuveloz provider onboarding currently focuses on Montgomery County,
            Maryland. Customers and providers elsewhere in Maryland or Washington,
            DC can request their area. We&apos;ll use combined demand to choose where
            to launch next.
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
        <h2>Provider applications are open. Customer service requests are not yet available.</h2>
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
          <a href="https://ai.tuveloz.com/">Tuveloz AI</a>
          <Link href="/post-job">Customer launch status</Link>
          <Link href="/join">Join as a provider</Link>
          <Link href="/how-it-works">How it works</Link>
          <Link href="/safety">Safety &amp; trust</Link>
          <Link href="/faq">FAQ</Link>
          <a href="/payments">Payment policy</a>
          <Link href={accountHref}>{accountLabel}</Link>
          <a href="/terms">Terms</a>
          <a href="/customer-agreement">Customer agreement</a>
          <a href="/provider-agreement">Provider agreement</a>
          <a href="/marketplace-conduct">Marketplace conduct</a>
          <a href="/provisional-provider-policy">Provider pathways</a>
          <a href="/privacy">Privacy</a>
          <Link href="/about#expansion">Request your area</Link>
          <Link href="/about#feedback">Give feedback</Link>
          {isOwner && <a href="/admin">Owner dashboard</a>}
          <a href="mailto:hello@tuveloz.com?subject=Tuveloz%20Early%20Supporter">Early supporters</a>
          <a href="mailto:hello@tuveloz.com">hello@tuveloz.com</a>
        </div>
        <div className="footer-bottom">
          <SocialLinks />
          <span>© 2026 Tuveloz. All rights reserved.</span>
          <span>Provider onboarding is open in Montgomery County, Maryland.</span>
        </div>
      </footer>
    </main>
  );
}

export default function Home() {
  return <TuvelozPublic view="home" />;
}
