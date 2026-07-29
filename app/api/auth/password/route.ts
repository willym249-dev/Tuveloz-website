import {
  isAccountRole,
  isSameOriginRequest,
  isValidAccountEmail,
  normalizeAccountEmail,
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
        {
          error: result.rateLimited
            ? "Too many sign-in codes were requested. Please wait 15 minutes and try again."
            : "The email or password is incorrect, or this workspace is not available.",
        },
        {
          status: result.rateLimited ? 429 : 401,
          headers: { "cache-control": "no-store" },
        },
      );
    }
    return Response.json({
      ok: true,
      challengeRequired: true,
      message: "Enter the 6-digit code sent to your email to finish signing in.",
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("Unable to sign in with a Tuveloz password", error);
    return Response.json(
      { error: "Sign-in is temporarily unavailable. Please try again later." },
      { status: 503 },
    );
  }
}
