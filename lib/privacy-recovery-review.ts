import { AuthErasureRecoveryJournal } from "./privacy-erasure-recovery";
import { assertAuthenticationCatalogMatches, readCurrentAuthenticationCatalog } from "./privacy-erasure-catalog";

// Internal, read-only diagnostics. No HTTP route or production mutation caller.
// At most ten intents: two full journal reads use at most 40 object GETs,
// eight list calls and two D1 reads. Larger catalogs need reviewed batching.
// This cannot prove binding provenance, freshness, a write pause, or erasure.
export async function reviewAuthenticationRecovery(source: D1Database, journal: AuthErasureRecoveryJournal) {
  const entries = await journal.inspectIntents(10, 4);
  const intents = entries.map(entry => entry.intent);
  // Also rejects ambiguous attempts sharing a request ID.
  assertAuthenticationCatalogMatches(intents, intents);
  const receipts = await readCurrentAuthenticationCatalog(source);
  const byRequest = new Map(entries.map(entry => [entry.intent.requestId, entry]));
  for (const receipt of receipts) {
    const entry = byRequest.get(receipt.requestId);
    if (!entry) throw new Error("Recovery receipt has no matching signed intent. Keep deletion and restore traffic disabled.");
    assertAuthenticationCatalogMatches([receipt], [entry.intent]);
  }
  const receiptIds = new Set(receipts.map(receipt => receipt.requestId));
  const cases = entries.map(entry => {
    const hasReceipt = receiptIds.has(entry.intent.requestId);
    if (entry.state === "complete" && !hasReceipt) {
      throw new Error("Completed recovery evidence has no current source receipt. Keep deletion and restore traffic disabled.");
    }
    return { requestId: entry.intent.requestId, state: entry.state === "complete" ? "matched-completion" as const
      : hasReceipt ? "receipt-present-completion-missing" as const : "no-source-receipt" as const };
  });
  // An operation may finish while diagnostics are running. Discard this report
  // on observed source or journal movement; do not use it to resolve an intent.
  assertAuthenticationCatalogMatches(receipts, await readCurrentAuthenticationCatalog(source));
  const after = await journal.inspectIntents(10, 4);
  assertAuthenticationCatalogMatches(intents, after.map(entry => entry.intent));
  const states = (rows: typeof entries) => JSON.stringify(rows.map(row => [row.intent.requestId, row.state]).sort());
  if (states(entries) !== states(after)) throw new Error("Recovery evidence changed during review. Read it again before proceeding.");
  return { cases, unresolved: cases.filter(item => item.state !== "matched-completion").length,
    deletionEnabled: false as const, trafficMayOpen: false as const, requiresOperationalReview: true as const };
}
