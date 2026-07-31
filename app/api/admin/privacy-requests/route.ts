import { env } from "cloudflare:workers";
import { sendMarketplaceUpdateEmail } from "../../../../lib/email-notifications";
import { notifyMarketplaceAccount } from "../../../../lib/marketplace-notifications";
import {
  getAuthenticatedEmail,
  isVerifiedOwnerRequest,
} from "../../../../lib/owner-auth";
import { isSameOriginRequest } from "../../../../lib/request-security";

type PrivacyStatus = "submitted" | "in-review" | "completed" | "denied" | "withdrawn";
type AccountRole = "customer" | "provider";

type PrivacyRequestRow = {
  id: string;
  email: string;
  role: AccountRole;
  requestType: string;
  relatedRequestId: string;
  details: string;
  status: PrivacyStatus;
  identitySource: string;
  resolutionNote: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string;
};

const REVIEW_STATUSES = new Set<PrivacyStatus>(["in-review", "completed", "denied"]);

function text(value: unknown, maximum: number) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

async function requestRows() {
  const result = await env.DB.prepare(
    `SELECT id,
            email,
            role,
            request_type AS requestType,
            related_request_id AS relatedRequestId,
            details,
            status,
            identity_source AS identitySource,
            resolution_note AS resolutionNote,
            created_at AS createdAt,
            updated_at AS updatedAt,
            resolved_at AS resolvedAt
       FROM privacy_requests
      ORDER BY
        CASE status WHEN 'submitted' THEN 0 WHEN 'in-review' THEN 1 ELSE 2 END,
        datetime(created_at) ASC
      LIMIT 1000`,
  ).all<PrivacyRequestRow>();
  return result.results ?? [];
}

export async function GET(request: Request) {
  if (!(await isVerifiedOwnerRequest(request))) {
    return Response.json(
      { error: "Signed owner verification is required for privacy-request review." },
      { status: 403, headers: { "cache-control": "private, no-store" } },
    );
  }
  return Response.json(
    { requests: await requestRows() },
    { headers: { "cache-control": "private, no-store" } },
  );
}

export async function POST(request: Request) {
  if (!(await isVerifiedOwnerRequest(request))) {
    return Response.json({ error: "Owner access required." }, { status: 403 });
  }
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Cross-origin owner actions are not allowed." }, { status: 403 });
  }

  try {
    const body = await request.json() as Record<string, unknown>;
    const id = text(body.id, 100);
    const status = text(body.status, 30) as PrivacyStatus;
    const resolutionNote = text(body.resolutionNote, 2000);
    if (!id || !REVIEW_STATUSES.has(status)) {
      return Response.json({ error: "Choose a valid request and review status." }, { status: 400 });
    }
    if ((status === "completed" || status === "denied") && resolutionNote.length < 10) {
      return Response.json(
        { error: "Record a clear customer-facing explanation before completing or denying the request." },
        { status: 400 },
      );
    }

    const current = await env.DB.prepare(
      `SELECT id, email, role,
              request_type AS requestType,
              status
         FROM privacy_requests
        WHERE id = ? LIMIT 1`,
    ).bind(id).first<{
      id: string;
      email: string;
      role: AccountRole;
      requestType: string;
      status: PrivacyStatus;
    }>();
    if (!current) return Response.json({ error: "Privacy request not found." }, { status: 404 });
    if (current.status === "withdrawn") {
      return Response.json({ error: "A withdrawn request cannot be reopened from this review screen." }, { status: 409 });
    }

    const reviewer = getAuthenticatedEmail(request);
    const ownerRecord = resolutionNote
      ? `${resolutionNote}\n\nOwner reviewer: ${reviewer}`
      : `Review opened by ${reviewer}.`;
    await env.DB.prepare(
      `UPDATE privacy_requests
          SET status = ?,
              resolution_note = ?,
              updated_at = CURRENT_TIMESTAMP,
              resolved_at = CASE WHEN ? IN ('completed','denied') THEN CURRENT_TIMESTAMP ELSE '' END
        WHERE id = ?`,
    ).bind(status, ownerRecord, status, id).run();

    const statusLabel = status === "in-review"
      ? "is now being reviewed"
      : status === "completed"
        ? "was completed"
        : "was denied";
    await notifyMarketplaceAccount({
      eventKey: `privacy-owner-status:${id}:${status}`,
      email: current.email,
      role: current.role,
      title: `Privacy request ${status.replaceAll("-", " ")}`,
      body: `Your ${current.requestType.replaceAll("-", " ")} privacy request ${statusLabel}. Open the privacy center for the recorded explanation.`,
      href: "/privacy-center",
    });
    await sendMarketplaceUpdateEmail({
      eventKey: `privacy-status-email:${id}:${status}`,
      recipientEmail: current.email,
      subject: `Tuveloz privacy request ${status.replaceAll("-", " ")}`,
      lines: [
        `Your ${current.requestType.replaceAll("-", " ")} privacy request ${statusLabel}.`,
        `Request ID: ${id}`,
        resolutionNote || "Tuveloz has started reviewing the request.",
        "Open the privacy center: https://tuveloz.com/privacy-center",
        status === "denied"
          ? "You may submit an appeal from the privacy center and identify this request."
          : "",
      ].filter(Boolean),
    });

    return Response.json({ ok: true, requests: await requestRows() });
  } catch (error) {
    console.error("Unable to update privacy request", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to update the privacy request." },
      { status: 400 },
    );
  }
}
