export type PrivacyAccountSession = {
  email: string;
  role: string;
  availableRoles?: readonly string[];
};

export type PrivacyScope = "customer" | "provider";

export type PrivacyProviderApplication = {
  id: string;
  email: string;
  status?: string;
  verificationStatus?: string;
};

function normalizedEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

/**
 * Privacy rights follow application ownership, not marketplace eligibility.
 * Status and verification state are intentionally irrelevant: pending,
 * blocked, and declined applicants keep access to their own privacy tools.
 */
export function ownedProviderApplicationForPrivacy(
  session: PrivacyAccountSession | null | undefined,
  application: PrivacyProviderApplication | null | undefined,
) {
  if (
    !session
    || (session.role !== "customer" && session.role !== "provider")
    || !application?.id
  ) return null;
  const sessionEmail = normalizedEmail(session.email);
  const applicationEmail = normalizedEmail(application.email);
  if (!sessionEmail || sessionEmail !== applicationEmail) return null;
  return {
    email: sessionEmail,
    providerId: application.id,
  };
}

/**
 * Resolves a privacy-only data scope. Provider scope is granted by exact
 * application ownership and never changes the session's marketplace role.
 */
export function privacyAccountAccessFor(
  session: PrivacyAccountSession | null | undefined,
  application: PrivacyProviderApplication | null | undefined,
  requestedScope?: PrivacyScope,
) {
  if (!session || (session.role !== "customer" && session.role !== "provider")) {
    return null;
  }
  const email = normalizedEmail(session.email);
  if (!email) return null;

  const authenticatedRoles = new Set(session.availableRoles ?? [session.role]);
  const ownership = ownedProviderApplicationForPrivacy(session, application);
  const availablePrivacyScopes: PrivacyScope[] = [];
  if (authenticatedRoles.has("customer")) availablePrivacyScopes.push("customer");
  if (ownership) availablePrivacyScopes.push("provider");

  const activeScope = requestedScope ?? session.role;
  if (
    (activeScope !== "customer" && activeScope !== "provider")
    || !availablePrivacyScopes.includes(activeScope)
  ) return null;

  if (activeScope === "provider") {
    if (!ownership) return null;
    return {
      ...ownership,
      role: "provider" as const,
      availablePrivacyScopes,
    };
  }
  return {
    email,
    role: "customer" as const,
    availablePrivacyScopes,
  };
}

/** Undefined means no scope was requested; null means an invalid request. */
export function parsePrivacyScope(values: readonly string[]) {
  if (values.length === 0) return undefined;
  if (values.length !== 1) return null;
  return values[0] === "customer" || values[0] === "provider"
    ? values[0] as PrivacyScope
    : null;
}
