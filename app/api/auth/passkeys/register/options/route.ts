import { isSameOriginRequest } from "../../../../../../lib/account-auth";
import { beginPasskeyRegistration } from "../../../../../../lib/passkeys";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  }

  try {
    const result = await beginPasskeyRegistration(request);
    if (!result) {
      return Response.json(
        { error: "Sign in before setting up a passkey." },
        { status: 401, headers: { "cache-control": "no-store" } },
      );
    }
    const response = Response.json(
      { options: result.options },
      { headers: { "cache-control": "no-store" } },
    );
    response.headers.append("set-cookie", result.cookie);
    return response;
  } catch (error) {
    console.error("Unable to begin Tuveloz passkey registration", error);
    return Response.json(
      { error: "Passkey setup is temporarily unavailable." },
      { status: 503 },
    );
  }
}
