import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "../../../../db";
import { customerRequests } from "../../../../db/schema";
import { isSameOriginRequest } from "../../../../lib/account-auth";
import { isVerifiedOwnerRequest } from "../../../../lib/owner-auth";
import { sendMatchingProviderAlerts } from "../../../../lib/provider-alerts";
import {
  marketplacePausedMessage,
} from "../../../../lib/launch-status";
import { runtimeMarketplaceActionAllowed } from "../../../../lib/runtime-marketplace-action";

function marketplacePausedResponse() {
  return Response.json(
    {
      error: marketplacePausedMessage("discovery"),
      code: "MARKETPLACE_ONBOARDING_ONLY",
    },
    {
      status: 503,
      headers: { "cache-control": "no-store", "retry-after": "86400" },
    },
  );
}

export async function POST(request: Request) {
  if (!(await isVerifiedOwnerRequest(request))) {
    return Response.json({ error: "Owner access required." }, { status: 403 });
  }
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Cross-origin owner actions are not allowed." }, { status: 403 });
  }
  const body = (await request.json()) as { id?: string; status?: string; action?: string };
  if (!body.id) {
    return Response.json({ error: "Invalid request update." }, { status: 400 });
  }

  if (body.action === "mark-test") {
    return Response.json({
      error: "A real customer submission cannot be converted into a test fixture. Test jobs must originate as isolated synthetic records with no real customer or provider data.",
      code: "REAL_RECORD_TEST_CONVERSION_DISABLED",
    }, { status: 409, headers: { "cache-control": "no-store" } });
  }

  if (!["approved", "declined"].includes(body.status ?? "")) {
    return Response.json({ error: "Invalid request update." }, { status: 400 });
  }

  const [job] = await getDb().select({ isTestJob: customerRequests.isTestJob })
    .from(customerRequests)
    .where(eq(customerRequests.id, body.id))
    .limit(1);
  if (!job) {
    return Response.json({ error: "Customer request not found." }, { status: 404 });
  }
  if (body.status === "approved" && job.isTestJob !== "yes") {
    return Response.json({
      error: "Real exact-service requests are decided automatically when submitted. Owner approval cannot substitute for documented mandatory requirements, exact-operation insurance approval, service activation, and current provider eligibility.",
      code: "REAL_REQUESTS_AUTO_DECIDED",
    }, { status: 409, headers: { "cache-control": "no-store" } });
  }
  if (
    body.status === "approved"
    && !(await runtimeMarketplaceActionAllowed("discovery", { testOnly: job.isTestJob === "yes" }))
  ) {
    return marketplacePausedResponse();
  }

  const approvedAt = body.status === "approved" ? new Date().toISOString() : "";
  const updated = await getDb()
    .update(customerRequests)
    .set({
      status: body.status,
      ...(approvedAt ? { approvedAt } : {}),
    })
    .where(and(
      eq(customerRequests.id, body.id),
      body.status === "declined"
        ? inArray(customerRequests.status, ["new", "approved"])
        : eq(customerRequests.status, "new"),
    ))
    .returning({ id: customerRequests.id });
  if (updated.length === 0) {
    return Response.json({
      error: body.status === "declined"
        ? "This request is no longer open or eligible for an owner safety decline."
        : "This isolated test request was already reviewed.",
    }, { status: 409 });
  }
  if (body.status === "approved") {
    const alerts = await sendMatchingProviderAlerts(body.id);
    return Response.json({ ok: true, alerts, approvedAt });
  }
  return Response.json({ ok: true, alerts: null });
}
