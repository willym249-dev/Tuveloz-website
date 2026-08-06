import {
  getAccountSession,
  isSameOriginRequest,
} from "../../../../lib/account-auth";
import { policyAccepted } from "../../../../lib/policies";
import { recordPolicyReacceptance } from "../../../../lib/policy-reacceptance-store";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  }

  try {
    const session = await getAccountSession(request);
    if (!session) {
      return Response.json(
        { error: "Sign in to accept the updated policies." },
        { status: 401, headers: { "cache-control": "no-store" } },
      );
    }
    const body = (await request.json().catch(() => ({}))) as {
      accepted?: unknown;
    };
    // Acceptance must be an affirmative click in this request — it is never
    // inferred from continued use, a stored draft, or an earlier session.
    if (!policyAccepted(body.accepted)) {
      return Response.json(
        { error: "Select the agreement checkbox to accept the updated policies." },
        { status: 400, headers: { "cache-control": "no-store" } },
      );
    }
    const policyAcceptance = await recordPolicyReacceptance(
      session.email,
      session.role,
    );
    return Response.json(
      { ok: true, policyAcceptance },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    console.error("Unable to record a policy re-acceptance", error);
    return Response.json(
      { error: "Unable to record your acceptance right now." },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
