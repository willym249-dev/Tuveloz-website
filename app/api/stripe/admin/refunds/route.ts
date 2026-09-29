import { isSameOriginRequest } from "../../../../../lib/account-auth";
import { verifyOwnerRequest } from "../../../../../lib/owner-auth";
import { executeApprovedFullRefund, FullRefundReviewError } from "../../../../../lib/stripe-full-refund";
import { stripeErrorResponse } from "../../../../../lib/stripe";

function response(body: unknown, status: number) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

// Status checks may reconcile an existing reservation, but can never start one.
export async function GET(request: Request) {
  const owner = await verifyOwnerRequest(request);
  if (!owner.ok) return response({ error: "Owner access required." }, 403);
  const params = new URL(request.url).searchParams;
  const id = params.get("adjustmentId");
  if (!id?.trim() || id.length > 120 || params.getAll("adjustmentId").length !== 1
    || [...params.keys()].some(key => key !== "adjustmentId")) return response({ error: "Choose one saved refund." }, 400);
  try {
    const refund = await executeApprovedFullRefund(id.trim(), owner.email, { reconcileOnly: true });
    return response(refund, refund.refundSucceeded ? 200 : 202);
  } catch (error) {
    if (error instanceof FullRefundReviewError) return response({ error: error.message }, error.status);
    return response({ error: "Unable to check the refund. Its saved reservation is unchanged." }, 503);
  }
}

export async function POST(request: Request) {
  const owner = await verifyOwnerRequest(request);
  if (!owner.ok) return response({ error: "Owner access required." }, 403);
  if (!isSameOriginRequest(request)) return response({ error: "Cross-origin refund requests are not allowed." }, 403);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.adjustmentId !== "string" || !body.adjustmentId.trim() || body.adjustmentId.length > 120
    || Object.keys(body).some(key => key !== "adjustmentId")) {
    return response({ error: "Choose one approved refund. Amounts are read from its saved payment." }, 400);
  }
  try {
    const refund = await executeApprovedFullRefund(body.adjustmentId.trim(), owner.email);
    return response(refund, refund.refundSucceeded ? 200 : 202);
  } catch (error) {
    if (error instanceof FullRefundReviewError) return response({ error: error.message }, error.status);
    const failure = stripeErrorResponse(error, "Unable to check this refund. Please try again.");
    failure.headers.set("cache-control", "no-store");
    return failure;
  }
}
