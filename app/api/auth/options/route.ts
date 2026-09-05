import { phoneSignInIsLive } from "../../../../lib/phone-auth";

// Public capability information only. No account lookup or credentials are
// returned, and a disabled/unconfigured sender must not be offered by the UI.
export async function GET() {
  return Response.json(
    { phoneSignIn: phoneSignInIsLive() },
    { headers: { "cache-control": "no-store" } },
  );
}
