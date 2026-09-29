import { isSameOriginRequest } from "../../../../../lib/account-auth";
import { verifyOwnerRequest } from "../../../../../lib/owner-auth";
import { approveFullRefund, getRefundReview, listRefundReviews } from "../../../../../lib/stripe-refund-review";
import { FullRefundReviewError } from "../../../../../lib/stripe-full-refund";

function response(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}
function failure(error: unknown) {
  return error instanceof FullRefundReviewError ? response({ error: error.message }, error.status)
    : response({ error: "Unable to load or save this review. Refresh its saved status before trying again." }, 500);
}
function validId(value: unknown): value is string { return typeof value === "string" && value.trim().length > 0 && value.length <= 120; }

export async function GET(request: Request) {
  if (!(await verifyOwnerRequest(request)).ok) return response({ error: "Owner access required." }, 403);
  const params = new URL(request.url).searchParams;
  if ([...params.keys()].some(key => key !== "cancellationId") || params.getAll("cancellationId").length > 1
    || (params.has("cancellationId") && !validId(params.get("cancellationId")))) return response({ error: "Choose one cancellation to review." }, 400);
  try { return response(params.has("cancellationId") ? await getRefundReview(params.get("cancellationId")!.trim()) : await listRefundReviews()); }
  catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  const owner = await verifyOwnerRequest(request);
  if (!owner.ok) return response({ error: "Owner access required." }, 403);
  if (!isSameOriginRequest(request)) return response({ error: "Cross-origin refund reviews are not allowed." }, 403);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || !validId(body.cancellationId) || typeof body.reviewToken !== "string" || !/^[a-f0-9]{64}$/.test(body.reviewToken)
    || typeof body.reason !== "string" || body.reason.trim().length < 10 || body.reason.length > 1000 || body.confirmed !== true
    || Object.keys(body).some(key => !["cancellationId", "reviewToken", "reason", "confirmed"].includes(key))) {
    return response({ error: "Review the cancellation, add a reason (10–1,000 characters), and confirm the full refund. Amounts come from the saved payment." }, 400);
  }
  try { return response(await approveFullRefund({ cancellationId: body.cancellationId.trim(), reviewToken: body.reviewToken, reason: body.reason.trim() }, owner.email)); }
  catch (error) { return failure(error); }
}
