import {
  isAccountRole,
  isSameOriginRequest,
  isValidAccountEmail,
  normalizeAccountEmail,
  requestAccountCode,
} from "../../../../lib/account-auth";

const GENERIC_MESSAGE = "If that email is eligible for this workspace, a sign-in code is on its way.";
const RATE_LIMITED_MESSAGE =
  "Too many codes were requested for this email. Please wait 15 minutes and try again.";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const body = (await request.json()) as { email?: unknown; role?: unknown };
  const email = normalizeAccountEmail(body.email);
  if (!isValidAccountEmail(email) || !isAccountRole(body.role)) {
    return Response.json({ error: "Enter a valid email and choose a workspace." }, { status: 400 });
  }

  try {
    const result = await requestAccountCode(email, body.role);
    // Distinguishable for the same reason as the password request route: the
    // throttle is consumed ahead of the eligibility lookup.
    if ("rateLimited" in result && result.rateLimited === true) {
      return Response.json(
        { error: RATE_LIMITED_MESSAGE },
        { status: 429, headers: { "cache-control": "no-store" } },
      );
    }
    return Response.json(
      { ok: true, message: GENERIC_MESSAGE },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    console.error("Unable to request a Tuveloz sign-in code", error);
    return Response.json({
      error: "Sign-in email is temporarily unavailable. Please try again later.",
    }, { status: 503 });
  }
}
