import { env } from "cloudflare:workers";
import { isVerifiedOwnerRequest } from "../../../../../lib/owner-auth";
import { closurePreview, PRIVACY_CLOSURE_PREVIEW_SQL } from "../../../../../lib/privacy-closure-preview";
import { isSameOriginRequest } from "../../../../../lib/request-security";
import { privacyReviewToken } from "../../../../../lib/privacy-access-closure";
import { checkPrivacyFileStorage } from "../../../../../lib/privacy-file-storage";

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
    const reviewToken = await privacyReviewToken(result.results ?? []);
    preview.files = await checkPrivacyFileStorage(result.results?.find(row => row.item === "fileReview")?.value, env.BUCKET);
    if (preview.files.items.length > 0) {
      // Reject an observed changed/withdrawn case or replaced reference while
      // metadata was being read. A storage check is still point-in-time only.
      const current = await env.DB.prepare(PRIVACY_CLOSURE_PREVIEW_SQL).bind(id).all<{ item: string; value: string }>();
      if (await privacyReviewToken(current.results ?? []) !== reviewToken) {
        return Response.json({ error: "The account records changed during the file check. Refresh the account review. Nothing was changed." }, { status: 409, headers });
      }
    }
    return Response.json({ preview: { ...preview, reviewToken } }, { headers });
  } catch {
    return Response.json({ error: "The account review could not be loaded. Nothing was changed. Please try again." }, { status: 503, headers });
  }
}
