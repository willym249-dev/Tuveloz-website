/**
 * Phone contact consent.
 *
 * Two different things share one field on a form and must never share one
 * permission:
 *
 * 1. **Transactional contact** — calling or texting someone about the specific
 *    job, quote, or request they themselves started. Giving the number for
 *    that purpose is the consent for that purpose, and it is why the number is
 *    worth collecting at all: it is the fastest way to reach someone about
 *    their own vehicle.
 *
 * 2. **Marketing** — promotions, offers, launch news, anything they did not
 *    ask for. Under the federal Telephone Consumer Protection Act this needs
 *    prior express written consent: an affirmative, unchecked opt-in that
 *    names the sender, says what will be sent, and states that agreeing is not
 *    a condition of getting service. Statutory damages run $500 per message,
 *    $1,500 if willful, per recipient — a franchisee of an oil-change chain
 *    settled for $47M after texting one discount offer to numbers customers
 *    had written on their own service invoices.
 *
 * Storing the exact wording someone agreed to, and its version, is what makes
 * the difference provable later. A number with no recorded marketing consent
 * is transactional-only, and the absence of a record is a refusal.
 */

export const PHONE_CONTACT_CONSENT_VERSION = "2026-08-phone-contact-v1";

/**
 * Shown next to every phone field. Not a checkbox: it states the purpose the
 * number is being given for, which is the purpose it may be used for.
 */
export const PHONE_TRANSACTIONAL_PURPOSE_TEXT_EN =
  "Tuveloz uses this number only to reach you about this request. "
  + "It is not used for marketing and is never sold or shared for advertising.";

export const PHONE_TRANSACTIONAL_PURPOSE_TEXT_ES =
  "Tuveloz usa este número solo para comunicarse con usted sobre esta "
  + "solicitud. No se usa para publicidad y nunca se vende ni se comparte con "
  + "fines publicitarios.";

/**
 * The marketing opt-in. Must render as an unchecked box, must be separate from
 * any other agreement, and must never be required to submit the form.
 */
export const SMS_MARKETING_CONSENT_TEXT_EN =
  "Text me Tuveloz updates and offers at this number, including messages sent "
  + "by an automatic system. Message and data rates may apply, message "
  + "frequency varies, and I can stop at any time by replying STOP. Agreeing "
  + "is not a condition of any purchase or service.";

export const SMS_MARKETING_CONSENT_TEXT_ES =
  "Envíenme por mensaje de texto novedades y ofertas de Tuveloz a este número, "
  + "incluidos mensajes enviados por un sistema automático. Pueden aplicarse "
  + "tarifas de mensajes y datos, la frecuencia varía y puedo detenerlos en "
  + "cualquier momento respondiendo STOP. Aceptar no es condición para ninguna "
  + "compra ni servicio.";

export type PhoneContactConsent = {
  /** E.164-ish normalized number, or "" when none was given. */
  phone: string;
  /** Exact wording the person agreed to, stored only when they opted in. */
  smsMarketingConsentText: string;
  smsMarketingConsentVersion: string;
  smsMarketingConsentedAt: string;
};

const NO_CONSENT: PhoneContactConsent = {
  phone: "",
  smsMarketingConsentText: "",
  smsMarketingConsentVersion: "",
  smsMarketingConsentedAt: "",
};

/**
 * Keeps digits and a single leading +. Returns "" for anything that cannot be
 * a real number, because a stored value that cannot be dialed is only a
 * privacy liability.
 */
export function normalizeContactPhone(value: unknown) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 40) return "";
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) return "";
  return hasPlus ? `+${digits}` : digits;
}

/**
 * Resolves a phone field plus its marketing checkbox into what may be stored.
 * Consent is recorded only when a usable number was given *and* the box was
 * affirmatively ticked — a checked box with no number consents to nothing, and
 * a number with an unchecked box stays transactional-only.
 */
export function resolvePhoneContactConsent(input: {
  phone: unknown;
  smsMarketingConsent: unknown;
  spanish?: boolean;
  now?: string;
}): PhoneContactConsent {
  const phone = normalizeContactPhone(input.phone);
  if (!phone) return NO_CONSENT;
  if (input.smsMarketingConsent !== true) {
    return { ...NO_CONSENT, phone };
  }
  return {
    phone,
    smsMarketingConsentText: input.spanish
      ? SMS_MARKETING_CONSENT_TEXT_ES
      : SMS_MARKETING_CONSENT_TEXT_EN,
    smsMarketingConsentVersion: PHONE_CONTACT_CONSENT_VERSION,
    smsMarketingConsentedAt: input.now ?? new Date().toISOString(),
  };
}

/** Whether a stored record may receive a promotional text. */
export function mayReceiveMarketingSms(record: {
  phone: string;
  smsMarketingConsentVersion: string;
  smsMarketingConsentedAt: string;
  smsMarketingRevokedAt?: string;
}) {
  return Boolean(
    record.phone
    && record.smsMarketingConsentVersion === PHONE_CONTACT_CONSENT_VERSION
    && record.smsMarketingConsentedAt
    && !record.smsMarketingRevokedAt,
  );
}
