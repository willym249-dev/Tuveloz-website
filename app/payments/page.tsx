import { PolicyPage } from "../components/policy-page";

export default function PaymentsPage() {
  return (
    <PolicyPage
      eyebrow="Money"
      title="Payment, Cancellation, and Refund Policy"
      summary="How Tuveloz displays prices, collects platform payments, transfers provider amounts, and handles cancellations and disputes."
      updated="July 28, 2026"
    >
      <section>
        <h2>1. Price shown before checkout</h2>
        <p>
          Posting a request is free. For an accepted quote, the customer sees the
          provider&apos;s quoted subtotal, a separate 10% Tuveloz customer service
          fee, and the total before Stripe Checkout opens. Tuveloz does not add
          work or parts to an accepted quote. A scope or price change requires
          customer approval before an additional charge.
        </p>
      </section>

      <section>
        <h2>2. Provider freedom and Tuveloz fee</h2>
        <p>
          Providers set their own labor and parts prices. The accepted provider
          subtotal remains the provider amount, subject to a lawful refund,
          dispute, reversal, correction, tax withholding, or separately
          authorized adjustment. Tuveloz&apos;s 10% fee is charged separately to
          the customer for marketplace and transaction support.
        </p>
      </section>

      <section>
        <h2>3. Stripe and the platform transaction</h2>
        <p>
          Stripe hosts checkout and processes card information. Storefront
          purchases use Stripe destination charges created on the Tuveloz
          platform account. For that Stripe charge type, TUVELOZ LLC is the
          merchant of record, and the Tuveloz platform balance is responsible
          for Stripe fees, refunds, and chargebacks.
        </p>
        <p>
          Quote-based payments use a charge created on the Tuveloz platform
          account without an immediate provider transfer. Tuveloz schedules a
          separate transfer of the provider subtotal only after the job is
          marked complete and the payment record passes owner review. In both
          payment paths, the selected independent provider remains responsible
          for performing the vehicle service, supplying listed parts, and
          honoring provider warranties.
        </p>
        <p>
          Tuveloz does not receive or store complete card or bank-account numbers.
          Stripe&apos;s own terms and privacy policy also apply to its services.
        </p>
      </section>

      <section>
        <h2>4. Authorization, capture, and receipts</h2>
        <p>
          By choosing the checkout button, the customer authorizes the displayed
          total and confirms the accepted quote. A completed payment is evidence
          of payment—not proof that service has been completed or that a vehicle
          is safe to operate. Stripe or the card issuer may decline, review, or
          reverse a transaction. Receipts identify the amount and available job
          details.
        </p>
      </section>

      <section>
        <h2>5. Provider transfers</h2>
        <p>
          For quote-based work, Tuveloz schedules the provider&apos;s quoted
          subtotal for transfer after the job is marked complete and the payment
          record passes owner review. An unreleased transfer may be paused while
          Tuveloz reviews a cancellation, refund, duplicate charge, fraud signal,
          service complaint, dispute, or inconsistent record.
        </p>
        <p>
          Storefront purchases may transfer the provider amount after Stripe
          confirms payment. Stripe account eligibility, payout timing, bank
          processing, refunds, disputes, and chargebacks may affect when funds
          become available. This process is not a bank account, deposit account,
          trust account, or consumer escrow service.
        </p>
      </section>

      <section>
        <h2>6. Cancellations</h2>
        <ul>
          <li>If the provider cancels, does not appear, or cannot perform the accepted service, the customer is eligible for a full refund of the amount paid for that service.</li>
          <li>If the customer cancels before work begins and before approved parts are ordered, the customer is eligible for a full refund.</li>
          <li>If authorized work has begun or approved parts were ordered, the refund may exclude documented, reasonable, nonrecoverable parts costs and the value of authorized work already completed, but only to the extent allowed by law.</li>
          <li>A provider may stop work because of an unsafe or unlawful location, missing authorization, or materially inaccurate job information. Any charge or refund will depend on documented authorized work and costs, applicable law, and the records available.</li>
        </ul>
      </section>

      <section>
        <h2>7. Refunds and corrections</h2>
        <p>
          Duplicate, unauthorized, or incorrectly calculated platform charges
          will be corrected after verification. An approved refund returns to the
          original payment method unless law or the payment network requires
          otherwise. The bank or card issuer controls when the credit appears.
          Refunds do not limit a non-waivable consumer remedy.
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
          platform balance. Tuveloz may reverse or recover the corresponding
          provider transfer when records show the refund or dispute is tied to
          the provider&apos;s service, breach, misrepresentation, or failure to
          supply the accepted work or parts, subject to applicable law.
        </p>
      </section>

      <section>
        <h2>9. Taxes and provider records</h2>
        <p>
          Each provider is responsible for identifying, collecting, reporting,
          and paying taxes that apply to the provider&apos;s business or service,
          except taxes Tuveloz or Stripe is legally required to collect, report,
          or withhold. Customers and providers should keep their quote, approval,
          invoice, receipt, and service records.
        </p>
      </section>

      <section>
        <h2>10. Live-payment readiness</h2>
        <p>
          Payment availability may remain limited during the local pilot. Live
          processing is enabled only after Tuveloz&apos;s verified adult legal
          owner confirms Stripe approval, merchant-of-record duties, taxes,
          refund operations, dispute handling, security controls, and a
          sufficient reserve for processing fees, refunds, and chargebacks.
        </p>
      </section>
    </PolicyPage>
  );
}
