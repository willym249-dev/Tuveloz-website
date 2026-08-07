import { revokeMarketingSmsConsent } from "../../../lib/phone-contact-consent";

const NO_STORE = { "cache-control": "no-store" } as const;

/**
 * Stops promotional texts for a stored consent record.
 *
 * Deliberately easier to reach than the opt-in: no sign-in, no account
 * lookup, and the same answer whether or not the token matched, so the
 * endpoint cannot be used to test whether a token exists. Transactional
 * contact about someone's own job is unaffected — this revokes marketing.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const token = typeof body.token === "string" ? body.token : "";
    await revokeMarketingSmsConsent(token);
  } catch (error) {
    console.error("Unable to revoke marketing SMS consent", error);
    return Response.json(
      { error: "We could not update your text preferences. Please email hello@tuveloz.com." },
      { status: 500, headers: NO_STORE },
    );
  }
  return Response.json({ ok: true }, { headers: NO_STORE });
}
