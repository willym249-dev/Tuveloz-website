import {
  completePasswordVerification,
  isAccountRole,
  isPasswordPurpose,
  isSameOriginRequest,
  isValidAccountEmail,
  normalizeAccountEmail,
  passwordValidationError,
  sessionCookie,
} from "../../../../../lib/account-auth";
import { policyAccepted } from "../../../../../lib/policies";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const body = (await request.json()) as {
    code?: unknown;
    email?: unknown;
    password?: unknown;
    purpose?: unknown;
    role?: unknown;
    termsAccepted?: unknown;
  };
  const email = normalizeAccountEmail(body.email);
  const code = typeof body.code === "string" ? body.code.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const passwordError = passwordValidationError(password);
  if (
    !isValidAccountEmail(email)
    || !isAccountRole(body.role)
    || !isPasswordPurpose(body.purpose)
    || !/^\d{6}$/.test(code)
  ) {
    return Response.json(
      { error: "Enter the 6-digit code from your email." },
      { status: 400 },
    );
  }
  if (passwordError) {
    return Response.json({ error: passwordError }, { status: 400 });
  }
  const acceptedTerms = policyAccepted(body.termsAccepted);
  if (body.purpose === "create" && !acceptedTerms) {
    return Response.json(
      { error: "Agree to the Terms, role agreement, and Privacy Policy to create an account." },
      { status: 400 },
    );
  }

  try {
    const result = await completePasswordVerification(
      email,
      body.role,
      body.purpose,
      code,
      password,
      acceptedTerms,
    );
    if (!result.ok) {
      return Response.json(
        { error: "That code is invalid, expired, or cannot be used for this workspace." },
        { status: 401, headers: { "cache-control": "no-store" } },
      );
    }
    const response = Response.json({
      ok: true,
      role: result.role,
      availableRoles: result.roles,
      destination: result.destination,
    }, { headers: { "cache-control": "no-store" } });
    response.headers.append("set-cookie", sessionCookie(request, result.token));
    return response;
  } catch (error) {
    console.error("Unable to finish Tuveloz password verification", error);
    return Response.json(
      { error: "Account setup is temporarily unavailable. Please try again later." },
      { status: 503 },
    );
  }
}
