"use client";

import { InterfaceCopy } from "./interface-copy";
import { SiteLink as Link } from "./site-link";
import { CUSTOMER_STEPS, LAUNCH_SERVICES } from "../../lib/marketing-content";
import { LaunchUpdatesForm } from "./launch-updates-form";
import { PublicSiteFooter, PublicSiteHeader } from "./public-chrome";
import { SaveMySpotButton } from "./save-my-spot-button";
import { SignedInReturnNote } from "./signed-in-return-note";
import { TuvelozIcon } from "./tuveloz-icons";

const valueProps = [
  {
    icon: "quote" as const,
    title: "Real prices, side by side",
    text: "Compare the price and work described in each quote. If a provider needs more information or an in-person assessment, you can discuss that before agreeing to service.",
  },
  {
    icon: "open-jobs" as const,
    title: "Only the right people see it",
    text: "Your job goes to pros near you who are cleared for that exact work — not to a giant call list. Way less phone tag.",
  },
  {
    icon: "active-job" as const,
    title: "Options for where the work happens",
    text: "For eligible services, a mobile provider may be able to come to you. The provider confirms whether your location is suitable before the appointment.",
  },
];

const trustPoints = [
  {
    title: "You're never stuck",
    text: "Asking is free, comparing is free, and you can walk away from every single price you get. It costs you nothing to say no thanks.",
  },
  {
    title: "Real local businesses",
    text: "Providers set their own prices and hours. They work independently of Tuveloz, and you choose whose services fit your needs.",
  },
  {
    title: "Your address stays yours",
    text: "Eligible providers see the request details needed to quote. Your contact details are shared with your selected provider for the job, as described in our privacy policy.",
  },
  {
    title: "Planned customer fee, shown clearly",
    text: "Example at the planned 5% rate: a $200 labor quote would show a $10 Tuveloz customer service fee, for a $210 total. Final launch pricing and tax treatment remain under review; you'll see the full total before accepting.",
  },
];

const faqs = [
  {
    question: "What does this cost me?",
    answer:
      "Asking and comparing will be free. If you accept a job after launch, the current plan is the pro's labor price plus a separate 5% Tuveloz customer service fee. Final launch pricing and tax treatment are still under review, and you'll see the full total before confirming anything.",
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
      "For customer-supplied parts, discuss the exact part and compatibility with your provider before the appointment. The quote should explain what work and costs are included.",
  },
  {
    question: "When can I post a job?",
    answer:
      "We haven't announced a launch date. Provider applications are open while we complete the required reviews. You can create a free account now; this does not submit a request, contact a provider, book service, or charge you.",
  },
  {
    question: "My car needs something that's not on the list. Now what?",
    answer:
      "Please tell us what you need. Your suggestions help us understand which services and areas to consider as Tuveloz grows.",
  },
];

export function CustomerLander() {
  return (
    <InterfaceCopy><main className="public-site lander-page">
      <PublicSiteHeader />

      <section className="hero" id="top">
        <div className="hero-glow" />
        <div className="hero-copy">
          <SignedInReturnNote />
          <div className="eyebrow">
            <span className="pulse" />
            Customer launch is in preparation · Montgomery County, MD
          </div>
          <h1>
            Car care should feel less stressful.
            <br />
            <span className="hero-value-line">Local help. A choice you feel good about.</span>
          </h1>
          <p>
            We&apos;re building Tuveloz to help neighbors in Montgomery County find local vehicle services, compare quotes, and ask questions before choosing someone. You can create a free account today. Customer bookings are not open yet.
          </p>
          <ul className="hero-highlights">
            <li><span aria-hidden="true">✓</span> Free to create your account</li>
            <li><span aria-hidden="true">✓</span> Independent local businesses, no call center</li>
            <li><span aria-hidden="true">✓</span> When we open, you decide who to hire — or no one</li>
          </ul>
          <div className="hero-actions">
            <SaveMySpotButton />
            <a className="button secondary" href="#how-it-works">
              See how it works <span>→</span>
            </a>
            <Link className="button ai" href="/ai">
              Get answers <span>✦</span>
            </Link>
          </div>
          <div className="hero-launch-note">
            <strong>
              We&apos;re onboarding providers for the services customers will need.
              Customer requests open once the marketplace is ready.
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
              <small>Example mobile provider · preview</small>
            </article>
            <article className="quote-ticket qt-2">
              <div className="qt-head"><span>JOB #4471</span><b>Preview</b></div>
              <strong>Battery replacement</strong>
              <span className="qt-price">$96</span>
              <small>Example local provider · preview</small>
            </article>
            <article className="quote-ticket qt-3 qt-selected">
              <div className="qt-head"><span>JOB #4471</span><b>Planned pick</b></div>
              <strong>Battery replacement</strong>
              <span className="qt-price">$96</span>
              <small>Example local provider · preview</small>
              <span className="qt-stamp">YOU CHOOSE</span>
            </article>
          </div>
          <p className="hero-visual-caption">
            A sneak peek, not a real job — this is what comparing prices will look like. Customer requests and quotes open at launch.
          </p>
        </div>
      </section>

      <section className="proof-strip" aria-label="What Tuveloz promises customers">
        <span><b>Free</b> to create your account</span>
        <span><b>Independent</b> local businesses, no call center</span>
        <span><b>Your choice</b> when customer requests open</span>
        <span><b>No launch date yet</b> — we open when coverage is ready</span>
      </section>

      <section className="section lander-value" aria-labelledby="lander-value-heading">
        <div className="section-heading">
          <div>
            <span className="kicker">Why customers use Tuveloz</span>
            <h2 id="lander-value-heading">Stop guessing what a repair should cost.</h2>
          </div>
          <p>
            An unexpected car problem can leave you with plenty of questions. Tuveloz is being built so you can compare the quotes you receive and understand what is included before deciding.
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
          <h2>Here&apos;s how it will work.</h2>
          <p>
            Once customer requests open, you&apos;ll be able to share what you need and hear from eligible local providers. For now, you can create your account and explore.
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
            <span className="kicker">Services planned for launch</span>
            <h2>Help with the little things that keep you going.</h2>
          </div>
          <p>
            We&apos;re preparing these services for Montgomery County. Each will open when the right providers and required reviews are in place.
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
          <h2 id="lander-trust-heading">Know what to expect before you join.</h2>
          <p className="trust-intro-text">
            A few things we want you to feel comfortable with: how you choose, how your information is shared, and what a service would cost.
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

      <section className="launch-help-section" aria-labelledby="launch-help-heading">
        <div>
          <span className="kicker">Need help today?</span>
          <h2 id="launch-help-heading">If your car needs attention today</h2>
        </div>
        <div>
          <p>
            Tuveloz isn&apos;t dispatching service requests yet. If your car trouble is
            urgent or the vehicle may be unsafe to drive, contact a local shop or
            mobile mechanic directly, or call a licensed towing service.
          </p>
          <p>
            If you&apos;re not sure whether it&apos;s safe to drive, have the vehicle checked
            before continuing your trip.
          </p>
          <Link className="text-link" href="/account?role=customer&mode=create">
            Join the list for launch updates →
          </Link>
        </div>
      </section>

      <section className="section early-access" id="early-access">
        <div className="early-access-copy">
          <span className="kicker">Start when you are ready</span>
          <h2>Get to know Tuveloz before we open.</h2>
          <p>
            Create a free account and add your vehicle details when you are ready. You can take your time getting familiar with Tuveloz before bookings open. Nothing on this page submits a request, contacts a provider, books service, or processes a payment.
          </p>
          <ul>
            <li><span aria-hidden="true">✓</span> Create your account before launch</li>
            <li><span aria-hidden="true">✓</span> Only pros cleared for that exact job see it</li>
            <li><span aria-hidden="true">✓</span> Saying yes to a price is always your call</li>
          </ul>
          <div className="hero-actions">
            <SaveMySpotButton />
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
          <SaveMySpotButton className="button lime" />
          <Link className="button ghost" href="/how-it-works">See how it works</Link>
        </div>
        <p className="final-cta-note">
          Free to join. Posting a job and paying through us starts the day we open.
        </p>
      </section>

      <PublicSiteFooter />
    </main></InterfaceCopy>
  );
}

