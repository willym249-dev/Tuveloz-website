import { isSameOriginRequest, sessionCookie } from "../../../../../lib/account-auth";
import { verifyPhoneSignInCode } from "../../../../../lib/phone-auth";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const body = (await request.json()) as {
    phone?: unknown;
    code?: unknown;
    role?: unknown;
  };
  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!/^\d{6}$/.test(code)) {
    return Response.json(
      { error: "Enter the 6-digit code from your text message." },
      { status: 400 },
    );
  }

  try {
    const result = await verifyPhoneSignInCode(body.phone, code, body.role);
    if (!result.ok) {
      return Response.json({
        error: "That code is invalid, expired, or not eligible for text sign-in.",
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
    console.error("Unable to verify a Tuveloz phone sign-in code", error);
    return Response.json({
      error: "Text sign-in is temporarily unavailable. Please try again later.",
    }, { status: 503 });
  }
}
