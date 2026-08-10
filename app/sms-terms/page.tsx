import type { Metadata } from "next";
import { PolicyPage } from "../components/policy-page";

export const metadata: Metadata = {
  title: "SMS Terms",
  description:
    "Plain-language terms for the text messages Tuveloz sends — one-time sign-in and verification codes only, with message rates, frequency, and how to stop them.",
  alternates: {
    canonical: "/sms-terms",
  },
};

export default function SmsTermsPage() {
  return (
    <PolicyPage
      eyebrow="Legal"
      title="SMS Terms"
      summary="Plain-language terms for the text messages Tuveloz sends — one-time sign-in and verification codes only."
      updated="August 6, 2026"
    >
      <section>
        <h2>1. What Tuveloz texts you</h2>
        <p>
          Tuveloz sends text messages only when you ask it to: a one-time
          code to sign in, or a one-time code to verify a phone number you&apos;re
          adding to your account. Each code expires in 10 minutes and works
          once. Tuveloz does not send marketing or promotional texts, and
          adding your phone number never enrolls you in any recurring message
          program.
        </p>
        <p>
          Message frequency depends entirely on how often you request a code.
          Message and data rates may apply, depending on your mobile plan.
        </p>
      </section>

      <section>
        <h2>2. Consent and opting out</h2>
        <p>
          By entering your phone number and requesting a code, you consent to
          receive that requested message at that number, and you confirm
          you&apos;re the account holder or have the account holder&apos;s permission.
          Reply STOP to any Tuveloz text to stop receiving texts — after
          that, phone sign-in won&apos;t work until you opt back in, but you can
          always sign in another way. Reply HELP, or email{" "}
          <a href="mailto:hello@tuveloz.com">hello@tuveloz.com</a>, for help.
        </p>
      </section>

      <section>
        <h2>3. Keeping codes safe</h2>
        <p>
          A Tuveloz code is only for you. Tuveloz will never call or text you
          to ask you to read a code back — anyone who does is trying to break
          into your account. If you receive a code you didn&apos;t request, don&apos;t
          share it, and consider telling us at{" "}
          <a href="mailto:hello@tuveloz.com">hello@tuveloz.com</a>.
        </p>
      </section>

      <section>
        <h2>4. Delivery and carriers</h2>
        <p>
          Text delivery depends on your carrier and network conditions, so
          Tuveloz can&apos;t promise a message will arrive instantly or at all.
          Mobile carriers aren&apos;t liable for delayed or undelivered messages.
          If a code doesn&apos;t arrive, you can request a new one or use a
          different sign-in method.
        </p>
      </section>

      <section>
        <h2>5. Your number and privacy</h2>
        <p>
          Your phone number is used to send the codes you request, to secure
          your account, and for nothing else. The{" "}
          <a href="/privacy">Privacy Policy</a> governs how Tuveloz handles
          your phone number and the rest of your information. Update or
          remove your number in your account settings if it changes —
          keeping it current is what keeps codes going only to you.
        </p>
      </section>
    </PolicyPage>
  );
}
