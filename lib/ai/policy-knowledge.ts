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
};

export const POLICY_ENTRIES: readonly PolicyEntry[] = [
  {
    id: "customer-fee",
    audience: "customer",
    question: "What does Tuveloz charge me?",
    keywords: ["fee", "cost", "charge", "commission", "5%", "price", "total", "surcharge"],
    answer:
      "The pro sets their own price for the labor. On top of that, the current design adds a 5% Tuveloz service fee to your total, shown as its own line before you confirm — never folded into the pro's price. That percentage and how it is handled are still going through compliance and tax review, so treat it as the plan rather than a locked-in number.",
    source: { label: "Payment, Cancellation, and Refund Policy", href: "/payments" },
    anchor: "5% customer service fee",
  },
  {
    id: "customer-parts",
    audience: "customer",
    question: "Who buys the parts?",
    keywords: ["part", "parts", "oem", "aftermarket", "buy", "supply", "battery", "labor only"],
    answer:
      "You do. Prices on Tuveloz cover labor only, so any part is something you purchase separately — it is not included in the pro's quote and Tuveloz does not sell, source, or pay for it. The request flow is built to pin down the exact part before the appointment so nobody wastes a trip on the wrong one.",
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
    audience: "customer",
    question: "What happens if something goes wrong with the work?",
    keywords: ["refund", "dispute", "complaint", "problem", "wrong", "bad job", "chargeback", "cancel"],
    answer:
      "Raise it with the pro first, since the work is a direct agreement between the two of you. Tuveloz keeps the job record, the written authorization, and the payment trail, and the payment policy sets out how cancellations, refunds, and disputes are meant to be handled. Those protections are part of the payment design that is still under review, so read the policy page rather than relying on a summary.",
    source: { label: "Payment, Cancellation, and Refund Policy", href: "/payments" },
    anchor: "Refunds and corrections",
  },
  {
    id: "provider-payout",
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
    keywords: ["license", "licence", "registration", "insurance", "documents", "paperwork", "evidence", "requirements", "approval"],
    answer:
      "Only what the specific jobs you pick actually require by law. If a service legally needs a license, registration, or insurance, we ask for it and confirm it before that service can go live for you — and if a service needs nothing, we do not invent a requirement. You can browse and pick services freely while you decide; nothing is locked in.",
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
export function starterQuestions(audience: PolicyAudience, limit = 4) {
  return POLICY_ENTRIES
    .filter((entry) => entry.audience === audience || entry.audience === "both")
    .slice(0, limit)
    .map((entry) => entry.question);
}

function scoreEntry(entry: PolicyEntry, words: readonly string[], haystack: string) {
  let score = 0;
  for (const keyword of entry.keywords) {
    if (haystack.includes(keyword)) score += keyword.includes(" ") ? 3 : 2;
  }
  for (const word of words) {
    if (word.length > 3 && entry.question.toLowerCase().includes(word)) score += 1;
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
  const haystack = message.toLowerCase();
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
