// File references are review candidates, not ownership or erasure authority.
// These static predicates use the existing closure subject/providers/jobs CTEs.
const email = (column: string) => `lower(trim(${column})) IN (SELECT lower(trim(email)) FROM subject)`;
const provider = "provider_id IN (SELECT id FROM providers)";
const job = "request_id IN (SELECT id FROM jobs)";
export const PRIVACY_FILE_SOURCES = [
  { table: "provider_evidence_submissions", column: "storage_key", label: "Provider documents", scope: "business", where: provider },
  { table: "provider_profiles", column: "logo_image_key", label: "Provider logos", scope: "business", where: provider },
  { table: "provider_gallery_items", column: "image_key", label: "Provider gallery photos", scope: "business", where: provider },
  { table: "customer_requests", column: "issue_image_key", label: "Vehicle issue photos", scope: "shared-job", where: "id IN (SELECT id FROM jobs)" },
  { table: "customer_requests", column: "completion_image_key", label: "Job completion photos", scope: "shared-job", where: "id IN (SELECT id FROM jobs)" },
  { table: "job_evidence_items", column: "image_key", label: "Job evidence photos", scope: "shared-job", where: `${job} OR ${email("customer_email")} OR ${email("provider_email")} OR ${email("uploaded_by_email")}` },
  { table: "job_messages", column: "image_key", label: "Message attachments", scope: "shared-message", where: `${email("sender_email")} OR ${email("recipient_email")}` },
  { table: "self_hosted_scan_jobs", column: "storage_key", label: "Scanner file references", scope: "scanner", where: provider },
] as const;

export const PRIVACY_FILE_REVIEW_LIMIT = 100;
// Include every known file-reference column when finding aliases. Never trim
// keys: object storage treats whitespace and case as part of the exact key.
const sourceSelect = (source: typeof PRIVACY_FILE_SOURCES[number]) => `SELECT '${source.table}' AS source, id AS record_id,
    '${source.column}' AS field, ${source.column} AS object_key,
    CASE WHEN (${source.where}) THEN 1 ELSE 0 END AS related
    FROM ${source.table} WHERE ${source.column} <> ''`;
// D1 permits fewer compound SELECT terms than desktop SQLite. Materialized
// groups keep each union within that limit, including after query flattening.
const fileGroups = Array.from({ length: Math.ceil(PRIVACY_FILE_SOURCES.length / 4) }, (_, index) =>
  `file_group_${index} AS MATERIALIZED (${PRIVACY_FILE_SOURCES.slice(index * 4, index * 4 + 4).map(sourceSelect).join(" UNION ALL ")})`);
export const PRIVACY_FILE_REVIEW_CTES = `
, ${fileGroups.join(",\n")}
, file_references AS MATERIALIZED (
  ${fileGroups.map((_, index) => `SELECT * FROM file_group_${index}`).join(" UNION ALL ")}
), related_files AS (
  SELECT * FROM file_references WHERE related = 1
    OR (source = 'self_hosted_scan_jobs' AND object_key IN
      (SELECT object_key FROM file_references WHERE related = 1))
), limited_files AS (
  SELECT * FROM related_files ORDER BY source, record_id, field LIMIT ${PRIVACY_FILE_REVIEW_LIMIT + 1}
)
`;
export const PRIVACY_FILE_REVIEW_ROW_SQL = `
UNION ALL SELECT 'fileReview', COALESCE((SELECT json_group_array(json_object(
  'source', selected.source, 'recordId', selected.record_id, 'field', selected.field,
  'objectKey', selected.object_key,
  'otherReferences', (SELECT count(*) FROM file_references other
    WHERE other.object_key = selected.object_key
      AND NOT (other.source = selected.source AND other.record_id = selected.record_id AND other.field = selected.field))
)) FROM limited_files selected), '[]')
`;

export type PrivacyFileReview = {
  mode: "references-only"; canExecute: false; coverageComplete: false;
  storageChecked: boolean; truncated: boolean; limit: number;
  storageCheck?: { startedAt: string; finishedAt: string; objectLimit: number };
  items: { source: string; recordId: string; field: string; label: string;
    scope: string; otherReferences: number; disposition: "needs-review";
    storage?: "found" | "missing" | "unavailable" | "not-checked" }[];
};

export function privacyFileReview(value: string | undefined): PrivacyFileReview {
  if (value === undefined) throw new Error("Missing file reference review");
  const rows: unknown = JSON.parse(value);
  if (!Array.isArray(rows) || rows.length > PRIVACY_FILE_REVIEW_LIMIT + 1) throw new Error("Invalid file reference review");
  const seen = new Set<string>();
  const items = rows.map(row => {
    const source = PRIVACY_FILE_SOURCES.find(item => item.table === row?.source && item.column === row?.field);
    if (!source || typeof row.recordId !== "string" || !row.recordId
      || typeof row.objectKey !== "string" || !row.objectKey
      || !Number.isSafeInteger(row.otherReferences) || row.otherReferences < 0) {
      throw new Error("Invalid file reference");
    }
    const identity = JSON.stringify([row.source, row.recordId, row.field]);
    if (seen.has(identity)) throw new Error("Duplicate file reference");
    seen.add(identity);
    // Keys remain only in the server-side snapshot hashed by privacyReviewToken.
    // Do not send paths, document bytes, download links or tokens to the client.
    return { source: source.table, recordId: row.recordId, field: source.column,
      label: source.label, scope: source.scope, otherReferences: row.otherReferences,
      disposition: "needs-review" as const };
  });
  return { mode: "references-only", canExecute: false, coverageComplete: false,
    storageChecked: false, truncated: items.length > PRIVACY_FILE_REVIEW_LIMIT,
    limit: PRIVACY_FILE_REVIEW_LIMIT, items: items.slice(0, PRIVACY_FILE_REVIEW_LIMIT) };
}
