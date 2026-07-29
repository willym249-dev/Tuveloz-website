import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import {
  isSameOriginRequest,
  sessionCookie,
} from "../../../../../../lib/account-auth";
import {
  expiredPasskeyChallengeCookies,
  finishPasskeyAuthentication,
} from "../../../../../../lib/passkeys";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  }

  try {
    const body = (await request.json()) as {
      response?: AuthenticationResponseJSON;
    };
    if (!body.response) {
      return Response.json({ error: "Passkey response is missing." }, { status: 400 });
    }
    const result = await finishPasskeyAuthentication(request, body.response);
    if (!result.ok) {
      const response = Response.json(
        { error: "That passkey could not sign you in." },
        { status: 401, headers: { "cache-control": "no-store" } },
      );
      for (const cookie of expiredPasskeyChallengeCookies(request)) {
        response.headers.append("set-cookie", cookie);
      }
      return response;
    }

    const response = Response.json({
      ok: true,
      role: result.role,
      availableRoles: result.roles,
      destination: result.destination,
    }, { headers: { "cache-control": "no-store" } });
    response.headers.append("set-cookie", sessionCookie(request, result.token));
    for (const cookie of expiredPasskeyChallengeCookies(request)) {
      response.headers.append("set-cookie", cookie);
    }
    return response;
  } catch (error) {
    console.error("Unable to finish Tuveloz passkey sign-in", error);
    const response = Response.json(
      { error: "Passkey sign-in is temporarily unavailable." },
      { status: 503 },
    );
    for (const cookie of expiredPasskeyChallengeCookies(request)) {
      response.headers.append("set-cookie", cookie);
    }
    return response;
  }
}
