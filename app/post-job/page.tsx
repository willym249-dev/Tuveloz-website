import type { Metadata } from "next";
import Link from "next/link";
import {
  CUSTOMER_REQUEST_ACCEPTANCE_TEXT,
  CUSTOMER_REQUEST_AGREEMENT_KEY,
  CUSTOMER_REQUEST_AGREEMENT_VERSION,
  CUSTOMER_REQUEST_PRIVACY_ACKNOWLEDGMENT_TEXT,
  CUSTOMER_REQUEST_PRIVACY_AGREEMENT_KEY,
  CUSTOMER_REQUEST_PRIVACY_AGREEMENT_VERSION,
  customerRequestAgreementHash,
  customerRequestPrivacyAgreementHash,
} from "../../lib/customer-job-scope";
import { CUSTOMER_JOB_POSTING_PAUSED } from "../../lib/launch-status";
import { CUSTOMER_STEPS, LAUNCH_SERVICES } from "../../lib/marketing-content";
import { CustomerRequestForm } from "../components/customer-request-form";
import { LaunchUpdatesForm } from "../components/launch-updates-form";
import { PublicSiteFooter, PublicSiteHeader } from "../components/public-chrome";
import { TuvelozIcon } from "../components/tuveloz-icons";

export const metadata: Metadata = {
  title: "For Customers — Real Quotes From Local Pros",
  description:
    "Say what your car needs once and compare real quotes from independent local providers in Montgomery County, MD. Free to post, free to compare, no obligation.",
};

const valueProps = [
  {
    icon: "quote" as const,
    title: "Real prices, side by side",
    text: "No “bring it in and we'll see.” You get actual numbers from actual local providers, and you read them all before you commit to anything.",
  },
  {
    icon: "open-jobs" as const,
    title: "Only the pros who fit",
    text: "Your request reaches providers approved for that exact service in your area — not a call list. Less phone tag, better matches.",
  },
  {
    icon: "active-job" as const,
    title: "They come to your car",
    text: "Mobile mechanics and service trucks work where your car already sits: your driveway, your office lot, your street.",
  },
];

const trustPoints = [
  {
    title: "You are never locked in",
    text: "Posting is free, comparing is free, and you can accept nothing at all. There is no fee for walking away.",
  },
  {
    title: "Independent local businesses",
    text: "Providers are their own businesses, not Tuveloz employees. They set their own price, schedule, and methods — and you see exactly who you picked.",
  },
  {
    title: "Your address stays yours",
    text: "Providers see only what they need in order to decide whether to quote. Your exact address and contact details go to the one provider you select.",
  },
  {
    title: "The fee is on the screen",
    text: "Tuveloz adds an itemized 5% customer service fee to the total, shown before you confirm. It is never buried inside the provider's labor price.",
  },
];

const faqs = [
  {
    question: "What does it cost me?",
    answer:
      "Posting a request and comparing quotes is free. You pay only for work you accept: the provider's quoted labor price plus an itemized 5% Tuveloz service fee, both shown before you confirm.",
  },
  {
    question: "Do I have to accept a quote?",
    answer:
      "No. Read every quote, ask questions, and accept none of them if nothing fits. There is no obligation and no charge for deciding not to book.",
  },
  {
    question: "Who actually does the work?",
    answer:
      "An independent local provider you choose. Tuveloz is the marketplace that connects you and keeps the paperwork straight; the work itself is a direct agreement between you and that provider.",
  },
  {
    question: "What about parts?",
    answer:
      "Tuveloz quotes cover labor. You buy the part separately, and the request flow is built to line up the exact part before the appointment so a wrong part does not waste anyone's trip.",
  },
  {
    question: "When can I post a job?",
    answer:
      "Providers are onboarding in Montgomery County, Maryland right now, and customer requests and payments switch on once launch review is complete. Create your account today and you are first in line — signing up does not submit a request, contact a provider, book service, or charge you.",
  },
  {
    question: "My car needs something that is not listed. Now what?",
    answer:
      "Tell us anyway. The services people ask for most are the ones we open next, and area requests decide where Tuveloz launches after Montgomery County.",
  },
];

function CustomerLander() {
  return (
    <main className="public-site lander-page">
      <PublicSiteHeader />

      <section className="hero" id="top">
        <div className="hero-glow" />
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="pulse" />
            Early access · Montgomery County, MD
          </div>
          <h1>
            Car trouble.
            <br />
            <span className="hero-value-line">Real quotes. Zero guesswork.</span>
          </h1>
          <p>
            Say what your car needs once. Independent local providers send you their
            own price, you put those prices side by side, and you pick. No calling
            five shops, no mystery number at pickup.
          </p>
          <ul className="hero-highlights">
            <li><span aria-hidden="true">✓</span> Free to post, free to compare</li>
            <li><span aria-hidden="true">✓</span> Real local providers, not a call center</li>
            <li><span aria-hidden="true">✓</span> Accept a quote only if it fits</li>
          </ul>
          <div className="hero-actions">
            <Link className="button primary" href="/account?role=customer&mode=create">
              Get early access — free <span>→</span>
            </Link>
            <a className="button secondary" href="#how-it-works">
              See how it works <span>→</span>
            </a>
            <Link className="button ai" href="/ai">
              Try Tuveloz AI <span>✦</span>
            </Link>
          </div>
          <div className="hero-launch-note">
            <strong>
              Providers are joining now. Customer requests open at launch — early-access
              accounts go first.
            </strong>
            <Link href="/about#expansion">Outside the county? Request your area →</Link>
          </div>
        </div>

        <div
          className="hero-visual"
          aria-label="Preview of the planned Tuveloz quote comparison"
          role="img"
        >
          <div className="quote-board">
            <article className="quote-ticket qt-1">
              <div className="qt-head"><span>JOB #4471</span><b>Preview</b></div>
              <strong>Battery replacement</strong>
              <span className="qt-price">$118</span>
              <small>Ramirez Mobile Auto · concept preview</small>
            </article>
            <article className="quote-ticket qt-2">
              <div className="qt-head"><span>JOB #4471</span><b>Preview</b></div>
              <strong>Battery replacement</strong>
              <span className="qt-price">$96</span>
              <small>Silver Spring Auto Care · concept preview</small>
            </article>
            <article className="quote-ticket qt-3 qt-selected">
              <div className="qt-head"><span>JOB #4471</span><b>Planned pick</b></div>
              <strong>Battery replacement</strong>
              <span className="qt-price">$96</span>
              <small>Silver Spring Auto Care · concept preview</small>
              <span className="qt-stamp">YOU CHOOSE</span>
            </article>
          </div>
          <p className="hero-visual-caption">
            Concept preview — not a live job. Customer requests and quotes open at launch.
          </p>
        </div>
      </section>

      <section className="proof-strip" aria-label="What Tuveloz promises customers">
        <span><b>Free</b> to post and to compare quotes</span>
        <span><b>No obligation</b> — accept a quote only if it fits</span>
        <span><b>5% fee</b> itemized before you confirm</span>
        <span><b>Montgomery County</b> Maryland, with more areas next</span>
      </section>

      <section className="section lander-value" aria-labelledby="lander-value-heading">
        <div className="section-heading">
          <div>
            <span className="kicker">Why customers use Tuveloz</span>
            <h2 id="lander-value-heading">Stop guessing what a repair should cost.</h2>
          </div>
          <p>
            The worst part of car trouble is not the repair — it is not knowing whether
            the price is fair. Tuveloz puts the answer in front of you before you commit.
          </p>
        </div>
        <div className="lander-value-grid">
          {valueProps.map((item) => (
            <article key={item.title}>
              <span className="lander-value-icon">
                <TuvelozIcon name={item.icon} />
              </span>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section how" id="how-it-works">
        <div className="how-intro">
          <span className="kicker light">How it works</span>
          <h2>Three steps. That is the whole thing.</h2>
          <p>
            Requests and quotes switch on at launch. Set up your account now and step one
            takes about a minute on the day it opens.
          </p>
          <Link className="text-link" href="/how-it-works">Read the full flow →</Link>
        </div>
        <div className="steps">
          {CUSTOMER_STEPS.map((step) => (
            <article key={step.number}>
              <span>{step.number}</span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section services" id="services">
        <div className="section-heading">
          <div>
            <span className="kicker">Services we open with</span>
            <h2>The everyday stuff, handled where you park.</h2>
          </div>
          <p>
            These are the first services opening in Montgomery County. Each one switches
            on for real jobs as it clears launch review, and early-access customers hear
            the moment it does.
          </p>
        </div>
        <div className="service-cards">
          {LAUNCH_SERVICES.map((service) => (
            <article key={service.title}>
              <div className="service-icon">
                <TuvelozIcon name={service.icon} />
              </div>
              <h3>{service.title}</h3>
              <p>{service.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="trust-section" aria-labelledby="lander-trust-heading">
        <div className="trust-intro">
          <span className="kicker light">Straight answers</span>
          <h2 id="lander-trust-heading">Nothing about this is designed to trap you.</h2>
          <p className="trust-intro-text">
            Here is where Tuveloz&apos;s responsibility starts and stops, in plain words,
            before you sign up for anything.
          </p>
        </div>
        <div className="trust-grid lander-trust-grid">
          {trustPoints.map((point) => (
            <article className="trust-card" key={point.title}>
              <span className="trust-card-label">{point.title}</span>
              <p>{point.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section early-access" id="early-access">
        <div className="early-access-copy">
          <span className="kicker">Early access</span>
          <h2>Be first in line when requests open.</h2>
          <p>
            Creating a customer account takes about two minutes and keeps your
            vehicle and contact details ready, so the day requests open you post
            instead of filling out forms. Nothing on this page submits a
            request, contacts a provider, books service, or processes a payment.
          </p>
          <ul>
            <li><span aria-hidden="true">✓</span> Your account is ready the second requests open</li>
            <li><span aria-hidden="true">✓</span> Requests reach only providers approved for that exact service</li>
            <li><span aria-hidden="true">✓</span> You decide whether to accept a quote — every time</li>
          </ul>
          <div className="hero-actions">
            <Link className="button primary" href="/account?role=customer&mode=create">
              Create customer account <span>→</span>
            </Link>
            <Link className="button secondary" href="/join">
              I fix cars — join free
            </Link>
          </div>
        </div>

        <div className="early-access-form">
          <h3>Just want the launch email?</h3>
          <p>
            Drop your address and we will write once, when customer requests open in
            Montgomery County. No account required.
          </p>
          <LaunchUpdatesForm source="customer-lander" />
        </div>
      </section>

      <section className="section lander-faq" aria-labelledby="lander-faq-heading">
        <div className="section-heading">
          <div>
            <span className="kicker">Questions people actually ask</span>
            <h2 id="lander-faq-heading">The short answers.</h2>
          </div>
          <p>
            Anything not covered here lives in the <Link className="text-link" href="/faq">full FAQ</Link>,
            or email us at <a className="text-link" href="mailto:hello@tuveloz.com">hello@tuveloz.com</a>.
          </p>
        </div>
        <div className="lander-faq-list">
          {faqs.map((item) => (
            <details key={item.question}>
              <summary>{item.question}</summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="final-cta">
        <span className="kicker light">Montgomery County, Maryland</span>
        <h2>Your car. Your quotes. Your call.</h2>
        <div>
          <Link className="button lime" href="/account?role=customer&mode=create">
            Get early access — free <span>→</span>
          </Link>
          <Link className="button ghost" href="/how-it-works">See how it works</Link>
        </div>
        <p className="final-cta-note">
          Free to join. Job requests and payments switch on at launch.
        </p>
      </section>

      <PublicSiteFooter />
    </main>
  );
}

export default async function PostJobPage() {
  if (CUSTOMER_JOB_POSTING_PAUSED) {
    return <CustomerLander />;
  }

  const [acceptanceHash, privacyHash] = await Promise.all([
    customerRequestAgreementHash(),
    customerRequestPrivacyAgreementHash(),
  ]);

  return (
    <main className="account-shell">
      <PublicSiteHeader />

      <section className="account-main">
        <div className="account-welcome">
          <span className="account-kicker">Request service</span>
          <h1>Tell us what your vehicle needs.</h1>
          <p>
            Post your request, compare quotes from local independent providers,
            and choose the one that works — or accept nothing at all.
          </p>
          <small>
            TUVELOZ does not employ, hire, train, assign, or place anyone on
            payroll. Customers select an independent provider business for an
            exact approved service.
          </small>
        </div>

        <CustomerRequestForm
          acceptanceKey={CUSTOMER_REQUEST_AGREEMENT_KEY}
          acceptanceVersion={CUSTOMER_REQUEST_AGREEMENT_VERSION}
          acceptanceHash={acceptanceHash}
          acceptanceText={CUSTOMER_REQUEST_ACCEPTANCE_TEXT}
          privacyKey={CUSTOMER_REQUEST_PRIVACY_AGREEMENT_KEY}
          privacyVersion={CUSTOMER_REQUEST_PRIVACY_AGREEMENT_VERSION}
          privacyHash={privacyHash}
          privacyText={CUSTOMER_REQUEST_PRIVACY_ACKNOWLEDGMENT_TEXT}
        />

        <div className="hero-actions" style={{ marginTop: 24 }}>
          <Link className="button primary" href="/account?role=customer&mode=create">
            Create a customer account <span>→</span>
          </Link>
          <Link className="button secondary" href="/join">
            Apply as an independent provider
          </Link>
        </div>
      </section>
    </main>
  );
}
