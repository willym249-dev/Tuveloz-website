import type { AuthErasureIntent } from "./privacy-erasure-recovery";

// Independent of R2 listing and of the restored snapshot. Read only from the
// current source binding while source writes are operationally paused. This
// does not establish binding provenance or implement that pause.
const catalogSql = `SELECT receipt.request_id AS requestId, closed.email,
  receipt.snapshot_digest AS snapshotDigest, receipt.approved_by AS approvedBy,
  receipt.case_reference AS caseReference, receipt.recovery_reference AS recoveryReference,
  closed.case_reference AS closureCaseReference, closed.closed_at AS closedAt,
  closed.review_after AS reviewAfter, receipt.scope
  FROM privacy_auth_erasure_records receipt
  LEFT JOIN account_closures closed ON closed.privacy_request_id = receipt.request_id
  ORDER BY receipt.request_id, closed.email LIMIT 101`;
const fields = ["requestId", "email", "snapshotDigest", "approvedBy", "caseReference",
  "recoveryReference", "closureCaseReference", "closedAt", "reviewAfter"] as const;
const problem = () => new Error("Current source and recovery catalog do not agree. Keep the restore isolated.");

function canonicalCatalog(intents: AuthErasureIntent[]) {
  if (intents.length > 100) throw problem();
  const ids = new Set<string>();
  const rows = intents.map(intent => {
    if (!intent || fields.some(field => typeof intent[field] !== "string" || !intent[field].trim())
      || ids.has(intent.requestId)) throw problem();
    ids.add(intent.requestId);
    return JSON.stringify(fields.map(field => intent[field]));
  });
  return JSON.stringify(rows.sort());
}

export function assertAuthenticationCatalogMatches(expected: AuthErasureIntent[], actual: AuthErasureIntent[]) {
  if (canonicalCatalog(expected) !== canonicalCatalog(actual)) throw problem();
}

export async function assertCurrentAuthenticationCatalog(source: D1Database, intents: AuthErasureIntent[]) {
  // Failure/unavailable source must not become an empty catalog. LEFT JOIN
  // deliberately exposes orphan receipts rather than silently omitting them.
  const result = await source.prepare(catalogSql).all<AuthErasureIntent & { scope: string }>();
  if (!result.success || !Array.isArray(result.results)
    || result.results.some(row => row.scope !== "authentication-records")) throw problem();
  assertAuthenticationCatalogMatches(result.results, intents);
}
