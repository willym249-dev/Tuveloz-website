import { PolicyPage } from "../components/policy-page";

export default function PartsPolicyPage() {
  return (
    <PolicyPage
      eyebrow="Legal"
      title="Parts Policy"
      summary="Tuveloz never sells you a part, never marks one up, and never earns a cent on one."
      updated="August 6, 2026"
    >
      <section>
        <h2>Where things stand right now</h2>
        <p>
          Tuveloz is in provider-onboarding review. No service is enabled for a
          real customer job yet, so nothing here is in effect for a live
          repair. This is a draft that describes how parts work once a service
          is enabled, and it applies in full once you use one. It is an
          operational document, not legal advice.
        </p>
      </section>

      <section>
        <h2>1. The short version</h2>
        <p>
          A Tuveloz quote covers labor only. If your vehicle needs a part, you
          buy that part yourself, from whoever you choose, at whatever price
          you find. The provider quotes you for the work of installing it.
        </p>
        <p>
          Tuveloz does not sell, source, list, stock, verify, warrant, or
          process payment for vehicle parts. No part can appear on a Tuveloz
          quote, invoice, or checkout — not as a line item, not as
          reimbursement, not as tax.
        </p>
      </section>

      <section>
        <h2>2. Why we do it this way</h2>
        <p>
          Parts markup is the oldest complaint in vehicle repair. The customer
          can&apos;t see what the shop paid, can&apos;t tell an OEM part from an
          aftermarket one once it&apos;s installed, and has no way to check
          whether the price was fair. Every incentive runs the wrong way.
        </p>
        <p>
          We removed the incentive instead of promising to resist it. Tuveloz
          earns a percentage of the labor quote and nothing else, so there is
          no version of this where we make more money by putting a more
          expensive part on your car. That isn&apos;t a promise about our
          character. It&apos;s arithmetic.
        </p>
      </section>

      <section>
        <h2>3. What you control</h2>
        <p>
          You decide whether a part is needed, where it comes from, what it
          costs, and whether it&apos;s OEM or aftermarket. You keep the receipt,
          the warranty, and the box. If a part fails, your claim is with
          whoever sold it to you — which is also who you can hold to their
          warranty, rather than a shop that marked it up.
        </p>
        <p>
          You can tell a provider your preference — OEM, aftermarket, either,
          or that you&apos;d rather talk it through. That preference is a
          communication tool so the two of you can plan the job. It is never a
          Tuveloz parts sale and never a Tuveloz recommendation.
        </p>
      </section>

      <section>
        <h2>4. What the provider controls</h2>
        <p>
          The provider quotes their labor, tells you what the job needs, and
          decides whether they&apos;re willing to install a part you supplied.
          A provider may decline a part they consider unsafe, incorrect for
          your vehicle, or outside what they&apos;re approved to work on — and
          they should say so before the work starts, not after.
        </p>
        <p>
          If a provider offers a warranty on their labor, that is between you
          and that provider. Tuveloz does not warrant the part or the work.
        </p>
      </section>

      <section>
        <h2>5. This is enforced, not just promised</h2>
        <p>
          A customer request cannot be saved unless it uses the labor-only
          parts workflow — the database itself rejects anything else, so there
          is no path through the software where a Tuveloz job carries a part
          charge. Quote part types are limited to &quot;customer supplied&quot;
          or &quot;no parts needed.&quot; Checkout has no parts line.
        </p>
        <p>
          We mention the mechanism because a policy nobody can verify is worth
          less than one you can check. If you ever see a part on a Tuveloz
          quote, invoice, or receipt, something is wrong — tell us at{" "}
          <a href="mailto:hello@tuveloz.com">hello@tuveloz.com</a>.
        </p>
      </section>

      <section>
        <h2>6. What this policy does not do</h2>
        <p>
          It doesn&apos;t make Tuveloz responsible for a part you bought, a
          part a provider installed, or a repair that didn&apos;t fix your
          problem. It doesn&apos;t make Tuveloz the seller, installer, or
          warrantor of anything. It doesn&apos;t remove a right the law gives
          you that can&apos;t be waived, and it doesn&apos;t override the{" "}
          <a href="/terms">Terms of Use</a>, the{" "}
          <a href="/customer-agreement">Customer Agreement</a>, or the{" "}
          <a href="/payments">Payment, Cancellation, and Refund Policy</a>.
        </p>
      </section>

      <section>
        <h2>7. Changes</h2>
        <p>
          If this ever changes, we&apos;ll post it with a new date and ask you
          to accept it again before a new transaction where that&apos;s
          legally required. A change won&apos;t rewrite a job you already
          authorized.
        </p>
      </section>
    </PolicyPage>
  );
}
