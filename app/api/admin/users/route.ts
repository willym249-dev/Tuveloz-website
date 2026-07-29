import { sql } from "drizzle-orm";
import { getDb } from "../../../../db";
import { accountCredentials, authSessions } from "../../../../db/schema";
import {
  isSameOriginRequest,
  normalizeAccountEmail,
} from "../../../../lib/account-auth";
import { isVerifiedOwnerRequest } from "../../../../lib/owner-auth";

export async function POST(request: Request) {
  if (!(await isVerifiedOwnerRequest(request))) {
    return Response.json(
      { error: "This action is only available to the Tuveloz owner." },
      { status: 403, headers: { "cache-control": "no-store" } },
    );
  }
  if (!isSameOriginRequest(request)) {
    return Response.json(
      { error: "This owner action must come from Tuveloz." },
      { status: 403, headers: { "cache-control": "no-store" } },
    );
  }

  try {
    const body = await request.json() as { action?: unknown; email?: unknown };
    const email = normalizeAccountEmail(body.email);
    if (body.action !== "revoke-sessions" || !email) {
      return Response.json(
        { error: "Choose a valid account and session action." },
        { status: 400, headers: { "cache-control": "no-store" } },
      );
    }

    const db = getDb();
    const [account] = await db.select({ email: accountCredentials.email })
      .from(accountCredentials)
      .where(sql`lower(${accountCredentials.email}) = ${email}`)
      .limit(1);
    if (!account) {
      return Response.json(
        { error: "That verified sign-in account no longer exists." },
        { status: 404, headers: { "cache-control": "no-store" } },
      );
    }

    const sessions = await db.select({ email: authSessions.email })
      .from(authSessions)
      .where(sql`lower(${authSessions.email}) = ${email}`);
    await db.delete(authSessions)
      .where(sql`lower(${authSessions.email}) = ${email}`);

    return Response.json(
      { ok: true, revoked: sessions.length },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    console.error("Unable to revoke account sessions", error);
    return Response.json(
      { error: "Unable to sign this account out right now." },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }
}
