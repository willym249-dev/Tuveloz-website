import { PolicyPage } from "../components/policy-page";
import { UNIVERSAL_SAFETY_RULES } from "../../lib/provider-safety-practices";

export default function ProviderSafetyPolicyPage() {
  const stopWork = UNIVERSAL_SAFETY_RULES.filter((rule) => rule.severity === "stop_work");
  const required = UNIVERSAL_SAFETY_RULES.filter((rule) => rule.severity === "required");

  return (
    <PolicyPage
      eyebrow="Providers"
      title="Provider Safety and Safe-Work Policy"
      summary="An operational review draft covering the safety rules you agree to follow on every Tuveloz job, and what to do when a job is not safe to perform."
      updated="August 7, 2026"
    >
      <section>
        <h2>Important current status</h2>
        <p>
          This policy is an operational draft, not legal advice, proof of
          compliance, or approval to launch. Tuveloz is in provider-onboarding
          mode, so no real customer job can be assigned or performed yet. This
          policy applies in full to every job once a service is enabled.
        </p>
      </section>

      <section>
        <h2>1. What this policy is, and what it is not</h2>
        <p>
          These are marketplace conduct rules. They exist to protect the
          customer, the vehicle, the people around the job, and you. Following
          them is a condition of keeping access to customer jobs.
        </p>
        <p>
          They are not repair instructions and they do not tell you how to do
          your trade. You keep control of the lawful method, tools, staffing,
          and sequence of the work. Tuveloz does not employ you, does not train
          you, does not supervise you, and does not direct your repair method.
          Nothing in this policy creates an employment relationship, and nothing
          in it makes Tuveloz responsible for the work you perform.
        </p>
      </section>

      <section>
        <h2>2. Stop-work rules</h2>
        <p>
          These are absolute. If one of them is not satisfied, do not start, or
          stop if you have already started. Leave the vehicle in a safe state
          and report it in the job record. You will never be penalized for
          stopping a job under this section, and Tuveloz does not track or
          reward acceptance rates.
        </p>
        <ul>
          {stopWork.map((rule) => (
            <li key={rule.code}>{rule.text}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2>3. Standard of care on every job</h2>
        <ul>
          {required.map((rule) => (
            <li key={rule.code}>{rule.text}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2>4. Service-specific rules</h2>
        <p>
          Each approved service adds its own hazard rules on top of the rules
          above, covering things like battery acid, wash-water capture, used-oil
          handling, lift points and torque, refrigerant recovery, fuel transfer,
          tow securement, and lockout authority. These are the standard you
          agree to by accepting this policy, and they apply on every job whether
          or not anyone asks you about them.
        </p>
        <p>
          Separately, when you arrive at a job you confirm the site conditions
          the app asks about before the timer will start — for example that the
          vehicle is secured and outside every active traffic lane, that there
          is no fire, smoke, or fuel leak, that you have permission to be on the
          property, and any controls your exact service and location require.
          Those confirmations are part of the job record. They check whether the
          place is safe to work; this policy governs how you work once it is.
        </p>
      </section>

      <section>
        <h2>5. Credentials and insurance</h2>
        <p>
          You must hold and keep current whatever licenses, registrations, and
          insurance the law requires for your exact service and location.
          Tuveloz asks for those and nothing else — we do not require extra
          coverage &quot;as a precaution.&quot; Depending on the service that can mean
          the Montgomery County repair or towing registration, a Maryland
          locksmith license and its insurance, custody coverage for towing, an
          EPA Section 609 certificate, an air permit for refinishing, or
          workers&apos; compensation if you have employees.
        </p>
        <p>
          You are an independent business. Whether to carry any coverage beyond
          the legal minimum is your call, and customers may ask you what you
          carry. Tell Tuveloz within five days if a required credential or
          policy is cancelled, non-renewed, or materially reduced. If one
          lapses, your access to the work that depends on it is suspended until
          it is current. Tuveloz does not provide, procure, or pay for your
          coverage and is not your insurer.
        </p>
      </section>

      <section>
        <h2>6. Incidents</h2>
        <p>
          Report any injury, property damage, spill, fire, theft, or police or
          fire response through the job record the same day it happens, with
          photographs. Do not repair or alter the scene beyond what is needed to
          make it safe. Do not admit or assign fault on Tuveloz&apos;s behalf, and do
          not tell a customer that Tuveloz insurance covers a loss. Cooperate
          with your insurer, and give Tuveloz the records it needs to preserve
          the job file.
        </p>
      </section>

      <section>
        <h2>7. Responsibility between you and Tuveloz</h2>
        <p>
          You are responsible for the work you perform and for damage or injury
          your work causes, including work performed by anyone you assign. You
          agree to cover Tuveloz for claims and reasonable costs arising from
          your work, your breach of this policy, your failure to carry required
          insurance or credentials, or the acts of anyone you assign. This does
          not apply to any part of a claim caused by Tuveloz&apos;s own conduct, and
          it does not reduce any right you have that Maryland law does not
          permit to be waived.
        </p>
      </section>

      <section>
        <h2>8. If you do not follow this policy</h2>
        <p>
          Depending on what happened, Tuveloz may ask for an explanation, pause
          a service, require re-confirmation of the safety rules, suspend
          customer-job access, or end your access. A stop-work rule broken in a
          way that endangered someone can end access immediately. You will be
          told the reason and given the job records the decision was based on.
        </p>
      </section>

      <section>
        <h2>9. Questions and changes</h2>
        <p>
          Ask anything at <a href="mailto:hello@tuveloz.com">hello@tuveloz.com</a>.
          A material change to this policy is published as a new version with a
          new effective date and requires a fresh acceptance before you take
          another job. This policy works alongside the{" "}
          <a href="/provider-agreement">Provider Agreement</a> and the{" "}
          <a href="/marketplace-conduct">Marketplace Conduct and Review Policy</a>.
        </p>
      </section>
    </PolicyPage>
  );
}
