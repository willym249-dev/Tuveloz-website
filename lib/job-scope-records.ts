import { and, eq } from "drizzle-orm";
import { getDb } from "../db";
import {
  customerAgreementAcceptances,
  jobScopeVersions,
} from "../db/schema";
import {
  CUSTOMER_REQUEST_AGREEMENT_KEY,
  CUSTOMER_REQUEST_AGREEMENT_VERSION,
  CUSTOMER_REQUEST_PRIVACY_AGREEMENT_KEY,
  CUSTOMER_REQUEST_PRIVACY_AGREEMENT_VERSION,
  CUSTOMER_REQUEST_SCOPE_VERSION,
  customerRequestAgreementEvidenceText,
  customerRequestPrivacyAgreementEvidenceText,
  customerRequestScopedAgreementHash,
  customerRequestScopedPrivacyAgreementHash,
  customerRequestScopeSnapshot,
  parseCustomerRequestScopeSnapshot,
  type CustomerRequestScope,
} from "./customer-job-scope";
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
  const requestAcceptance = acceptances.find((acceptance) => (
    acceptance.agreementKey === CUSTOMER_REQUEST_AGREEMENT_KEY
    && acceptance.agreementVersion === CUSTOMER_REQUEST_AGREEMENT_VERSION
    && Boolean(acceptance.acceptedAt)
    && (!customerEmail || acceptance.customerEmail === customerEmail)
  ));
  if (!requestAcceptance) return null;
  const scope = parseCustomerRequestScopeSnapshot(
    requestAcceptance.scopeSnapshot,
  );
  if (!scope || scope.requestId !== requestId) return null;
  const canonicalSnapshot = customerRequestScopeSnapshot(scope);
  if (canonicalSnapshot !== requestAcceptance.scopeSnapshot) return null;
  const [agreementHash, privacyHash] = await Promise.all([
    customerRequestScopedAgreementHash(canonicalSnapshot),
    customerRequestScopedPrivacyAgreementHash(canonicalSnapshot),
  ]);
  if (
    requestAcceptance.agreementHash !== agreementHash
    || requestAcceptance.agreementText
      !== customerRequestAgreementEvidenceText(canonicalSnapshot)
  ) return null;
  const privacyAcceptance = acceptances.find((acceptance) => (
    acceptance.customerEmail === requestAcceptance.customerEmail
    && acceptance.agreementKey === CUSTOMER_REQUEST_PRIVACY_AGREEMENT_KEY
    && acceptance.agreementVersion === CUSTOMER_REQUEST_PRIVACY_AGREEMENT_VERSION
    && acceptance.agreementHash === privacyHash
    && acceptance.agreementText
      === customerRequestPrivacyAgreementEvidenceText(canonicalSnapshot)
    && acceptance.scopeSnapshot === canonicalSnapshot
    && Boolean(acceptance.acceptedAt)
  ));
  return privacyAcceptance ? scope : null;
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
