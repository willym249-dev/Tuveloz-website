import {
  isAccountRole,
  isSameOriginRequest,
  switchAccountRole,
} from "../../../../lib/account-auth";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const body = (await request.json()) as { role?: unknown };
  if (!isAccountRole(body.role)) {
    return Response.json({ error: "Choose a valid workspace." }, { status: 400 });
  }

  try {
    const result = await switchAccountRole(request, body.role);
    if (!result) {
      return Response.json({ error: "That workspace is not available for this account." }, { status: 403 });
    }
    return Response.json(result, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("Unable to switch a Tuveloz account role", error);
    return Response.json({ error: "Unable to switch workspaces right now." }, { status: 503 });
  }
}
