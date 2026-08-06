import { PolicyPage } from "../components/policy-page";

export default function VerificationPolicyPage() {
  return (
    <PolicyPage
      eyebrow="Legal"
      title="Verification Policy"
      summary="What Tuveloz checks, what it doesn't, and why we won't show you a badge we didn't earn."
      updated="August 6, 2026"
    >
      <section>
        <h2>Where things stand right now</h2>
        <p>
          Tuveloz is in provider-onboarding review. No service is enabled for a
          real customer job yet. This draft describes how verification works
          once a service is enabled, and it applies in full once you use one.
          It is an operational document, not legal advice and not proof of
          compliance.
        </p>
      </section>

      <section>
        <h2>1. We verify per service, not per person</h2>
        <p>
          There is no single credential that qualifies someone to work on cars.
          A certificate that covers a jump start says nothing about
          refrigerant work, and a registration that covers tire installation
          says nothing about towing. So Tuveloz doesn&apos;t verify
          &quot;a provider.&quot; It verifies a specific provider for a
          specific service in a specific place.
        </p>
        <p>
          Being approved for one service never approves a provider for another.
          Each service is checked on its own evidence, and each can be turned
          off on its own without touching the rest.
        </p>
      </section>

      <section>
        <h2>2. We check what the law requires — and stop there</h2>
        <p>
          When a service legally requires a license, registration, permit, or
          certificate, Tuveloz must receive and confirm it before that provider
          can offer that service. When no government credential applies,
          Tuveloz does not invent one to look thorough. Insurance, competency,
          or environmental-handling evidence may still be required where the
          service or a carrier calls for it.
        </p>
        <p>
          Collecting documents nobody requires isn&apos;t diligence. It&apos;s
          theater that costs providers time and tells you nothing.
        </p>
      </section>

      <section>
        <h2>3. Nothing is approved by default</h2>
        <p>
          Every service starts denied. A provider becomes eligible for a
          service only when the evidence for that exact service, pathway, and
          jurisdiction is on file, current, and accepted. Expired evidence
          removes eligibility without anyone having to notice — the check runs
          again at quote, booking, job start, scope change, completion, and
          payout, not once at signup.
        </p>
        <p>
          Providers cannot borrow, share, or rely on someone else&apos;s
          credentials to reach a job. A credential belongs to the person or
          business it was issued to.
        </p>
      </section>

      <section>
        <h2>4. What our badges mean, exactly</h2>
        <p>
          Tuveloz does not describe a provider as &quot;certified,&quot;
          &quot;verified,&quot; &quot;screened,&quot; or &quot;insured&quot;
          beyond exactly what has been documented and disclosed for that
          service. Where we show a status, we intend to show what was actually
          checked, for which service, and when it expires.
        </p>
        <p>
          A single word like &quot;verified&quot; on a profile, with nothing
          behind it, invites you to assume more than anyone confirmed. We would
          rather show you a shorter, duller, true list.
        </p>
      </section>

      <section>
        <h2>5. What we do not verify</h2>
        <p>
          Tuveloz does not currently run criminal background checks or consumer
          reports. If that ever changes, the full legally required disclosure,
          written authorization, pre-adverse notice, dispute, and final-action
          process must be built and tested first, and we&apos;ll say so plainly
          before it starts.
        </p>
        <p>
          Verification is not a prediction. Confirming a registration does not
          promise that a provider is skilled, honest, careful, on time, or
          right for your vehicle. It confirms a document existed, applied, and
          was current. You still choose who works on your car.
        </p>
      </section>

      <section>
        <h2>6. Getting it wrong</h2>
        <p>
          If you believe a provider is offering a service they aren&apos;t
          approved for, or that something we displayed about a provider is
          inaccurate, email{" "}
          <a href="mailto:hello@tuveloz.com">hello@tuveloz.com</a>. Providers
          can dispute a verification decision about their own evidence through
          the appeals process in the{" "}
          <a href="/provisional-provider-policy">Provisional Provider Policy</a>.
        </p>
        <p>
          This policy doesn&apos;t override the <a href="/terms">Terms of Use</a>,
          the <a href="/customer-agreement">Customer Agreement</a>, or the{" "}
          <a href="/provider-agreement">Provider Agreement</a>, and it
          doesn&apos;t remove a right the law says can&apos;t be waived.
        </p>
      </section>
    </PolicyPage>
  );
}
