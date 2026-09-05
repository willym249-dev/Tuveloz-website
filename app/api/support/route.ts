import { queueOwnerSupportMessage } from "../../../lib/email-notifications";
import { isStrictSameOriginWriteRequest } from "../../../lib/request-security";
import { readLimitedJsonObject, RequestBodyTooLargeError } from "../../../lib/limited-json";
import { consumeFixedWindow, rateLimitKeyHash } from "../../../lib/public-write-rate-limit";

const headers = { "cache-control": "no-store" };
const reply = (body: unknown, status: number) => Response.json(body, { status, headers });

export async function POST(request: Request) {
  if (!isStrictSameOriginWriteRequest(request)) return reply({ error: "Open the support form on Tuveloz to send a message." }, 403);
  let body: Record<string, unknown>;
  try {
    body = await readLimitedJsonObject(request, 16_384);
  } catch (error) {
    return reply({ error: "Send a valid, short support message." }, error instanceof RequestBodyTooLargeError ? 413 : 400);
  }
  const spanish = body.language === "es";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const requestId = typeof body.requestId === "string" ? body.requestId : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)
    || email.length > 180 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    || !message || message.length > 3000 || body.consent !== true
    || !["customer", "provider"].includes(String(body.audience))) {
    return reply({ error: spanish ? "Revise su correo y mensaje, y confirme que desea enviarlos al dueño." : "Check your email and message, and confirm you want to send them to the owner." }, 400);
  }
  try {
    const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
    for (const [action, key, limit] of [
      ["support-global", "all", 60],
      ["support-ip", ip, 5],
      ["support-email", email, 3],
    ] as const) {
      if (!await consumeFixedWindow(action, await rateLimitKeyHash(key), limit, 60 * 60 * 1000)) {
        return reply({ error: spanish ? "Ha enviado varios mensajes. Espere una hora o escriba a hello@tuveloz.com." : "You have sent several messages. Wait an hour or email hello@tuveloz.com." }, 429);
      }
    }
    const audience = body.audience === "provider" ? "provider" : "customer";
    const language = spanish ? "es" : "en";
    // Bind retries to the exact submitted content; a different visitor cannot
    // replace a message by guessing its reference. No transcript is collected.
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(
      JSON.stringify({ email, message, audience, language }),
    ));
    const fingerprint = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
    await queueOwnerSupportMessage({ requestId, fingerprint, email, message, audience, language });
    return reply({ ok: true, status: "queued", reference: requestId }, 202);
  } catch {
    // Do not log contact details, message contents, or database errors.
    return reply({ error: spanish ? "No pudimos guardar su mensaje. Intente de nuevo o escriba a hello@tuveloz.com." : "We couldn't save your message. Try again or email hello@tuveloz.com." }, 503);
  }
}
