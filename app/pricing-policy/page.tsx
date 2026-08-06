import { PolicyPage } from "../components/policy-page";

export default function PricingPolicyPage() {
  return (
    <PolicyPage
      eyebrow="Legal"
      title="No-Surprise Pricing Policy"
      summary="You see the full price before you accept, the fee is its own line, and nobody can raise it after the fact."
      updated="August 6, 2026"
    >
      <section>
        <h2>Where things stand right now</h2>
        <p>
          Tuveloz is in provider-onboarding review. Customer requests and
          payments are not open, so nothing here is charging anyone today. This
          draft describes how pricing works once payments are enabled, and it
          applies in full once you use them. It is an operational document, not
          legal advice. The 5% figure below is Tuveloz&apos;s proposed pricing
          and still needs sign-off from a tax adviser, the payment processor,
          and Tuveloz&apos;s insurance broker.
        </p>
      </section>

      <section>
        <h2>1. Nothing costs anything until you accept a quote</h2>
        <p>
          It is free to browse, free to post a request, free to receive quotes,
          and free to compare them. You can accept none of them and owe
          nothing.
        </p>
        <p>
          Providers pay nothing to see your request, nothing to send you a
          quote, and nothing to be listed. Tuveloz does not sell leads, does
          not charge per contact, does not run a credit system, and does not
          sell subscriptions. Tuveloz earns only when a job is completed —
          which means nobody is paying for the privilege of talking to you.
        </p>
      </section>

      <section>
        <h2>2. The fee is a line item, not a discovery</h2>
        <p>
          Tuveloz plans to charge a 5% customer service fee, calculated on the
          provider&apos;s quoted labor and added on top of it. It appears as
          its own labelled line before you accept — not folded into the
          provider&apos;s price, not revealed at checkout, not described as a
          &quot;processing&quot; or &quot;convenience&quot; charge.
        </p>
        <p>
          You should be able to see three numbers before you decide: what the
          provider charges, what Tuveloz charges, and the total. If you ever
          can&apos;t, that is a defect — tell us at{" "}
          <a href="mailto:hello@tuveloz.com">hello@tuveloz.com</a>.
        </p>
      </section>

      <section>
        <h2>3. The price you accept is the price</h2>
        <p>
          Work or cost beyond the accepted quote requires your approval first,
          recorded before the added work begins. A provider cannot start extra
          work and bill you afterward, and cannot raise an accepted price
          without a new authorization from you.
        </p>
        <p>
          If the scope or price does change, any open payment link for the old
          amount is cancelled before the new one can be created, so a stale
          checkout can never quietly collect the wrong total.
        </p>
      </section>

      <section>
        <h2>4. Parts are never in the price</h2>
        <p>
          Tuveloz quotes cover labor only. Parts are purchased separately by
          you and never appear on a Tuveloz quote, invoice, or checkout. Since
          the fee is a percentage of labor, Tuveloz earns nothing on a part and
          gains nothing from a more expensive one. See the{" "}
          <a href="/parts-policy">Parts Policy</a>.
        </p>
      </section>

      <section>
        <h2>5. Completing a job does not release money by itself</h2>
        <p>
          A job being marked complete does not automatically pay anyone.
          Payouts to providers go through a separate release step. This exists
          so a disputed or incomplete job can be stopped before funds move, not
          chased afterward.
        </p>
        <p>
          Refunds, cancellations, disputes, and chargebacks are governed by the{" "}
          <a href="/payments">Payment, Cancellation, and Refund Policy</a>.
        </p>
      </section>

      <section>
        <h2>6. What this does not promise</h2>
        <p>
          Tuveloz does not set, review, approve, or guarantee what a provider
          charges. Providers price their own labor, and one may quote far more
          than another for the same job — comparing them is the point. A low
          quote is not a promise of good work, and a high one is not a promise
          of better.
        </p>
        <p>
          This policy doesn&apos;t override the <a href="/terms">Terms of Use</a>,
          the <a href="/customer-agreement">Customer Agreement</a>, or the{" "}
          <a href="/payments">Payment, Cancellation, and Refund Policy</a>, and
          it doesn&apos;t remove a right the law says can&apos;t be waived.
        </p>
      </section>
    </PolicyPage>
  );
}
