import { PolicyPage } from "../components/policy-page";
import { JobOperationsConsole } from "./job-operations-console";

export default function JobOperationsPage() {
  return (
    <PolicyPage
      eyebrow="Job controls"
      title="Change, Cancellation, Incident, Invoice, and Payment Review"
      summary="The operational workflow TUVELOZ is building for review before any real customer job or payment is enabled."
      updated="July 31, 2026"
    >
      <JobOperationsConsole />

      <section>
        <h2>Current status: test records only</h2>
        <p>
          Real jobs, customer charges, refunds, and provider payouts remain
          disabled. These controls can be exercised only with isolated database
          records marked as test jobs and test providers. A test approval never
          creates a Stripe charge, refund, transfer, or transfer reversal.
        </p>
      </section>

      <section>
        <h2>Before work starts</h2>
        <p>
          The server rechecks the exact service codes, jurisdiction, scheduled
          time, selected provider business, performing person, any required
          supervisor, current evidence, and current agreements. Missing or
          expired information stops the job. A browser button cannot override a
          denied decision.
        </p>
      </section>

      <section>
        <h2>Added work and price changes</h2>
        <p>
          A provider must create a complete change order identifying the exact
          services, scope, parts responsibility, reason, and itemized new total.
          TUVELOZ rechecks eligibility for the complete changed scope. Added work
          cannot begin until the customer affirmatively authorizes the stored
          scope and price. The authorization text, version, hash, timestamp,
          account, session, and scope snapshot are retained.
        </p>
      </section>

      <section>
        <h2>Cancellations and no-shows</h2>
        <p>
          Customers and providers may report a cancellation or no-show. The
          record captures notice time, whether travel began, claimed committed
          parts, and claimed authorized work. Work stops while the owner reviews
          the record. No refund or retained amount is calculated or sent
          automatically; final rules still require documented compliance with
          applicable law plus CPA or tax-adviser and processor approval.
        </p>
      </section>

      <section>
        <h2>Incidents, injuries, property damage, and stop-work</h2>
        <p>
          An incident report creates a payment hold. Serious safety concerns,
          reported injury, or property damage stop the provider timer and put the
          job into stop-work status. Injury and property-damage records cannot be
          closed without documenting insurer notice. Emergency situations should
          still be directed immediately to 911 or the appropriate emergency
          service; this form is not emergency dispatch.
        </p>
      </section>

      <section>
        <h2>Final invoice and warranty disclosure</h2>
        <p>
          The selected provider business must issue an itemized final invoice for
          the current authorized scope. Labor, parts, tax, and other amounts must
          add up exactly and match the customer-authorized provider total. The
          invoice records returned-parts treatment, the warranty provider, and
          specific warranty terms, including a clear disclosure when no written
          provider warranty is offered.
        </p>
      </section>

      <section>
        <h2>Refunds, disputes, and reserves</h2>
        <p>
          A refund request is a review record, not an automatic refund. Disputes,
          active reserves, open incidents, unresolved cancellations, and pending
          refunds all hold provider release. Test decisions state explicitly that
          no Stripe action occurred. Production rules, deadlines, evidence
          standards, allocation, and appeal rights remain review items.
        </p>
      </section>

      <section>
        <h2>Payout release remains fail-closed</h2>
        <p>
          Completion alone never makes funds releasable. A future production
          release would require a fresh payout-stage eligibility decision, an
          authorized completion, a stopped timer, a matching final invoice, no
          unauthorized change order, no open incident or claim, no unresolved
          cancellation, no refund hold, no dispute, no reserve, and current
          connected-account capability. Live Stripe is separately code-disabled
          while TUVELOZ remains in provider-onboarding mode.
        </p>
      </section>
    </PolicyPage>
  );
}
