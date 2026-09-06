CREATE TABLE self_hosted_scan_jobs (
  job_key TEXT PRIMARY KEY NOT NULL,
  id TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK(kind IN ('evidence', 'message')),
  target_id TEXT NOT NULL,
  evidence_id TEXT NOT NULL DEFAULT '',
  provider_id TEXT NOT NULL DEFAULT '',
  storage_key TEXT NOT NULL,
  content_type TEXT NOT NULL,
  file_hash TEXT NOT NULL DEFAULT '',
  byte_size INTEGER NOT NULL DEFAULT 0,
  lease_until TEXT NOT NULL,
  created_at TEXT NOT NULL,
  result_status TEXT NOT NULL DEFAULT '',
  result_digest TEXT NOT NULL DEFAULT '',
  report_json TEXT NOT NULL DEFAULT '',
  last_error TEXT NOT NULL DEFAULT ''
);
CREATE INDEX self_hosted_scan_jobs_lease_idx ON self_hosted_scan_jobs(result_status, lease_until);
