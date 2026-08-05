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
      "Thanks for signing up. Here's exactly what you've signed up for, so there are no surprises.",
      "Tuveloz is a local marketplace for vehicle services in Montgomery County, Maryland. You'll describe what your vehicle needs, local independent providers will send you real quotes, and you'll choose the one that works. No phone tag, no guessing at prices.",
      "To be straight with you: it isn't open yet. Customer requests and payments are not available today. Right now we're onboarding and reviewing the independent providers who'll be there on day one — because a marketplace with no one in it is no use to you.",
      "You'll hear from us a handful of times before launch, and then once when it actually opens. That's it. No weekly newsletter.",
      "If you'd rather not get these, the unsubscribe link at the bottom works immediately.",
    ],
    bodyEs: [
      "Gracias por inscribirse. Esto es exactamente lo que recibirá, para que no haya sorpresas.",
      "Tuveloz es un mercado local de servicios vehiculares en el Condado de Montgomery, Maryland. Usted describe lo que necesita su vehículo, proveedores independientes locales le envían cotizaciones reales, y usted elige la que le conviene. Sin llamadas interminables y sin adivinar precios.",
      "Para ser claros: todavía no está abierto. Las solicitudes y los pagos de clientes no están disponibles hoy. Por ahora estamos inscribiendo y revisando a los proveedores independientes que estarán listos desde el primer día — porque un mercado sin nadie adentro no le sirve de nada.",
      "Recibirá unos pocos correos antes del lanzamiento, y uno más cuando realmente abra. Nada más. No es un boletín semanal.",
      "Si prefiere no recibirlos, el enlace para cancelar la suscripción al final funciona de inmediato.",
    ],
  },
  {
    step: 1,
    afterDays: 7,
    subject: "Why Tuveloz starts with providers, not customers",
    subjectEs: "Por qué Tuveloz empieza con los proveedores, no con los clientes",
    body: [
      "A quick note on why the customer side isn't open yet.",
      "It would be easy to switch it on and hope providers show up. That's how you end up posting a job and hearing nothing for three days — the failure mode of every marketplace that launched empty.",
      "So the order is deliberate: accept and review local independent providers first, then open to customers. The providers going through review now are mobile mechanics, detailers, and roadside operators working in Montgomery County.",
      "What that means for you at launch: real quotes from people who are actually nearby and actually available, instead of a form that goes into a void.",
      "Know a good independent mechanic or detailer? Sending them to tuveloz.com/join genuinely moves this forward — it's free for them, they set their own prices, and they keep 100% of what they quote.",
    ],
    bodyEs: [
      "Una nota breve sobre por qué el lado del cliente todavía no está abierto.",
      "Sería fácil activarlo y esperar que aparezcan proveedores. Así es como uno termina publicando un trabajo y sin recibir respuesta por tres días — la forma en que fracasan los mercados que abren vacíos.",
      "Por eso el orden es intencional: primero aceptar y revisar proveedores independientes locales, después abrir a los clientes. Los proveedores en revisión ahora son mecánicos móviles, detallistas y operadores de asistencia en el Condado de Montgomery.",
      "Lo que eso significa para usted en el lanzamiento: cotizaciones reales de personas que de verdad están cerca y disponibles, en lugar de un formulario que no llega a ninguna parte.",
      "¿Conoce a un buen mecánico o detallista independiente? Enviarlo a tuveloz.com/join realmente ayuda — es gratis para él, pone sus propios precios y se queda con el 100% de lo que cotiza.",
    ],
  },
  {
    step: 2,
    afterDays: 30,
    subject: "Tuveloz: where things stand",
    subjectEs: "Tuveloz: cómo va todo",
    body: [
      "A short progress note, because a list you never hear from is just a list you eventually unsubscribe from.",
      "Provider applications are open and being reviewed. The services we're launching with are deliberately narrow: battery and jump start, wiper blades and bulbs, fluid top-offs, detailing, and basic diagnostics. Not towing, not tires, not A/C — those come later, done properly, rather than promised now and botched.",
      "Customer requests and payments are still not open. When they are, you'll get one email saying so, and it will be the first thing you hear.",
      "You can always check the current status at tuveloz.com.",
    ],
    bodyEs: [
      "Una nota breve de avance, porque una lista de la que nunca recibe noticias es una lista que termina cancelando.",
      "Las solicitudes de proveedores están abiertas y en revisión. Los servicios con los que vamos a lanzar son intencionalmente pocos: batería y arranque, limpiaparabrisas y bombillas, recarga de líquidos, detallado y diagnóstico básico. No remolque, no llantas, no aire acondicionado — eso vendrá después y bien hecho, en lugar de prometerlo ahora y hacerlo mal.",
      "Las solicitudes y los pagos de clientes siguen sin estar abiertos. Cuando lo estén, recibirá un correo avisándole, y será lo primero que sepa.",
      "Siempre puede ver el estado actual en tuveloz.com.",
    ],
  },
];

export function launchUpdateStep(step: number): LaunchUpdateStep | undefined {
  return LAUNCH_UPDATE_SEQUENCE.find((entry) => entry.step === step);
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
