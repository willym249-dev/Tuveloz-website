import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { launchUpdateSubscribers } from "../../../../db/schema";

/**
 * One-click unsubscribe. No sign-in, no confirmation step, no "are you sure" —
 * the link in the email works on the first click, which is both the legal
 * expectation for commercial mail and the decent thing to do.
 *
 * GET is deliberate: mail clients follow links with GET, and List-Unsubscribe
 * handling expects it.
 */
function page(title: string, message: string) {
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8">`
    + `<meta name="viewport" content="width=device-width,initial-scale=1">`
    + `<meta name="robots" content="noindex">`
    + `<title>${title} — Tuveloz</title>`
    + `<style>body{background:#050505;color:#f7f3ef;font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;`
    + `display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px}`
    + `main{max-width:480px}h1{font-size:24px;margin:0 0 12px}p{color:#b3a79d;margin:0 0 18px}`
    + `a{color:#ff8a2a}</style></head><body><main>`
    + `<h1>${title}</h1><p>${message}</p>`
    + `<p><a href="https://tuveloz.com">Return to tuveloz.com</a></p>`
    + `</main></body></html>`,
    { status: 200, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token")?.trim() ?? "";
  if (!token) {
    return page("Link incomplete", "That unsubscribe link is missing its code. Reply to any Tuveloz email and we'll remove you by hand.");
  }
  try {
    const db = getDb();
    const [subscriber] = await db.select({
      email: launchUpdateSubscribers.email,
      unsubscribedAt: launchUpdateSubscribers.unsubscribedAt,
    }).from(launchUpdateSubscribers)
      .where(eq(launchUpdateSubscribers.unsubscribeToken, token))
      .limit(1);

    // An unknown token and an already-unsubscribed address get the same
    // answer: the address is not going to receive anything. Saying "no such
    // subscriber" would turn this into a way to test whether an address is on
    // the list.
    if (!subscriber) {
      return page("You're unsubscribed", "This address will not receive Tuveloz launch updates.");
    }
    if (!subscriber.unsubscribedAt) {
      await db.update(launchUpdateSubscribers).set({
        unsubscribedAt: new Date().toISOString(),
      }).where(eq(launchUpdateSubscribers.email, subscriber.email));
    }
    return page(
      "You're unsubscribed",
      "You won't receive Tuveloz launch updates again. Emails about an account or an application you started are separate and are not affected.",
    );
  } catch (error) {
    console.error("Unable to process a launch update unsubscribe", error);
    return page("Something went wrong", "We couldn't complete that just now. Email hello@tuveloz.com and we'll remove you by hand.");
  }
}

/** Some clients POST the List-Unsubscribe URL instead of following it. */
export async function POST(request: Request) {
  return GET(request);
}
