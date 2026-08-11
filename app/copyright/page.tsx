import { PolicyPage } from "../components/policy-page";

export default function CopyrightPage() {
  return (
    <PolicyPage
      eyebrow="Legal"
      title="Copyright &amp; DMCA Policy"
      summary="How to report content on Tuveloz that infringes a copyright, and what happens after a report."
      updated="August 6, 2026"
    >
      <section>
        <h2>1. What this covers</h2>
        <p>
          Users upload photos, reviews, business descriptions, and other
          content to Tuveloz. Tuveloz respects copyright owners&apos; rights and
          follows the Digital Millennium Copyright Act (DMCA) notice-and-
          takedown process for user-posted content on the platform. This page
          explains how to send a takedown notice, how a user can respond with
          a counter-notice, and what happens to repeat infringers.
        </p>
      </section>

      <section>
        <h2>2. Sending a takedown notice</h2>
        <p>
          If you believe content on Tuveloz infringes a copyright you own or
          are authorized to act for, email{" "}
          <a href="mailto:hello@tuveloz.com?subject=DMCA%20Takedown%20Notice">
            hello@tuveloz.com
          </a>{" "}
          with the subject &quot;DMCA Takedown Notice.&quot; Under 17 U.S.C. § 512(c)(3),
          an effective notice must include:
        </p>
        <p>
          (1) identification of the copyrighted work you claim is infringed;
          (2) identification of the material you want removed, with enough
          detail for us to find it — a link to the page is best; (3) your
          name, mailing address, phone number, and email; (4) a statement
          that you have a good-faith belief the use isn&apos;t authorized by the
          copyright owner, its agent, or the law; (5) a statement, under
          penalty of perjury, that the notice is accurate and that you&apos;re
          the copyright owner or authorized to act for them; and (6) your
          physical or electronic signature.
        </p>
        <p>
          Knowingly misrepresenting that material is infringing can make you
          liable for damages under 17 U.S.C. § 512(f). If your notice is
          complete, we&apos;ll remove or disable access to the identified
          material promptly and make a reasonable attempt to notify the user
          who posted it.
        </p>
      </section>

      <section>
        <h2>3. Counter-notices</h2>
        <p>
          If your content was removed and you believe that was a mistake or a
          misidentification, you can send a counter-notice to the same email
          address. It must include: identification of the removed material
          and where it appeared; a statement under penalty of perjury that
          you have a good-faith belief the removal was a mistake or
          misidentification; your name, address, and phone number; a
          statement that you consent to the jurisdiction of the federal
          district court for your address (or, if outside the United States,
          for any judicial district where Tuveloz may be found) and that
          you&apos;ll accept service of process from the person who sent the
          original notice; and your physical or electronic signature.
        </p>
        <p>
          If we receive a valid counter-notice, we&apos;ll forward it to the
          original complainant. Unless they tell us within 10 business days
          that they&apos;ve filed a court action seeking to restrain the alleged
          infringement, we may restore the removed material within 10 to 14
          business days.
        </p>
      </section>

      <section>
        <h2>4. Repeat infringers</h2>
        <p>
          Tuveloz terminates the accounts of users who repeatedly infringe
          copyrights, in appropriate circumstances, and may remove content or
          restrict an account after a single clear-cut infringement where
          that&apos;s warranted.
        </p>
      </section>

      <section>
        <h2>5. Designated agent</h2>
        <p>
          Copyright notices for Tuveloz should go to:{" "}
          <a href="mailto:hello@tuveloz.com">hello@tuveloz.com</a> (subject
          line &quot;DMCA Takedown Notice&quot; or &quot;DMCA Counter-Notice&quot;). This
          address is only for copyright matters — other legal or support
          questions belong at the same address without a DMCA subject line,
          and using a DMCA subject line for a non-copyright complaint may
          delay a response.
        </p>
      </section>
    </PolicyPage>
  );
}
