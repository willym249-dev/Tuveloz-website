export type OwnerSupportProblem = "unconfirmed" | "validation" | "too-long" | "rate-limit";

export function readOwnerSupportReceipt(value: unknown, requestId: string): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const reply = value as Record<string, unknown>;
  if (reply.ok !== true || reply.status !== "queued" || reply.reference !== requestId
    || ("error" in reply && reply.error !== "")) return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId) ? requestId : null;
}

export function ownerSupportProblemMessage(problem: OwnerSupportProblem, spanish = false): string {
  if (problem === "rate-limit") return spanish
    ? "Espere una hora antes de enviar otro mensaje, o escriba a hello@tuveloz.com."
    : "Please wait an hour before sending another message, or email hello@tuveloz.com.";
  if (problem === "validation") return spanish
    ? "Revise su correo y mensaje, y confirme que desea enviarlos al dueño."
    : "Check your email and message, and confirm you want to send them to the owner.";
  if (problem === "too-long") return spanish
    ? "Acorte su mensaje a 3,000 caracteres o menos e intente de nuevo."
    : "Please shorten your message to 3,000 characters or fewer and try again.";
  return spanish
    ? "No pudimos confirmar la recepción. Su mensaje sigue aquí. Revise su conexión e intente de nuevo."
    : "We couldn't confirm receipt. Your message is still here. Check your connection and try again.";
}

export class OwnerSupportError extends Error {
  readonly problem: OwnerSupportProblem;

  constructor(problem: OwnerSupportProblem) {
    super(problem);
    this.name = "OwnerSupportError";
    this.problem = problem;
  }
}

export async function requestOwnerSupport(
  payload: Record<string, unknown> & { requestId: string },
  signal: AbortSignal,
  timeoutMs = 45000,
): Promise<string> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal.aborted) abort();
  else signal.addEventListener("abort", abort, { once: true });
  const timer = globalThis.setTimeout(abort, timeoutMs);
  try {
    const response = await fetch("/api/support", {
      method: "POST", signal: controller.signal,
      headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
    });
    const data: unknown = await response.json().catch(() => null);
    const reference = response.ok ? readOwnerSupportReceipt(data, payload.requestId) : null;
    if (controller.signal.aborted) throw new OwnerSupportError("unconfirmed");
    if (!reference) throw new OwnerSupportError(response.status === 429 ? "rate-limit"
      : response.status === 413 ? "too-long"
      : [400, 422].includes(response.status) ? "validation" : "unconfirmed");
    return reference;
  } catch (error) {
    if (error instanceof OwnerSupportError) throw error;
    throw new OwnerSupportError("unconfirmed");
  } finally {
    globalThis.clearTimeout(timer);
    signal.removeEventListener("abort", abort);
  }
}
