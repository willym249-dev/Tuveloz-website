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
    await requestPasswordVerification(email, body.role, body.purpose);
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
