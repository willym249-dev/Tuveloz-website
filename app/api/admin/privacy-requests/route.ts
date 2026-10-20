import { env } from "cloudflare:workers";
import { sendMarketplaceUpdateEmail } from "../../../../lib/email-notifications";
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

async function reviewVersion(row: PrivacyRequestRow) {
  const snapshot = JSON.stringify([
    row.id, row.email, row.role, row.requestType, row.relatedRequestId, row.details,
    row.status, row.identitySource, row.resolutionNote, row.createdAt, row.updatedAt, row.resolvedAt,
  ]);
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(snapshot));
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("");
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
  return Promise.all((result.results ?? []).map(async row => ({ ...row, reviewVersion: await reviewVersion(row) })));
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

  let saveAttempted = false;
  let decisionSaved = false;
  try {
    const body = await request.json() as Record<string, unknown>;
    const id = text(body.id, 100);
    const status = text(body.status, 30) as PrivacyStatus;
    const resolutionNote = text(body.resolutionNote, 2000);
    const expectedVersion = typeof body.reviewVersion === "string" ? body.reviewVersion : "";
    if (!id || !REVIEW_STATUSES.has(status)) {
      return Response.json({ error: "Choose a valid request and review status." }, { status: 400 });
    }
    if ((status === "completed" || status === "denied") && resolutionNote.length < 10) {
      return Response.json(
        { error: "Record a clear customer-facing explanation before completing or denying the request." },
        { status: 400 },
      );
    }
    if (!/^[a-f0-9]{64}$/.test(expectedVersion)) {
      return Response.json({ error: "Refresh the privacy request before saving your review." },
        { status: 409, headers: { "cache-control": "private, no-store" } });
    }

    const current = await env.DB.prepare(
      `SELECT id, email, role,
              request_type AS requestType,
              related_request_id AS relatedRequestId, details, status,
              identity_source AS identitySource, resolution_note AS resolutionNote,
              created_at AS createdAt, updated_at AS updatedAt, resolved_at AS resolvedAt
         FROM privacy_requests
        WHERE id = ? LIMIT 1`,
    ).bind(id).first<PrivacyRequestRow>();
    if (!current) return Response.json({ error: "Privacy request not found." }, { status: 404 });
    if (current.status === "withdrawn") {
      return Response.json({ error: "A withdrawn request cannot be reopened from this review screen." }, { status: 409 });
    }
    if (current.status === "completed" || current.status === "denied") {
      return Response.json(
        { error: "This decision is final. Record a correction or appeal as a new request linked to the original." },
        { status: 409, headers: { "cache-control": "private, no-store" } },
      );
    }
    if (await reviewVersion(current) !== expectedVersion) {
      return Response.json(
        { error: "This privacy request changed while you were reviewing it. Refresh the page before saving another decision." },
        { status: 409, headers: { "cache-control": "private, no-store" } },
      );
    }

    const reviewer = getAuthenticatedEmail(request);
    const ownerRecord = resolutionNote
      ? `${resolutionNote}\n\nOwner reviewer: ${reviewer}`
      : `Review opened by ${reviewer}.`;
    const statusLabel = status === "in-review"
      ? "is now being reviewed"
      : status === "completed"
        ? "was completed"
        : "was denied";
    const email = {
      eventKey: `privacy-status-email:${id}:${status}`,
      recipientEmail: current.email.trim().toLowerCase(),
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
    };
    // D1 batch executes these statements as one transaction. Each insert is
    // gated by the exact reviewed row, before the update changes that row.
    // A stale review queues nothing; any SQL failure rolls everything back.
    // Final decisions cannot be edited again, so their notices must be durable
    // in the same transaction, not queued after the decision has committed.
    const reviewedRow = `id = ? AND status = ? AND email = ? AND role = ?
      AND request_type = ? AND related_request_id = ? AND details = ?
      AND identity_source = ? AND resolution_note = ? AND created_at = ?
      AND updated_at = ? AND resolved_at = ?`;
    const reviewedValues = [
      id, current.status, current.email, current.role, current.requestType,
      current.relatedRequestId, current.details, current.identitySource,
      current.resolutionNote, current.createdAt, current.updatedAt, current.resolvedAt,
    ];
    saveAttempted = true;
    const results = await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO account_notifications (id, event_key, email, role, title, body, href)
         SELECT ?, ?, ?, ?, ?, ?, ? FROM privacy_requests WHERE ${reviewedRow}
         ON CONFLICT(event_key) DO NOTHING`,
      ).bind(
        crypto.randomUUID(), `privacy-owner-status:${id}:${status}`, email.recipientEmail,
        current.role, `Privacy request ${status.replaceAll("-", " ")}`,
        `Your ${current.requestType.replaceAll("-", " ")} privacy request ${statusLabel}. Open the privacy center for the recorded explanation.`,
        "/privacy-center", ...reviewedValues,
      ),
      env.DB.prepare(
        `INSERT INTO email_notification_outbox (id, event_key, recipient_email, subject, text_body)
         SELECT ?, ?, ?, ?, ? FROM privacy_requests WHERE ${reviewedRow}
         ON CONFLICT(event_key) DO NOTHING`,
      ).bind(
        crypto.randomUUID(), `marketplace:${email.eventKey}`, email.recipientEmail,
        email.subject, email.lines.join("\n"), ...reviewedValues,
      ),
      env.DB.prepare(
        `UPDATE privacy_requests
            SET status = ?, resolution_note = ?, updated_at = CURRENT_TIMESTAMP,
                resolved_at = CASE WHEN ? IN ('completed','denied') THEN CURRENT_TIMESTAMP ELSE '' END
          WHERE ${reviewedRow}`,
      ).bind(status, ownerRecord, status, ...reviewedValues),
    ]);
    if ((results[2]?.meta?.changes ?? 0) !== 1) {
      return Response.json(
        { error: "This privacy request changed while you were reviewing it. Refresh the page before saving another decision." },
        { status: 409, headers: { "cache-control": "private, no-store" } },
      );
    }
    decisionSaved = true;

    // Delivery is best effort after commit. The existing event key reuses the
    // durable outbox row; scheduled retries can recover an interrupted request.
    // Saving a decision does not establish inbox delivery.
    try {
      await sendMarketplaceUpdateEmail(email);
    } catch (error) {
      console.error("Privacy decision saved; email remains queued", error);
    }

    return Response.json({ ok: true, requests: await requestRows() });
  } catch (error) {
    console.error("Unable to update privacy request", error);
    return Response.json(
      { error: decisionSaved
        ? "Your decision was saved and its notifications were queued, but the request list could not refresh. Reload the page to see the saved decision."
        : saveAttempted
          ? "Unable to confirm whether your review was saved. Refresh the page before trying again."
          : "Unable to update the privacy request." },
      { status: decisionSaved ? 409 : 400, headers: { "cache-control": "private, no-store" } },
    );
  }
}
