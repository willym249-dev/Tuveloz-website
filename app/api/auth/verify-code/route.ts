import {
  isAccountRole,
  isSameOriginRequest,
  isValidAccountEmail,
  normalizeAccountEmail,
  sessionCookie,
  verifyAccountCode,
} from "../../../../lib/account-auth";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const body = (await request.json()) as {
    code?: unknown;
    email?: unknown;
    role?: unknown;
  };
  const email = normalizeAccountEmail(body.email);
  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!isValidAccountEmail(email) || !isAccountRole(body.role) || !/^\d{6}$/.test(code)) {
    return Response.json({ error: "Enter the 6-digit code from your email." }, { status: 400 });
  }

  try {
    const result = await verifyAccountCode(email, body.role, code);
    if (!result.ok) {
      return Response.json({
        error: "That code is invalid, expired, or not eligible for this workspace.",
      }, { status: 401, headers: { "cache-control": "no-store" } });
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
    console.error("Unable to verify a Tuveloz sign-in code", error);
    return Response.json({
      error: "Sign-in is temporarily unavailable. Please try again later.",
    }, { status: 503 });
  }
}
