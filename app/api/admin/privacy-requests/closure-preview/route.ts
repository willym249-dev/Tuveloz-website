import { env } from "cloudflare:workers";
import { isVerifiedOwnerRequest } from "../../../../../lib/owner-auth";
import { closurePreview, PRIVACY_CLOSURE_PREVIEW_SQL } from "../../../../../lib/privacy-closure-preview";
import { isSameOriginRequest } from "../../../../../lib/request-security";
import { privacyReviewToken } from "../../../../../lib/privacy-access-closure";

const headers = { "cache-control": "private, no-store" };
export async function GET(request: Request) {
  if (!(await isVerifiedOwnerRequest(request)) || !isSameOriginRequest(request)) {
    return Response.json({ error: "Owner access required." }, { status: 403, headers });
  }
  const id = new URL(request.url).searchParams.get("id")?.trim();
  if (!id || id.length > 100) {
    return Response.json({ error: "Choose an account-closure request to review." }, { status: 400, headers });
  }
  try {
    const result = await env.DB.prepare(PRIVACY_CLOSURE_PREVIEW_SQL).bind(id).all<{ item: string; value: string }>();
    const preview = closurePreview(result.results ?? []);
    if (!preview) return Response.json({ error: "Privacy request not found." }, { status: 404, headers });
    if (preview.request.requestType !== "account-closure" || !["submitted", "in-review"].includes(preview.request.status)) {
      return Response.json({ error: "Only an open account-closure request can be previewed. Refresh the request queue." }, { status: 409, headers });
    }
    return Response.json({ preview: { ...preview, reviewToken: await privacyReviewToken(result.results ?? []) } }, { headers });
  } catch {
    return Response.json({ error: "The account review could not be loaded. Nothing was changed. Please try again." }, { status: 503, headers });
  }
}
