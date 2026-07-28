import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { customerRequests } from "../../../db/schema";
import {
  getAccountSession,
  providerAccountFor,
} from "../../../lib/account-auth";

export async function GET(request: Request) {
  try {
    const session = await getAccountSession(request);
    if (!session) {
      return Response.json(
        { error: "Sign in to open your Tuveloz workspace." },
        { status: 401, headers: { "cache-control": "no-store" } },
      );
    }

    if (session.role === "customer") {
      const requests = await getDb().select({
        id: customerRequests.id,
        vehicle: customerRequests.vehicle,
        service: customerRequests.service,
        launchArea: customerRequests.launchArea,
        municipality: customerRequests.municipality,
        status: customerRequests.status,
        createdAt: customerRequests.createdAt,
      }).from(customerRequests)
        .where(eq(customerRequests.email, session.email))
        .orderBy(desc(customerRequests.createdAt))
        .limit(100);
      return Response.json({
        role: "customer",
        email: session.email,
        availableRoles: session.availableRoles,
        requests,
      }, { headers: { "cache-control": "no-store" } });
    }

    const provider = await providerAccountFor(session.email);
    if (!provider?.accessToken) {
      return Response.json(
        { error: "Verified provider access is no longer active." },
        { status: 403, headers: { "cache-control": "no-store" } },
      );
    }
    return Response.json({
      role: "provider",
      email: session.email,
      availableRoles: session.availableRoles,
      provider: {
        name: provider.name,
        accessToken: provider.accessToken,
        verificationStatus: provider.verificationStatus,
      },
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("Unable to load a Tuveloz account", error);
    return Response.json(
      { error: "Account access is temporarily unavailable." },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
