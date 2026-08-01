export const SUPERSEDED_IDENTITY_CLEANUP_BATCH_MAX = 10;
export const SUPERSEDED_IDENTITY_CLEANUP_SCAN_MAX = 50;

export function supersededIdentityCleanupBatchLimit(limit: number) {
  return Math.max(
    1,
    Math.min(SUPERSEDED_IDENTITY_CLEANUP_BATCH_MAX, Math.trunc(limit) || 1),
  );
}

/**
 * Scan beyond the requested cancellation count so a few permanently skipped
 * rows cannot hide a later cancelable hosted session. Skipped rows are also
 * CAS-deferred by the recorder, so a queue larger than this cap progresses on
 * the next scheduled run.
 */
export function supersededIdentityCleanupScanLimit(batchLimit: number) {
  return Math.min(
    SUPERSEDED_IDENTITY_CLEANUP_SCAN_MAX,
    Math.max(10, supersededIdentityCleanupBatchLimit(batchLimit) * 5),
  );
}
