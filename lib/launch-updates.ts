/**
 * Pre-launch email sequence.
 *
 * Social reach is rented; this list is owned. The sequence exists so that
 * someone who raised their hand before launch actually hears from Tuveloz
 * between now and then, instead of going silent for months and then receiving
 * a cold "we're live" mail from a sender they've forgotten.
 *
 * Copy rules are the same ones the outreach kit enforces (see
 * brand/outreach/audience-growth-playbook.md): never imply customers can book
 * or pay today, never promise income or job volume, never claim a provider is
 * endorsed. Every step below says plainly where the marketplace actually is.
 *
 * The launch announcement itself is deliberately NOT a timed step — it is sent
 * when launch actually happens, not on a schedule guessed months earlier.
 */

export const LAUNCH_UPDATE_CONSENT_VERSION = "2026-08-launch-updates-v1";

export const LAUNCH_UPDATE_CONSENT_TEXT_EN =
  "Email me occasional Tuveloz updates about the Montgomery County launch. "
  + "I can unsubscribe at any time using the link in any email.";

export const LAUNCH_UPDATE_CONSENT_TEXT_ES =
  "Envíenme por correo electrónico noticias ocasionales de Tuveloz sobre el "
  + "lanzamiento en el Condado de Montgomery. Puedo cancelar la suscripción en "
  + "cualquier momento con el enlace incluido en cualquier correo.";

export type LaunchUpdateStep = {
  /** Stable index. Never renumber — subscribers store the last step sent. */
  step: number;
  /** Days after consent before this step becomes due. */
  afterDays: number;
  subject: string;
  subjectEs: string;
  body: string[];
  bodyEs: string[];
};

export const LAUNCH_UPDATE_SEQUENCE: readonly LaunchUpdateStep[] = [
  {
    step: 0,
    afterDays: 0,
    subject: "You're on the Tuveloz launch list",
    subjectEs: "Está en la lista de lanzamiento de Tuveloz",
    body: [
      "Thanks for joining Tuveloz's launch list.",
      "Tuveloz will help neighbors in Montgomery County, Maryland, find independent vehicle-service providers, compare quotes, and choose a provider.",
      "Customer requests and payments are not available yet. Provider applications are open while we prepare for launch.",
      "We'll send a few updates and let you know when customer requests open. You can unsubscribe at any time using the link below.",
    ],
    bodyEs: [
      "Gracias por inscribirse para recibir noticias del lanzamiento de Tuveloz.",
      "Tuveloz ayudará a los vecinos del condado de Montgomery, Maryland, a encontrar proveedores independientes de servicios para vehículos, comparar cotizaciones y elegir un proveedor.",
      "Las solicitudes y los pagos de clientes aún no están disponibles. Los proveedores ya pueden solicitar su incorporación mientras preparamos el lanzamiento.",
      "Le enviaremos algunas novedades y le avisaremos cuando se abran las solicitudes de clientes. Puede cancelar la suscripción en cualquier momento con el enlace al final del correo.",
    ],
  },
  {
    step: 1,
    afterDays: 7,
    subject: "Local vehicle-service businesses can now apply to Tuveloz",
    subjectEs: "Los negocios locales de servicios para vehículos ya pueden solicitar su incorporación a Tuveloz",
    body: [
      "We're preparing for launch by welcoming local vehicle-service businesses.",
      "Providers choose which services to offer and receive a checklist for those services. Each service must complete its required review before it can be offered through Tuveloz.",
      "Customer requests and payments are still closed. Once requests open, eligible providers in the area can choose whether to send a quote.",
      "Know a mechanic or detailer who may be interested? They can apply at https://tuveloz.com/join. Applying is free. Providers set their own prices and keep 100% of their quoted price.",
    ],
    bodyEs: [
      "Estamos preparando el lanzamiento e invitamos a los negocios locales de servicios para vehículos a participar.",
      "Los proveedores eligen los servicios que quieren ofrecer y reciben una lista de requisitos para esos servicios. Cada servicio debe completar la revisión correspondiente antes de ofrecerse a través de Tuveloz.",
      "Las solicitudes y los pagos de clientes siguen cerrados. Cuando se abran las solicitudes, los proveedores que cumplan los requisitos para el servicio y la zona podrán decidir si envían una cotización.",
      "¿Conoce a un mecánico o especialista en limpieza y detallado de vehículos que pueda estar interesado? Puede solicitar su incorporación en https://tuveloz.com/join. La solicitud es gratuita. Los proveedores fijan sus propios precios y conservan el 100% de lo que cotizan.",
    ],
  },
  {
    step: 2,
    afterDays: 30,
    subject: "Tuveloz: where things stand",
    subjectEs: "Tuveloz: cómo va todo",
    body: [
      "Here's a brief update on Tuveloz.",
      "Provider applications remain open. Each applicant receives a checklist based on the services they choose, and no service is activated until its required review is complete.",
      "Customer requests and payments are still not open. When they are, you'll get one clear email saying so.",
      "You can always check the current status at tuveloz.com.",
    ],
    bodyEs: [
      "Queremos compartir una breve actualización sobre Tuveloz.",
      "Las solicitudes de proveedores siguen abiertas. Cada solicitante recibe una lista de requisitos según los servicios que elija, y ningún servicio se activa hasta completar la revisión correspondiente.",
      "Las solicitudes y los pagos de clientes siguen sin estar abiertos. Cuando lo estén, recibirá un correo claro avisándole.",
      "Siempre puede ver el estado actual en tuveloz.com.",
    ],
  },
];

export function launchUpdateStep(step: number): LaunchUpdateStep | undefined {
  return LAUNCH_UPDATE_SEQUENCE.find((entry) => entry.step === step);
}

// Bind queued mail to the consent that created it. A returning subscriber
// gets a new sequence without reviving pending mail from an earlier opt-in.
// Keep unsubscribe tokens out of event keys and preserve existing opt-out URLs.
export function launchUpdateEventPrefix(step: number) {
  return `launch-updates:v2:${step}:`;
}

export function launchUpdateEventKey(step: number, consentedAt: string, email: string) {
  return `${launchUpdateEventPrefix(step)}${consentedAt}:${email}`;
}

export function nextDueStep(options: {
  lastStepSent: number;
  consentedAt: string;
  now: Date;
}): LaunchUpdateStep | undefined {
  const { lastStepSent, consentedAt, now } = options;
  const consented = Date.parse(consentedAt);
  if (!Number.isFinite(consented)) return undefined;
  const candidate = LAUNCH_UPDATE_SEQUENCE.find((entry) => entry.step > lastStepSent);
  if (!candidate) return undefined;
  const dueAt = consented + candidate.afterDays * 24 * 60 * 60 * 1000;
  return now.getTime() >= dueAt ? candidate : undefined;
}

/**
 * Commercial email must identify the sender and carry a working opt-out.
 * The postal address is read from configuration rather than hardcoded — an
 * invented address is worse than a missing one, and this must be set before
 * the first send. See LAUNCH_UPDATES_POSTAL_ADDRESS in .env.example.
 */
export function marketingFooter(options: {
  unsubscribeUrl: string;
  postalAddress: string;
  spanish: boolean;
}): string[] {
  const { unsubscribeUrl, postalAddress, spanish } = options;
  const lines = spanish
    ? [
      "—",
      "Recibe este correo porque se inscribió para recibir noticias del lanzamiento de Tuveloz.",
      `Cancelar la suscripción: ${unsubscribeUrl}`,
    ]
    : [
      "—",
      "You're receiving this because you signed up for Tuveloz launch updates.",
      `Unsubscribe: ${unsubscribeUrl}`,
    ];
  if (postalAddress.trim()) lines.push(postalAddress.trim());
  return lines;
}
