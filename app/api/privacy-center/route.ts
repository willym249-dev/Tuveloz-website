import { env } from "cloudflare:workers";
import { getAccountSession, providerAccountFor } from "../../../lib/account-auth";
import {
  sendMarketplaceUpdateEmail,
} from "../../../lib/email-notifications";
import { notifyMarketplaceAccount } from "../../../lib/marketplace-notifications";
import { isSameOriginRequest } from "../../../lib/request-security";

type AccountRole = "customer" | "provider";
type PrivacyRequestType =
  | "access"
  | "correction"
  | "account-closure"
  | "limit-processing"
  | "opt-out"
  | "appeal";

type PreferenceRow = {
  email: string;
  role: AccountRole;
  marketingEmail: string;
  productUpdateEmail: string;
  optionalReminderEmail: string;
  updatedAt: string;
};

type PrivacyRequestRow = {
  id: string;
  requestType: PrivacyRequestType;
  relatedRequestId: string;
  details: string;
  status: "submitted" | "in-review" | "completed" | "denied" | "withdrawn";
  resolutionNote: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string;
};

type RuntimeEnvironment = Record<string, string | undefined>;

const REQUEST_TYPES = new Set<PrivacyRequestType>([
  "access",
  "correction",
  "account-closure",
  "limit-processing",
  "opt-out",
  "appeal",
]);

function text(value: unknown, maximum: number) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function yesNo(value: unknown) {
  return value === true || value === "yes" ? "yes" : "no";
}

function cleanEmail(value: string) {
  return value.trim().toLowerCase();
}

async function signedInAccount(request: Request) {
  const session = await getAccountSession(request);
  if (!session || (session.role !== "customer" && session.role !== "provider")) return null;
  if (session.role === "provider" && !(await providerAccountFor(session.email))) return null;
  return {
    email: cleanEmail(session.email),
    role: session.role as AccountRole,
  };
}

async function ensurePreferences(email: string, role: AccountRole) {
  await env.DB.prepare(
    `INSERT OR IGNORE INTO account_communication_preferences
       (email, role, marketing_email, product_update_email, optional_reminder_email,
        created_at, updated_at)
     VALUES (?, ?, 'no', 'no', 'yes', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
  ).bind(email, role).run();
}

async function responseData(email: string, role: AccountRole) {
  await ensurePreferences(email, role);
  const [preferences, requestsResult] = await Promise.all([
    env.DB.prepare(
      `SELECT email, role,
              marketing_email AS marketingEmail,
              product_update_email AS productUpdateEmail,
              optional_reminder_email AS optionalReminderEmail,
              updated_at AS updatedAt
         FROM account_communication_preferences
        WHERE lower(email) = lower(?) AND role = ?
        LIMIT 1`,
    ).bind(email, role).first<PreferenceRow>(),
    env.DB.prepare(
      `SELECT id,
              request_type AS requestType,
              related_request_id AS relatedRequestId,
              details,
              status,
              resolution_note AS resolutionNote,
              created_at AS createdAt,
              updated_at AS updatedAt,
              resolved_at AS resolvedAt
         FROM privacy_requests
        WHERE lower(email) = lower(?) AND role = ?
        ORDER BY datetime(created_at) DESC
        LIMIT 100`,
    ).bind(email, role).all<PrivacyRequestRow>(),
  ]);

  return {
    role,
    email,
    preferences: {
      marketingEmail: preferences?.marketingEmail === "yes",
      productUpdateEmail: preferences?.productUpdateEmail === "yes",
      optionalReminderEmail: preferences?.optionalReminderEmail !== "no",
      essentialTransactionalEmail: true,
      securityEmail: true,
      updatedAt: preferences?.updatedAt ?? "",
    },
    requests: requestsResult.results ?? [],
    immediateTools: {
      dataExport: "/api/privacy-center/export",
      profileCorrection: role === "customer" ? "/customer?view=settings" : "/provider-jobs",
    },
    notices: [
      "Essential account-security, payment, appointment, authorization, and active-job messages remain enabled because they help protect the account and complete requested marketplace activity.",
      "An account-closure request does not instantly erase transaction, authorization, safety, fraud-prevention, tax, accounting, dispute, or other records that Tuveloz may need or be permitted to retain.",
      "Tuveloz does not sell personal information or use it for cross-site behavioral advertising.",
    ],
  };
}

export async function GET(request: Request) {
  const account = await signedInAccount(request);
  if (!account) {
    return Response.json(
      { error: "Sign in to your Tuveloz account to use the privacy center." },
      { status: 401, headers: { "cache-control": "private, no-store" } },
    );
  }
  return Response.json(
    await responseData(account.email, account.role),
    { headers: { "cache-control": "private, no-store" } },
  );
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "This privacy action must come from Tuveloz." }, { status: 403 });
  }
  const account = await signedInAccount(request);
  if (!account) {
    return Response.json({ error: "Sign in to manage privacy choices." }, { status: 401 });
  }

  try {
    const body = await request.json() as Record<string, unknown>;
    const action = text(body.action, 40);
    await ensurePreferences(account.email, account.role);

    if (action === "save-preferences") {
      await env.DB.prepare(
        `UPDATE account_communication_preferences
            SET marketing_email = ?,
                product_update_email = ?,
                optional_reminder_email = ?,
                updated_at = CURRENT_TIMESTAMP
          WHERE lower(email) = lower(?) AND role = ?`,
      ).bind(
        yesNo(body.marketingEmail),
        yesNo(body.productUpdateEmail),
        yesNo(body.optionalReminderEmail),
        account.email,
        account.role,
      ).run();
      return Response.json({
        ok: true,
        ...(await responseData(account.email, account.role)),
      });
    }

    if (action === "withdraw-request") {
      const id = text(body.id, 100);
      if (!id) throw new Error("Choose a privacy request to withdraw.");
      const result = await env.DB.prepare(
        `UPDATE privacy_requests
            SET status = 'withdrawn',
                resolution_note = 'Withdrawn by the signed-in account holder.',
                resolved_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
            AND lower(email) = lower(?)
            AND role = ?
            AND status IN ('submitted','in-review')`,
      ).bind(id, account.email, account.role).run();
      if ((result.meta?.changes ?? 0) === 0) {
        throw new Error("That request is no longer available to withdraw.");
      }
      return Response.json({
        ok: true,
        ...(await responseData(account.email, account.role)),
      });
    }

    if (action !== "submit-request") {
      return Response.json({ error: "Unknown privacy-center action." }, { status: 400 });
    }

    const requestType = text(body.requestType, 40) as PrivacyRequestType;
    const details = text(body.details, 2000);
    const relatedRequestId = text(body.relatedRequestId, 100);
    if (!REQUEST_TYPES.has(requestType)) {
      return Response.json({ error: "Choose a listed privacy request." }, { status: 400 });
    }
    if ((requestType === "correction" || requestType === "appeal") && details.length < 10) {
      return Response.json(
        { error: "Explain what should be corrected or why the earlier decision should be reviewed." },
        { status: 400 },
      );
    }
    if (requestType === "appeal") {
      if (!relatedRequestId) {
        return Response.json({ error: "Choose the earlier privacy request being appealed." }, { status: 400 });
      }
      const earlier = await env.DB.prepare(
        `SELECT id, status FROM privacy_requests
          WHERE id = ? AND lower(email) = lower(?) AND role = ? LIMIT 1`,
      ).bind(relatedRequestId, account.email, account.role).first<{ id: string; status: string }>();
      if (!earlier || !new Set(["denied", "completed"]).has(earlier.status)) {
        return Response.json(
          { error: "An appeal must identify a completed or denied privacy request from this account." },
          { status: 409 },
        );
      }
    }

    const existing = await env.DB.prepare(
      `SELECT id FROM privacy_requests
        WHERE lower(email) = lower(?)
          AND role = ?
          AND request_type = ?
          AND status IN ('submitted','in-review')
        LIMIT 1`,
    ).bind(account.email, account.role, requestType).first<{ id: string }>();
    if (existing) {
      return Response.json(
        { error: "This account already has an active request of that type." },
        { status: 409 },
      );
    }

    const id = crypto.randomUUID();
    const completedImmediately = requestType === "opt-out";
    if (completedImmediately) {
      await env.DB.prepare(
        `UPDATE account_communication_preferences
            SET marketing_email = 'no',
                product_update_email = 'no',
                updated_at = CURRENT_TIMESTAMP
          WHERE lower(email) = lower(?) AND role = ?`,
      ).bind(account.email, account.role).run();
    }

    await env.DB.prepare(
      `INSERT INTO privacy_requests
         (id, email, role, request_type, related_request_id, details, status,
          identity_source, resolution_note, created_at, updated_at, resolved_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'signed-in-account', ?,
               CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
               CASE WHEN ? = 'completed' THEN CURRENT_TIMESTAMP ELSE '' END)`,
    ).bind(
      id,
      account.email,
      account.role,
      requestType,
      relatedRequestId,
      details,
      completedImmediately ? "completed" : "submitted",
      completedImmediately
        ? "Marketing and optional product-update email choices were turned off immediately."
        : "",
      completedImmediately ? "completed" : "submitted",
    ).run();

    await notifyMarketplaceAccount({
      eventKey: `privacy-request:${id}:${account.role}`,
      email: account.email,
      role: account.role,
      title: completedImmediately ? "Privacy choice updated" : "Privacy request received",
      body: completedImmediately
        ? "Marketing and optional product-update emails are turned off. Essential account and active-job messages remain enabled."
        : "Tuveloz received your signed-in privacy request. Its status is available in the privacy center.",
      href: "/privacy-center",
    });

    await sendMarketplaceUpdateEmail({
      eventKey: `privacy-confirmation:${id}`,
      recipientEmail: account.email,
      subject: completedImmediately ? "Your Tuveloz privacy choice was updated" : "Tuveloz privacy request received",
      lines: [
        completedImmediately
          ? "Your marketing and optional product-update email choices were turned off."
          : "Tuveloz received a privacy request from your signed-in account.",
        `Request type: ${requestType}`,
        `Request ID: ${id}`,
        "Essential account-security and active marketplace transaction messages remain enabled.",
        "Open the privacy center: https://tuveloz.com/privacy-center",
      ],
    });

    if (!completedImmediately) {
      const runtime = env as unknown as RuntimeEnvironment;
      await sendMarketplaceUpdateEmail({
        eventKey: `privacy-owner-review:${id}`,
        recipientEmail: cleanEmail(runtime.OWNER_EMAIL ?? "hello@tuveloz.com"),
        subject: "New Tuveloz privacy request",
        lines: [
          "A signed-in Tuveloz account submitted a privacy request.",
          `Request ID: ${id}`,
          `Account role: ${account.role}`,
          `Request type: ${requestType}`,
          "Review it only in the protected owner privacy workspace:",
          "https://tuveloz.com/admin/privacy",
        ],
      });
    }

    return Response.json({
      ok: true,
      requestId: id,
      ...(await responseData(account.email, account.role)),
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update privacy choices.";
    return Response.json({ error: message }, { status: 400 });
  }
}
