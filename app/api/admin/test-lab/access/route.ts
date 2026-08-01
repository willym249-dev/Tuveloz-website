import { env } from "cloudflare:workers";
import { isVerifiedOwnerRequest } from "../../../../../lib/owner-auth";

type RuntimeEnvironment = Record<string, string | undefined>;

export async function GET(request: Request) {
  if (!(await isVerifiedOwnerRequest(request))) {
    return Response.json(
      { error: "Signed owner verification is required for the Tuveloz Test Lab." },
      { status: 403, headers: { "cache-control": "private, no-store" } },
    );
  }

  const variables = env as unknown as RuntimeEnvironment;
  const environment = variables.APP_ENVIRONMENT?.trim().toLowerCase() === "staging"
    ? "staging"
    : "production";

  return Response.json(
    {
      ok: true,
      environment,
      stagingUrl: "https://staging.tuveloz.com",
      safeguards: {
        databaseWrites: false,
        realPayments: false,
        outboundEmail: false,
        providerNotifications: false,
      },
    },
    { headers: { "cache-control": "private, no-store" } },
  );
}
