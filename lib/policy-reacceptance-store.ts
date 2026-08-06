import { desc, sql } from "drizzle-orm";
import { getDb } from "../db";
import {
  accountCredentials,
  customerRequests,
  policyAcceptances,
  providerApplications,
} from "../db/schema";
import {
  POLICY_REACCEPTANCE_TEXT,
  policyAcceptanceStatus,
  policyBundleForRole,
  type PolicyAcceptanceStatus,
  type ReacceptanceRole,
} from "./policy-reacceptance";

/**
 * Collects every bundle version this email has ever affirmatively accepted:
 * the signup-time stamp on account credentials, the acceptance recorded with
 * each customer request or provider application, and any re-acceptance rows.
 * The status only asks whether the current documents are all covered, so an
 * account that already accepted the latest bundle through any of those paths
 * is never re-prompted.
 */
export async function policyAcceptanceStatusFor(
  email: string,
  role: ReacceptanceRole,
): Promise<PolicyAcceptanceStatus> {
  const lowered = email.toLowerCase();
  const [credentialRows, reacceptanceRows, requestRows, applicationRows] =
    await Promise.all([
      getDb().select({ bundle: accountCredentials.termsVersion })
        .from(accountCredentials)
        .where(sql`lower(${accountCredentials.email}) = ${lowered}`)
        .limit(1),
      getDb().select({ bundle: policyAcceptances.bundleVersion })
        .from(policyAcceptances)
        .where(sql`lower(${policyAcceptances.email}) = ${lowered}`)
        .orderBy(desc(policyAcceptances.id))
        .limit(50),
      getDb().select({ bundle: customerRequests.termsVersion })
        .from(customerRequests)
        .where(sql`lower(${customerRequests.email}) = ${lowered}`)
        .orderBy(desc(customerRequests.createdAt))
        .limit(10),
      getDb().select({ bundle: providerApplications.termsVersion })
        .from(providerApplications)
        .where(sql`lower(${providerApplications.email}) = ${lowered}`)
        .limit(5),
    ]);
  const acceptedBundles = [
    ...credentialRows,
    ...reacceptanceRows,
    ...requestRows,
    ...applicationRows,
  ].map((row) => row.bundle).filter(Boolean);
  return policyAcceptanceStatus(acceptedBundles, role);
}

export async function recordPolicyReacceptance(
  email: string,
  role: ReacceptanceRole,
) {
  const now = new Date().toISOString();
  await getDb().insert(policyAcceptances).values({
    email,
    role,
    bundleVersion: policyBundleForRole(role),
    acceptanceText: POLICY_REACCEPTANCE_TEXT,
    acceptedAt: now,
  });
  return policyAcceptanceStatusFor(email, role);
}
