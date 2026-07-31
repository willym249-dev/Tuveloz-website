import Link from "next/link";
import { BrandMark } from "../components/tuveloz-icons";

export default function FirstOilChangeOfferPage() {
  return (
    <main className="legal-page">
      <header className="legal-header">
        <Link className="brand" href="/"><BrandMark />Tuveloz</Link>
        <Link className="button secondary" href="/customer">Customer workspace</Link>
      </header>
      <article className="legal-card">
        <span className="kicker">New-account offer</span>
        <h1>No Tuveloz service fee on your first qualifying oil change</h1>
        <p>
          Create a Tuveloz customer account, then post a qualifying oil-change request.
          When the offer applies, Tuveloz automatically sets its customer marketplace
          service fee to $0 for every provider quote on that one request.
        </p>
        <section>
          <h2>What is waived</h2>
          <p>Only the Tuveloz customer service fee for one qualifying oil-change booking.</p>
        </section>
        <section>
          <h2>What is not waived</h2>
          <p>
            The independent provider&apos;s labor, oil, filter, other parts, taxes, disposal,
            travel, shop fees, additional work, and any other provider charges remain due.
          </p>
        </section>
        <section>
          <h2>Basic eligibility</h2>
          <ul>
            <li>One offer per verified customer account.</li>
            <li>The qualifying request must be created after the account is created.</li>
            <li>The request must include an oil-change service and cannot be a test job.</li>
            <li>The offer is attached to the first qualifying request and cannot be exchanged for cash.</li>
            <li>Tuveloz may prevent duplicate, abusive, or fraudulent use.</li>
          </ul>
        </section>
        <p>
          Tuveloz is a marketplace and does not perform the oil change. The customer still
          chooses an independent provider and approves that provider&apos;s quote.
        </p>
        <div className="legal-actions">
          <Link className="button primary" href="/post-job">Post an oil-change request</Link>
          <Link className="button secondary" href="/notifications">Check offer status</Link>
        </div>
      </article>
    </main>
  );
}