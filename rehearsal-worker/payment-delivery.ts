import { env } from "cloudflare:workers";
import Stripe from "stripe";
import { POST } from "../app/api/stripe/webhooks/payments/route";

// Standalone, opt-in transport rehearsal. This is not imported by the site.
// Bind only a new, empty rehearsal D1 database with the receipt table. No
// production/staging database, R2 binding, routes, email or schedules belong here.
type RehearsalEnvironment = Record<string, string | undefined>;
const MAX_BODY_BYTES = 32 * 1024;
const WINDOW_MS = 60 * 60 * 1000;

function reply(status: number, message: string) {
  return Response.json({ error: message }, { status, headers: {
    "cache-control": "private, no-store",
    "x-robots-tag": "noindex, nofollow, noarchive",
  } });
}

async function boundedBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const next = await reader.read();
    if (next.done) break;
    size += next.value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(next.value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

const rehearsalWorker = {
  async fetch(request: Request): Promise<Response> {
    const runtime = env as unknown as RehearsalEnvironment;
    const url = new URL(request.url);
    const start = Date.parse(runtime.REHEARSAL_STARTS_AT ?? "");
    const end = Date.parse(runtime.REHEARSAL_EXPIRES_AT ?? "");
    const now = Date.now();
    if (
      runtime.APP_ENVIRONMENT !== "stripe_delivery_rehearsal"
      || runtime.REHEARSAL_ENABLED !== "true"
      || !Number.isFinite(start) || !Number.isFinite(end)
      || end <= start || end - start > WINDOW_MS
      || now < start || now >= end
      || !/^evt_[A-Za-z0-9]+$/.test(runtime.REHEARSAL_EVENT_ID ?? "")
      || !/^cs_test_[A-Za-z0-9]+$/.test(runtime.REHEARSAL_SESSION_ID ?? "")
      || !/^acct_[A-Za-z0-9]+$/.test(runtime.REHEARSAL_ACCOUNT_CONTEXT ?? "")
      || !/^rk_test_\S+$/.test(runtime.STRIPE_SECRET_KEY ?? "")
      || !/^whsec_\S+$/.test(runtime.STRIPE_PAYMENT_WEBHOOK_SECRET ?? "")
      || runtime.STRIPE_ALLOW_LIVE_MODE !== "false"
      || url.protocol !== "https:"
      || url.pathname !== "/api/stripe/webhooks/payments"
      || url.search !== ""
    ) return reply(404, "Not available.");
    if (request.method !== "POST") return reply(405, "POST required.");
    if (request.headers.get("content-encoding")
      || request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
      return reply(415, "JSON required.");
    }
    const signature = request.headers.get("stripe-signature") ?? "";
    if (!signature || signature.length > 2048) return reply(400, "Invalid signature.");

    let raw: string | null;
    let event: Stripe.Event;
    try {
      raw = await boundedBody(request);
      if (raw === null) return reply(413, "Request too large.");
      event = await Stripe.webhooks.constructEventAsync(
        raw, signature, runtime.STRIPE_PAYMENT_WEBHOOK_SECRET!, undefined,
        Stripe.createSubtleCryptoProvider(),
      );
    } catch {
      return reply(400, "Invalid signed event.");
    }

    // The no-payment expiration path stores the real route's durable receipt,
    // then returns before any payment lookup/update because metadata is empty.
    // Only the explicitly selected sandbox event can reach that route.
    const session = event.data?.object as Stripe.Checkout.Session | undefined;
    if (
      event.id !== runtime.REHEARSAL_EVENT_ID
      || event.object !== "event" || event.type !== "checkout.session.expired"
      || event.livemode !== false || event.account
      || (event.context && event.context !== runtime.REHEARSAL_ACCOUNT_CONTEXT)
      || !session || session.id !== runtime.REHEARSAL_SESSION_ID
      || session.object !== "checkout.session" || session.livemode !== false
      || session.status !== "expired" || session.payment_status !== "unpaid"
      || session.payment_intent || session.subscription || session.invoice
      || session.customer || session.customer_email || session.customer_details
      || Object.keys(session.metadata ?? {}).length !== 0
    ) return reply(400, "Event is outside this rehearsal.");

    const response = await POST(new Request(request.url, {
      method: "POST", headers: request.headers, body: raw,
    }));
    const result = new Response(response.body, response);
    result.headers.set("cache-control", "private, no-store");
    result.headers.set("x-robots-tag", "noindex, nofollow, noarchive");
    return result;
  },
};

export default rehearsalWorker;
