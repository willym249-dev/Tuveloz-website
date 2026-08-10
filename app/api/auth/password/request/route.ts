import {
  isAccountRole,
  isPasswordPurpose,
  isSameOriginRequest,
  isValidAccountEmail,
  normalizeAccountEmail,
  requestPasswordVerification,
} from "../../../../../lib/account-auth";

const GENERIC_MESSAGE =
  "If that email is eligible, a verification code is on its way.";
const RATE_LIMITED_MESSAGE =
  "Too many codes were requested for this email. Please wait 15 minutes and try again.";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const body = (await request.json()) as {
    email?: unknown;
    purpose?: unknown;
    role?: unknown;
  };
  const email = normalizeAccountEmail(body.email);
  if (
    !isValidAccountEmail(email)
    || !isAccountRole(body.role)
    || !isPasswordPurpose(body.purpose)
  ) {
    return Response.json(
      { error: "Enter a valid email and choose a workspace." },
      { status: 400 },
    );
  }

  try {
    const result = await requestPasswordVerification(email, body.role, body.purpose);
    // Safe to distinguish: the throttle is consumed before any eligibility
    // lookup, so this fires identically for a real and an unknown address.
    // Silence here used to read as success and left people waiting on an email
    // that was never going to arrive.
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
    console.error("Unable to send a Tuveloz password verification code", error);
    return Response.json(
      { error: "Verification email is temporarily unavailable. Please try again later." },
      { status: 503 },
    );
  }
}
