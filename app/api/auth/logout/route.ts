import {
  endAccountSession,
  expiredSessionCookies,
  isSameOriginRequest,
} from "../../../../lib/account-auth";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  }

  try {
    await endAccountSession(request);
  } catch (error) {
    console.error("Unable to remove a Tuveloz session", error);
  }
  const response = Response.json(
    { ok: true },
    { headers: { "cache-control": "no-store" } },
  );
  for (const cookie of expiredSessionCookies(request)) {
    response.headers.append("set-cookie", cookie);
  }
  return response;
}
