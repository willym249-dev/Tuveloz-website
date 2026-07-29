import { PolicyPage } from "../components/policy-page";

export default function PrivacyPage() {
  return (
    <PolicyPage
      eyebrow="Privacy"
      title="Privacy Policy"
      summary="What Tuveloz collects, why it is needed, who receives it, and the choices available to you."
      updated="July 28, 2026"
    >
      <section>
        <h2>1. Scope and sources</h2>
        <p>
          This policy applies to personal information TUVELOZ LLC processes
          through its website, accounts, customer requests, provider applications,
          public provider pages, support, communications, and payment records. We
          receive information from you, the other party to a job, service
          providers that operate the platform, and records created through your
          use of Tuveloz.
        </p>
      </section>

      <section>
        <h2>2. Information we collect</h2>
        <ul>
          <li>Identifiers and account data, including name, email, role, password hash, session and sign-in records, language, and support messages.</li>
          <li>Customer job data, including vehicle details or a VIN you choose to provide, requested services, general area, exact service address when needed, photos, quote selections, messages, status, and reviews.</li>
          <li>Provider data, including business name and location, service areas, service options, experience, insurance responses, legally applicable credential records, verification decisions, profile content, and Stripe connected-account identifiers.</li>
          <li>Transaction data, including displayed amounts, payment status, receipt email, refunds, disputes, transfer status, and Stripe transaction identifiers.</li>
          <li>Technical and security data needed to deliver the site, secure accounts, prevent abuse, investigate errors, and maintain audit records.</li>
        </ul>
        <p>
          Stripe collects payment-card, identity, payout, tax, and bank
          information on Stripe-hosted pages. Tuveloz does not receive or store
          complete card or bank-account numbers.
        </p>
      </section>

      <section>
        <h2>3. Why we use information</h2>
        <p>
          We use information to create and secure accounts; receive requests and
          applications; determine service-area and service eligibility; match
          requests with providers; present quotes and job updates; verify
          legally applicable provider credentials; process and reconcile
          payments; publish provider-selected profile content; prevent fraud;
          resolve support, safety, privacy, and payment issues; maintain legal,
          tax, and accounting records; and improve Tuveloz.
        </p>
        <p>
          Tuveloz limits collection to information reasonably necessary and
          proportionate to these purposes. We do not use personal information for
          a materially unrelated purpose without notice and any consent required
          by law.
        </p>
      </section>

      <section>
        <h2>4. Exact location and staged sharing</h2>
        <p>
          Providers deciding whether to quote receive limited job information and
          the general service area—not the customer&apos;s private email or exact
          street address. After the customer selects a provider, that provider
          receives the contact and exact location reasonably needed to arrange the
          accepted job. The customer receives relevant provider business and
          contact information.
        </p>
        <p>
          If you enter an exact address for service at your location, you direct
          Tuveloz to use it and share it with the selected provider solely to
          arrange and support that service. Where available, you may instead
          choose to meet at the provider&apos;s business location and avoid
          submitting a customer service address.
        </p>
      </section>

      <section>
        <h2>5. Service providers and other disclosures</h2>
        <ul>
          <li>Stripe processes checkout, connected accounts, transfers, refunds, disputes, and payment risk.</li>
          <li>Cloudflare provides hosting, security, database, and private image-storage services.</li>
          <li>Resend provides transactional email delivery.</li>
          <li>Professional advisers may receive information when reasonably necessary for accounting, insurance, security, or legal work and subject to appropriate duties.</li>
          <li>Information may be disclosed to comply with law, valid legal process, payment-network rules, or a good-faith need to protect users, rights, property, or platform security.</li>
          <li>Information may transfer as part of a merger, financing, acquisition, reorganization, or sale, subject to this policy and applicable law.</li>
        </ul>
      </section>

      <section>
        <h2>6. No sale, behavioral ads, or solely automated decisions</h2>
        <p>
          Tuveloz does not sell personal information. We do not currently use
          personal information for cross-site targeted advertising or solely
          automated decisions that produce legal or similarly significant
          effects. Public provider pages omit private email and exact address
          information, and public reviews use a first name and last initial.
        </p>
      </section>

      <section>
        <h2>7. Retention</h2>
        <p>
          We keep information only as long as reasonably needed for the purpose
          collected, account and service delivery, safety, security, disputes,
          refunds and chargebacks, fraud prevention, tax and accounting records,
          and other legal duties. Retention depends on the record type, whether a
          job or account remains active, and whether a legal or payment issue is
          open. We delete or de-identify information when it is no longer
          reasonably needed, unless law permits or requires retention.
        </p>
      </section>

      <section>
        <h2>8. Your privacy choices and requests</h2>
        <p>
          Subject to applicable law, you may ask Tuveloz to confirm whether it is
          processing your personal information; provide access or a portable
          copy; correct inaccuracies; delete information; or identify categories
          of third parties that received personal information. You may also opt
          out if Tuveloz later begins selling information, using it for targeted
          advertising, or using it for covered profiling.
        </p>
        <p>
          Email <a href="mailto:hello@tuveloz.com?subject=Privacy%20Request">hello@tuveloz.com</a>{" "}
          with the subject “Privacy Request.” We may verify your identity and
          authority before acting. We will respond within the period required by
          applicable law and explain any denial. You may appeal a denial by
          replying with the subject “Privacy Appeal”; the appeal will be reviewed
          by someone other than the original reviewer when practical. You do not
          need to create a new account to submit a request.
        </p>
      </section>

      <section>
        <h2>9. Security</h2>
        <p>
          Tuveloz uses password hashing, expiring one-time codes, rate and lockout
          controls, secure session cookies, role-based and record-level access
          controls, restricted private images, signed Stripe webhooks, HTTPS,
          security headers, and limited administrative access. No system can
          guarantee absolute security. Report suspected unauthorized access
          promptly to <a href="mailto:hello@tuveloz.com?subject=Security%20Report">hello@tuveloz.com</a>.
        </p>
      </section>

      <section>
        <h2>10. Cookies and device storage</h2>
        <p>
          Tuveloz uses essential cookies to secure signed-in sessions and device
          storage for choices such as language. We do not currently use
          advertising cookies. If that changes, this policy and any legally
          required choice mechanism will be updated first.
        </p>
      </section>

      <section>
        <h2>11. Age limit, changes, and contact</h2>
        <p>
          Tuveloz accounts, job requests, provider applications, and checkout are
          for adults. Tuveloz does not knowingly collect account information from
          anyone under 18. Material changes will be posted with a new date and
          presented for consent when law requires it.
        </p>
        <p>
          Contact TUVELOZ LLC at{" "}
          <a href="mailto:hello@tuveloz.com">hello@tuveloz.com</a> about this
          policy or a privacy request.
        </p>
      </section>
    </PolicyPage>
  );
}
