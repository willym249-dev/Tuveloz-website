type PublicForm = "updates" | "fleet";
export type PublicFormProblem = "unconfirmed" | "email" | "consent" | "business" | "name" | "fleet-size" | "rate-limit" | "reload";

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
  return "unconfirmed";
}

const messages: Record<Exclude<PublicFormProblem, "unconfirmed">, readonly [string, string]> = {
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
  if (form === "fleet") {
    return spanish
      ? "No pudimos confirmar la recepción de los datos de su flota. Intente de nuevo."
      : "We couldn't confirm that your fleet details were received. Please try again.";
  }
  return spanish
    ? "No pudimos confirmar su suscripción. Intente de nuevo."
    : "We couldn't confirm your signup. Please try again.";
}
