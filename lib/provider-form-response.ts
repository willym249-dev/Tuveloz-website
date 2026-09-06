import { spanishText } from "./spanish-dictionary.ts";

export type ProviderFormRequest = "challenge" | "application";
type ProviderFormReply = { ok: true; challengeId?: string };

export function readProviderFormReply(value: unknown, stage: ProviderFormRequest): ProviderFormReply | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const reply = value as Record<string, unknown>;
  if (reply.ok !== true || ("error" in reply && reply.error !== "")) return null;
  if ("message" in reply && typeof reply.message !== "string") return null;
  if (stage === "application") {
    return reply.onboardingUrl === "/provider-onboarding" ? { ok: true } : null;
  }
  const id = reply.challengeId;
  if (typeof id !== "string" || !id.trim() || id.length > 256 || /\s/u.test(id)
    || [...id].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) return null;
  return { ok: true, challengeId: id };
}

export function providerFormFailure(stage: ProviderFormRequest, spanish = false): string {
  if (stage === "challenge") return spanish
    ? "No pudimos confirmar el envío del código. Sus datos siguen aquí. Intente de nuevo."
    : "We couldn't confirm that a code was sent. Your details are still here. Please try again.";
  return spanish
    ? "No pudimos confirmar la recepción de su solicitud. Sus datos siguen aquí. Intente de nuevo."
    : "We couldn't confirm receipt of your application. Your details are still here. Please try again.";
}

class ProviderFormRequestError extends Error {}

function failureMessage(stage: ProviderFormRequest, status: number, data: unknown, spanish: boolean): string {
  if (status === 401) return spanish
    ? "El código no es válido o ya venció. Revíselo o solicite uno nuevo."
    : "That code is invalid or expired. Please check it or request a new one.";
  if (status === 429) return spanish ? "Espere un poco e intente de nuevo." : "Please wait a little, then try again.";
  if (status === 403) return spanish ? "Vuelva a cargar la página e intente de nuevo." : "Please reload the page and try again.";
  // Keep useful server validation guidance, but never surface malformed error objects
  // or transport/JSON exception text as an applicant-facing message.
  if ([400, 409, 413, 422].includes(status) && data && typeof data === "object" && "error" in data
    && typeof data.error === "string" && data.error.trim() && data.error.length <= 500) {
    return spanish ? spanishText[data.error] ?? "Revise los datos de su solicitud e intente de nuevo." : data.error;
  }
  return providerFormFailure(stage, spanish);
}

export async function requestProviderForm(
  stage: ProviderFormRequest,
  payload: Record<string, unknown>,
  signal: AbortSignal,
  spanish = false,
  timeoutMs = 45000,
): Promise<ProviderFormReply> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal.aborted) abort();
  else signal.addEventListener("abort", abort, { once: true });
  const timer = globalThis.setTimeout(abort, timeoutMs);
  try {
    const response = await fetch(stage === "challenge" ? "/api/providers/challenge" : "/api/providers", {
      method: "POST", signal: controller.signal,
      headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
    });
    const data: unknown = await response.json();
    const reply = response.ok ? readProviderFormReply(data, stage) : null;
    if (!reply) throw new ProviderFormRequestError(failureMessage(stage, response.status, data, spanish));
    return reply;
  } catch (error) {
    if (error instanceof ProviderFormRequestError) throw error;
    throw new ProviderFormRequestError(providerFormFailure(stage, spanish));
  } finally {
    globalThis.clearTimeout(timer);
    signal.removeEventListener("abort", abort);
  }
}
