import { isSameOriginRequest } from "../../../../../../lib/account-auth";
import { beginPasskeyAuthentication } from "../../../../../../lib/passkeys";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  }

  try {
    const result = await beginPasskeyAuthentication(request);
    const response = Response.json(
      { options: result.options },
      { headers: { "cache-control": "no-store" } },
    );
    response.headers.append("set-cookie", result.cookie);
    return response;
  } catch (error) {
    console.error("Unable to begin Tuveloz passkey sign-in", error);
    return Response.json(
      { error: "Passkey sign-in is temporarily unavailable." },
      { status: 503 },
    );
  }
}
