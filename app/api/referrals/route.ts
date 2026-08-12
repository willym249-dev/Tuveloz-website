import { getAccountSession } from "../../../lib/account-auth";
import {
  isReferralRole,
  referralCodeFor,
  referralSignupCount,
} from "../../../lib/referrals";

const NO_STORE = { "cache-control": "no-store" } as const;
const BASE_URL = "https://tuveloz.com";

/**
 * The signed-in account's share code and how many signups it has been
 * credited with. Deliberately returns a count and nothing else: a referrer
 * never learns who signed up.
 */
export async function GET(request: Request) {
  const session = await getAccountSession(request);
  if (!session) {
    return Response.json(
      { error: "Sign in to see your share link." },
      { status: 401, headers: NO_STORE },
    );
  }
  if (!isReferralRole(session.role)) {
    return Response.json(
      { error: "Share links are available to customer and provider accounts." },
      { status: 403, headers: NO_STORE },
    );
  }

  try {
    const [record, signupCount] = await Promise.all([
      referralCodeFor(session.role, session.email),
      referralSignupCount(session.role, session.email),
    ]);
    const path = session.role === "provider" ? "/join" : "/";
    return Response.json({
      role: session.role,
      code: record.code,
      shareUrl: `${BASE_URL}${path}?ref=${record.code}`,
      signupCount,
    }, { headers: NO_STORE });
  } catch (error) {
    console.error("Unable to load a referral code", error);
    return Response.json(
      { error: "We could not load your share link." },
      { status: 500, headers: NO_STORE },
    );
  }
}
