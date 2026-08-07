import { PolicyPage } from "../components/policy-page";

export default function PrivacyPage() {
  return (
    <PolicyPage
      eyebrow="Privacy"
      title="Privacy Policy"
      summary="What Tuveloz collects, why it is needed, who receives it, and the choices available to you."
      updated="August 7, 2026"
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
          <li>Customer job data, including vehicle details or a VIN you choose to provide, requested services, general area, exact service address when needed, photos, condition records, quote selections, messages, status, and reviews.</li>
          <li>Provider data, including business name and location, performing-person name, service areas, service options, experience, insurance responses, legally applicable credential records, identity-verification status and references, verification decisions, profile content, and Stripe connected-account identifiers.</li>
          <li>Transaction data, including displayed amounts, payment status, receipt email, refunds, disputes, transfer status, and Stripe transaction identifiers.</li>
          <li>Technical and security data needed to deliver the site, secure accounts, prevent abuse, investigate errors, and maintain audit records.</li>
        </ul>
        <p>
          Stripe collects payment-card, identity, payout, tax, and bank
          information on Stripe-hosted pages. A Stripe Identity document-and-selfie
          check captures images of a government-issued photo ID and the person&apos;s
          face, extracts identity information such as name and date of birth, and
          uses biometric comparison to determine whether the selfie matches the ID.
          Stripe asks for its own consent in the hosted flow and handles that data
          under Stripe&apos;s privacy terms. Tuveloz does not receive or store complete
          card or bank-account numbers.
        </p>
        <p>
          Tuveloz&apos;s application processes the verified name and date of birth in
          memory only to compare the named performing person and confirm adult
          status. Tuveloz stores the Stripe session or report reference, decision,
          check date, and validity date, but not the verified name, date of birth, ID
          number, document image, selfie, or biometric identifier. Authorized
          Tuveloz administrators may be able to access identity information in the
          restricted Stripe Dashboard when reasonably necessary for verification,
          fraud or security review, a privacy request, or a legal obligation.
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
          <li>Stripe processes checkout, connected accounts, transfers, refunds, disputes, payment risk, and hosted provider identity document-and-selfie verification.</li>
          <li>Cloudflare provides hosting, security, database, and private image-storage services.</li>
          <li>Cloudmersive receives a quarantined provider-evidence file solely to scan it for malware and unsafe file content before Tuveloz permits review or download.</li>
          <li>OpenAI, Google, and Anthropic provide the models behind Tuveloz AI, the optional assistant that helps you put words to what your vehicle is doing. What you type into it — and nothing else — is sent to one of them to produce a reply. Tuveloz AI is optional; if you never open it, nothing goes to them from you. Do not enter payment details, passwords, or government-ID numbers there, and the assistant is instructed not to ask for them.</li>
          <li>The same model providers may receive a provider&apos;s submitted compliance document to read the details printed on it — business name, license or policy number, issuer, and dates — so those can be checked against the application. This applies to provider evidence only, never to a customer&apos;s information. It is a reading step: it never decides whether a document is accepted, and it never replaces the external check Tuveloz performs with the issuing authority, insurer, or approved vendor.</li>
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
          effects. Where automated tools help review a provider application,
          they sort, read, and flag — a person makes every decision that
          approves, rejects, or limits a provider, and the only step a tool
          completes on its own is asking a provider to re-upload a document
          that is expired or undated, which the provider can simply redo. Public provider pages omit private email and exact address
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
        <p>
          Stripe controls its retention of identity images, extracted identity
          data, and biometric identifiers under Stripe&apos;s privacy terms and the
          choices Stripe presents in its hosted flow. Tuveloz may ask Stripe to
          redact an eligible verification session when the information is no
          longer needed, subject to fraud, security, dispute, and legal-retention
          requirements. A limited Tuveloz verification and audit reference may be
          retained for those purposes even after Stripe-hosted data is redacted.
        </p>
      </section>

      <section>
        <h2>8. Your privacy choices and requests</h2>
        <p>
          Subject to applicable law, you may ask Tuveloz to confirm whether it is
          processing your personal information; provide access or a portable
          copy; correct inaccuracies; delete information; limit certain uses; or
          identify categories of third parties that received personal information.
          You may also opt out if Tuveloz later begins selling information, using
          it for targeted advertising, or using it for covered profiling.
        </p>
        <p>
          Signed-in customers and providers can use the{" "}
          <a href="/privacy-center">Tuveloz Privacy Center</a> to download an
          account-data copy, correct profile information, manage optional email
          choices, submit a verified request, see its status, withdraw an open
          request, or appeal a completed or denied decision.
        </p>
        <p>
          People who cannot sign in may email{" "}
          <a href="mailto:hello@tuveloz.com?subject=Privacy%20Request">hello@tuveloz.com</a>{" "}
          with the subject &ldquo;Privacy Request.&rdquo; We may verify identity and authority
          before acting. We will respond within the period required by applicable
          law and explain any denial. Privacy requests do not require payment, and
          Tuveloz will not discriminate against someone for exercising an applicable right.
        </p>
        <p>
          A provider who does not want to use a selfie or other biometric identity
          check may contact{" "}
          <a href="mailto:hello@tuveloz.com?subject=Alternative%20Identity%20Verification">
            hello@tuveloz.com
          </a>{" "}
          before starting Stripe Identity to request an available non-biometric
          external verification method. Requesting an alternative does not grant
          job access or waive identity, age, credential, or service requirements.
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
        <p>
          The public <a href="/system-status">Tuveloz System Status</a> reports
          whether the application release, database connection, and required
          operational schema are ready. It does not expose credentials, private
          records, user counts, payment details, or internal security controls.
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
