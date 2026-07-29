import { PolicyPage } from "../components/policy-page";

export default function CustomerAgreementPage() {
  return (
    <PolicyPage
      eyebrow="Customers"
      title="Customer Agreement"
      summary="Your choices, responsibilities, and direct agreement with the independent provider you select."
      updated="July 28, 2026"
    >
      <section>
        <h2>1. How this agreement fits</h2>
        <p>
          This Customer Agreement supplements the <a href="/terms">Terms of Use</a>.
          It applies when you post, review, accept, schedule, or pay for a
          vehicle-service request as a customer.
        </p>
      </section>

      <section>
        <h2>2. Your freedom to choose</h2>
        <p>
          You decide whether to post a request, which information to include,
          which provider to contact, whether to accept a quote, and whether to
          proceed with a service. Tuveloz does not require you to select any
          provider, accept any quote, or purchase any service.
        </p>
      </section>

      <section>
        <h2>3. Your authority and information</h2>
        <p>
          You must be authorized to request work on the vehicle and to approve
          the service location. Provide accurate vehicle, condition, symptom,
          location, access, and safety information. Tell the provider about known
          hazards or restrictions that could affect the work.
        </p>
      </section>

      <section>
        <h2>4. Selecting a provider</h2>
        <p>
          You are responsible for evaluating the provider and quote. Tuveloz
          displays the verification information it has reviewed, but a badge is
          not a guarantee. Tuveloz requires a governmental credential only when
          applicable law requires it for that service and location.
        </p>
        <p>
          Accepting a quote creates a direct service agreement between you and
          the provider. The accepted quote and messages define the work. No added
          work, substitute part, or price increase is approved unless you agree.
        </p>
      </section>

      <section>
        <h2>5. Service location and safety</h2>
        <p>
          Choose a place where the requested work may lawfully and reasonably be
          performed. The provider may decline or stop work because of weather,
          traffic exposure, property restrictions, unstable ground, missing
          permission, inaccurate vehicle information, or another safety or legal
          concern. Tuveloz is not an emergency or roadside-rescue service.
        </p>
      </section>

      <section>
        <h2>6. Diagnosis, inspections, parts, and warranties</h2>
        <p>
          A diagnosis or pre-purchase opinion may be limited by what can
          reasonably be observed and tested at the location. It is not an
          official state inspection unless an authorized provider expressly says
          so. The provider must identify parts and any provider or manufacturer
          warranty in the service records.
        </p>
      </section>

      <section>
        <h2>7. Price, payment, cancellation, and refunds</h2>
        <p>
          Before payment, you see the provider subtotal, the separate 10% Tuveloz
          customer service fee, and the total. You authorize the displayed amount
          only after choosing to continue. The{" "}
          <a href="/payments">Payment, Cancellation, and Refund Policy</a> governs
          payment administration, cancellations, refunds, and disputes.
        </p>
      </section>

      <section>
        <h2>8. Problems with service</h2>
        <p>
          Raise a workmanship, parts, warranty, delay, or property concern with
          the provider promptly and preserve relevant messages, approvals,
          receipts, and photos. Tuveloz may help organize records or review an
          unreleased payment, but the provider remains responsible for the
          vehicle service and any provider warranty.
        </p>
      </section>

      <section>
        <h2>9. Privacy and respectful use</h2>
        <p>
          Providers considering a request receive limited job and general-area
          details. Only the provider you select receives the contact and exact
          service-location information needed for the job. Treat providers
          lawfully and respectfully, and do not request unsafe, deceptive, or
          illegal work.
        </p>
      </section>

      <section>
        <h2>10. Ending use</h2>
        <p>
          You may stop using Tuveloz at any time, but accepted jobs, payment
          obligations, dispute records, and provisions intended to survive
          continue as required. If this Customer Agreement conflicts with the
          general Terms on a customer-specific issue, this agreement controls.
        </p>
      </section>
    </PolicyPage>
  );
}
