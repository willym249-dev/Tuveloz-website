import { env } from "cloudflare:workers";
import { verifyOwnerRequest } from "../../../../../lib/owner-auth";
import { closurePreview, PRIVACY_CLOSURE_PREVIEW_SQL } from "../../../../../lib/privacy-closure-preview";
import { CLOSE_UNUSED_ACCOUNT_SQL, privacyReviewToken } from "../../../../../lib/privacy-access-closure";
import { isStrictSameOriginWriteRequest } from "../../../../../lib/request-security";

const headers = { "cache-control": "private, no-store" };
const reply = (error: string, status: number) => Response.json({ error }, { status, headers });
const text = (value: unknown) => typeof value === "string" ? value.trim() : "";

export async function POST(request: Request) {
  const owner = await verifyOwnerRequest(request);
  if (!owner.ok || !isStrictSameOriginWriteRequest(request)) {
    return reply("Signed owner access and a same-origin request are required.", 403);
  }
  try {
    const body = await request.json() as Record<string, unknown>;
    const id = text(body.id), caseReference = text(body.caseReference), reviewAfter = text(body.reviewAfter);
    const retentionNotes = text(body.retentionNotes), reviewToken = text(body.reviewToken);
    if (!id || id.length > 100 || caseReference.length < 8 || caseReference.length > 200
      || retentionNotes.length < 20 || retentionNotes.length > 2000
      || !/^[a-f0-9]{64}$/.test(reviewToken) || body.confirmWholeAccount !== true
      || body.confirmIdentityAndAuthority !== true || body.confirmRetainedDataReview !== true
      || !/^\d{4}-\d{2}-\d{2}$/.test(reviewAfter)
      || !Number.isFinite(Date.parse(`${reviewAfter}T23:59:59Z`))
      || new Date(`${reviewAfter}T23:59:59Z`).toISOString().slice(0, 10) !== reviewAfter
      || Date.parse(`${reviewAfter}T23:59:59Z`) <= Date.now()) {
      return reply("Confirm the whole-account scope and verified case, and record a future data-review date and clear retention notes.", 400);
    }
    const reviewer = owner.email;
    if (!reviewer) return reply("The verified owner identity could not be recorded.", 403);

    const existing = await env.DB.prepare(
      `SELECT closure.privacy_request_id AS requestId, closure.case_reference AS caseReference,
              review.scope, review.review_after AS reviewAfter, review.retention_notes AS retentionNotes,
              review.snapshot_digest AS snapshotDigest
         FROM account_closures closure JOIN privacy_access_closure_reviews review ON review.request_id = closure.privacy_request_id
        WHERE closure.privacy_request_id = ?`,
    ).bind(id).first<{ requestId: string; caseReference: string; scope: string; reviewAfter: string; retentionNotes: string; snapshotDigest: string }>();
    if (existing) {
      if (existing.caseReference !== caseReference || existing.reviewAfter !== reviewAfter
        || existing.retentionNotes !== retentionNotes || existing.snapshotDigest !== reviewToken) {
        return reply("Access was already closed using a different review record. Refresh the request queue.", 409);
      }
      return Response.json({ ok: true, accessClosed: true, alreadyClosed: true, privacyFulfillmentComplete: false }, { headers });
    }

    const result = await env.DB.prepare(PRIVACY_CLOSURE_PREVIEW_SQL).bind(id).all<{ item: string; value: string }>();
    const rows = result.results ?? [], preview = closurePreview(rows);
    if (!preview) return reply("Privacy request not found.", 404);
    if (preview.request.requestType !== "account-closure" || !["submitted", "in-review"].includes(preview.request.status)
      || !preview.accessClosureAllowed || await privacyReviewToken(rows) !== reviewToken) {
      return reply("This review changed or needs a separate process for jobs, payments, holds or shared business access. Refresh the account review.", 409);
    }
    const state = JSON.parse(rows.find(row => row.item === "reviewState")!.value) as {
      email: string; role: string; status: string; updatedAt: string; details: string; resolutionNote: string; identitySource: string;
    };
    if (state.identitySource !== "signed-in-account") return reply("Verified case ownership is required.", 409);
    const results = await env.DB.batch([
      env.DB.prepare(CLOSE_UNUSED_ACCOUNT_SQL).bind(id, caseReference, reviewAfter,
        state.email, state.role, state.status, state.updatedAt, state.details, state.resolutionNote),
      env.DB.prepare(
        `INSERT INTO privacy_access_closure_reviews
           (request_id, reviewed_by, scope, case_reference, review_after, retention_notes, snapshot_digest)
         SELECT privacy_request_id, ?, 'whole-account-access', case_reference, review_after, ?, ?
           FROM account_closures WHERE changes() = 1 AND privacy_request_id = ? AND case_reference = ? AND review_after = ?
         ON CONFLICT(request_id) DO NOTHING`,
      ).bind(reviewer, retentionNotes, reviewToken, id, caseReference, reviewAfter),
    ]);
    // D1 includes trigger-driven session/code revocations in the first count.
    // SQL changes() above still checks the one direct closure insert; the
    // separate audit insert must also succeed exactly once.
    if ((results[0].meta?.changes ?? 0) < 1 || (results[1].meta?.changes ?? 0) !== 1) {
      return reply("The request changed or access was closed by another review. Refresh the request queue.", 409);
    }
    return Response.json({ ok: true, accessClosed: true, alreadyClosed: false, privacyFulfillmentComplete: false }, { headers });
  } catch {
    return reply("Access closure could not be confirmed. Refresh the request queue before retrying.", 503);
  }
}
