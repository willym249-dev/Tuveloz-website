import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { isSameOriginRequest } from "../../../../../../lib/account-auth";
import {
  expiredPasskeyChallengeCookies,
  finishPasskeyRegistration,
} from "../../../../../../lib/passkeys";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  }

  try {
    const body = (await request.json()) as {
      response?: RegistrationResponseJSON;
    };
    if (!body.response) {
      return Response.json({ error: "Passkey response is missing." }, { status: 400 });
    }
    const result = await finishPasskeyRegistration(request, body.response);
    const response = result.ok
      ? Response.json(
          { ok: true },
          { headers: { "cache-control": "no-store" } },
        )
      : Response.json(
          { error: "This passkey could not be verified." },
          { status: 401, headers: { "cache-control": "no-store" } },
        );
    for (const cookie of expiredPasskeyChallengeCookies(request)) {
      response.headers.append("set-cookie", cookie);
    }
    return response;
  } catch (error) {
    console.error("Unable to finish Tuveloz passkey registration", error);
    const response = Response.json(
      { error: "Passkey setup is temporarily unavailable." },
      { status: 503 },
    );
    for (const cookie of expiredPasskeyChallengeCookies(request)) {
      response.headers.append("set-cookie", cookie);
    }
    return response;
  }
}
