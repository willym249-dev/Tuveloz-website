import { isSameOriginRequest } from "../../../../../lib/account-auth";
import { requestPhoneSignInCode } from "../../../../../lib/phone-auth";

// Deliberately generic and identical whether or not the number is registered,
// eligible, or rate-limited, so the response cannot be used to enumerate which
// phone numbers have Tuveloz accounts.
const GENERIC_MESSAGE = "If that number can sign in to Tuveloz, a code is on its way.";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const body = (await request.json()) as { phone?: unknown };

  try {
    await requestPhoneSignInCode(body.phone);
    return Response.json(
      { ok: true, message: GENERIC_MESSAGE },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    console.error("Unable to request a Tuveloz phone sign-in code", error);
    return Response.json({
      error: "Text sign-in is temporarily unavailable. Please try again later.",
    }, { status: 503 });
  }
}
