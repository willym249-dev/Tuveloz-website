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
    "Tell us what your car needs once and compare real prices from local pros in Montgomery County, MD. Free to ask, free to compare, and you can always say no.",
};

const valueProps = [
  {
    icon: "quote" as const,
    title: "Real prices, side by side",
    text: "No more “bring it in and we'll take a look.” You get actual numbers from actual local pros, and you read them all before you agree to anything.",
  },
  {
    icon: "open-jobs" as const,
    title: "Only the right people see it",
    text: "Your job goes to pros near you who are cleared for that exact work — not to a giant call list. Way less phone tag.",
  },
  {
    icon: "active-job" as const,
    title: "They come to your car",
    text: "Plenty of them are mobile, so they work where your car already is — your driveway, the office lot, wherever it broke down.",
  },
];

const trustPoints = [
  {
    title: "You're never stuck",
    text: "Asking is free, comparing is free, and you can walk away from every single price you get. It costs you nothing to say no thanks.",
  },
  {
    title: "Real local businesses",
    text: "Everyone here runs their own shop or truck — they don't work for us. They set their own prices and hours, and you'll see exactly who you picked.",
  },
  {
    title: "Your address stays yours",
    text: "Pros see only enough to give you a price. Your exact address and phone number go to the one person you choose, and nobody else.",
  },
  {
    title: "Our fee is right on the screen",
    text: "We add 5% to the total, listed as its own line before you confirm. It's never quietly folded into the pro's price.",
  },
];

const faqs = [
  {
    question: "What does this cost me?",
    answer:
      "Asking and comparing is free. You only pay for work you say yes to: the pro's price for the labor, plus our 5% fee listed separately. You see both before you confirm anything.",
  },
  {
    question: "Do I have to say yes to any of them?",
    answer:
      "Nope. Read them all, ask questions, and turn every one of them down if nothing feels right. It costs you nothing to walk away.",
  },
  {
    question: "Who actually does the work?",
    answer:
      "A local pro you picked yourself. We introduce the two of you and keep the paperwork straight — the work itself is between you and them.",
  },
  {
    question: "What about parts?",
    answer:
      "Prices here cover the labor, so you buy the part yourself. We'll help you pin down the exact part before the appointment, so nobody wastes a trip on the wrong one.",
  },
  {
    question: "When can I post a job?",
    answer:
      "Very soon. Local pros across Montgomery County, Maryland are signing up right now, and posting jobs opens once we've finished getting everything ready. Make your account today and you're first in line — signing up does not submit a request, contact a provider, book service, or charge you.",
  },
  {
    question: "My car needs something that's not on the list. Now what?",
    answer:
      "Tell us anyway! The jobs people ask about most are the ones we add next, and the areas people ask about decide where we go after Montgomery County.",
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
            Almost open · Montgomery County, MD
          </div>
          <h1>
            Car trouble.
            <br />
            <span className="hero-value-line">Real prices. Zero guesswork.</span>
          </h1>
          <p>
            Tell us what&apos;s going on with your car. Local pros send you their
            price, you line them up next to each other, and you pick. No calling five
            shops, no surprise number when you go to pay.
          </p>
          <ul className="hero-highlights">
            <li><span aria-hidden="true">✓</span> Free to ask, free to compare</li>
            <li><span aria-hidden="true">✓</span> Real local pros, not a call center</li>
            <li><span aria-hidden="true">✓</span> Say yes only if the price feels right</li>
          </ul>
          <div className="hero-actions">
            <Link className="button primary" href="/account?role=customer&mode=create">
              Save my spot — free <span>→</span>
            </Link>
            <a className="button secondary" href="#how-it-works">
              See how it works <span>→</span>
            </a>
            <Link className="button ai" href="/ai">
              Open Tuveloz AI <span>✦</span>
            </Link>
          </div>
          <div className="hero-launch-note">
            <strong>
              Local pros are joining now. You&apos;ll be able to post a job the day we
              open, and early sign-ups go first.
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
            A sneak peek, not a real job — this is what comparing prices will look like. Customer requests and quotes open at launch.
          </p>
        </div>
      </section>

      <section className="proof-strip" aria-label="What Tuveloz promises customers">
        <span><b>Free</b> to ask and to compare prices</span>
        <span><b>No pressure</b> — say yes only if you want to</span>
        <span><b>5% fee</b> shown on its own line before you confirm</span>
        <span><b>Montgomery County</b> Maryland, more areas next</span>
      </section>

      <section className="section lander-value" aria-labelledby="lander-value-heading">
        <div className="section-heading">
          <div>
            <span className="kicker">Why customers use Tuveloz</span>
            <h2 id="lander-value-heading">Stop guessing what a repair should cost.</h2>
          </div>
          <p>
            The worst part of car trouble usually isn&apos;t the repair — it&apos;s not
            knowing if the price is fair. We put that answer in front of you before you
            agree to anything.
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
          <h2>Three steps. That&apos;s the whole thing.</h2>
          <p>
            You can&apos;t post a job just yet. Set up your account now and step one
            takes about a minute the day we open.
          </p>
          <Link className="text-link" href="/how-it-works">See it in more detail →</Link>
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
            These are the jobs we&apos;re starting with in Montgomery County. We turn
            them on one at a time as we&apos;re ready, and we&apos;ll email you the
            moment yours is live.
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
          <h2 id="lander-trust-heading">There&apos;s no catch here.</h2>
          <p className="trust-intro-text">
            Before you sign up for anything, here&apos;s exactly what we do and what we
            don&apos;t — in plain words.
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
          <span className="kicker">Save your spot</span>
          <h2>Be first in line when we open.</h2>
          <p>
            Making an account takes about two minutes and saves your car and
            contact details, so the day we open you can just post instead of
            filling out forms. Nothing on this page submits a
            request, contacts a provider, books service, or processes a payment.
          </p>
          <ul>
            <li><span aria-hidden="true">✓</span> Ready to go the second we open</li>
            <li><span aria-hidden="true">✓</span> Only pros cleared for that exact job see it</li>
            <li><span aria-hidden="true">✓</span> Saying yes to a price is always your call</li>
          </ul>
          <div className="hero-actions">
            <Link className="button primary" href="/account?role=customer&mode=create">
              Save my spot — free <span>→</span>
            </Link>
            <Link className="button secondary" href="/join">
              I do car work — apply free
            </Link>
          </div>
        </div>

        <div className="early-access-form">
          <h3>Just want an email when we open?</h3>
          <p>
            Leave your address and we&apos;ll write you once, the day we open in
            Montgomery County. No account needed.
          </p>
          <LaunchUpdatesForm source="customer-lander" />
        </div>
      </section>

      <section className="section lander-faq" aria-labelledby="lander-faq-heading">
        <div className="section-heading">
          <div>
            <span className="kicker">Questions people actually ask</span>
            <h2 id="lander-faq-heading">Straight answers, no fine print.</h2>
          </div>
          <p>
            Don&apos;t see yours? There&apos;s more in the <Link className="text-link" href="/faq">full FAQ</Link>,
            or just email us at <a className="text-link" href="mailto:hello@tuveloz.com">hello@tuveloz.com</a> — a real person answers.
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
            Save my spot — free <span>→</span>
          </Link>
          <Link className="button ghost" href="/how-it-works">See how it works</Link>
        </div>
        <p className="final-cta-note">
          Free to join. Posting a job and paying through us starts the day we open.
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
          <h1>Tell us what your car needs.</h1>
          <p>
            Post it once, compare prices from local pros, and pick the one you
            like — or none of them. Up to you.
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
