import { and, eq } from "drizzle-orm";
import { getDb } from "../db";
import {
  customerAgreementAcceptances,
  jobScopeVersions,
} from "../db/schema";
import {
  CUSTOMER_REQUEST_AGREEMENT_KEY,
  CUSTOMER_REQUEST_SCOPE_VERSION,
  customerRequestScopeSnapshot,
  parseCustomerRequestScopeSnapshot,
  type CustomerRequestScope,
} from "./customer-job-scope";
import { acceptedCustomerRequestConsent } from "./customer-job-consent";
import {
  jobScopeFactsFromScopeDetails,
  type JobScopeFacts,
} from "./job-scope-facts";

export async function loadCurrentAcceptedCustomerRequestScope(
  requestId: string,
  customerEmail = "",
): Promise<CustomerRequestScope | null> {
  const acceptances = await getDb().select().from(customerAgreementAcceptances)
    .where(and(
      eq(customerAgreementAcceptances.requestId, requestId),
      eq(customerAgreementAcceptances.quoteId, ""),
      eq(
        customerAgreementAcceptances.scopeVersion,
        CUSTOMER_REQUEST_SCOPE_VERSION,
      ),
    ));
  for (const requestAcceptance of acceptances.filter((acceptance) => (
    acceptance.agreementKey === CUSTOMER_REQUEST_AGREEMENT_KEY
    && Boolean(acceptance.acceptedAt)
    && (!customerEmail || acceptance.customerEmail === customerEmail)
  ))) {
    const scope = parseCustomerRequestScopeSnapshot(requestAcceptance.scopeSnapshot);
    if (!scope || scope.requestId !== requestId) continue;
    const canonicalSnapshot = customerRequestScopeSnapshot(scope);
    if (canonicalSnapshot !== requestAcceptance.scopeSnapshot) continue;
    if (await acceptedCustomerRequestConsent(acceptances, canonicalSnapshot, requestAcceptance.customerEmail)) return scope;
  }
  return null;
}

export async function loadAuthorizedJobScopeFacts(
  requestId: string,
  scopeVersion: number,
): Promise<JobScopeFacts | null> {
  if (!requestId || !Number.isInteger(scopeVersion) || scopeVersion < 1) {
    return null;
  }
  const [scope] = await getDb().select({
    scopeDetails: jobScopeVersions.scopeDetails,
  }).from(jobScopeVersions).where(and(
    eq(jobScopeVersions.requestId, requestId),
    eq(jobScopeVersions.version, scopeVersion),
  )).limit(1);
  return scope ? jobScopeFactsFromScopeDetails(scope.scopeDetails) : null;
}
