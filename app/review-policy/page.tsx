import { PolicyPage } from "../components/policy-page";

export default function ReviewPolicyPage() {
  return (
    <PolicyPage
      eyebrow="Legal"
      title="Review Policy"
      summary="Only people who actually hired a provider and had the work finished can review them. No exceptions, and none for sale."
      updated="August 6, 2026"
    >
      <section>
        <h2>Where things stand right now</h2>
        <p>
          Tuveloz is in provider-onboarding review, so no real job has been
          completed and no real review exists yet. This draft describes how
          reviews work once jobs are enabled. It is an operational document,
          not legal advice.
        </p>
      </section>

      <section>
        <h2>1. Who can leave a review</h2>
        <p>
          A review can only come from the customer of a specific job, using the
          private link for that job, after three things are true: the customer
          accepted a quote from that provider, the provider was the one
          selected, and the job is marked completed. One job, one review.
        </p>
        <p>
          That means nobody can review a provider they never hired — not a
          competitor, not a friend of the shop, not someone who never showed
          up. It isn&apos;t a moderation rule we apply after the fact. There is
          no route through the software to post a review without a completed
          job behind it.
        </p>
      </section>

      <section>
        <h2>2. Reviews are tied to the job, and stay that way</h2>
        <p>
          Every published review is bound to the job record it came from — the
          service, the provider, and the date. A review cannot be moved to a
          different provider, reassigned to a different job, or detached from
          the work it describes.
        </p>
        <p>
          Records created for internal testing are stored separately and are
          never published as customer reviews.
        </p>
      </section>

      <section>
        <h2>3. What Tuveloz will not do</h2>
        <p>
          Tuveloz does not sell review placement, does not let a provider pay
          to raise a rating or bury a bad one, and does not remove a truthful
          negative review because the provider asked, complained, or
          threatened. Ranking is not for sale.
        </p>
        <p>
          Tuveloz does not write reviews, does not ask staff or contractors to
          write them, and does not offer anything of value in exchange for a
          positive one. We will not condition a discount, a placement, or any
          benefit on the rating you leave.
        </p>
      </section>

      <section>
        <h2>4. What Tuveloz can remove</h2>
        <p>
          A review can be removed when it is unlawful, threatening, or
          harassing; discloses someone&apos;s private information; is about
          something other than the job; or was submitted through fraud or a
          security failure. Removal is about the content or its origin — never
          about whether it was flattering.
        </p>
        <p>
          Where it is practical and legally appropriate, we&apos;ll tell the
          person who wrote it why, and give them a chance to respond.
        </p>
      </section>

      <section>
        <h2>5. What a rating means</h2>
        <p>
          A rating is one customer&apos;s account of one job. It is not a
          Tuveloz endorsement, a safety finding, a quality guarantee, or a
          prediction about your job. Providers are independent businesses, and
          a good history with someone else&apos;s vehicle is not a promise
          about yours.
        </p>
        <p>
          A provider with few reviews is usually new, not bad. Tuveloz is new
          too, so early on there will not be much to read — we would rather
          show you an honest empty page than pad it.
        </p>
      </section>

      <section>
        <h2>6. Reporting a problem</h2>
        <p>
          To report a review you believe is fake, unlawful, or misassigned,
          email <a href="mailto:hello@tuveloz.com">hello@tuveloz.com</a> with
          the provider and what you noticed.
        </p>
        <p>
          This policy works alongside the{" "}
          <a href="/marketplace-conduct">Marketplace Conduct Policy</a> and
          doesn&apos;t override the <a href="/terms">Terms of Use</a> or remove
          a right the law says can&apos;t be waived.
        </p>
      </section>
    </PolicyPage>
  );
}
