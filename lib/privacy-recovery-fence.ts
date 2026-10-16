import { verifyOwnerRequest } from "./owner-auth";
import { isStrictSameOriginWriteRequest } from "./request-security";

// Internal maintenance control, with no HTTP/UI caller. The append-only history
// prevents an old operation becoming valid again after pause/resume (ABA).
export type AuthenticationRecoveryFence = { generation: number; paused: number; caseReference: string };
export const AUTH_RECOVERY_GENERATION_SQL = "COALESCE((SELECT max(generation) FROM privacy_recovery_fences), 0)";
export async function readAuthenticationRecoveryFence(db: D1Database): Promise<AuthenticationRecoveryFence> {
  const row = await db.prepare(`SELECT ${AUTH_RECOVERY_GENERATION_SQL} AS generation,
    COALESCE((SELECT paused FROM privacy_recovery_fences ORDER BY generation DESC LIMIT 1), 0) AS paused,
    COALESCE((SELECT case_reference FROM privacy_recovery_fences ORDER BY generation DESC LIMIT 1), '') AS caseReference`)
    .first<AuthenticationRecoveryFence>();
  if (!row || !Number.isSafeInteger(row.generation) || row.generation < 0
    || ![0, 1].includes(row.paused) || typeof row.caseReference !== "string"
    || (row.generation > 0 && row.caseReference.trim().length < 8)) throw new Error("Recovery write state is unavailable.");
  return row;
}

export async function assertAuthenticationRecoveryFence(db: D1Database, expected: AuthenticationRecoveryFence) {
  const current = await readAuthenticationRecoveryFence(db);
  if (current.generation !== expected.generation || current.paused !== expected.paused
    || current.caseReference !== expected.caseReference) throw new Error("Recovery write state changed. Keep the restore isolated.");
}

export async function setAuthenticationRecoveryPause(request: Request, db: D1Database, input: {
  expectedGeneration: number; paused: boolean; caseReference: string; confirmMaintenance: boolean;
}) {
  const owner = await verifyOwnerRequest(request);
  if (!owner.ok || request.method !== "POST" || !isStrictSameOriginWriteRequest(request)) return { status: "forbidden" as const };
  if (!Number.isSafeInteger(input.expectedGeneration) || input.expectedGeneration < 0
    || input.expectedGeneration >= Number.MAX_SAFE_INTEGER || typeof input.paused !== "boolean"
    || input.confirmMaintenance !== true || typeof input.caseReference !== "string"
    || input.caseReference.trim().length < 8 || input.caseReference.length > 200) return { status: "invalid" as const };
  const current = await readAuthenticationRecoveryFence(db), caseReference = input.caseReference.trim();
  if (current.generation !== input.expectedGeneration || current.paused === Number(input.paused)
    || (!input.paused && current.caseReference !== caseReference)) return { status: "conflict" as const };
  const result = await db.prepare(`INSERT INTO privacy_recovery_fences
    (generation, paused, case_reference, changed_by)
    SELECT ?, ?, ?, ? WHERE ${AUTH_RECOVERY_GENERATION_SQL} = ?`)
    .bind(current.generation + 1, Number(input.paused), caseReference, owner.email, current.generation).run();
  if (!result.success || result.meta.changes !== 1) return { status: "conflict" as const };
  const expected = { generation: current.generation + 1, paused: Number(input.paused), caseReference };
  await assertAuthenticationRecoveryFence(db, expected);
  return { status: input.paused ? "paused" as const : "resumed" as const, generation: expected.generation,
    trafficMayOpen: false as const, deletionEnabled: false as const };
}
