import { PolicyPage } from "../components/policy-page";

export default function PaymentsPage() {
  return (
    <PolicyPage
      eyebrow="Money"
      title="Payment, Cancellation, and Refund Policy"
      summary="An operational review draft for proposed pricing, payments, transfers, cancellations, and customer protections."
      updated="September 30, 2026"
    >
      <section>
        <h2>Important current status</h2>
        <p>
          Tuveloz is currently in provider-onboarding mode. Real customer
          checkout, collection, provider transfer, completion, and payout are
          disabled. This operational draft is for owner, CPA or tax-adviser,
          payment-processor, insurance, security, and implementation review; it
          is not legal or tax advice, proof of compliance, or approval to launch.
          Tuveloz&apos;s owner may elect not to hire private counsel, but every duty
          imposed by applicable law remains mandatory. This draft describes the
          intended payment recipient, collection timing, and full-refund rule.
          Tax treatment, transfer limits, reserves, and the remaining adjustment
          and recovery rules still need review before launch.
        </p>
      </section>

      <section>
        <h2>1. Price shown before checkout</h2>
        <p>
          Customer requests and checkout are not yet open. The current product
          configuration proposes a customer service fee equal to 5% of the
          provider&apos;s quoted subtotal. If that pricing and payment flow receive
          final approval, the customer must see the provider subtotal, separate
          Customer Service Fee, and total conspicuously before choosing whether to proceed.
          Tuveloz must not add work to an accepted quote. Every provider amount
          processed through Tuveloz is labor only; provider-supplied parts, parts
          reimbursement, parts tax, and other parts charges are prohibited. A labor
          scope or labor-price change requires the customer&apos;s express approval before
          any additional charge.
        </p>
      </section>

      <section>
        <h2>2. Provider pricing and proposed Customer Service Fee</h2>
        <p>
          Provider businesses set their own labor-only quotes. Any required part
          is purchased separately by the customer and is not included in the
          provider subtotal. The proposed product design separately tracks the accepted
          provider labor subtotal and a
          5% customer service fee for marketplace and transaction support. The
          percentage, transfer calculation, adjustments, and accounting treatment
          remain subject to documented compliance with applicable law and final
          CPA or tax-adviser, processor, insurance, and operational approval.
          Product configuration alone does not establish a legal or tax
          characterization or promise a particular provider payout.
        </p>
      </section>

      <section>
        <h2>3. Proposed Stripe payment flow</h2>
        <p>
          When payments open, your payment through Tuveloz will be to TUVELOZ
          LLC, processed by Stripe. Your selected independent provider business
          performs the vehicle service. For help with a payment or refund,
          contact <a href="mailto:hello@tuveloz.com">hello@tuveloz.com</a>.
        </p>
        <p>
          The proposed product uses Stripe-hosted checkout so Tuveloz does not
          receive or store complete card or bank-account numbers. Any charge,
          transfer, or connected-account configuration remains in testing and
          must match the final processor agreement and approved legal and
          accounting model before production use.
        </p>
        <p>
          Identifying TUVELOZ LLC as the payment recipient does not by itself
          settle tax treatment, agency status, or every applicable legal duty.
          Those questions still require documented review. If payments are
          enabled, the selected provider business remains the party that accepts
          and performs the vehicle-service agreement and honors any workmanship
          warranty it expressly offers. Tuveloz does not process payment for parts;
          any part is separately purchased by the customer. Nothing in this draft
          decides a non-waivable warranty right or responsibility.
        </p>
        <p>
          Stripe&apos;s own terms and privacy policy also apply to its services.
          Nothing about the proposed processor flow waives any payment, privacy,
          consumer-protection, or other duty applicable law places on Tuveloz.
        </p>
      </section>

      <section>
        <h2>4. Authorization, capture, and receipts</h2>
        <p>
          No live checkout authorization is currently available. If production
          checkout is approved, choosing the checkout button will authorize only
          the total displayed with the accepted quote and then-current policy
          disclosures. You pay the provider&apos;s labor quote plus the separate
          5% Customer Service Fee at checkout. The provider&apos;s transfer happens
          later, after completion and the required payment checks. The fee is
          added to your total, not deducted from the provider&apos;s quote.
          A completed payment would be evidence of payment, not
          proof that service has been completed or that a vehicle is safe to
          operate. Stripe or the card issuer may decline, review, or reverse a
          transaction under its own rules.
        </p>
      </section>

      <section>
        <h2>5. Proposed provider transfers</h2>
        <p>
          No production provider transfer is currently available. The proposed
          flow would hold a provider transfer until the job has passed its exact
          service, provider, performer, supervision, completion, and payment
          authorization controls. An unreleased transfer could be paused while
          Tuveloz reviews a cancellation, duplicate charge, fraud signal, service
          complaint, dispute, expired evidence, or inconsistent record.
        </p>
        <p>
          Final transfer timing, adjustment rights, and reserves must be approved
          and stated conspicuously before production. Tuveloz is responsible to
          Stripe for platform refunds, disputes, and related processor costs
          under this payment configuration. Any recovery from a provider must
          follow the accepted provider terms, documented facts, processor rules,
          and applicable law; this draft does not create an automatic recovery
          right. Tuveloz will not describe
          the proposed process as a bank deposit, trust, or escrow arrangement
          unless that description is accurate under applicable law and the
          processor approves it.
        </p>
      </section>

      <section>
        <h2>6. Proposed cancellation protections</h2>
        <p>
          The following are proposed baseline customer protections for final
          review. They are not yet live blanket refund promises and remain subject
          to applicable law, processor rules, documented job facts, and the final
          policy shown before checkout:
        </p>
        <ul>
          <li>The proposed rule would provide a full refund of the amount paid for the service if the provider cancels, does not appear, or cannot perform the accepted service.</li>
          <li>The proposed rule would provide a full refund if the customer cancels before authorized labor begins.</li>
          <li>If authorized labor has begun, the refund may exclude the documented value of authorized labor already completed, but only to the extent allowed by law. Tuveloz does not collect or refund separately purchased customer parts.</li>
          <li>A provider may stop work because of an unsafe or unlawful location, missing authorization, or materially inaccurate job information. Any charge or refund will depend on documented authorized work and costs, applicable law, and the records available.</li>
        </ul>
        <p>
          A full refund for provider cancellation, provider no-show, or customer
          cancellation before authorized work starts includes both the
          provider&apos;s labor amount and Tuveloz&apos;s 5% Customer Service Fee.
          Tuveloz covers any original Stripe processing fee that Stripe keeps;
          it is not deducted from that customer refund.
        </p>
        <p>
          The final process must not limit any cancellation, refund, or other
          remedy that applicable law does not allow the parties to limit.
        </p>
      </section>

      <section>
        <h2>7. Refunds and corrections</h2>
        <p>
          If live payments are enabled, Tuveloz will review reports of duplicate,
          unauthorized, or incorrectly calculated platform charges and make any
          correction required by applicable law, processor rules, or the final
          accepted policy. A refund approved under that process would ordinarily
          return to the original payment method unless law or the payment network
          requires otherwise. The bank or card issuer controls when a credit
          appears. Nothing here limits a non-waivable consumer remedy.
        </p>
      </section>

      <section>
        <h2>8. Service complaints, disputes, and chargebacks</h2>
        <p>
          Email <a href="mailto:hello@tuveloz.com?subject=Payment%20Issue">hello@tuveloz.com</a>{" "}
          promptly with the job, provider, amount, requested resolution, and
          relevant messages, approvals, invoices, receipts, or photos. Tuveloz may
          ask both sides for records and may pause an unreleased transfer while
          reviewing the issue.
        </p>
        <p>
          A customer keeps the right to contact the card issuer. A chargeback is
          decided under card-network and issuer rules. Under this payment
          configuration, Stripe debits the Tuveloz platform balance for platform
          refunds and disputes. Whether
          a provider transfer may be delayed, adjusted, reversed, or recovered
          must follow the final processor agreement, accepted provider terms,
          documented facts, and applicable law; this draft does not create an
          automatic recovery right or guarantee a dispute outcome.
        </p>
      </section>

      <section>
        <h2>9. Taxes and records</h2>
        <p>
          The proposed payment architecture does not decide who must collect,
          report, withhold, or pay a particular tax. Tuveloz will obtain final
          CPA or qualified tax-adviser guidance, document the applicable legal
          requirements, and configure the payment and reporting flow to match
          the responsibilities imposed by law. Provider
          businesses remain responsible for accurate business records and for
          duties the law places on them. Customers and providers should keep
          their quote, approval, invoice, receipt, and service records.
        </p>
      </section>

      <section>
        <h2>10. Production-payment readiness</h2>
        <p>
          Live processing remains disabled. It may be enabled only after Tuveloz
          documents compliance with applicable law and required government rules;
          records the required CPA or tax-adviser, insurance, and processor
          approvals; confirms the merchant-of-record and tax analysis without
          relying on a technical label; adopts conspicuous fee, cancellation,
          refund, dispute, chargeback, reserve, security, and recordkeeping
          controls; and verifies that the exact service, provider business,
          performing person, supervisor when required, and job stage are eligible.
          No technical switch may override those controls.
        </p>
      </section>
    </PolicyPage>
  );
}
