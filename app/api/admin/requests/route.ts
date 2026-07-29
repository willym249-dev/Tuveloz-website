import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { customerRequests } from "../../../../db/schema";
import { isOwnerRequest } from "../../../../lib/owner-auth";
import { sendMatchingProviderAlerts } from "../../../../lib/provider-alerts";

export async function POST(request: Request) {
  if (!isOwnerRequest(request)) {
    return Response.json({ error: "Owner access required." }, { status: 403 });
  }
  const body = (await request.json()) as { id?: string; status?: string; action?: string };
  if (!body.id) {
    return Response.json({ error: "Invalid request update." }, { status: 400 });
  }

  if (body.action === "create-link") {
    const accessToken = crypto.randomUUID();
    await getDb()
      .update(customerRequests)
      .set({ accessToken })
      .where(eq(customerRequests.id, body.id));
    return Response.json({ ok: true, accessToken });
  }

  if (body.action === "mark-test") {
    const updated = await getDb()
      .update(customerRequests)
      .set({ isTestJob: "yes" })
      .where(and(
        eq(customerRequests.id, body.id),
        eq(customerRequests.status, "new"),
      ))
      .returning({ id: customerRequests.id });
    if (updated.length === 0) {
      return Response.json({ error: "Only a new request can be marked as a test job." }, { status: 409 });
    }
    return Response.json({ ok: true, isTestJob: "yes" });
  }

  if (!["approved", "declined"].includes(body.status ?? "")) {
    return Response.json({ error: "Invalid request update." }, { status: 400 });
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
      eq(customerRequests.status, "new"),
    ))
    .returning({ id: customerRequests.id });
  if (updated.length === 0) {
    return Response.json({ error: "This request was already reviewed." }, { status: 409 });
  }
  if (body.status === "approved") {
    const alerts = await sendMatchingProviderAlerts(body.id);
    return Response.json({ ok: true, alerts, approvedAt });
  }
  return Response.json({ ok: true, alerts: null });
}
