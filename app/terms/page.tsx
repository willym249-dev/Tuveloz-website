import Link from "next/link";
import { PolicyPage } from "../components/policy-page";

export default function TermsPage() {
  return (
    <PolicyPage
      eyebrow="Legal"
      title="Terms of Use"
      summary="Plain-language terms for using Tuveloz&apos;s vehicle-service marketplace."
      updated="August 7, 2026"
    >
      <section>
        <h2>Where things stand right now</h2>
        <p>
          Tuveloz is currently in provider-onboarding review, not general use.
          No service is enabled for a real customer job yet, and customers
          can&apos;t post, book, pay for, start, complete, or release payout for a
          real job through the platform. Every service stays off until its
          specific legal, insurance, and technical requirements are documented
          and satisfied. This page describes how Tuveloz works once a service
          is enabled, and it applies in full once you use one.
        </p>
        <p>
          These Terms are an operational document, not a substitute for legal
          advice or proof of compliance. Tuveloz&apos;s owner may choose to proceed
          without private counsel for now, but that choice doesn&apos;t reduce any
          duty the law places on Tuveloz.
        </p>
        <p className="policy-callout">
          <strong>Please read section 13 before you agree.</strong> It requires
          most disputes with Tuveloz to go to individual arbitration instead of
          court, and gives up your right to a jury trial and to join a class
          action. <strong>You have 30 days to opt out</strong> and keep those
          rights. Opting out costs you nothing and changes nothing else about
          your account — the form is at{" "}
          <Link href="/arbitration-opt-out">tuveloz.com/arbitration-opt-out</Link>,
          and section 13 explains the rest.
        </p>
      </section>

      <section>
        <h2>1. Who this applies to</h2>
        <p>
          These Terms apply the moment you create an account, post a job,
          submit a quote, or otherwise use Tuveloz. If you&apos;re a customer, the{" "}
          <a href="/customer-agreement">Customer Agreement</a> also applies.
          If you&apos;re a provider, the{" "}
          <a href="/provider-agreement">Provider Agreement</a> also applies.
          The <a href="/privacy">Privacy Policy</a> and the{" "}
          <a href="/payments">Payment, Cancellation, and Refund Policy</a>{" "}
          apply too.
        </p>
        <p>
          You must be at least 18, able to enter a binding agreement, and
          authorized to act for anyone or any business you represent. If
          that&apos;s not you, please don&apos;t use Tuveloz.
        </p>
      </section>

      <section>
        <h2>2. Tuveloz is a marketplace, not a service provider</h2>
        <p>
          Tuveloz connects customers with independent vehicle-service provider
          businesses. Tuveloz doesn&apos;t perform, supervise, or guarantee any
          vehicle service, and doesn&apos;t hire, employ, train, sponsor, assign,
          direct, discipline, or supervise providers, mechanics, trainees, or
          provider-business employees. A provider business accepts the job,
          controls its own personnel, and performs the service under its own
          name.
        </p>
        <p>
          Once a service is enabled, an accepted quote creates a direct
          agreement between the customer and the provider business — Tuveloz
          is not a party to it. Customers decide whom to hire. Providers
          decide which jobs to pursue, what to quote, and how to do the work,
          lawfully. Using Tuveloz doesn&apos;t by itself create an employment,
          agency, partnership, or franchise relationship between any two
          users — actual legal status depends on the real facts, not the
          labels in these Terms.
        </p>
      </section>

      <section>
        <h2>3. The agreement between you and the other party</h2>
        <p>
          When a customer accepts a quote, the customer and provider form
          their own service agreement covering the labor scope, price,
          location, timing, and any changes they later approve. A provider&apos;s
          OEM-or-aftermarket note is a communication about parts the customer
          purchases separately — it&apos;s never a Tuveloz part sale or payment.
        </p>
        <p>
          Tuveloz isn&apos;t a party to that agreement just because it displays
          information, supports messages, collects the platform fee, or helps
          review a complaint. Nobody may make a promise or sign anything on
          Tuveloz&apos;s behalf.
        </p>
      </section>

      <section>
        <h2>4. What Tuveloz verifies</h2>
        <p>
          Tuveloz confirms only the specific license, registration, or
          insurance that the law actually requires for a given service —
          nothing else. There&apos;s no single credential that covers every kind
          of vehicle work, so what&apos;s checked depends on the exact service and
          location. Tuveloz doesn&apos;t represent that a provider is
          &quot;certified,&quot; &quot;verified,&quot; or &quot;insured&quot; beyond exactly what&apos;s been
          documented and disclosed for that service, and providers can&apos;t
          borrow, share, or rely on someone else&apos;s credentials to get job
          access.
        </p>
        <p>
          Right now, at this onboarding-only stage, no service is enabled for
          a real job — a service moves forward only after its legal
          requirements are documented, satisfied, and the corresponding
          controls are deliberately turned on.
        </p>
      </section>

      <section>
        <h2>5. Using Tuveloz responsibly</h2>
        <p>
          Give accurate, current information, and use Tuveloz only for lawful
          vehicle-service requests. Don&apos;t impersonate anyone, post a job you
          can&apos;t authorize, misstate credentials, prices, reviews, or work
          performed, harass or discriminate unlawfully, interfere with
          platform security, scrape private data, upload malware, or use
          Tuveloz for fraud or unsafe or illegal work.
        </p>
        <p>
          Keep your password, one-time codes, and account access private, and
          tell us right away if you think your account may have been
          compromised.
        </p>
      </section>

      <section>
        <h2>6. Quotes, changes, and warranties</h2>
        <p>
          Providers set their own labor quotes and need to clearly describe
          the scope, any parts assumptions, timing, exclusions, and price.
          Tuveloz quotes, invoices, and checkout never include
          provider-supplied parts, parts reimbursement, or parts tax — any
          needed part is something the customer buys separately. Work or
          price beyond the accepted quote needs the customer&apos;s approval
          first.
        </p>
        <p>
          If a provider offers a service or parts warranty, that&apos;s between
          the customer and the provider — Tuveloz doesn&apos;t offer one just by
          operating the marketplace. Nothing here cancels out a warranty or
          right that the law says can&apos;t be waived.
        </p>
      </section>

      <section>
        <h2>7. Fees</h2>
        <p>
          Once enabled, Tuveloz plans to charge a 5% fee on completed jobs,
          added to the provider&apos;s quoted price and shown to the customer
          before they accept. There&apos;s no fee to browse, post a request, apply
          as a provider, or send a quote. That 5% figure is Tuveloz&apos;s
          proposed pricing — it still needs final sign-off from a tax
          adviser, the payment processor, and Tuveloz&apos;s insurance broker
          before it&apos;s final.
        </p>
        <p>
          Once payments are turned on, they&apos;ll be governed by the{" "}
          <a href="/payments">Payment, Cancellation, and Refund Policy</a>,
          including how refunds, disputes, and chargebacks work. Operating a
          payment flow wouldn&apos;t make Tuveloz the vehicle-service provider, and
          it wouldn&apos;t remove any payment-related duty the law places directly
          on Tuveloz.
        </p>
      </section>

      <section>
        <h2>8. Content and reviews</h2>
        <p>
          You keep ownership of anything you post. You&apos;re giving Tuveloz
          permission to host, copy, resize, display, and share that content
          only as needed to run the platform and any public provider page you
          choose to publish, and only if you actually have the right to share
          it.
        </p>
        <p>
          Reviews need to reflect a real experience. Don&apos;t upload payment
          credentials, unnecessary identity documents, faces, addresses, or
          visible license plates. Tuveloz
          can remove content that&apos;s unlawful, deceptive, unsafe, or invades
          someone&apos;s privacy.
        </p>
      </section>

      <section>
        <h2>9. Safety</h2>
        <p>
          Tuveloz isn&apos;t an emergency, towing-dispatch, roadside-rescue,
          police, fire, or medical service. Choose a lawful, reasonably safe
          place to do the work, and stop if conditions turn unsafe. A
          diagnostic or pre-purchase opinion isn&apos;t an official government
          inspection unless a provider specifically says it is.
        </p>
      </section>

      <section>
        <h2>10. Suspending or ending access</h2>
        <p>
          You can stop using Tuveloz any time, subject to any jobs, payments,
          or disputes still open. Tuveloz can restrict, suspend, or end your
          access to protect users or the platform, look into a real concern,
          deal with an expired or invalid credential, follow the law or
          payment-network rules, or respond to a serious breach of these
          Terms. Where it&apos;s practical and legally appropriate, we&apos;ll tell you
          why and give you a chance to respond.
        </p>
      </section>

      <section>
        <h2>11. Disclaimers</h2>
        <p>
          If adopted, the platform is provided &quot;as is&quot; and &quot;as available.&quot;
          Tuveloz doesn&apos;t promise uninterrupted access, a certain number of
          quotes, that user statements are accurate, or a particular outcome
          from a provider&apos;s work — you make your own call about who and
          what&apos;s right for you. Nothing here cancels a right the law says
          can&apos;t be waived.
        </p>
      </section>

      <section>
        <h2>12. Liability</h2>
        <p>
          Tuveloz&apos;s role is limited to running the marketplace. To the
          fullest extent Maryland law allows, Tuveloz&apos;s liability for any
          claim is capped at the platform fee collected on the job the claim
          is about. This cap doesn&apos;t remove a right, duty, or remedy the law
          doesn&apos;t let us waive — and it isn&apos;t a claim that Tuveloz has zero
          liability.
        </p>
      </section>

      <section>
        <h2>13. Resolving disputes with Tuveloz</h2>
        <p>
          Before filing a claim against Tuveloz, email{" "}
          <a href="mailto:hello@tuveloz.com">hello@tuveloz.com</a> with what
          happened and what you&apos;re asking for, so we can both try to work it
          out first. That doesn&apos;t extend any legal filing deadline you have.
        </p>
        <p>
          These Terms are governed by the laws of the State of Maryland, without
          regard to its conflict-of-laws rules. Any claim that isn&apos;t resolved
          between us belongs in the state or federal courts located in
          Montgomery County, Maryland, and we each agree those courts have
          jurisdiction. If your claim qualifies for small-claims court, you can
          bring it there instead.
        </p>
        <h3>Binding individual arbitration</h3>
        <p>
          If talking it out doesn&apos;t work, you and Tuveloz agree to resolve the
          dispute by <strong>binding individual arbitration</strong> rather than
          in court, and each of us gives up the right to a jury trial. This
          applies to any dispute between you and Tuveloz arising out of or
          relating to these Terms or your use of Tuveloz, including disputes
          about whether this section itself applies. It binds Tuveloz exactly
          as much as it binds you.
        </p>
        <p>
          Arbitration is run by the American Arbitration Association under its
          Consumer Arbitration Rules, by a single arbitrator, and the
          arbitrator&apos;s decision can be entered as a judgment in any court with
          jurisdiction. Unless you and Tuveloz agree otherwise, any in-person
          hearing happens in the county where you live — not where Tuveloz is.
          You can also choose to have it decided on written submissions or by
          phone or video.
        </p>

        <h3>What arbitration does not cover</h3>
        <p>Either of us can still go to court for:</p>
        <ul>
          <li>
            <strong>Small claims.</strong> Any claim that qualifies can be
            brought in small-claims court instead, and you don&apos;t need our
            agreement to do that.
          </li>
          <li>
            <strong>Sexual assault or sexual harassment.</strong> Under the
            federal Ending Forced Arbitration of Sexual Assault and Sexual
            Harassment Act, if your dispute relates to sexual assault or sexual
            harassment, <strong>you choose</strong> whether it goes to
            arbitration or to court, and no class waiver applies to it. That
            choice is entirely yours.
          </li>
          <li>
            <strong>Emergency orders</strong> to stop misuse of accounts,
            security systems, or intellectual property, while the rest of the
            dispute goes to arbitration.
          </li>
        </ul>

        <h3>How to opt out — 30 days, no cost</h3>
        <p>
          You can decline arbitration entirely, within <strong>30 days</strong>{" "}
          of first accepting these Terms. Either of these works, and they count
          the same:
        </p>
        <ul>
          <li>
            Use the form at{" "}
            <Link href="/arbitration-opt-out">tuveloz.com/arbitration-opt-out</Link>{" "}
            — one field, and it&apos;s recorded immediately.
          </li>
          <li>
            Or email <a href="mailto:hello@tuveloz.com">hello@tuveloz.com</a>{" "}
            with the subject <strong>&quot;Arbitration opt-out&quot;</strong> and
            the email address or phone number on your account.
          </li>
        </ul>
        <p>
          That&apos;s all it takes. It costs nothing, we&apos;ll confirm in
          writing, and it has no effect on your account, your pricing, or how
          your jobs are handled — we won&apos;t treat you differently for it. If
          you opt out, disputes go to the Montgomery County courts described
          above.
        </p>
        <p>
          An opt-out applies to the version of these Terms you accepted. If we
          publish a new version, you get a fresh 30 days to decline arbitration
          under that one.
        </p>

        <h3>No class actions</h3>
        <p>
          Claims are brought individually. Neither you nor Tuveloz may bring a
          class, collective, consolidated, or representative action, and the
          arbitrator may only award relief to the individual party asking for
          it. If you opt out of arbitration, this paragraph doesn&apos;t apply to
          you either.
        </p>
        <p>
          If many similar claims are filed against Tuveloz at around the same
          time by the same or coordinated counsel, we and the claimants may
          agree with AAA to hear a small number of representative cases first
          and apply what the arbitrators decide to the rest, so that nobody
          waits years in a queue. Any claimant who prefers to have their own
          case heard separately can say so and keep that right.
        </p>

        <h3>Costs</h3>
        <p>
          <strong>Tuveloz pays the AAA filing, administrative, and arbitrator
          fees</strong> on any claim you bring that exceed what it would have
          cost you to file the same claim in court. This applies whether you are
          an individual or a provider business — we are not drawing a line
          between &quot;consumers&quot; and &quot;businesses&quot; here, because a
          one-person provider business facing our filing costs is in exactly the
          position this paragraph exists to prevent. You are never required to
          pay Tuveloz&apos;s legal fees as a condition of arbitrating, and nothing
          here limits what the law lets you recover.
        </p>

        <h3>If part of this doesn&apos;t hold up</h3>
        <p>
          If the class-action waiver above is found unenforceable for a
          particular claim, that claim goes to court instead — it is never
          arbitrated as a class. If any other part of this section is found
          unenforceable, the rest still applies. This section survives after
          your account closes.
        </p>
      </section>

      <section>
        <h2>14. Changes to these Terms</h2>
        <p>
          We&apos;ll post material changes with a new date, and ask you to accept
          them again before a new transaction if that&apos;s legally required. A
          change won&apos;t rewrite a service agreement you already accepted,
          unless both sides agree or the law requires it.
        </p>
        <p>
          If one part of these Terms turns out to be unenforceable, the rest
          still applies. Not enforcing a provision once doesn&apos;t waive it.
        </p>
      </section>
    </PolicyPage>
  );
}
