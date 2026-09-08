type PublicForm = "updates" | "fleet" | "feedback" | "expansion";
export type PublicFormProblem = "unconfirmed" | "email" | "consent" | "business" | "name" | "fleet-size" | "rate-limit" | "reload" | "audience" | "provider-type" | "locality" | "current-area" | "feedback-sections" | "optional-email";

export function hasPublicFormReceipt(payload: unknown): boolean {
  return typeof payload === "object" && payload !== null
    && "ok" in payload && payload.ok === true;
}

/** Only expected validation messages become field guidance; never display raw errors. */
export function publicFormProblem(form: PublicForm, status: number, payload: unknown): PublicFormProblem {
  if (status === 429) return "rate-limit";
  if (status === 403) return "reload";
  if (status !== 400 || typeof payload !== "object" || payload === null || !("error" in payload)) {
    return "unconfirmed";
  }
  if (payload.error === "Enter a valid email address.") return "email";
  if (form === "updates" && payload.error === "Please check the box to confirm you want launch updates.") return "consent";
  if (form === "fleet") {
    if (payload.error === "Enter your business name.") return "business";
    if (payload.error === "Enter a contact name.") return "name";
    if (payload.error === "Choose how many vehicles you run.") return "fleet-size";
  }
  if (form === "feedback" || form === "expansion") {
    if (["Tell us which group best describes you.", "Choose whether you are a customer, provider, or both."].includes(String(payload.error))) return "audience";
    if (payload.error === "Choose the type of provider you are.") return "provider-type";
    if (payload.error === "Enter your county or city and choose Maryland or Washington, DC.") return "locality";
    if (payload.error === "Tuveloz already serves Montgomery County. Use the customer or provider form to get started.") return "current-area";
    if (payload.error === "Please complete all three feedback sections.") return "feedback-sections";
    if (payload.error === "Enter a valid email or leave it blank.") return "optional-email";
  }
  return "unconfirmed";
}

const messages: Record<Exclude<PublicFormProblem, "unconfirmed">, readonly [string, string]> = {
  audience: ["Choose whether you are a customer, provider, or both.", "Seleccione si es cliente, proveedor o ambos."],
  "provider-type": ["Choose the type of provider you are.", "Seleccione el tipo de servicio que ofrece."],
  locality: ["Enter your county or city and choose Maryland or Washington, DC.", "Ingrese su condado o ciudad y seleccione Maryland o Washington, DC."],
  "current-area": ["Montgomery County is our first launch area. You can create a customer account or apply as a provider.", "El condado de Montgomery es nuestra primera zona de lanzamiento. Puede crear una cuenta de cliente o solicitar ser proveedor."],
  "feedback-sections": ["Select at least one answer in each feedback section.", "Seleccione al menos una respuesta en cada sección de comentarios."],
  "optional-email": ["Enter a valid email or leave it blank.", "Ingrese un correo electrónico válido o deje el campo en blanco."],
  email: ["Enter a valid email address.", "Ingrese un correo electrónico válido."],
  consent: ["Check the box if you'd like to receive launch updates.", "Marque la casilla si desea recibir novedades del lanzamiento."],
  business: ["Enter your business name.", "Ingrese el nombre de su negocio."],
  name: ["Enter your name.", "Ingrese su nombre."],
  "fleet-size": ["Choose how many vehicles you have.", "Seleccione cuántos vehículos tiene."],
  "rate-limit": ["Please wait a little, then try again.", "Espere un poco e intente de nuevo."],
  reload: ["Please reload the page and try again.", "Vuelva a cargar la página e intente de nuevo."],
};

export function publicFormMessage(form: PublicForm, problem: PublicFormProblem, spanish = false): string {
  if (problem !== "unconfirmed") return messages[problem][spanish ? 1 : 0];
  if (form === "feedback") return spanish
    ? "No pudimos confirmar la recepción de sus comentarios. Intente de nuevo."
    : "We couldn't confirm that your feedback was received. Please try again.";
  if (form === "expansion") return spanish
    ? "No pudimos confirmar su solicitud de zona. Intente de nuevo."
    : "We couldn't confirm your area request. Please try again.";
  if (form === "fleet") {
    return spanish
      ? "No pudimos confirmar la recepción de los datos de su flota. Intente de nuevo."
      : "We couldn't confirm that your fleet details were received. Please try again.";
  }
  return spanish
    ? "No pudimos confirmar su suscripción. Intente de nuevo."
    : "We couldn't confirm your signup. Please try again.";
}

/** The deadline includes reading the body, so a stalled reply cannot lock a form. */
export async function requestPublicForm(input: string, init: RequestInit, timeoutMs = 45000) {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    const payload: unknown = await response.json().catch(() => null);
    return { ok: response.ok, status: response.status, payload };
  } finally {
    globalThis.clearTimeout(timeout);
  }
}
