import type { ProviderLevel, ServiceCode } from "./provider-policy";

/**
 * Scored admissions for `provisional_service_competency`.
 *
 * This deliberately sits BESIDE the eligibility engine, never inside it. The
 * engine's question is unchanged: "is there an accepted competency evidence
 * submission for this person and this service?" What this module decides is
 * when a reviewer is entitled to accept one. Keeping the split means
 * ELIGIBILITY_RULES_VERSION, the policy matrix schema, and every job
 * authorization path stay exactly as they are.
 *
 * The problem it solves: the acceptance guide recognizes competency only when
 * an approved vendor or issuing program can confirm it. A mechanic who has run
 * their own mobile repair business for six years has no such issuer, and fails.
 * Someone with a fresh online certificate and no jobs passes. Scoring several
 * routes fixes that ordering without lowering the bar.
 */
export const COMPETENCY_POINTS_VERSION = "1.0.0";

export type CompetencyRouteCode =
  | "parts_house_commercial_account"
  | "customer_references"
  | "prior_invoices"
  | "public_review_history"
  | "documented_job_photos"
  | "issued_credential"
  | "work_history_attestation"
  | "tooling_photos";

export type CompetencyRoute = {
  code: CompetencyRouteCode;
  label: string;
  labelEs: string;
  points: number;
  /**
   * True when the only thing standing behind the claim is the provider's own
   * word. Self-attested routes still earn points, but they can never carry an
   * application on their own — see `MINIMUM_VERIFIABLE_POINTS`.
   */
  selfAttested: boolean;
  /** What a reviewer has to do before this route counts. */
  reviewAction: string;
};

export const COMPETENCY_ROUTES: readonly CompetencyRoute[] = [
  {
    code: "parts_house_commercial_account",
    label: "Commercial account with a parts supplier",
    labelEs: "Cuenta comercial con un proveedor de repuestos",
    points: 3,
    selfAttested: false,
    reviewAction: "Confirm the account exists and is in the provider's business name.",
  },
  {
    code: "customer_references",
    label: "Reachable customer references",
    labelEs: "Referencias de clientes que contesten",
    points: 3,
    selfAttested: false,
    reviewAction: "Phone at least two references and record that they confirmed the work.",
  },
  {
    code: "prior_invoices",
    label: "Prior invoices for the same kind of work",
    labelEs: "Facturas anteriores del mismo tipo de trabajo",
    points: 2,
    selfAttested: false,
    reviewAction: "Check the invoices name the provider and cover this service.",
  },
  {
    code: "public_review_history",
    label: "Public review history under the business name",
    labelEs: "Historial público de reseñas a nombre del negocio",
    points: 2,
    selfAttested: false,
    reviewAction: "Open the listing and confirm it is the same business, with dated reviews.",
  },
  {
    code: "documented_job_photos",
    label: "Dated photos of completed jobs",
    labelEs: "Fotos fechadas de trabajos terminados",
    points: 2,
    selfAttested: false,
    reviewAction: "Confirm the photos show this service and carry usable dates.",
  },
  {
    code: "issued_credential",
    label: "Certificate or credential from a training program",
    labelEs: "Certificado o credencial de un programa de capacitación",
    points: 2,
    selfAttested: false,
    reviewAction: "Confirm the credential with the issuing program for this exact person.",
  },
  {
    code: "work_history_attestation",
    label: "Signed work history",
    labelEs: "Historial de trabajo firmado",
    points: 2,
    selfAttested: true,
    reviewAction: "No action required to count; spot-check per WORK_HISTORY_AUDIT_RATE.",
  },
  {
    code: "tooling_photos",
    label: "Photos of the tools and vehicle setup",
    labelEs: "Fotos de las herramientas y del vehículo de trabajo",
    points: 1,
    selfAttested: false,
    reviewAction: "Confirm the tooling shown can actually perform this service.",
  },
];

const ROUTES_BY_CODE = new Map(COMPETENCY_ROUTES.map((route) => [route.code, route]));

export function isCompetencyRouteCode(value: string): value is CompetencyRouteCode {
  return ROUTES_BY_CODE.has(value as CompetencyRouteCode);
}

export function competencyRoute(code: CompetencyRouteCode) {
  const route = ROUTES_BY_CODE.get(code);
  if (!route) throw new Error(`Unknown competency route: ${code}`);
  return route;
}

/**
 * Points needed per provider level.
 *
 * `provisional_independent` sits lowest on purpose: it is the entry lane, its
 * service list is deliberately limited to simple work, and it is the tier the
 * probation window is built for. Raising it would close the on-ramp the
 * provisional tier exists to be.
 */
export const REQUIRED_POINTS_BY_LEVEL: Record<ProviderLevel, number> = {
  learning_account: 0,
  sponsored_trainee: 0,
  provisional_independent: 3,
  standard_provider: 5,
  specialty_provider: 5,
};

/**
 * At least this many points must come from routes somebody other than the
 * applicant stands behind. A signed work history is worth 2, so on its own it
 * can never clear any real tier — which is the point.
 */
export const MINIMUM_VERIFIABLE_POINTS = 2;

/**
 * Stated years of hands-on work required per level, counted for the service
 * being applied for rather than across a career. Ten years of roadside work
 * says nothing about air-conditioning service.
 *
 * Provisional is 0 for the same reason its point threshold is lowest. Changing
 * any of these is a one-line policy decision, not a code change.
 */
export const REQUIRED_YEARS_BY_LEVEL: Record<ProviderLevel, number> = {
  learning_account: 0,
  sponsored_trainee: 0,
  provisional_independent: 0,
  standard_provider: 2,
  specialty_provider: 2,
};

/** Share of signed work histories to spot-check. An unchecked attestation is decoration. */
export const WORK_HISTORY_AUDIT_RATE = 0.2;

export type CompetencyClaim = {
  route: CompetencyRouteCode;
  /**
   * Verifiable routes count only once a reviewer has confirmed them. A
   * self-attested route counts as soon as it is signed, so callers pass true
   * for it at signature time.
   */
  verified: boolean;
};

export type CompetencyAssessmentInput = {
  serviceCode: ServiceCode;
  providerLevel: ProviderLevel;
  claims: readonly CompetencyClaim[];
  /** Years the provider stated for this service's kind of work. */
  statedYearsForService: number;
  /** Whether a current signed work history exists at all. */
  workHistorySigned: boolean;
};

export type CompetencyAssessment = {
  serviceCode: ServiceCode;
  providerLevel: ProviderLevel;
  totalPoints: number;
  verifiablePoints: number;
  requiredPoints: number;
  requiredYears: number;
  statedYearsForService: number;
  /** True when a reviewer may accept the competency evidence for this service. */
  acceptable: boolean;
  /** Everything still standing between this provider and acceptance. */
  shortfalls: readonly string[];
  /**
   * True when every counted route is the provider's own word. Never show a
   * customer a "verified" badge in this state.
   */
  selfAttestedOnly: boolean;
};

/**
 * Score one service. Unknown or duplicate route codes are ignored rather than
 * thrown on, so a stale stored claim can never block a reviewer.
 */
export function assessCompetency(
  input: CompetencyAssessmentInput,
): CompetencyAssessment {
  const requiredPoints = REQUIRED_POINTS_BY_LEVEL[input.providerLevel] ?? 0;
  const requiredYears = REQUIRED_YEARS_BY_LEVEL[input.providerLevel] ?? 0;

  const counted = new Map<CompetencyRouteCode, CompetencyRoute>();
  for (const claim of input.claims) {
    if (!claim.verified) continue;
    const route = ROUTES_BY_CODE.get(claim.route);
    if (!route) continue;
    counted.set(route.code, route);
  }

  let totalPoints = 0;
  let verifiablePoints = 0;
  for (const route of counted.values()) {
    totalPoints += route.points;
    if (!route.selfAttested) verifiablePoints += route.points;
  }

  const shortfalls: string[] = [];
  if (requiredPoints > 0 && !input.workHistorySigned) {
    shortfalls.push("A signed work history is required before competency can be accepted.");
  }
  if (totalPoints < requiredPoints) {
    shortfalls.push(
      `${requiredPoints - totalPoints} more competency point(s) needed for this tier.`,
    );
  }
  if (requiredPoints > 0 && verifiablePoints < MINIMUM_VERIFIABLE_POINTS) {
    shortfalls.push(
      "At least one route confirmed by someone other than the applicant is required.",
    );
  }
  if (input.statedYearsForService < requiredYears) {
    shortfalls.push(
      `This tier asks for ${requiredYears} year(s) of this kind of work; ${
        input.statedYearsForService
      } stated.`,
    );
  }

  return {
    serviceCode: input.serviceCode,
    providerLevel: input.providerLevel,
    totalPoints,
    verifiablePoints,
    requiredPoints,
    requiredYears,
    statedYearsForService: input.statedYearsForService,
    acceptable: shortfalls.length === 0,
    shortfalls,
    selfAttestedOnly: totalPoints > 0 && verifiablePoints === 0,
  };
}

/**
 * Deterministic audit selection. Same provider always gets the same answer, so
 * a reviewer cannot reroll until an application escapes the spot-check, and a
 * provider cannot resubmit to dodge one.
 */
export function workHistoryNeedsAudit(
  providerId: string,
  rate = WORK_HISTORY_AUDIT_RATE,
): boolean {
  if (rate <= 0) return false;
  if (rate >= 1) return true;
  let hash = 2166136261;
  for (let index = 0; index < providerId.length; index += 1) {
    hash ^= providerId.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 1000) / 1000 < rate;
}
