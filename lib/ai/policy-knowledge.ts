/**
 * Vetted answers Tuveloz AI is allowed to give about how the marketplace works.
 *
 * The policy pages are hand-written JSX, so the assistant cannot read them at
 * runtime. Instead of letting the model improvise about fees, payouts, or
 * privacy — the questions where a wrong answer does real damage — it answers
 * only from the entries below, each of which carries the page a person can read
 * for themselves.
 *
 * Every entry is a plain-language restatement of a section that already exists
 * on the cited page, including its hedges. Where the policy says a design is
 * still under review, the entry says so too. tests/ai-policy-guide.test.mjs
 * checks that each cited page exists and still contains the anchor phrase, so
 * an entry cannot quietly outlive the policy it came from.
 */

export type PolicyAudience = "customer" | "provider" | "both";

export type PolicyEntry = {
  id: string;
  audience: PolicyAudience;
  /** How a person would ask it. Shown as a starter prompt. */
  question: string;
  /** Extra words that should match this entry. */
  keywords: readonly string[];
  /** The vetted answer, in the site's plain voice. */
  answer: string;
  /** Where the visitor can read the real thing. */
  source: { label: string; href: string };
  /** Phrase that must still appear on the cited page. Guards against drift. */
  anchor: string;
  /**
   * True when the underlying policy calls this design proposed, provisional, or
   * subject to approval. A reply that drops that qualifier states something the
   * business has not committed to, so the route refuses to serve it.
   */
  hedged?: boolean;
};

export const POLICY_ENTRIES: readonly PolicyEntry[] = [
  {
    id: "customer-fee",
    hedged: true,
    audience: "both",
    question: "What does Tuveloz charge me?",
    keywords: ["fee", "fees", "cost", "charge", "commission", "5%", "price", "total", "surcharge"],
    answer:
      "The pro sets their own price for the labor. On top of that, the current design adds a 5% Customer Service Fee to the customer's total, shown as its own line before confirmation - never deducted from the pro's quoted price. That percentage and how it is handled are still going through compliance and tax review, so treat it as the plan rather than a locked-in number.",
    source: { label: "Payment, Cancellation, and Refund Policy", href: "/payments" },
    anchor: "5% customer service fee",
  },
  {
    id: "customer-parts",
    audience: "both",
    question: "Who buys the parts?",
    keywords: ["part", "parts", "oem", "aftermarket", "buy", "supply", "battery", "labor only"],
    answer:
      "The customer purchases parts separately. Prices on Tuveloz cover labor only - parts are not included in the pro's quote and Tuveloz does not sell, source, or pay for them. The planned request flow records the exact part before the appointment so nobody wastes a trip on the wrong one.",
    source: { label: "Customer Agreement", href: "/customer-agreement" },
    anchor: "labor-only",
  },
  {
    id: "customer-no-obligation",
    audience: "customer",
    question: "Do I have to accept a quote?",
    keywords: ["obligation", "accept", "decline", "say no", "reject", "commit", "cancel"],
    answer:
      "No. Asking is free, comparing is free, and you can turn down every price you get. Choosing who does the work is always your decision, and walking away costs you nothing.",
    source: { label: "Customer Agreement", href: "/customer-agreement" },
    anchor: "Your freedom to choose",
  },
  {
    id: "customer-privacy",
    audience: "customer",
    question: "Who can see my address and phone number?",
    keywords: ["address", "privacy", "phone", "contact", "location", "data", "personal", "share"],
    answer:
      "Pros deciding whether to quote see only enough to make that decision. Your exact address and contact details go to the one pro you pick, and to nobody else. You can also review, export, or ask us to delete your information from the Privacy Center.",
    source: { label: "Privacy Policy", href: "/privacy" },
    anchor: "Exact location and staged sharing",
  },
  {
    id: "customer-refunds",
    hedged: true,
    audience: "customer",
    question: "What happens if something goes wrong with the work?",
    keywords: ["refund", "refunds", "dispute", "disputes", "complaint", "problem", "wrong", "bad job", "chargeback", "cancel"],
    answer:
      "Raise it with the pro first, since the work is a direct agreement between the two of you. Tuveloz keeps the job record, the written authorization, and the payment trail, and the payment policy sets out how cancellations, refunds, and disputes are meant to be handled. Those protections are part of the payment design that is still under review, so read the policy page rather than relying on a summary.",
    source: { label: "Payment, Cancellation, and Refund Policy", href: "/payments" },
    anchor: "Refunds and corrections",
  },
  {
    id: "provider-payout",
    hedged: true,
    audience: "provider",
    question: "How and when do I get paid?",
    keywords: ["paid", "payout", "payment", "transfer", "stripe", "money", "deposit", "when"],
    answer:
      "You quote your own labor price and that stays your subtotal — the 5% service fee is added to the customer's total rather than taken out of what you quoted. Payment runs through the platform via Stripe, and the design releases your transfer after the job is completed and your completion evidence is in. The payout details are still subject to processor, insurance, and accounting sign-off, so check the policy page before you count on a specific timing.",
    source: { label: "Payment, Cancellation, and Refund Policy", href: "/payments" },
    anchor: "Proposed provider transfers",
  },
  {
    id: "provider-independence",
    audience: "provider",
    question: "Am I working for Tuveloz?",
    keywords: ["employee", "employ", "boss", "independent", "contractor", "work for", "assign", "supervise"],
    answer:
      "No. You run your own business. Tuveloz does not employ, train, sponsor, assign, or supervise you or anyone who works for you — you set your prices, your hours, your service area, and how you do the job. If you bring a helper, they work for your business, which handles their hiring, pay, training, and supervision.",
    source: { label: "Provider Agreement", href: "/provider-agreement" },
    anchor: "Your business, your relationship with Tuveloz",
  },
  {
    id: "provider-exclusivity",
    audience: "provider",
    question: "Can I keep my own customers and use other platforms?",
    keywords: ["exclusive", "exclusivity", "other platforms", "own customers", "compete", "lock in"],
    answer:
      "Yes. Tuveloz is not exclusive. Keep your own customers, work other platforms, and turn down any job you do not want — you are never required to accept, quote, or complete a specific job.",
    source: { label: "Provider Agreement", href: "/provider-agreement" },
    anchor: "No exclusivity, no obligation",
  },
  {
    id: "provider-documents",
    audience: "provider",
    question: "What paperwork do I need to send?",
    keywords: ["license", "licence", "registration", "insurance", "documents", "paperwork", "evidence", "requirements", "approval", "apply", "applying", "sign up", "application"],
    answer:
      "Start your free provider application at /join. The application shows the requirements for your selected services and where you work, including legally required documents and Tuveloz's safety and competency checks. Any required evidence must be reviewed before that service can go live for you. You can browse and pick services while you decide; you do not need to upload everything to start.",
    source: { label: "Provider pathways", href: "/provisional-provider-policy" },
    anchor: "provisional",
  },
  {
    id: "provider-conduct",
    audience: "provider",
    question: "What are the rules for dealing with customers?",
    keywords: ["conduct", "rules", "behaviour", "behavior", "off platform", "offline", "poaching", "review", "suspend"],
    answer:
      "The short version: quote honestly, keep the job inside the platform so both sides have the same record, treat customer information as private, and do not pressure anyone. Breaking those rules can pause or end your access. The conduct page has the full list, and it is worth reading once before your first job.",
    source: { label: "Marketplace conduct", href: "/marketplace-conduct" },
    anchor: "conduct",
  },
  {
    id: "provider-job-records",
    audience: "provider",
    question: "What do I have to record on a job?",
    keywords: ["record", "evidence", "photo", "authorization", "change order", "invoice", "documentation"],
    answer:
      "When a customer accepts your price, that becomes a written authorization covering the agreed work. Extra work needs the customer's approval first, as a change order — never a surprise on the invoice. Along the way you log the vehicle's condition, progress, parts, and completion with photos from your phone, which is also what supports your payout.",
    source: { label: "Job controls", href: "/job-operations" },
    anchor: "job",
  },
  {
    id: "both-what-tuveloz-is",
    audience: "both",
    question: "What exactly is Tuveloz?",
    keywords: ["what is", "marketplace", "who are you", "how does this work", "company"],
    answer:
      "Tuveloz is a local vehicle-service marketplace in Montgomery County, Maryland. We introduce customers to independent local pros: mechanics, detailers, tint installers, mobile service trucks, and shops. We keep the paperwork — quotes, authorizations, records, invoices, payment — in one place. We do not fix cars ourselves, and the work is a direct agreement between the customer and the pro they chose.",
    source: { label: "Terms of Use", href: "/terms" },
    anchor: "marketplace",
  },
  {
    id: "both-launch-state",
    hedged: true,
    audience: "both",
    question: "Can I use it right now?",
    keywords: ["when", "open", "launch", "live", "available", "yet", "start", "waiting"],
    answer:
      "Not for real jobs yet. Local pros are signing up across Montgomery County right now, and accounts are open for customers and pros both — but posting a job, quoting, booking, and paying stay switched off until each service clears its legal and operational checks. Making an account today books nothing and costs nothing.",
    source: { label: "How it works", href: "/how-it-works" },
    anchor: "opens to customers at launch",
  },
  {
    id: "both-safety",
    audience: "both",
    question: "What if the car is unsafe to drive?",
    keywords: ["safety", "unsafe", "danger", "emergency", "brakes", "smoke", "fire", "stranded", "911"],
    answer:
      "Stop when it is safe to do so, get clear of traffic, and call 911 or a professional. That comes before anything on this site. Tuveloz is not a roadside or emergency service and cannot send help.",
    source: { label: "Safety & trust", href: "/safety" },
    anchor: "safety",
  },
];

/** Starter questions for the assistant's empty state, per audience. */
export function starterQuestions(audience: PolicyAudience, limit = 4, language: "en" | "es" = "en") {
  return POLICY_ENTRIES
    .filter((entry) => entry.audience === audience || entry.audience === "both")
    .slice(0, limit)
    .map((entry) => language === "es" ? SPANISH_POLICY[entry.id].question : entry.question);
}

function normalize(text: string) {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9%]+/g, " ").trim();
}

function scoreEntry(entry: PolicyEntry, words: readonly string[], haystack: string) {
  let score = 0;
  const spanish = SPANISH_POLICY[entry.id];
  if ([entry.question, spanish.question].some(question => normalize(question) === haystack)) return 100;
  for (const keyword of new Set([...entry.keywords, ...spanish.keywords].map(normalize))) {
    const specific = /^(fees?|commission|surcharge|privacy|refunds?|disputes?|paperwork|documents|requirements|apply|applying|application|exclusivity|exclusive|insurance|piezas|repuestos|tarifa|comision|privacidad|reembolsos?|documentos|requisitos|solicitud|aplicar|exclusividad)$/;
    if (` ${haystack} `.includes(` ${keyword} `)) score += keyword.includes(" ") || specific.test(keyword) ? 3 : 2;
  }
  for (const word of words) {
    if (word.length > 3 && normalize(`${entry.question} ${spanish.question}`).split(" ").includes(word)) score += 1;
  }
  return score;
}

/**
 * Picks the entries worth putting in front of the model for this message.
 * Returns nothing when the question is not about policy, which is what keeps
 * ordinary "my car is making a noise" chats on the vehicle-guidance path.
 */
export function findPolicyEntries(
  message: string,
  audience: PolicyAudience,
  limit = 3,
): PolicyEntry[] {
  const haystack = normalize(message);
  const words = haystack.split(/[^a-z0-9%]+/).filter(Boolean);
  return POLICY_ENTRIES
    .filter((entry) => entry.audience === audience || entry.audience === "both")
    .map((entry) => ({ entry, score: scoreEntry(entry, words, haystack) }))
    // 3 clears a single generic word like "when" on its own, so "my car makes a
    // noise when I brake" stays a vehicle question rather than dragging in policy.
    .filter((scored) => scored.score >= 3)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((scored) => scored.entry);
}


/**
 * Paraphrases that count as keeping a hedge. The model rewrites the vetted
 * answer in its own words, so an exact-string match would fire constantly;
 * these are the ways a reply can honestly signal "not settled yet".
 */
const HEDGE_MARKERS: readonly string[] = [
  "under review",
  "subject to",
  "still going through",
  "still being",
  "still subject",
  "not final",
  "not locked in",
  "not yet locked",
  "proposed",
  "the plan rather than",
  "current design",
  "may change",
  "before you count on",
  "not for real jobs yet",
  "opens at launch",
  "open at launch",
  "when we open",
  "once we",
];

/**
 * True when a reply is safe to serve for these entries. If the question touched
 * a hedged policy and the reply reads as settled fact, the caller should serve
 * the vetted wording instead of the model's.
 */
export function replyKeepsRequiredHedges(
  reply: string,
  entries: readonly PolicyEntry[],
): boolean {
  if (!entries.some((entry) => entry.hedged)) return true;
  const text = reply.toLowerCase();
  return HEDGE_MARKERS.some((marker) => text.includes(marker));
}

/** The approved wording, used verbatim when a reply fails the hedge guard. */
export function vettedAnswer(entries: readonly PolicyEntry[], language: "en" | "es" = "en") {
  return entries.map((entry) => language === "es" ? SPANISH_POLICY[entry.id].answer : entry.answer).join("\n\n");
}

// Translations stay beside the published English answers so both languages are
// reviewed together. This is a policy guide, not generated model output.
const SPANISH_POLICY: Record<string, { question: string; keywords: string[]; answer: string }> = {
  "customer-fee": {
    question: "¿Cuánto cobra Tuveloz?", keywords: ["cuanto cobra", "costo", "tarifa", "comision", "precio", "cobran"],
    answer: "El profesional fija su precio por la mano de obra. El diseño actual añade un Customer Service Fee del 5% al total del cliente, en una línea separada antes de confirmar; no se descuenta del precio cotizado por el profesional. El porcentaje y su aplicación siguen en revisión de cumplimiento e impuestos; todavía son una propuesta.",
  },
  "customer-parts": {
    question: "¿Quién compra las piezas?", keywords: ["piezas", "repuestos", "compra", "comprar", "solo mano de obra"],
    answer: "El cliente compra las piezas por separado. Los precios de Tuveloz cubren solo mano de obra; las piezas no están incluidas en la cotización. Tuveloz no vende, busca ni paga las piezas. El flujo previsto registra la pieza exacta antes de la cita.",
  },
  "customer-no-obligation": {
    question: "¿Tengo que aceptar una cotización?", keywords: ["aceptar", "cotizacion", "rechazar", "obligacion"],
    answer: "No. Consultar y comparar es gratis; puede rechazar todas las cotizaciones. Usted elige quién hace el trabajo y retirarse no tiene costo.",
  },
  "customer-privacy": {
    question: "¿Quién puede ver mi dirección y teléfono?", keywords: ["direccion", "telefono", "privacidad", "datos personales"],
    answer: "Los profesionales que evalúan si cotizar solo ven lo necesario para decidir. Su dirección exacta y datos de contacto se comparten con el profesional que elija. En el Centro de Privacidad puede revisar, exportar o pedir que eliminemos su información.",
  },
  "customer-refunds": {
    question: "¿Qué pasa si el trabajo sale mal?", keywords: ["reembolso", "reembolsos", "disputa", "reclamo", "trabajo sale mal"],
    answer: "Hable primero con el profesional: el trabajo es un acuerdo directo entre ustedes. El diseño de pagos prevé registros, autorización escrita y procedimientos para cancelaciones, reembolsos y disputas. Estas protecciones siguen en revisión; consulte la política de pagos para los detalles.",
  },
  "provider-payout": {
    question: "¿Cómo y cuándo recibo mi pago?", keywords: ["pago", "cobro", "transferencia", "deposito", "me pagan", "recibo"],
    answer: "Usted cotiza su mano de obra y conserva ese subtotal: el Customer Service Fee del 5% se añade al total del cliente. El diseño prevé pagos mediante Stripe y la transferencia tras completar el trabajo y presentar evidencia. Los detalles siguen sujetos a aprobación del procesador, seguro y contabilidad; consulte la política antes de contar con una fecha de pago.",
  },
  "provider-independence": {
    question: "¿Voy a trabajar como empleado de Tuveloz?", keywords: ["empleado", "empleo", "jefe", "independiente", "contratista"],
    answer: "No. Usted dirige su propio negocio y fija sus precios, horario, área de servicio y forma de trabajar. Tuveloz no emplea, capacita, patrocina, asigna ni supervisa a usted ni a sus ayudantes. Su negocio se encarga de contratar, pagar, capacitar y supervisar a su equipo.",
  },
  "provider-exclusivity": {
    question: "¿Puedo conservar mis clientes y usar otras plataformas?", keywords: ["exclusividad", "exclusivo", "mis clientes", "otras plataformas"],
    answer: "Sí. Tuveloz no exige exclusividad. Puede conservar sus clientes, trabajar en otras plataformas y rechazar trabajos. No está obligado a aceptar, cotizar ni completar un trabajo específico.",
  },
  "provider-documents": {
    question: "¿Qué documentos necesito enviar?", keywords: ["documentos", "licencia", "registro", "seguro", "requisitos", "papeles", "solicitud", "aplicar", "inscribirme"],
    answer: "Empiece su solicitud gratuita de proveedor en /join. La solicitud muestra los requisitos de sus servicios y lugares de trabajo: documentos exigidos por ley y controles de seguridad y competencia de Tuveloz. La evidencia requerida debe revisarse antes de activar un servicio. Puede explorar y elegir servicios sin subir todo para empezar.",
  },
  "provider-conduct": {
    question: "¿Cuáles son las reglas para tratar con los clientes?", keywords: ["conducta", "reglas", "fuera de la plataforma"],
    answer: "Cotice con honestidad, mantenga el trabajo en la plataforma para que ambas partes tengan el mismo registro, proteja los datos del cliente y no presione a nadie. Incumplir puede pausar o terminar su acceso. Consulte la página de conducta antes de su primer trabajo.",
  },
  "provider-job-records": {
    question: "¿Qué debo registrar durante un trabajo?", keywords: ["registrar", "fotos", "autorizacion", "factura", "orden de cambio"],
    answer: "Aceptar una cotización crea una autorización escrita para el trabajo acordado. El trabajo adicional necesita aprobación del cliente mediante una orden de cambio. Se registra con fotos el estado del vehículo, avance, piezas y finalización; esa evidencia también respalda el pago.",
  },
  "both-what-tuveloz-is": {
    question: "¿Qué es Tuveloz?", keywords: ["que es", "como funciona", "empresa", "mercado"],
    answer: "Tuveloz es un mercado local de servicios para vehículos en Montgomery County, Maryland, que conecta clientes con profesionales independientes: mecánicos, detalladores, instaladores de polarizado, servicios móviles y talleres. El diseño reúne cotizaciones, autorizaciones, registros, facturas y pagos. Tuveloz no repara vehículos; el trabajo es un acuerdo directo entre el cliente y el profesional elegido.",
  },
  "both-launch-state": {
    question: "¿Ya puedo usar Tuveloz?", keywords: ["abierto", "disponible", "lanzamiento", "ya puedo", "reservar", "trabajos hoy"],
    answer: "Todavía no para trabajos reales. Las cuentas y solicitudes de proveedores están abiertas, pero publicar trabajos, cotizar, reservar y pagar sigue desactivado hasta completar los controles legales y operativos. Crear una cuenta hoy no reserva nada ni tiene costo.",
  },
  "both-safety": {
    question: "¿Qué hago si no es seguro conducir?", keywords: ["peligro", "emergencia", "humo", "incendio", "no es seguro conducir"],
    answer: "Deténgase cuando sea seguro, aléjese del tráfico y llame al 911 o a un profesional. Su seguridad va primero. Tuveloz no es un servicio de emergencias ni de asistencia en carretera y no puede enviar ayuda.",
  },
};
