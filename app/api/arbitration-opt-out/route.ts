import {
  isArbitrationOptOutRole,
  markArbitrationOptOutConfirmed,
  recordArbitrationOptOut,
} from "../../../lib/arbitration-opt-out";
import { sendArbitrationOptOutConfirmation } from "../../../lib/email-notifications";
import { consumeFixedWindow, rateLimitKeyHash } from "../../../lib/public-write-rate-limit";
import { isStrictSameOriginWriteRequest } from "../../../lib/request-security";

const NO_STORE = { "cache-control": "no-store" } as const;

const EMAIL_FALLBACK =
  "We could not record that. Email hello@tuveloz.com with the subject “Arbitration opt-out” and we'll record it by hand — the Terms accept either route, so your 30 days are not affected.";

/**
 * Records that someone is declining the arbitration agreement in section 13 of
 * the Terms of Use.
 *
 * Deliberately open: no sign-in, no account lookup, and no check that the
 * address belongs to anyone. The Terms promise that opting out costs nothing
 * and takes only an email address, so demanding proof of an account here would
 * make the page harder to use than the email route it is meant to replace.
 * Nothing is disclosed in return — the response is the same whether or not the
 * address exists anywhere else, so this cannot be used to test for accounts.
 *
 * The one thing that must not happen is a silent failure. If the write does
 * not land, the person is told to email instead, because someone who believes
 * they opted out and did not is worse off than someone who got an error.
 */
export async function POST(request: Request) {
  if (!isStrictSameOriginWriteRequest(request)) {
    return Response.json(
      { error: "This request could not be verified. Reload the page and try again." },
      { status: 403, headers: NO_STORE },
    );
  }

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const email = typeof body.email === "string"
    ? body.email.trim().toLowerCase().slice(0, 180)
    : "";
  const role = isArbitrationOptOutRole(body.role) ? body.role : "";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json(
      { error: "Enter the email address you use with Tuveloz." },
      { status: 400, headers: NO_STORE },
    );
  }

  try {
    const emailAllowed = await consumeFixedWindow(
      "arbitration-opt-out:email",
      await rateLimitKeyHash(email),
      5,
      60 * 60 * 1000,
    );
    const addressAllowed = await consumeFixedWindow(
      "arbitration-opt-out:ip",
      await rateLimitKeyHash(request.headers.get("cf-connecting-ip") ?? "unknown"),
      20,
      60 * 60 * 1000,
    );
    if (!emailAllowed || !addressAllowed) {
      return Response.json(
        { error: "Too many submissions from here just now. Please try again later, or email hello@tuveloz.com." },
        { status: 429, headers: NO_STORE },
      );
    }

    const result = await recordArbitrationOptOut({ email, role, method: "form" });

    // The opt-out is already valid. The confirmation is a promise we made
    // separately, so a mail failure is logged and never reported as a failure
    // to opt out.
    try {
      await sendArbitrationOptOutConfirmation({
        recipientEmail: email,
        termsVersion: result.termsVersion,
        recordedAt: result.recordedAt,
      });
      await markArbitrationOptOutConfirmed(result.id);
    } catch (error) {
      console.error("Unable to send an arbitration opt-out confirmation", error);
    }

    return Response.json(
      {
        ok: true,
        termsVersion: result.termsVersion,
        recordedAt: result.recordedAt,
        alreadyRecorded: result.status === "already_recorded",
      },
      { headers: NO_STORE },
    );
  } catch (error) {
    console.error("Unable to record an arbitration opt-out", error);
    return Response.json({ error: EMAIL_FALLBACK }, { status: 500, headers: NO_STORE });
  }
}
