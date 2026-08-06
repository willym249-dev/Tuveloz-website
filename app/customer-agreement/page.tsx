import { PolicyPage } from "../components/policy-page";

export default function CustomerAgreementPage() {
  return (
    <PolicyPage
      eyebrow="Customers"
      title="Customer Agreement"
      summary="An operational review draft about your choices and direct agreement with the provider business you select."
      updated="August 6, 2026"
    >
      <section>
        <h2>Important current status</h2>
        <p>
          This Customer Agreement is an operational draft, not legal advice,
          proof of compliance, or approval to launch. Tuveloz&apos;s owner may elect
          to proceed without hiring private counsel, but that choice does not
          waive or reduce any duty imposed by applicable law. Tuveloz is currently
          in provider-onboarding mode, so customers cannot post, book, pay for,
          start, or complete a real job. Every exact service remains disabled
          until its mandatory legal, government, insurance, tax, payment,
          security, and technical launch controls are documented and satisfied.
        </p>
      </section>

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
          You evaluate the provider and quote using the information available to
          you. Any evidence-checked status shown by Tuveloz is limited to the
          named provider or person, exact service, location, document, and
          validity period shown; it is not a guarantee. Depending on the service,
          Tuveloz may require governmental credentials, business registration,
          insurance, competency, employment, supervision, or other evidence.
        </p>
        <p>
          Accepting a quote creates a direct service agreement between you and
          the responsible provider business. The accepted labor-only quote and messages
          define the work. The provider business controls any approved employee
          or sponsored-trainee assignment. OEM or aftermarket selections only
          communicate your preference for a part you purchase separately. No added
          work or labor-price increase is approved unless you agree. This direct agreement
          does not waive any non-waivable duty that law places on Tuveloz.
        </p>
        <p>
          TUVELOZ does not employ or train the provider, mechanic, trainee, or
          provider-business employee. Any employee or trainee works for and is
          assigned and supervised by the separate provider business, not TUVELOZ.
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
          so. Tuveloz does not sell, source, verify, reimburse, or process payment
          for parts. You must purchase any required part separately. The provider
          should identify the customer-supplied part and any applicable workmanship
          limitation in the service records. Implied or statutory warranty rights
          and duties remain governed by applicable law.
        </p>
        <p>
          Each provider business chooses its own written warranty. Some
          providers offer the Tuveloz standard labor warranty — the provider
          business&apos;s written warranty on its workmanship for 12 months or
          12,000 miles, whichever comes first, honored by re-performing the
          covered labor at no additional labor charge. Others offer a
          different written warranty or none at all. The provider&apos;s warranty
          choice must be disclosed to you before you accept a quote and
          stated again on the final invoice. Any warranty is provided and
          honored by the provider business, not by Tuveloz.
        </p>
      </section>

      <section>
        <h2>7. Price, payment, cancellation, and refunds</h2>
        <p>
          Real customer payments are currently disabled. The product
          configuration proposes a customer service fee equal to 5% of the
          provider subtotal, subject to documented compliance with applicable
          law and final CPA or tax-adviser, payment-processor, insurance, and
          operational approval. If that pricing is adopted, the provider
          subtotal, separate fee, and total must be displayed conspicuously before
          you choose whether to authorize checkout. The{" "}
          <a href="/payments">Payment, Cancellation, and Refund Policy</a> explains
          the proposed payment administration and customer protections.
        </p>
      </section>

      <section>
        <h2>8. Problems with service</h2>
        <p>
          Raise a workmanship, parts, warranty, delay, or property concern with
          the provider business promptly and preserve relevant messages, approvals,
          receipts, and photos. Tuveloz may help organize records or review an
          unreleased payment if live transactions are later enabled, but the
          provider business remains responsible for the vehicle service and any
          warranty it expressly offers. Tuveloz remains responsible for its own
          conduct and any duty applicable law does not allow it to disclaim.
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
