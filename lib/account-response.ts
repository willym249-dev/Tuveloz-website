/** Read an account response completely before allowing the UI to advance. */
export function readAccountReply(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid account response.");
  }
  const reply = value as Record<string, unknown>;
  for (const key of ["error", "message", "destination"]) {
    if (key in reply && typeof reply[key] !== "string") {
      throw new Error("Invalid account response text.");
    }
  }
  for (const key of ["ok", "challengeRequired", "phoneSignIn"]) {
    if (key in reply && typeof reply[key] !== "boolean") {
      throw new Error("Invalid account response status.");
    }
  }
  if ("role" in reply && reply.role !== "customer" && reply.role !== "provider") {
    throw new Error("Invalid account role.");
  }
  if (typeof reply.destination === "string"
    && (!reply.destination.startsWith("/") || reply.destination.startsWith("//")
      || /[\\\s]/u.test(reply.destination)
      || [...reply.destination].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127))) {
    throw new Error("Invalid account destination.");
  }
  return reply;
}

/** The deadline covers response headers and JSON, including a stalled body. */
export async function requestAccountResponse(
  input: string,
  init: RequestInit = {},
  timeoutMs = 45000,
) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (init.signal?.aborted) abort();
  else init.signal?.addEventListener("abort", abort, { once: true });
  const timeout = globalThis.setTimeout(abort, timeoutMs);
  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    const data = readAccountReply(await response.json());
    return { ok: response.ok, status: response.status, data };
  } finally {
    globalThis.clearTimeout(timeout);
    init.signal?.removeEventListener("abort", abort);
  }
}
