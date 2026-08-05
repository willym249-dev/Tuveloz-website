import {
  accountHasPassword,
  accountPasswordMatches,
  getAccountSession,
  isSameOriginRequest,
} from "../../../../lib/account-auth";
import {
  accountPhoneMasked,
  confirmPhoneChange,
  phoneSignInIsLive,
  requestPhoneChangeCode,
} from "../../../../lib/phone-auth";

const REQUEST_GENERIC_MESSAGE =
  "If that number can be used, a verification code is on its way.";

export async function GET(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const session = await getAccountSession(request);
  if (!session) {
    return Response.json(
      { error: "Sign in to manage your phone number." },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  }
  return Response.json({
    phone: await accountPhoneMasked(session.email),
    available: phoneSignInIsLive(),
    hasPassword: await accountHasPassword(session.email),
  }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const session = await getAccountSession(request);
  if (!session) {
    return Response.json(
      { error: "Sign in to manage your phone number." },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  }

  const body = (await request.json()) as {
    action?: unknown;
    phone?: unknown;
    code?: unknown;
    password?: unknown;
  };

  try {
    if (body.action === "request") {
      // Step-up re-authentication: adding or changing a phone number requires
      // re-confirming the account password, even on an already-signed-in
      // session. Accounts without a password must set one first.
      if (!(await accountHasPassword(session.email))) {
        return Response.json({
          error: "Add a password to your account before enabling text sign-in.",
        }, { status: 409, headers: { "cache-control": "no-store" } });
      }
      const password = typeof body.password === "string" ? body.password : "";
      if (!password || !(await accountPasswordMatches(session.email, password))) {
        return Response.json(
          { error: "That password is incorrect." },
          { status: 401, headers: { "cache-control": "no-store" } },
        );
      }
      const result = await requestPhoneChangeCode(session.email, body.phone);
      if (!result.ok && result.reason === "invalid_phone") {
        return Response.json(
          { error: "Enter a valid U.S. mobile number." },
          { status: 400, headers: { "cache-control": "no-store" } },
        );
      }
      // A rate-limited request returns the same generic success as an accepted
      // one so a caller cannot probe which numbers are in use.
      return Response.json(
        { ok: true, message: REQUEST_GENERIC_MESSAGE },
        { headers: { "cache-control": "no-store" } },
      );
    }

    if (body.action === "confirm") {
      const result = await confirmPhoneChange(
        session.email,
        session.role,
        body.phone,
        body.code,
      );
      if (!result.ok) {
        return Response.json(
          { error: "That code is invalid or expired." },
          { status: 401, headers: { "cache-control": "no-store" } },
        );
      }
      return Response.json(
        { ok: true, message: "Phone number verified for text sign-in." },
        { headers: { "cache-control": "no-store" } },
      );
    }

    return Response.json(
      { error: "Unknown phone action." },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    console.error("Unable to update a Tuveloz phone number", error);
    return Response.json(
      { error: "Phone management is temporarily unavailable. Please try again later." },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
