import {
  isAccountRole,
  isSameOriginRequest,
  isValidAccountEmail,
  normalizeAccountEmail,
  sessionCookie,
  signInWithPassword,
} from "../../../../lib/account-auth";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const body = (await request.json()) as {
    email?: unknown;
    password?: unknown;
    role?: unknown;
  };
  const email = normalizeAccountEmail(body.email);
  const password = typeof body.password === "string" ? body.password : "";
  if (
    !isValidAccountEmail(email)
    || !isAccountRole(body.role)
    || !password
    || Array.from(password).length > 128
  ) {
    return Response.json(
      { error: "Enter your email and password." },
      { status: 400 },
    );
  }

  try {
    const result = await signInWithPassword(email, body.role, password);
    if (!result.ok) {
      return Response.json(
        { error: "The email or password is incorrect, or this workspace is not available." },
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
    console.error("Unable to sign in with a Tuveloz password", error);
    return Response.json(
      { error: "Sign-in is temporarily unavailable. Please try again later." },
      { status: 503 },
    );
  }
}
