import { PolicyPage } from "../components/policy-page";

export default function PaymentsPage() {
  return (
    <PolicyPage
      eyebrow="Money"
      title="Payment, Cancellation, and Refund Policy"
      summary="An operational review draft for proposed pricing, payments, transfers, cancellations, and customer protections."
      updated="August 1, 2026"
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
          imposed by applicable law remains mandatory. This draft does not settle
          merchant-of-record, tax, funds-flow, refund, chargeback, or reserve
          responsibilities.
        </p>
      </section>

      <section>
        <h2>1. Price shown before checkout</h2>
        <p>
          Customer requests and checkout are not yet open. The current product
          configuration proposes a customer service fee equal to 10% of the
          provider&apos;s quoted subtotal. If that pricing and payment flow receive
          final approval, the customer must see the provider&apos;s one service
          price, exact parts arrangement, separate Tuveloz fee, and total
          conspicuously before choosing whether to proceed. Tuveloz must not add
          work, a substitute part, a separate goods charge, or a price to an
          accepted quote, and every material scope or price change requires the
          customer&apos;s express recorded approval before any additional charge.
        </p>
      </section>

      <section>
        <h2>2. Provider pricing and proposed Tuveloz fee</h2>
        <p>
          Provider businesses set their own service prices. The current guarded
          product design permits customer-supplied parts, no new parts, or
          provider-supplied parts and materials included in one all-inclusive
          lump-sum repair-service price. It does not permit a separate parts,
          materials, reimbursement, parts-markup, core-charge, tire-fee, or other
          goods line. The accepted provider service price is tracked separately
          from the proposed 10% customer service fee for marketplace and
          transaction support.
        </p>
        <p>
          A provider using the all-inclusive method may obtain parts at retail or
          wholesale, but must pay or accrue applicable sales or use tax on the
          parts and supplies purchased for the lump-sum repair, must not use a
          resale exemption for those items, and must retain supplier records.
          Separately itemized parts sales remain disabled until Tuveloz has an
          approved registration, tax-calculation, collection, withholding,
          reporting, refund, and remittance process for that flow. The fee
          percentage, transfer calculation, adjustments, and accounting treatment
          remain subject to documented compliance with applicable law and final
          CPA or tax-adviser, processor, insurance, and operational approval.
        </p>
      </section>

      <section>
        <h2>3. Proposed Stripe payment flow</h2>
        <p>
          The proposed product uses Stripe-hosted checkout so Tuveloz does not
          receive or store complete card or bank-account numbers. Any charge,
          transfer, or connected-account configuration remains in testing and
          must match the final processor agreement and approved legal and
          accounting model before production use.
        </p>
        <p>
          A processor&apos;s technical labels or movement of funds do not by
          themselves determine who is merchant of record, who owes a tax, whether
          anyone acts as an agent, or which legal duties apply. Those questions
          must be resolved under applicable law with final CPA or tax-adviser,
          processor, insurance, and operational review.
          If payments are enabled, the selected provider business remains
          the party that accepts and performs the vehicle-service agreement,
          acquires and supplies listed parts, pays or accrues the parts-purchase
          tax required under the selected billing method, preserves supplier
          records, and honors any provider warranty it expressly offers. Nothing
          in this draft decides a non-waivable warranty right or responsibility.
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
          disclosures. A completed payment would be evidence of payment, not
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
          Final transfer timing, adjustment rights, reserves, and responsibility
          for processor fees, refunds, disputes, and chargebacks must be approved
          and stated conspicuously before production. Tuveloz will not describe
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
          <li>The proposed rule would provide a full refund if the customer cancels before work begins and before approved parts are ordered.</li>
          <li>If authorized work has begun or approved parts were ordered, the refund may exclude documented, reasonable, nonrecoverable parts costs and the value of authorized work already completed, but only to the extent allowed by law.</li>
          <li>A provider may stop work because of an unsafe or unlawful location, missing authorization, or materially inaccurate job information. Any charge or refund will depend on documented authorized work and costs, applicable law, and the records available.</li>
        </ul>
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
          decided under card-network and issuer rules and may debit the Tuveloz
          platform balance depending on the final payment configuration. Whether
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
          the responsibilities imposed by law.
          Provider businesses remain responsible for accurate business,
          supplier, tax, warranty, and service records and for duties the law
          places on them. For an all-inclusive provider-parts repair, the stored
          record must preserve the parts arrangement, included-item description,
          provider certifications, one service price, customer acceptance, and
          supplier receipt reference. Customers and providers should keep their
          quote, approval, invoice, receipt, and service records.
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
